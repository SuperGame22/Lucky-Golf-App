-- Course requests: players upload a scorecard photo for a course that is missing; admin reads it, enters
-- the pars, and approves it into the courses table. The submitter earns 1 clover when it is approved.
--   * Photos live in a private storage bucket, one folder per player; only that player and admins can open them.
--   * Players can only send requests through submit_course_request() (limits: 5 waiting, 10 a day).
--   * Approving is admin-only, creates the course, and grants the clover exactly once per request.
-- To roll back: DROP TABLE public.course_requests CASCADE; DROP FUNCTION the four functions below;
-- DELETE FROM storage.buckets WHERE id = 'course-scorecards' (after emptying it).

DO $$
DECLARE
  v_missing TEXT[];
  v_required TEXT[];
BEGIN
  IF to_regclass('public.courses') IS NULL THEN RAISE EXCEPTION 'Course requests migration: courses table not found'; END IF;
  IF to_regclass('public.golfer_profiles') IS NULL OR to_regclass('public.admin_audit_log') IS NULL THEN
    RAISE EXCEPTION 'Course requests migration: golfer_profiles and admin_audit_log are required';
  END IF;
  SELECT array_agg(c) INTO v_missing FROM unnest(ARRAY['id', 'name', 'city', 'state', 'holes', 'par', 'hole_data']) c
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'courses' AND column_name = c);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Course requests migration: courses is missing columns: %', array_to_string(v_missing, ', ');
  END IF;
  -- Any other required column would make approving fail later, so refuse now and say which.
  SELECT array_agg(column_name::text) INTO v_required FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'courses' AND is_nullable = 'NO' AND column_default IS NULL
    AND is_identity = 'NO' AND is_generated = 'NEVER'
    AND column_name NOT IN ('id', 'name', 'city', 'state', 'holes', 'par', 'hole_data');
  IF v_required IS NOT NULL THEN
    RAISE EXCEPTION 'Course requests migration: courses has other required columns (%). Tell Claude so approving can fill them.', array_to_string(v_required, ', ');
  END IF;
END $$;

CREATE TABLE public.course_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL CHECK (char_length(course_name) BETWEEN 2 AND 120),
  city TEXT CHECK (city IS NULL OR char_length(city) <= 80),
  state TEXT NOT NULL CHECK (char_length(state) BETWEEN 2 AND 40),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  photo_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  course_id BIGINT,
  reject_reason TEXT CHECK (reject_reason IS NULL OR char_length(reject_reason) <= 300),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  clover_awarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX course_requests_status_created ON public.course_requests (status, created_at);
CREATE INDEX course_requests_user ON public.course_requests (user_id, created_at);

ALTER TABLE public.course_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_requests_own_read ON public.course_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.course_requests FROM anon, authenticated;

-- Only ever answers about the caller, so it is safe to expose (the storage policy below needs to call it).
CREATE OR REPLACE FUNCTION public.is_admin_me()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.golfer_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')) $$;

-- ---------------------------------------------------------------------------
-- Player: send a request (the photo is uploaded first, into the player's own folder)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_course_request(p_name TEXT, p_city TEXT, p_state TEXT, p_notes TEXT, p_photo_path TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF char_length(trim(coalesce(p_name, ''))) < 2 OR char_length(trim(coalesce(p_state, ''))) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add the course name and state');
  END IF;
  IF p_photo_path IS NULL OR left(p_photo_path, char_length(v_uid::text) + 1) <> v_uid::text || '/' OR p_photo_path LIKE '%..%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add a photo of the scorecard');
  END IF;
  IF (SELECT count(*) FROM public.course_requests WHERE user_id = v_uid AND status = 'pending') >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have 5 requests waiting. We will get to them soon!');
  END IF;
  IF (SELECT count(*) FROM public.course_requests WHERE user_id = v_uid AND created_at > now() - interval '1 day') >= 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'That is plenty for today. Try again tomorrow.');
  END IF;
  INSERT INTO public.course_requests (user_id, course_name, city, state, notes, photo_path)
  VALUES (v_uid, trim(p_name), nullif(trim(coalesce(p_city, '')), ''), trim(p_state), nullif(trim(coalesce(p_notes, '')), ''), p_photo_path)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_course_requests(p_status TEXT DEFAULT 'pending')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_me() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  RETURN jsonb_build_object('success', true, 'requests', coalesce((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at) FROM (
      SELECT cr.id, cr.course_name, cr.city, cr.state, cr.notes, cr.photo_path, cr.status, cr.reject_reason, cr.created_at,
             gp.display_name AS submitted_by
      FROM public.course_requests cr LEFT JOIN public.golfer_profiles gp ON gp.user_id = cr.user_id
      WHERE cr.status = p_status ORDER BY cr.created_at LIMIT 100
    ) r), '[]'::jsonb));
END;
$$;

