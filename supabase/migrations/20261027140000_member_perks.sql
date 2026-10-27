-- Member perks (overnight review, 2026-10-27).
--  1. Monthly free putts: Clover Club 3, Gold 7, once per calendar month (US Eastern). The app claims them
--     when the player opens Lucky Putts; a repeat call in the same month gives nothing.
--  2. Coach Ace daily cap: coach-chat asks coach_chat_take() before calling OpenAI (40 questions a day),
--     so one account can't run up the AI bill.
-- To roll back: DROP FUNCTION public.claim_member_putts(), public.coach_chat_take(integer);
-- DROP TABLE public.member_putt_grants, public.coach_chat_usage;

CREATE TABLE IF NOT EXISTS public.member_putt_grants (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  tier TEXT NOT NULL,
  putts INTEGER NOT NULL CHECK (putts >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);
ALTER TABLE public.member_putt_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_putt_grants_own_read ON public.member_putt_grants;
CREATE POLICY member_putt_grants_own_read ON public.member_putt_grants FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.member_putt_grants FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_member_putts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tier TEXT;
  v_putts INTEGER;
  v_month DATE := date_trunc('month', now() AT TIME ZONE 'America/New_York')::date;
  v_inserted INTEGER;
  v_credits INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  SELECT coalesce(to_jsonb(gp) ->> 'membership_tier', 'free') INTO v_tier FROM public.golfer_profiles gp WHERE gp.user_id = v_uid;
  v_putts := CASE v_tier WHEN 'gold' THEN 7 WHEN 'clover' THEN 3 ELSE 0 END;
  IF v_putts = 0 THEN
    RETURN jsonb_build_object('success', true, 'granted', 0, 'reason', 'not_member');
  END IF;

  INSERT INTO public.member_putt_grants (user_id, month, tier, putts)
  VALUES (v_uid, v_month, v_tier, v_putts)
  ON CONFLICT (user_id, month) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('success', true, 'granted', 0, 'reason', 'already_claimed', 'month', v_month);
  END IF;

  UPDATE public.golfer_profiles SET putt_credits = putt_credits + v_putts, updated_at = now()
  WHERE user_id = v_uid RETURNING putt_credits INTO v_credits;
  RETURN jsonb_build_object('success', true, 'granted', v_putts, 'credits', v_credits, 'month', v_month);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_member_putts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_member_putts() TO authenticated;

CREATE TABLE IF NOT EXISTS public.coach_chat_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  questions INTEGER NOT NULL DEFAULT 0 CHECK (questions >= 0),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.coach_chat_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS coach_chat_usage_own_read ON public.coach_chat_usage;
CREATE POLICY coach_chat_usage_own_read ON public.coach_chat_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.coach_chat_usage FROM anon, authenticated;

-- One question used; false when today's allowance is gone.
CREATE OR REPLACE FUNCTION public.coach_chat_take(p_limit INTEGER DEFAULT 40)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_day DATE := (now() AT TIME ZONE 'America/New_York')::date;
  v_used INTEGER;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  INSERT INTO public.coach_chat_usage (user_id, day, questions) VALUES (v_uid, v_day, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET questions = public.coach_chat_usage.questions + 1
  WHERE public.coach_chat_usage.questions < least(greatest(coalesce(p_limit, 40), 1), 200)
  RETURNING questions INTO v_used;
  RETURN v_used IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.coach_chat_take(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_chat_take(INTEGER) TO authenticated;
