-- Security hardening (overnight review, 2026-10-27). Safe to apply on the live database; every step is
-- idempotent and guarded so it works even where the live schema differs from the repo copies.
--
--  1. Players can no longer change their own role, membership tier or gold balance (an UPDATE on
--     golfer_profiles from the app could make anyone an admin or a Gold member). Only the server
--     (service role, SECURITY DEFINER functions, the SQL editor) can change them.
--  2. New sign-ups get their golfer_profiles row from the database (display name from sign-up metadata),
--     so a profile exists even when email confirmation means the app has no session yet.
--  3. Spend-based clovers over 500 at once are granted in chunks (add_clovers caps one call at 500 and
--     the old code silently dropped the whole amount).
--  4. Round clovers: the 3-a-day cap now holds even when several rounds are finished at the same moment.
--  5. A Stripe payment reference can only be recorded once (stops a double credit when Stripe retries).
--  6. Players cannot write wallets / transactions / competitions / competition_players directly; the
--     app only reads them and changes them through server functions.
--  7. Wagers: the pot is paid only when EVERY partner confirms; any "no" sends it to admin review.
--
-- Roll back: re-run the previous definitions of protect_profile_columns, _apply_spend, award_round_clovers,
-- _wager_evaluate and wager_status from their original migrations; DROP TRIGGER zz_lg_create_profile_on_signup
-- ON auth.users; DROP TRIGGER lg_protect_profile_insert ON public.golfer_profiles;
-- DROP INDEX IF EXISTS transactions_stripe_ref_unique; re-GRANT the revoked privileges if needed.

-- ---------------------------------------------------------------------------
-- 1. Protected profile columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  o JSONB := to_jsonb(OLD);
  n JSONB := to_jsonb(NEW);
  k TEXT;
BEGIN
  -- Only updates are compared; an INSERT (if an older trigger also fires on insert) passes through.
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF current_user IN ('authenticated', 'anon') THEN
    -- jsonb comparison so this works whether or not a column exists on this database.
    FOREACH k IN ARRAY ARRAY['clovers', 'total_clovers', 'spins', 'putt_credits',
                             'role', 'membership_tier', 'gold_balance'] LOOP
      IF (o -> k) IS DISTINCT FROM (n -> k) THEN
        RAISE EXCEPTION 'Protected columns cannot be modified directly (%)', k USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Make sure the function is attached (the live trigger may have another name; only add one if none uses it).
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.golfer_profiles'::regclass
      AND t.tgfoid = 'public.protect_profile_columns()'::regprocedure
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER lg_protect_profile_columns BEFORE UPDATE ON public.golfer_profiles
      FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();
  END IF;
END
$do$;

-- New rows written by the app cannot start as admin, as a paying member, or with gold.
CREATE OR REPLACE FUNCTION public.protect_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  n JSONB := to_jsonb(NEW);
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF coalesce(n ->> 'role', '') IN ('admin', 'super_admin')
       OR coalesce(n ->> 'membership_tier', 'free') NOT IN ('free')
       OR coalesce((n ->> 'gold_balance')::numeric, 0) <> 0 THEN
      RAISE EXCEPTION 'Protected columns cannot be set directly' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lg_protect_profile_insert ON public.golfer_profiles;
CREATE TRIGGER lg_protect_profile_insert BEFORE INSERT ON public.golfer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_insert();

-- ---------------------------------------------------------------------------
-- 2. Profile row on sign-up
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lg_create_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT := left(nullif(trim(coalesce(to_jsonb(NEW) -> 'raw_user_meta_data' ->> 'display_name', '')), ''), 60);
BEGIN
  BEGIN
    INSERT INTO public.golfer_profiles (user_id, display_name)
    VALUES (NEW.id, v_name)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Never block a sign-up because of the profile row; the app also creates it on first sign-in.
    RAISE WARNING 'lg_create_profile_for_new_user failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lg_create_profile_for_new_user() FROM PUBLIC, anon, authenticated;

