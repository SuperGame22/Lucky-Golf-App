-- Clovers that players earn in the app are now granted by the database, not by the browser.
--
-- Until now the Spinz page and the scorecard credited clovers by calling add_clovers() from
-- the browser, which means any signed-in player could call it themselves with any amount
-- (up to 500 a call, unlimited calls). This migration moves both grants onto the server:
--
--   * Spinz: consume_spin(true) spends the spin AND draws the prize on the server from the
--     wheel's own table (spin_wheel_slices, a copy of the wheel in features/spinz/prizes.ts,
--     kept identical by a test). It credits clovers, a Free Putt, or a Free Spin refund
--     itself, and logs every spin in spin_log. The page only animates the answer.
--   * Rounds: award_round_clovers(round_id) gives 5 clovers for a completed round the caller
--     owns, once per round, and at most 3 rounds' worth per rolling 24 hours (change
--     c_per_round / c_daily_cap below to retune).
--
-- This step only ADDS things: add_clovers() is still callable, so the app that is live now
-- keeps working while the new app is deployed (consume_spin() with no argument behaves as
-- before, including the Free Putt roll that 20261008120000 used to add). The step that
-- actually closes add_clovers / award_clovers is 20261010130000_lock_clover_minting.sql, to
-- be run once the new app is live.
--
-- Rollback (restores consume_spin() from 20261007120000): drop function consume_spin(boolean),
-- recreate consume_spin() from that file, then drop the new tables and functions below.

DO $$
BEGIN
  IF to_regclass('public.golfer_profiles') IS NULL THEN
    RAISE EXCEPTION 'Server-side clovers: public.golfer_profiles not found';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'golfer_profiles'
        AND column_name IN ('user_id', 'spins', 'putt_credits')) <> 3 THEN
    RAISE EXCEPTION 'Server-side clovers: golfer_profiles needs user_id, spins and putt_credits columns';
  END IF;
  IF to_regprocedure('public.add_clovers(uuid, integer)') IS NULL THEN
    RAISE EXCEPTION 'Server-side clovers: public.add_clovers(uuid, integer) not found';
  END IF;
  IF to_regprocedure('public.consume_spin()') IS NULL THEN
    RAISE EXCEPTION 'Server-side clovers: public.consume_spin() not found (apply 20261007120000_putt_spins.sql first)';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rounds'
        AND column_name IN ('id', 'user_id', 'completed', 'clovers_earned')) <> 4 THEN
    RAISE EXCEPTION 'Server-side clovers: rounds needs id, user_id, completed and clovers_earned columns';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. The wheel, as data (index = position on the wheel)
-- ---------------------------------------------------------------------------
CREATE TABLE public.spin_wheel_slices (
  idx INTEGER PRIMARY KEY CHECK (idx >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('prize', 'clovers', 'discount', 'free_spin', 'free_putt', 'membership', 'none')),
  label TEXT NOT NULL,
  clovers INTEGER NOT NULL DEFAULT 0 CHECK (clovers >= 0 AND clovers <= 500),
  weight NUMERIC NOT NULL CHECK (weight > 0)
);

ALTER TABLE public.spin_wheel_slices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spin_wheel_slices FROM anon, authenticated;

INSERT INTO public.spin_wheel_slices (idx, kind, label, clovers, weight) VALUES
  (0, 'none', 'Sand Trap', 0, 1),
  (1, 'prize', 'Lucky Wedge', 0, 0.3142857143),
  (2, 'none', 'Sand Trap', 0, 1),
  (3, 'clovers', '+2 Clovers', 2, 1),
  (4, 'discount', '15% Off', 0, 1),
  (5, 'none', 'Sand Bunker', 0, 1),
  (6, 'free_spin', 'Free Spin', 0, 1),
  (7, 'clovers', '+1 Clover', 1, 1),
  (8, 'discount', '10% Off', 0, 1),
  (9, 'none', 'Sand Bunker', 0, 1),
  (10, 'discount', '25% Off', 0, 1),
  (11, 'free_putt', 'Free Putt', 0, 1),
  (12, 'none', 'Sand Trap', 0, 1),
  (13, 'prize', 'Lucky Putter', 0, 0.3142857143),
  (14, 'none', 'Sand Trap', 0, 1),
  (15, 'clovers', '+1 Clover', 1, 1),
  (16, 'clovers', '+10 Clovers', 10, 1),
  (17, 'none', 'Sand Bunker', 0, 1),
  (18, 'clovers', '+2 Clovers', 2, 1),
  (19, 'discount', '30% Off', 0, 1),
  (20, 'clovers', '+3 Clovers', 3, 1),
  (21, 'none', 'Sand Bunker', 0, 1),
  (22, 'clovers', '+5 Clovers', 5, 1),
  (23, 'discount', '20% Off', 0, 1),
  (24, 'none', 'Sand Trap', 0, 1),
  (25, 'prize', 'Lucky Driver', 0, 0.3142857143),
  (26, 'none', 'Sand Trap', 0, 1),
  (27, 'membership', '1mo Clover Club', 0, 1),
  (28, 'discount', '25% Off', 0, 1),
  (29, 'none', 'Sand Bunker', 0, 1),
  (30, 'discount', '15% Off', 0, 1),
  (31, 'clovers', '+2 Clovers', 2, 1),
  (32, 'discount', '10% Off', 0, 1),
  (33, 'none', 'Sand Bunker', 0, 1),
  (34, 'free_spin', 'Free Spin', 0, 1),
  (35, 'membership', '3mo Clover Club', 0, 1);

