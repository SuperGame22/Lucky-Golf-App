-- Free Putt on the Spinz wheel.
--
-- A Free Putt is a real giveaway (+1 putt credit), so it is decided and credited on the
-- server, not in the browser. consume_spin() now also rolls for it: when the roll hits it
-- adds one putt credit in the same transaction and tells the page to land on the Free Putt
-- slice. The page can never claim a Free Putt on its own, and there is no endpoint that adds
-- putts for free. The new credit shows up in "Putts Left" in Lucky Putts (get_putt_status).
--
-- Odds: 1 in 33.94 (0.0295). That is the Free Putt slice's share of the wheel's selection
-- weights: 33 normal slices plus three gold slices at 11/35 each. If the wheel's prizes or
-- weights change, change the constant in free_putt_roll() to match (a test checks it).
--
-- Needs 20261007120000_putt_spins.sql first (it defines consume_spin()).
--
-- To roll back, re-run the consume_spin() definition from 20261007120000_putt_spins.sql and:
--   DROP FUNCTION public.free_putt_roll();

DO $$
BEGIN
  IF to_regprocedure('public.consume_spin()') IS NULL THEN
    RAISE EXCEPTION 'Free putt migration: public.consume_spin() not found (apply 20261007120000_putt_spins.sql first)';
  END IF;
  IF to_regclass('public.golfer_profiles') IS NULL THEN
    RAISE EXCEPTION 'Free putt migration: public.golfer_profiles not found';
  END IF;
END $$;

-- The roll lives in its own function so it can be tested; players cannot call it.
CREATE OR REPLACE FUNCTION public.free_putt_roll()
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT random() < 0.0295;
$$;

REVOKE ALL ON FUNCTION public.free_putt_roll() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_spin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_left INTEGER;
  v_credits INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  UPDATE public.golfer_profiles
  SET spins = spins - 1, updated_at = now()
  WHERE user_id = auth.uid() AND spins > 0
  RETURNING spins INTO v_left;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No spins remaining');
  END IF;

  IF public.free_putt_roll() THEN
    UPDATE public.golfer_profiles
    SET putt_credits = putt_credits + 1, updated_at = now()
    WHERE user_id = auth.uid()
    RETURNING putt_credits INTO v_credits;

    RETURN jsonb_build_object('success', true, 'spins', v_left, 'free_putt', true, 'credits', v_credits);
  END IF;

  RETURN jsonb_build_object('success', true, 'spins', v_left, 'free_putt', false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_spin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_spin() TO authenticated;
