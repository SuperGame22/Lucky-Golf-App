-- Spinz are won by sinking putts. Nothing else grants them (apart from any monthly
-- membership spin, which is a separate grant and is not touched here).
--
--   1. Retire the old rule: +1 spin for every 10 total clovers (award_spins_from_clovers).
--      Clovers are a by-product of spending money and no longer drive spins.
--   2. Track paid putts in public.putt_ledger so a sunk putt can only be claimed for a
--      putt that was actually paid for (spins won can never exceed putts paid).
--   3. spend_putt() keeps its behaviour and also records the paid putt.
--   4. award_putt_spin(): +1 saved spin for a sunk, paid putt (one claim per paid putt).
--   5. consume_spin(): the Spinz page spends one saved spin on the server.
--
-- Known limit: the putting physics run in the browser, so the server cannot tell a real
-- sink from a claimed one. The ledger caps abuse at one spin per $1 putt bought; stopping
-- it entirely needs the putt to be simulated or verified server-side.
--
-- To roll back the old rule (not recommended):
--   CREATE FUNCTION public.award_spins_from_clovers() RETURNS trigger LANGUAGE plpgsql AS $f$
--   BEGIN IF NEW.total_clovers > OLD.total_clovers THEN
--     NEW.spins := NEW.spins + (NEW.total_clovers / 10 - OLD.total_clovers / 10);
--   END IF; RETURN NEW; END; $f$;
--   CREATE TRIGGER award_spins_from_clovers BEFORE UPDATE ON public.golfer_profiles
--     FOR EACH ROW EXECUTE FUNCTION public.award_spins_from_clovers();

-- ---------------------------------------------------------------------------
-- 0. Refuse to apply to a database that is not shaped the way this expects.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.golfer_profiles') IS NULL THEN
    RAISE EXCEPTION 'Putt spins migration: public.golfer_profiles not found';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'golfer_profiles'
        AND column_name IN ('user_id', 'spins', 'putt_credits')) <> 3 THEN
    RAISE EXCEPTION 'Putt spins migration: golfer_profiles needs user_id, spins and putt_credits columns';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'spend_putt' AND p.pronargs = 0 AND p.prorettype = 'jsonb'::regtype
  ) THEN
    RAISE EXCEPTION 'Putt spins migration: public.spend_putt() returning jsonb not found';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Retire "10 clovers = 1 spin"
-- ---------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.golfer_profiles'::regclass
      AND p.proname = 'award_spins_from_clovers'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.golfer_profiles', r.tgname);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.award_spins_from_clovers();

-- ---------------------------------------------------------------------------
-- 2. Paid-putt ledger: written only by the functions below
-- ---------------------------------------------------------------------------
CREATE TABLE public.putt_ledger (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  paid INTEGER NOT NULL DEFAULT 0 CHECK (paid >= 0),
  claimed INTEGER NOT NULL DEFAULT 0 CHECK (claimed >= 0),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Spins won from putts can never exceed putts paid for.
  CONSTRAINT putt_ledger_claimed_le_paid CHECK (claimed <= paid)
);

ALTER TABLE public.putt_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own putt ledger"
  ON public.putt_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.putt_ledger FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. spend_putt(): unchanged behaviour, plus it records the paid putt
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spend_putt()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_left INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  UPDATE public.golfer_profiles
  SET putt_credits = putt_credits - 1, updated_at = now()
  WHERE user_id = auth.uid() AND putt_credits > 0
  RETURNING putt_credits INTO v_left;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No putts left');
  END IF;

  INSERT INTO public.putt_ledger (user_id, paid)
  VALUES (auth.uid(), 1)
  ON CONFLICT (user_id) DO UPDATE SET paid = public.putt_ledger.paid + 1, updated_at = now();

  RETURN jsonb_build_object('success', true, 'credits', v_left);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. award_putt_spin(): +1 spin for a sunk putt, once per paid putt
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_putt_spin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_spins INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Take one unclaimed paid putt. Atomic: two taps cannot claim the same putt.
  UPDATE public.putt_ledger
  SET claimed = claimed + 1, updated_at = now()
  WHERE user_id = v_uid AND claimed < paid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No paid putt to claim');
  END IF;

  UPDATE public.golfer_profiles
  SET spins = spins + 1, updated_at = now()
  WHERE user_id = v_uid
  RETURNING spins INTO v_spins;

  -- No profile: undo the claim instead of burning a paid putt.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN jsonb_build_object('success', true, 'spins', v_spins);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. consume_spin(): spend one saved spin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_spin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_left INTEGER;
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

  RETURN jsonb_build_object('success', true, 'spins', v_left);
END;
$$;

REVOKE ALL ON FUNCTION public.award_putt_spin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_spin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_putt_spin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_spin() TO authenticated;
