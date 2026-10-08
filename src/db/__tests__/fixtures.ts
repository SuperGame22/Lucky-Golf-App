import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Shared stand-ins for the live database pieces the migrations touch (pglite, in-process Postgres). */

export const migrationSql = (file: string) =>
  readFileSync(resolve(__dirname, "../../../supabase/migrations", file), "utf8");

export const ALICE = "11111111-1111-1111-1111-111111111111";
export const BOB = "22222222-2222-2222-2222-222222222222";

export const BASE = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
`;

/** The live pieces, copied from the production definitions. */
export const LIVE = `
  CREATE TABLE public.golfer_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    clovers INTEGER NOT NULL DEFAULT 0,
    total_clovers INTEGER NOT NULL DEFAULT 0,
    spins INTEGER NOT NULL DEFAULT 3,
    putt_credits INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE public.golfer_profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY own_select ON public.golfer_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
  CREATE POLICY own_update ON public.golfer_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

  CREATE FUNCTION public.award_spins_from_clovers() RETURNS trigger LANGUAGE plpgsql AS $f$
  BEGIN
    IF NEW.total_clovers > OLD.total_clovers THEN
      NEW.spins := NEW.spins + (NEW.total_clovers / 10 - OLD.total_clovers / 10);
    END IF;
    RETURN NEW;
  END; $f$;
  CREATE TRIGGER trg_award_spins BEFORE UPDATE ON public.golfer_profiles
    FOR EACH ROW EXECUTE FUNCTION public.award_spins_from_clovers();

  CREATE FUNCTION public.protect_profile_columns() RETURNS trigger LANGUAGE plpgsql AS $f$
  BEGIN
    IF current_user IN ('authenticated', 'anon') THEN
      IF new.clovers IS DISTINCT FROM old.clovers OR new.total_clovers IS DISTINCT FROM old.total_clovers
         OR new.spins IS DISTINCT FROM old.spins OR new.putt_credits IS DISTINCT FROM old.putt_credits THEN
        RAISE EXCEPTION 'Protected columns cannot be modified directly';
      END IF;
    END IF;
    RETURN new;
  END; $f$;
  CREATE TRIGGER trg_protect BEFORE UPDATE ON public.golfer_profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

  CREATE FUNCTION public.spend_putt() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $f$
  DECLARE v_left integer;
  BEGIN
    IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
    UPDATE public.golfer_profiles SET putt_credits = putt_credits - 1, updated_at = now()
    WHERE user_id = auth.uid() AND putt_credits > 0 RETURNING putt_credits INTO v_left;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'No putts left'); END IF;
    RETURN jsonb_build_object('success', true, 'credits', v_left);
  END; $f$;
`;

/** add_clovers as it is live today (callable by signed-in players), plus the tables the clover grants touch. */
export const CLOVERS_LIVE = `
  CREATE FUNCTION public.award_jackpot_entry(p_user_id UUID, p_amount INTEGER, p_source_ref UUID DEFAULT NULL)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $f$ BEGIN RETURN; END; $f$;

  CREATE FUNCTION public.add_clovers(p_user_id UUID, p_amount INTEGER) RETURNS JSONB
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
  DECLARE v_new_balance INTEGER;
  BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
      RAISE EXCEPTION 'Unauthorized: caller does not match user';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;
    IF p_amount > 500 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Amount exceeds per-call limit');
    END IF;
    UPDATE public.golfer_profiles
    SET clovers = clovers + p_amount, total_clovers = total_clovers + p_amount, updated_at = now()
    WHERE user_id = p_user_id RETURNING clovers INTO v_new_balance;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Profile not found'); END IF;
    PERFORM public.award_jackpot_entry(p_user_id, p_amount);
    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance, 'added', p_amount);
  END; $f$;

  CREATE FUNCTION public.award_clovers(p_user_id UUID, p_amount NUMERIC) RETURNS JSONB
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
  BEGIN
    UPDATE public.golfer_profiles SET clovers = clovers + floor(p_amount * 0.25)::int,
      total_clovers = total_clovers + floor(p_amount * 0.25)::int WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true);
  END; $f$;
`;

/** The rounds table the scorecard saves to, and the service-role used by the payment functions. */
export const ROUNDS_LIVE = `
  CREATE TABLE public.rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    completed BOOLEAN NOT NULL DEFAULT false,
    clovers_earned INTEGER NOT NULL DEFAULT 0
  );
  ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
  CREATE POLICY own_rounds ON public.rounds FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  DO $r$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF; END $r$;
`;
