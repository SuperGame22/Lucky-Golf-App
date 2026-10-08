-- Home-page clover reveal.
--
-- Clovers are credited the moment money is spent, but the Home page should not show them
-- until the player actually looks at it: then the new clovers "light up" leaf by leaf and the
-- count (and the weekly count) goes up one clover at a time. To make that survive reloads
-- and other devices, the server remembers how many clovers the Home page has already shown.
--
--   seen_total  = golfer_profiles.total_clovers as of the last completed reveal
--   pending     = total_clovers - seen_total   (what the next Home view will animate)
--   week_count  = clovers revealed so far this week (Monday-based); starts over each week
--
-- First time a player is seen, seen_total starts at their current total, so existing
-- players do not get their whole history replayed.
--
-- Players cannot write the table. get_home_clovers() reads (and creates the row);
-- ack_home_clovers() records a finished reveal and can only move forward, up to total_clovers.
--
-- To roll back: DROP FUNCTION public.get_home_clovers(); DROP FUNCTION public.ack_home_clovers(integer);
--               DROP TABLE public.home_clover_state;

DO $$
BEGIN
  IF to_regclass('public.golfer_profiles') IS NULL THEN
    RAISE EXCEPTION 'Home clover migration: public.golfer_profiles not found';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'golfer_profiles'
        AND column_name IN ('user_id', 'clovers', 'total_clovers')) <> 3 THEN
    RAISE EXCEPTION 'Home clover migration: golfer_profiles needs user_id, clovers and total_clovers columns';
  END IF;
END $$;

CREATE TABLE public.home_clover_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seen_total INTEGER NOT NULL DEFAULT 0 CHECK (seen_total >= 0),
  week_start DATE NOT NULL DEFAULT (date_trunc('week', now() AT TIME ZONE 'UTC'))::date,
  week_count INTEGER NOT NULL DEFAULT 0 CHECK (week_count >= 0),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.home_clover_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own home clover state"
  ON public.home_clover_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.home_clover_state FROM anon, authenticated;

-- Shared by both functions: the state row for a player, rolled over to this week.
CREATE OR REPLACE FUNCTION public._home_clover_state(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clovers INTEGER;
  v_total INTEGER;
  v_this_week DATE := (date_trunc('week', now() AT TIME ZONE 'UTC'))::date;
  v_state public.home_clover_state;
BEGIN
  SELECT clovers, total_clovers INTO v_clovers, v_total
  FROM public.golfer_profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  INSERT INTO public.home_clover_state (user_id, seen_total, week_start, week_count)
  VALUES (p_user_id, v_total, v_this_week, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- New week: the weekly count starts over.
  UPDATE public.home_clover_state
  SET week_start = v_this_week, week_count = 0, updated_at = now()
  WHERE user_id = p_user_id AND week_start < v_this_week;

  SELECT * INTO v_state FROM public.home_clover_state WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'clovers', v_clovers,
    'total', v_total,
    'seen_total', v_state.seen_total,
    'pending', greatest(v_total - v_state.seen_total, 0),
    'week_count', v_state.week_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public._home_clover_state(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_home_clovers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  RETURN public._home_clover_state(auth.uid());
END;
$$;

-- Records a finished reveal: everything up to p_seen_total (never beyond what the player
-- really has) counts as shown, and the weekly count goes up by that many clovers.
CREATE OR REPLACE FUNCTION public.ack_home_clovers(p_seen_total INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_total INTEGER;
  v_old INTEGER;
  v_new INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_seen_total IS NULL OR p_seen_total < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  -- Creates the row and rolls the week over.
  PERFORM public._home_clover_state(v_uid);

  SELECT total_clovers INTO v_total FROM public.golfer_profiles WHERE user_id = v_uid;
  SELECT seen_total INTO v_old FROM public.home_clover_state WHERE user_id = v_uid FOR UPDATE;

  v_new := least(greatest(v_old, p_seen_total), v_total);

  UPDATE public.home_clover_state
  SET seen_total = v_new,
      week_count = week_count + greatest(v_new - v_old, 0),
      updated_at = now()
  WHERE user_id = v_uid;

  RETURN public._home_clover_state(v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.get_home_clovers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ack_home_clovers(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_home_clovers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ack_home_clovers(INTEGER) TO authenticated;
