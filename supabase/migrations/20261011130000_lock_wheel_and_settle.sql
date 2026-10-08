-- Two clean-ups found while checking what signed-in players can call.
--
-- 1. The old spin_wheel() function and its prize tables
--    The app now draws prizes in consume_spin() (20261010120000). spin_wheel(p_user_id) is the
--    unused earlier version; it could be called by any signed-in player and would hand out
--    whatever spin_prizes holds. It is removed, and spin_prizes / spin_results are dropped only
--    if they are empty (if either has rows it is kept and a notice says so).
--
-- 2. settle_competition(): only the player who created the wager may settle it
--    It used to accept any paid player in the match, so any of them could call it directly and
--    name themselves winner of the whole pot. The app only ever calls it from the host's device,
--    so nothing in the app changes. The original function is kept under the name
--    _settle_competition_pay() (clients cannot call it) and still does the paying and the
--    paid-participant checks; settle_competition() is now a thin front that adds the
--    "must be the creator" rule.
--
--    Still true after this: the host's app works out who won, so a dishonest host could name
--    themselves. Closing that needs the scores to be sent to the database, not decided in the app.
--
-- To roll back the settle change:
--   DROP FUNCTION public.settle_competition(uuid, uuid);
--   ALTER FUNCTION public._settle_competition_pay(uuid, uuid) RENAME TO settle_competition;
--   GRANT EXECUTE ON FUNCTION public.settle_competition(uuid, uuid) TO authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.settle_competition(uuid, uuid)') IS NULL AND to_regprocedure('public._settle_competition_pay(uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'Lock wheel and settle: public.settle_competition(uuid, uuid) not found';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'competitions' AND column_name IN ('id', 'creator_id', 'status')) <> 3 THEN
    RAISE EXCEPTION 'Lock wheel and settle: competitions needs id, creator_id and status columns';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Old spin wheel
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.spin_wheel(uuid);

DO $$
DECLARE
  t TEXT;
  n BIGINT;
BEGIN
  FOREACH t IN ARRAY ARRAY['spin_results', 'spin_prizes'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n = 0 THEN
        EXECUTE format('DROP TABLE public.%I', t);
      ELSE
        RAISE NOTICE 'Kept public.% (it has % rows)', t, n;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. settle_competition(): creator only
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public._settle_competition_pay(uuid, uuid)') IS NULL THEN
    ALTER FUNCTION public.settle_competition(uuid, uuid) RENAME TO _settle_competition_pay;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public._settle_competition_pay(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.settle_competition(p_competition_id UUID, p_winner_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator UUID;
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

  RETURN public._settle_competition_pay(p_competition_id, p_winner_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_competition(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_competition(uuid, uuid) TO authenticated;
