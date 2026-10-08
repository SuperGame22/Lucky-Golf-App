-- Closes the last way to pay a wager without the confirmation flow.
--
-- settle_competition(competition, winner) was how the host's app paid out. With
-- 20261012120000_wager_results.sql the database works out the winner and the other players
-- confirm it, so the only thing settle_competition() is still for is a host cancelling a wager
-- nobody else paid into: the host gets their own buy-in back. Anything else is refused.
--
-- RUN THIS ONLY AFTER the app release that goes with 20261012120000 is live (the previous app
-- release pays out through settle_competition()).
--
-- To undo: re-run the settle_competition() definition from 20261011130000_lock_wheel_and_settle.sql.

DO $$
BEGIN
  IF to_regprocedure('public._settle_competition_pay(uuid, uuid)') IS NULL OR to_regprocedure('public.wager_propose_result(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Close legacy settle: apply 20261011130000 and 20261012120000 first';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.settle_competition(p_competition_id UUID, p_winner_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator UUID;
  v_paid INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT creator_id INTO v_creator FROM public.competitions WHERE id = p_competition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competition not found';
  END IF;
  IF v_creator IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the player who created this competition can settle it';
  END IF;

  SELECT count(*) INTO v_paid FROM public.competition_players WHERE competition_id = p_competition_id AND has_paid;
  IF v_paid > 1 OR p_winner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Wagers with other players are paid through the confirmation flow';
  END IF;

  RETURN public._settle_competition_pay(p_competition_id, p_winner_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_competition(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_competition(uuid, uuid) TO authenticated;