CREATE TABLE public.spin_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slice_idx INTEGER NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  clovers INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX spin_log_user_idx ON public.spin_log (user_id, created_at DESC);

ALTER TABLE public.spin_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own spin log"
  ON public.spin_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spin_log FROM anon, authenticated;
REVOKE USAGE, SELECT, UPDATE ON SEQUENCE public.spin_log_id_seq FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. consume_spin(): spend a spin and, for the new app, draw the prize
-- ---------------------------------------------------------------------------
-- The roll the old app used for the Free Putt (kept so the app that is live now still works).
CREATE OR REPLACE FUNCTION public.free_putt_roll()
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT random() < 0.0295;
$$;

REVOKE ALL ON FUNCTION public.free_putt_roll() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.consume_spin();

CREATE OR REPLACE FUNCTION public.consume_spin(p_server_prize BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_left INTEGER;
  v_credits INTEGER;
  v_total NUMERIC;
  v_r NUMERIC;
  v_acc NUMERIC := 0;
  v_slice public.spin_wheel_slices;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  UPDATE public.golfer_profiles
  SET spins = spins - 1, updated_at = now()
  WHERE user_id = v_uid AND spins > 0
  RETURNING spins INTO v_left;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No spins remaining');
  END IF;

  -- The app that is live before this migration's companion release: unchanged behaviour.
  IF NOT p_server_prize THEN
    IF public.free_putt_roll() THEN
      UPDATE public.golfer_profiles
      SET putt_credits = putt_credits + 1, updated_at = now()
      WHERE user_id = v_uid
      RETURNING putt_credits INTO v_credits;
      RETURN jsonb_build_object('success', true, 'spins', v_left, 'free_putt', true, 'credits', v_credits);
    END IF;
    RETURN jsonb_build_object('success', true, 'spins', v_left, 'free_putt', false);
  END IF;

  SELECT sum(weight) INTO v_total FROM public.spin_wheel_slices;
  IF v_total IS NULL OR v_total <= 0 THEN
    RAISE EXCEPTION 'Spin wheel is not configured';  -- rolls the spin back
  END IF;

  v_r := random() * v_total;
  FOR v_slice IN SELECT * FROM public.spin_wheel_slices ORDER BY idx LOOP
    v_acc := v_acc + v_slice.weight;
    EXIT WHEN v_r < v_acc;
  END LOOP;

  v_result := jsonb_build_object('success', true, 'slice', v_slice.idx, 'kind', v_slice.kind, 'clovers', v_slice.clovers);

  IF v_slice.kind = 'clovers' AND v_slice.clovers > 0 THEN
    PERFORM public.add_clovers(v_uid, v_slice.clovers);
  ELSIF v_slice.kind = 'free_putt' THEN
    UPDATE public.golfer_profiles
    SET putt_credits = putt_credits + 1, updated_at = now()
    WHERE user_id = v_uid
    RETURNING putt_credits INTO v_credits;
    v_result := v_result || jsonb_build_object('credits', v_credits);
  ELSIF v_slice.kind = 'free_spin' THEN
    -- The spin is handed back: the player ends up with the spins they started with.
    UPDATE public.golfer_profiles
    SET spins = spins + 1, updated_at = now()
    WHERE user_id = v_uid
    RETURNING spins INTO v_left;
  END IF;

  INSERT INTO public.spin_log (user_id, slice_idx, kind, label, clovers)
  VALUES (v_uid, v_slice.idx, v_slice.kind, v_slice.label, v_slice.clovers);

  RETURN v_result || jsonb_build_object('spins', v_left);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_spin(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_spin(boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Round clovers
-- ---------------------------------------------------------------------------
CREATE TABLE public.round_awards (
  round_id UUID PRIMARY KEY REFERENCES public.rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clovers INTEGER NOT NULL DEFAULT 0 CHECK (clovers >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX round_awards_user_idx ON public.round_awards (user_id, created_at DESC);

ALTER TABLE public.round_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own round awards"
  ON public.round_awards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.round_awards FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_round_clovers(p_round_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_per_round CONSTANT INTEGER := 5;
  c_daily_cap CONSTANT INTEGER := 3;   -- rounds that earn clovers per rolling 24 hours
  v_uid UUID := auth.uid();
  v_round RECORD;
  v_recent INTEGER;
  v_inserted INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, user_id, completed INTO v_round FROM public.rounds WHERE id = p_round_id;
  IF NOT FOUND OR v_round.user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round not found');
  END IF;
  IF NOT coalesce(v_round.completed, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round not complete');
  END IF;

  SELECT count(*) INTO v_recent FROM public.round_awards
  WHERE user_id = v_uid AND clovers > 0 AND created_at > now() - interval '24 hours';

  -- One decision per round, made once: a repeat call (or a second tab) cannot pay it twice.
  INSERT INTO public.round_awards (round_id, user_id, clovers)
  VALUES (p_round_id, v_uid, CASE WHEN v_recent < c_daily_cap THEN c_per_round ELSE 0 END)
  ON CONFLICT (round_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('success', true, 'clovers', 0, 'already_awarded', true);
  END IF;

  IF v_recent >= c_daily_cap THEN
    RETURN jsonb_build_object('success', true, 'clovers', 0, 'limit_reached', true);
  END IF;

  PERFORM public.add_clovers(v_uid, c_per_round);
  UPDATE public.rounds SET clovers_earned = c_per_round WHERE id = p_round_id;

  RETURN jsonb_build_object('success', true, 'clovers', c_per_round);
END;
$$;

REVOKE ALL ON FUNCTION public.award_round_clovers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_round_clovers(uuid) TO authenticated;
