-- Closes the "any signed-in player can set their own clover count" hole.
--
-- add_clovers() and award_clovers() were callable by every signed-in player for their own
-- account, with any amount. After 20261010120000_server_side_clovers.sql the app no longer
-- needs either from the browser:
--   * Spinz prizes and round clovers are granted inside consume_spin() / award_round_clovers()
--   * Monocle clovers are granted inside monocle_collect_clover()
--   * purchases are credited by the payment functions with the service key
-- Those functions are SECURITY DEFINER and keep working; only direct calls from a player's
-- browser (and from anyone not signed in) are refused.
--
-- RUN THIS ONLY AFTER the app release that goes with 20261010120000 is live. The previous app
-- release credits clovers from the browser and would stop earning them.
--
-- NOTE: the older local build (the archived project) calls award_clovers() from the browser to
-- animate spending. That stops crediting against this database once this runs.
--
-- To undo:
--   GRANT EXECUTE ON FUNCTION public.add_clovers(uuid, integer) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.award_clovers(uuid, numeric) TO authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.add_clovers(uuid, integer)') IS NULL THEN
    RAISE EXCEPTION 'Lock clover minting: public.add_clovers(uuid, integer) not found';
  END IF;
  IF to_regprocedure('public.consume_spin(boolean)') IS NULL OR to_regprocedure('public.award_round_clovers(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Lock clover minting: apply 20261010120000_server_side_clovers.sql first';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.add_clovers(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_clovers(uuid, integer) TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.award_clovers(uuid, numeric)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.award_clovers(uuid, numeric) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.award_clovers(uuid, numeric) TO service_role;
  END IF;
END $$;
