-- Spinz prizes that need a person (overnight review, 2026-10-27).
-- Physical prizes (Lucky Wedge / Putter / Driver) and Clover Club months are only logged by the wheel; nothing
-- tracked whether anyone shipped or activated them. Admins now get a queue, can mark each one done, and can
-- set a player's membership tier (which players can no longer change themselves).
-- To roll back: DROP FUNCTION public.admin_spin_prizes(text), public.admin_fulfill_spin_prize(bigint, text),
-- public.admin_set_membership_tier(uuid, text); ALTER TABLE public.spin_log DROP COLUMN fulfilled_at,
-- DROP COLUMN fulfilled_by, DROP COLUMN fulfillment_note;

ALTER TABLE public.spin_log
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fulfilled_by UUID,
  ADD COLUMN IF NOT EXISTS fulfillment_note TEXT CHECK (fulfillment_note IS NULL OR char_length(fulfillment_note) <= 300);

CREATE INDEX IF NOT EXISTS spin_log_open_prizes ON public.spin_log (created_at)
  WHERE kind IN ('prize', 'membership') AND fulfilled_at IS NULL;

CREATE OR REPLACE FUNCTION public._is_admin(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.golfer_profiles WHERE user_id = p_user AND role IN ('admin', 'super_admin')) $$;
REVOKE ALL ON FUNCTION public._is_admin(UUID) FROM PUBLIC, anon, authenticated;

-- p_status: 'open' (not yet done) or 'done'
CREATE OR REPLACE FUNCTION public.admin_spin_prizes(p_status TEXT DEFAULT 'open')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public._is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  RETURN jsonb_build_object('success', true, 'prizes', coalesce((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at)
    FROM (
      SELECT sl.id, sl.user_id, sl.kind, sl.label, sl.created_at, sl.fulfilled_at, sl.fulfillment_note,
             gp.display_name, to_jsonb(gp) ->> 'membership_tier' AS membership_tier, u.email
      FROM public.spin_log sl
      LEFT JOIN public.golfer_profiles gp ON gp.user_id = sl.user_id
      LEFT JOIN auth.users u ON u.id = sl.user_id
      WHERE sl.kind IN ('prize', 'membership')
        AND (CASE WHEN p_status = 'done' THEN sl.fulfilled_at IS NOT NULL ELSE sl.fulfilled_at IS NULL END)
      ORDER BY sl.created_at
      LIMIT 200
    ) r
  ), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_fulfill_spin_prize(p_id BIGINT, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public._is_admin(v_admin) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  UPDATE public.spin_log
  SET fulfilled_at = now(), fulfilled_by = v_admin, fulfillment_note = nullif(left(trim(coalesce(p_note, '')), 300), '')
  WHERE id = p_id AND kind IN ('prize', 'membership') AND fulfilled_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prize not found or already done');
  END IF;
  INSERT INTO public.admin_audit_log (admin_user_id, action, entity_type, after)
  VALUES (v_admin, 'fulfill_spin_prize', 'spin_log', jsonb_build_object('spin_log_id', p_id, 'note', p_note));
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_membership_tier(p_user UUID, p_tier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_before TEXT;
BEGIN
  IF v_admin IS NULL OR NOT public._is_admin(v_admin) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF p_tier NOT IN ('free', 'clover', 'gold') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tier must be free, clover or gold');
  END IF;
  SELECT membership_tier INTO v_before FROM public.golfer_profiles WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;
  UPDATE public.golfer_profiles SET membership_tier = p_tier, updated_at = now() WHERE user_id = p_user;
  INSERT INTO public.admin_audit_log (admin_user_id, action, entity_type, entity_id, before, after)
  VALUES (v_admin, 'set_membership_tier', 'user', p_user, jsonb_build_object('tier', v_before), jsonb_build_object('tier', p_tier));
  RETURN jsonb_build_object('success', true, 'tier', p_tier);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_spin_prizes(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_spin_prizes(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_fulfill_spin_prize(BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_fulfill_spin_prize(BIGINT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_membership_tier(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_membership_tier(UUID, TEXT) TO authenticated;