-- p_hole_data: [{ hole: 1, par: 4, yards_est: 380 }, ...] for 9 or 18 holes (yards optional).
CREATE OR REPLACE FUNCTION public.admin_approve_course_request(p_id UUID, p_name TEXT, p_city TEXT, p_state TEXT, p_hole_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  r public.course_requests;
  v_n INTEGER;
  h JSONB;
  v_par INTEGER := 0;
  v_i INTEGER := 0;
  v_course BIGINT;
  v_name TEXT := trim(coalesce(p_name, ''));
  v_city TEXT := nullif(trim(coalesce(p_city, '')), '');
  v_state TEXT := trim(coalesce(p_state, ''));
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin_me() THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthorized'); END IF;
  SELECT * INTO r FROM public.course_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Request not found'); END IF;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'This request was already ' || r.status); END IF;
  IF char_length(v_name) < 2 OR char_length(v_state) < 2 THEN RETURN jsonb_build_object('success', false, 'error', 'Course name and state are required'); END IF;

  IF p_hole_data IS NULL OR jsonb_typeof(p_hole_data) <> 'array' THEN RETURN jsonb_build_object('success', false, 'error', 'Enter the holes'); END IF;
  v_n := jsonb_array_length(p_hole_data);
  IF v_n NOT IN (9, 18) THEN RETURN jsonb_build_object('success', false, 'error', 'A course has 9 or 18 holes'); END IF;
  FOR h IN SELECT * FROM jsonb_array_elements(p_hole_data) LOOP
    v_i := v_i + 1;
    IF (h->>'hole')::int IS DISTINCT FROM v_i THEN RETURN jsonb_build_object('success', false, 'error', 'Holes must be numbered 1 to ' || v_n); END IF;
    IF (h->>'par')::int NOT BETWEEN 3 AND 6 THEN RETURN jsonb_build_object('success', false, 'error', 'Hole ' || v_i || ': par must be 3 to 6'); END IF;
    IF nullif(h->>'yards_est', '') IS NOT NULL AND (h->>'yards_est')::int NOT BETWEEN 30 AND 900 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Hole ' || v_i || ': yards must be 30 to 900');
    END IF;
    v_par := v_par + (h->>'par')::int;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.courses WHERE lower(name) = lower(v_name) AND lower(coalesce(city, '')) = lower(coalesce(v_city, '')) AND lower(state) = lower(v_state)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'That course is already in the finder. Reject this request as a duplicate.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('course_requests_new_course'));
  INSERT INTO public.courses (id, name, city, state, holes, par, hole_data)
  SELECT coalesce(max(id), 0) + 1, v_name, v_city, v_state, v_n, v_par, p_hole_data FROM public.courses
  RETURNING id INTO v_course;

  UPDATE public.course_requests
  SET status = 'approved', course_id = v_course, reviewed_by = v_admin, reviewed_at = now(), clover_awarded = true
  WHERE id = p_id;

  -- 1 clover to the submitter, once (the status check above makes a repeat impossible).
  UPDATE public.golfer_profiles SET clovers = clovers + 1, total_clovers = total_clovers + 1, updated_at = now() WHERE user_id = r.user_id;

  INSERT INTO public.admin_audit_log (admin_user_id, action, entity_type, entity_id, after)
  VALUES (v_admin, 'approve_course_request', 'course_request', p_id, jsonb_build_object('course_id', v_course, 'name', v_name));
  RETURN jsonb_build_object('success', true, 'course_id', v_course);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_course_request(p_id UUID, p_reason TEXT)
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
  SELECT status INTO v_status FROM public.course_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Request not found'); END IF;
  IF v_status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'This request was already ' || v_status); END IF;
  UPDATE public.course_requests
  SET status = 'rejected', reject_reason = nullif(left(trim(coalesce(p_reason, '')), 300), ''), reviewed_by = v_admin, reviewed_at = now()
  WHERE id = p_id;
  INSERT INTO public.admin_audit_log (admin_user_id, action, entity_type, entity_id, after)
  VALUES (v_admin, 'reject_course_request', 'course_request', p_id, jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_me() TO authenticated;
REVOKE ALL ON FUNCTION public.submit_course_request(TEXT, TEXT, TEXT, TEXT, TEXT), public.admin_list_course_requests(TEXT),
  public.admin_approve_course_request(UUID, TEXT, TEXT, TEXT, JSONB), public.admin_reject_course_request(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_course_request(TEXT, TEXT, TEXT, TEXT, TEXT), public.admin_list_course_requests(TEXT),
  public.admin_approve_course_request(UUID, TEXT, TEXT, TEXT, JSONB), public.admin_reject_course_request(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage: private bucket, one folder per player. Skipped where storage does not exist.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL AND to_regclass('storage.objects') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('course-scorecards', 'course-scorecards', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
    ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 8388608;

    DROP POLICY IF EXISTS "scorecards upload own folder" ON storage.objects;
    CREATE POLICY "scorecards upload own folder" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'course-scorecards' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "scorecards read own or admin" ON storage.objects;
    CREATE POLICY "scorecards read own or admin" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'course-scorecards' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin_me()));
  END IF;
END $$;
