-- Fan content: players upload 3 photos + 1 short video the company may use. An admin reviews each
-- set; on approval the player earns 1 clover (= 1 raffle entry), once.
--   * Files live in a private storage bucket, one folder per player; only that player and admins can open them.
--   * Players can only send submissions through submit_content_submission() (limits: 3 waiting, 3 a day).
--   * Approving / rejecting is admin-only.
-- To roll back: DROP TABLE public.content_submissions CASCADE; drop the four functions below;
-- DELETE FROM storage.buckets WHERE id = 'content-submissions' (after emptying it).

CREATE TABLE public.content_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_paths TEXT[] NOT NULL CHECK (cardinality(photo_paths) = 3),
  video_path TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason TEXT CHECK (reject_reason IS NULL OR char_length(reject_reason) <= 300),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  clover_awarded BOOLEAN NOT NULL DEFAULT false,
  drive_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX content_submissions_status_created ON public.content_submissions (status, created_at);
CREATE INDEX content_submissions_user ON public.content_submissions (user_id, created_at);

ALTER TABLE public.content_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_submissions_own_read ON public.content_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.content_submissions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin_me()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.golfer_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')) $$;

-- Private bucket. 50 MB is the per-file ceiling on the current Supabase plan.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('content-submissions', 'content-submissions', false, 52428800,
        ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY content_submissions_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY content_submissions_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'content-submissions' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin_me()));

-- ---------------------------------------------------------------------------
-- Player: send a set (files are uploaded first, into the player's own folder)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_content_submission(p_photo_paths TEXT[], p_video_path TEXT, p_terms_version TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prefix TEXT;
  v_path TEXT;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  v_prefix := v_uid::text || '/';
  IF p_terms_version IS NULL OR char_length(trim(p_terms_version)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please accept the terms first');
  END IF;
  IF p_photo_paths IS NULL OR cardinality(p_photo_paths) <> 3 OR p_video_path IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add 3 photos and 1 short video');
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_photo_paths) x) <> 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add 3 different photos');
  END IF;
  FOREACH v_path IN ARRAY (p_photo_paths || p_video_path) LOOP
    IF left(v_path, char_length(v_prefix)) <> v_prefix OR v_path LIKE '%..%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid file');
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id = 'content-submissions' AND name = ANY (p_photo_paths || p_video_path)) <> 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Upload did not finish. Please try again.');
  END IF;
  IF (SELECT count(*) FROM public.content_submissions WHERE user_id = v_uid AND status = 'pending') >= 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have 3 sets waiting for review. We will get to them soon!');
  END IF;
  IF (SELECT count(*) FROM public.content_submissions WHERE user_id = v_uid AND created_at > now() - interval '1 day') >= 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'That is plenty for today. Try again tomorrow.');
  END IF;
  INSERT INTO public.content_submissions (user_id, photo_paths, video_path, terms_version)
  VALUES (v_uid, p_photo_paths, p_video_path, trim(p_terms_version))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_content_submissions(p_status TEXT DEFAULT 'pending')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_me() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  RETURN jsonb_build_object('success', true, 'submissions', coalesce((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at) FROM (
      SELECT cs.id, cs.photo_paths, cs.video_path, cs.terms_version, cs.status, cs.reject_reason, cs.created_at, cs.drive_synced_at,
             gp.display_name AS submitted_by
      FROM public.content_submissions cs LEFT JOIN public.golfer_profiles gp ON gp.user_id = cs.user_id
      WHERE cs.status = p_status ORDER BY cs.created_at LIMIT 100
    ) r), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_content_submission(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  r public.content_submissions;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin_me() THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthorized'); END IF;
  SELECT * INTO r FROM public.content_submissions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Submission not found'); END IF;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'This submission was already ' || r.status); END IF;

  UPDATE public.content_submissions
  SET status = 'approved', reviewed_by = v_admin, reviewed_at = now(), clover_awarded = true
  WHERE id = p_id;

  -- 1 clover to the submitter, once (the status check above makes a repeat impossible).
  UPDATE public.golfer_profiles SET clovers = clovers + 1, total_clovers = total_clovers + 1, updated_at = now() WHERE user_id = r.user_id;
  -- A clover is a raffle entry. In the older raffle setup entries are added here; after the weekly-raffle
  -- migration a trigger adds them and this call is a harmless no-op.
  PERFORM public.award_jackpot_entry(r.user_id, 1);

  INSERT INTO public.admin_audit_log (admin_user_id, action, entity_type, entity_id, after)
  VALUES (v_admin, 'approve_content_submission', 'content_submission', p_id, jsonb_build_object('user_id', r.user_id));
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_content_submission(p_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_status TEXT;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin_me() THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthorized'); END IF;
  SELECT status INTO v_status FROM public.content_submissions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Submission not found'); END IF;
  IF v_status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'This submission was already ' || v_status); END IF;
  UPDATE public.content_submissions
  SET status = 'rejected', reject_reason = nullif(left(trim(coalesce(p_reason, '')), 300), ''), reviewed_by = v_admin, reviewed_at = now()
  WHERE id = p_id;
  INSERT INTO public.admin_audit_log (admin_user_id, action, entity_type, entity_id, after)
  VALUES (v_admin, 'reject_content_submission', 'content_submission', p_id, jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_content_submission(TEXT[], TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_content_submission(TEXT[], TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_content_submissions(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_content_submissions(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_approve_content_submission(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_content_submission(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_reject_content_submission(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_content_submission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_me() TO authenticated;