-- Named "zz_..." so it fires AFTER any profile trigger the project already has (triggers run alphabetically);
-- if that one already made the profile, this one finds it and does nothing.
DROP TRIGGER IF EXISTS lg_create_profile_on_signup ON auth.users;
DROP TRIGGER IF EXISTS zz_lg_create_profile_on_signup ON auth.users;
CREATE TRIGGER zz_lg_create_profile_on_signup AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.lg_create_profile_for_new_user();

-- ---------------------------------------------------------------------------
-- 3. Grant any number of clovers (add_clovers allows at most 500 per call)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._grant_clovers(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_left INTEGER := coalesce(p_amount, 0);
  v_step INTEGER;
  v_res JSONB;
BEGIN
  WHILE v_left > 0 LOOP
    v_step := least(v_left, 500);
    v_res := public.add_clovers(p_user_id, v_step);
    IF coalesce((v_res ->> 'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'add_clovers failed: %', coalesce(v_res ->> 'error', 'unknown');
    END IF;
    v_left := v_left - v_step;
  END LOOP;
  RETURN coalesce(p_amount, 0);
END;
$$;

REVOKE ALL ON FUNCTION public._grant_clovers(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._apply_spend(p_user_id UUID, p_cents BIGINT, p_bonus_given INTEGER DEFAULT 0)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_given INTEGER;
  v_due INTEGER;
BEGIN
  IF p_cents IS NULL OR p_cents <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.spend_progress (user_id, cents_total, clovers_given)
  VALUES (p_user_id, p_cents, p_bonus_given)
  ON CONFLICT (user_id) DO UPDATE
    SET cents_total = public.spend_progress.cents_total + p_cents,
        clovers_given = public.spend_progress.clovers_given + p_bonus_given,
        updated_at = now()
  RETURNING cents_total, clovers_given INTO v_total, v_given;

  v_due := (v_total / 400)::integer - v_given;
  IF v_due > 0 THEN
    PERFORM public._grant_clovers(p_user_id, v_due);
    UPDATE public.spend_progress SET clovers_given = clovers_given + v_due WHERE user_id = p_user_id;
    RETURN v_due;
  END IF;
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public._apply_spend(UUID, BIGINT, INTEGER) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Round clovers: serialise per player so the daily cap cannot be raced
-- ---------------------------------------------------------------------------
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

  PERFORM pg_advisory_xact_lock(hashtext('lg_round_award:' || v_uid::text));

  SELECT id, user_id, completed INTO v_round FROM public.rounds WHERE id = p_round_id;
  IF NOT FOUND OR v_round.user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round not found');
  END IF;
  IF NOT coalesce(v_round.completed, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round not complete');
  END IF;

  SELECT count(*) INTO v_recent FROM public.round_awards
  WHERE user_id = v_uid AND clovers > 0 AND created_at > now() - interval '24 hours';

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

  PERFORM public._grant_clovers(v_uid, c_per_round);
  UPDATE public.rounds SET clovers_earned = c_per_round WHERE id = p_round_id;

  RETURN jsonb_build_object('success', true, 'clovers', c_per_round);
END;
$$;

REVOKE ALL ON FUNCTION public.award_round_clovers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_round_clovers(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. One transaction per Stripe payment reference
-- ---------------------------------------------------------------------------
DO $do$
BEGIN
  IF to_regclass('public.transactions') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.transactions WHERE metadata ? 'stripe_ref'
    GROUP BY metadata ->> 'stripe_ref' HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'transactions has duplicate stripe_ref rows; unique index not created. Clean them up, then re-run this block.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS transactions_stripe_ref_unique
      ON public.transactions ((metadata ->> 'stripe_ref'))
      WHERE metadata ? 'stripe_ref';
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 6. Money tables are read-only for the app (server functions do the writing)
-- ---------------------------------------------------------------------------
DO $do$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['wallets', 'transactions', 'competitions', 'competition_players'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END
$do$;

-- ---------------------------------------------------------------------------
-- 7. Wagers: every partner must confirm
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._wager_evaluate(p_competition_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.competitions;
  g public.wager_games;
  v_n INTEGER;
  v_needed INTEGER;
  v_yes INTEGER;
  v_no INTEGER;
  v_paid JSONB;
BEGIN
  SELECT * INTO c FROM public.competitions WHERE id = p_competition_id;
  SELECT * INTO g FROM public.wager_games WHERE competition_id = p_competition_id FOR UPDATE;
  IF g.state <> 'awaiting' THEN
    RETURN jsonb_build_object('state', g.state);
  END IF;

  SELECT count(*) INTO v_n FROM public.competition_players WHERE competition_id = p_competition_id AND has_paid;
  v_needed := v_n - 1;  -- every partner must agree (the host's agreement is implied); any "no" goes to admin review
  SELECT count(*) FILTER (WHERE wc.agrees), count(*) FILTER (WHERE NOT wc.agrees) INTO v_yes, v_no
  FROM public.wager_confirmations wc
  JOIN public.competition_players cp ON cp.competition_id = wc.competition_id AND cp.user_id = wc.user_id AND cp.has_paid
  WHERE wc.competition_id = p_competition_id AND wc.user_id <> c.creator_id;

  IF v_no = 0 AND v_yes >= v_needed THEN
    v_paid := public._wager_pay(p_competition_id, NULL);
    RETURN jsonb_build_object('state', 'paid', 'payout', v_paid);
  ELSIF v_no > 0 THEN
    UPDATE public.wager_games SET state = 'review' WHERE competition_id = p_competition_id;
    RETURN jsonb_build_object('state', 'review');
  END IF;
  RETURN jsonb_build_object('state', 'awaiting', 'confirmed', v_yes, 'needed', v_needed);
END;
$$;

CREATE OR REPLACE FUNCTION public.wager_status(p_competition_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.competitions;
  g public.wager_games;
  v_n INTEGER;
  v_conf JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.competition_players WHERE competition_id = p_competition_id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not in this wager');
  END IF;
  SELECT * INTO c FROM public.competitions WHERE id = p_competition_id;
  SELECT * INTO g FROM public.wager_games WHERE competition_id = p_competition_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', true, 'state', 'not_started'); END IF;
  SELECT count(*) INTO v_n FROM public.competition_players WHERE competition_id = p_competition_id AND has_paid;
  SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'agrees', agrees)), '[]'::jsonb) INTO v_conf
  FROM public.wager_confirmations WHERE competition_id = p_competition_id;

  RETURN jsonb_build_object(
    'success', true, 'state', g.state, 'mode', g.mode, 'holes', g.holes, 'pars', to_jsonb(g.pars),
    'pot', c.pot_total, 'buy_in', c.buy_in, 'players', v_n, 'partners_needed', greatest(v_n - 1, 0),
    'is_host', c.creator_id = auth.uid(), 'host_id', c.creator_id,
    'standings', CASE WHEN g.result IS NOT NULL THEN g.result ELSE public._wager_standings(p_competition_id) END,
    'confirmations', v_conf,
    'names', (SELECT coalesce(jsonb_object_agg(cp.user_id, coalesce(gp.display_name, 'Player')), '{}'::jsonb)
              FROM public.competition_players cp LEFT JOIN public.golfer_profiles gp ON gp.user_id = cp.user_id
              WHERE cp.competition_id = p_competition_id AND cp.has_paid),
    -- {user_id: {"1": 4, "2": 3, ...}}
    'scores', (SELECT coalesce(jsonb_object_agg(u, h), '{}'::jsonb) FROM (
                 SELECT user_id AS u, jsonb_object_agg(hole::text, score) AS h
                 FROM public.wager_scores WHERE competition_id = p_competition_id GROUP BY user_id) x)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._wager_evaluate(UUID) FROM PUBLIC, anon, authenticated;
