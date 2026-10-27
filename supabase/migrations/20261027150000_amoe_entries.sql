-- Free entry by email (AMOE, Clovers Terms section 8), recorded by an admin (overnight review, 2026-10-27).
-- An admin enters the email from a "Clovers AMOE Entry" message; the player gets the same 1 clover (= 1 raffle
-- entry) as an approved content set, at most once per weekly drawing (weeks start Monday, US Eastern).
-- To roll back: DROP FUNCTION public.admin_grant_amoe_entry(text); DROP TABLE public.amoe_entries;

CREATE TABLE IF NOT EXISTS public.amoe_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
ALTER TABLE public.amoe_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS amoe_entries_own_read ON public.amoe_entries;
CREATE POLICY amoe_entries_own_read ON public.amoe_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.amoe_entries FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_amoe_entry(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_user UUID;
  v_week DATE := date_trunc('week', now() AT TIME ZONE 'America/New_York')::date;
  v_inserted INTEGER;
BEGIN
  IF v_admin IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.golfer_profiles WHERE user_id = v_admin AND role IN ('admin', 'super_admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(trim(coalesce(p_email, ''))) LIMIT 1;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No player with that email. They need to sign up first.');
  END IF;

  INSERT INTO public.amoe_entries (user_id, week_start, granted_by) VALUES (v_user, v_week, v_admin)
  ON CONFLICT (user_id, week_start) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'This player already has a free entry for this week''s drawing.');
  END IF;

  -- Same as approving a content set: 1 clover, which is 1 raffle entry.
  UPDATE public.golfer_profiles SET clovers = clovers + 1, total_clovers = total_clovers + 1, updated_at = now()
  WHERE user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That player has no profile yet';
  END IF;
  PERFORM public.award_jackpot_entry(v_user, 1);

  INSERT INTO public.admin_audit_log (admin_user_id, action, entity_type, entity_id, after)
  VALUES (v_admin, 'grant_amoe_entry', 'user', v_user, jsonb_build_object('week_start', v_week));
  RETURN jsonb_build_object('success', true, 'week_start', v_week);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_amoe_entry(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_amoe_entry(TEXT) TO authenticated;
