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
