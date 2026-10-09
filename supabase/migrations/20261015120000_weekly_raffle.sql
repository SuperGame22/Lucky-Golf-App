-- Weekly raffle: automatic, provably random, one winner per week.
--
-- Builds on the existing weekly_jackpots / jackpot_entries tables.
--   * Entries = clovers EARNED that week. A trigger on golfer_profiles.total_clovers adds one entry per
--     clover from every grant path (rounds, spins, purchases, wager/wheel prizes...), so no path can be missed.
--     The old award_jackpot_entry() becomes a no-op so nothing is counted twice.
--   * A week runs Sunday 8:00 pm Eastern to the next Sunday 8:00 pm Eastern (daylight saving handled).
--   * Admin queues prizes ahead (admin_queue_raffle_prizes). A week with nothing queued still collects
--     entries; its draw simply waits until a prize is added.
--   * The winner is a uniformly random ticket from a cryptographically secure source, drawn once.
--     A draw can never be repeated. The ticket, total tickets and time are stored with the result.
--   * Credit and Spinz prizes are paid automatically; products are marked for admin to fulfil.
--   * run_weekly_raffle() is what the schedule calls every few minutes.
--
-- To roll back: SELECT cron.unschedule('weekly-raffle'); DROP TRIGGER trg_raffle_entries ON public.golfer_profiles;
-- then restore award_jackpot_entry() from the previous definition.

DO $$
BEGIN
  IF to_regclass('public.weekly_jackpots') IS NULL OR to_regclass('public.jackpot_entries') IS NULL THEN
    RAISE EXCEPTION 'Weekly raffle migration: weekly_jackpots / jackpot_entries not found';
  END IF;
  IF to_regclass('public.golfer_profiles') IS NULL OR to_regclass('public.wallets') IS NULL OR to_regclass('public.transactions') IS NULL THEN
    RAISE EXCEPTION 'Weekly raffle migration: golfer_profiles, wallets and transactions are required';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Prize parts and the draw record
-- ---------------------------------------------------------------------------
ALTER TABLE public.weekly_jackpots
  ADD COLUMN IF NOT EXISTS prize_credit NUMERIC NOT NULL DEFAULT 0 CHECK (prize_credit >= 0),
  ADD COLUMN IF NOT EXISTS prize_spins INTEGER NOT NULL DEFAULT 0 CHECK (prize_spins >= 0),
  ADD COLUMN IF NOT EXISTS prize_products TEXT,
  ADD COLUMN IF NOT EXISTS drawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS draw_total BIGINT,
  ADD COLUMN IF NOT EXISTS draw_ticket BIGINT,
  ADD COLUMN IF NOT EXISTS draw_method TEXT,
  ADD COLUMN IF NOT EXISTS awarded_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Week boundaries: Sunday 8 pm America/New_York
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._raffle_week_start(p_ts TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_local TIMESTAMP := p_ts AT TIME ZONE 'America/New_York';
  v_cand TIMESTAMP;
BEGIN
  v_cand := date_trunc('day', v_local) - (extract(dow FROM v_local)::int) * interval '1 day' + interval '20 hours';
  IF v_cand > v_local THEN v_cand := v_cand - interval '7 days'; END IF;
  RETURN v_cand AT TIME ZONE 'America/New_York';
END;
$$;

CREATE OR REPLACE FUNCTION public._raffle_week_end(p_start TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$ SELECT ((p_start AT TIME ZONE 'America/New_York') + interval '7 days') AT TIME ZONE 'America/New_York' $$;

-- The raffle week that is running now. When nothing is queued for it, a placeholder is created so
-- entries are never lost; the draw waits until admin gives it a prize.
CREATE OR REPLACE FUNCTION public._raffle_current(p_create BOOLEAN)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_start TIMESTAMPTZ;
BEGIN
  SELECT id INTO v_id FROM public.weekly_jackpots
  WHERE status IN ('draft', 'active') AND drawn_at IS NULL AND now() >= starts_at AND now() < ends_at
  ORDER BY starts_at DESC LIMIT 1;
  IF v_id IS NOT NULL OR NOT p_create THEN RETURN v_id; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('weekly_raffle_placeholder'));
  SELECT id INTO v_id FROM public.weekly_jackpots
  WHERE status IN ('draft', 'active') AND drawn_at IS NULL AND now() >= starts_at AND now() < ends_at
  ORDER BY starts_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_start := public._raffle_week_start(now());
  INSERT INTO public.weekly_jackpots (title, prize_name, starts_at, ends_at, status)
  VALUES ('Weekly Raffle', 'Prize to be announced', v_start, public._raffle_week_end(v_start), 'active')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Entries: one per clover earned, from every path
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._raffle_add_entries(p_user_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  v_id := public._raffle_current(true);
  -- one running row per player per week keeps the table small
  UPDATE public.jackpot_entries SET entry_count = entry_count + p_amount
  WHERE jackpot_id = v_id AND user_id = p_user_id AND source = 'clover_earned' AND source_ref_id IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.jackpot_entries (jackpot_id, user_id, source, entry_count)
    VALUES (v_id, p_user_id, 'clover_earned', p_amount);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._raffle_on_clovers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Earning clovers must never fail because of the raffle.
  BEGIN
    PERFORM public._raffle_add_entries(NEW.user_id, NEW.total_clovers - OLD.total_clovers);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'raffle entry skipped: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_raffle_entries ON public.golfer_profiles;
CREATE TRIGGER trg_raffle_entries
  AFTER UPDATE OF total_clovers ON public.golfer_profiles
  FOR EACH ROW WHEN (NEW.total_clovers > OLD.total_clovers)
  EXECUTE FUNCTION public._raffle_on_clovers();

-- Older grant paths still call this; entries now come from the trigger, so it must do nothing.
CREATE OR REPLACE FUNCTION public.award_jackpot_entry(p_user_id UUID, p_amount INTEGER, p_source_ref UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN;
END;
$$;

-- ---------------------------------------------------------------------------
-- The draw
-- ---------------------------------------------------------------------------
-- A uniform random whole number from 1 to p_total, from the database's secure generator
-- (gen_random_uuid reads the operating system's CSPRNG). Rejection sampling removes modulo bias.
CREATE OR REPLACE FUNCTION public._raffle_pick(p_total BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_bytes BYTEA;
  v_u BIGINT;
  v_limit BIGINT;
BEGIN
  IF p_total IS NULL OR p_total < 1 OR p_total > 4294967296 THEN RAISE EXCEPTION 'Invalid ticket count'; END IF;
  v_limit := (4294967296 / p_total) * p_total;
  LOOP
    v_bytes := uuid_send(gen_random_uuid());
    v_u := get_byte(v_bytes, 0)::bigint * 16777216 + get_byte(v_bytes, 1)::bigint * 65536
         + get_byte(v_bytes, 2)::bigint * 256 + get_byte(v_bytes, 3)::bigint;
    IF v_u < v_limit THEN RETURN (v_u % p_total) + 1; END IF;
  END LOOP;
END;
$$;

-- Which entry row owns ticket number p_ticket (tickets are numbered across rows in a fixed order).
CREATE OR REPLACE FUNCTION public._raffle_owner(p_jackpot_id UUID, p_ticket BIGINT)
RETURNS TABLE (entry_id UUID, user_id UUID)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT e.id, e.user_id FROM (
    SELECT id, user_id, sum(entry_count) OVER (ORDER BY created_at, id) AS cum
    FROM public.jackpot_entries WHERE jackpot_id = p_jackpot_id AND entry_count > 0
  ) e
  WHERE e.cum >= p_ticket
  ORDER BY e.cum LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public._raffle_draw(p_jackpot_id UUID, p_admin UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j public.weekly_jackpots;
  v_total BIGINT;
  v_ticket BIGINT;
  v_entry UUID;
  v_winner UUID;
  v_wallet UUID;
  v_manual BOOLEAN;
BEGIN
  SELECT * INTO j FROM public.weekly_jackpots WHERE id = p_jackpot_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Raffle not found'); END IF;
  IF j.drawn_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'This raffle was already drawn'); END IF;
  IF j.status NOT IN ('draft', 'active') THEN RETURN jsonb_build_object('success', false, 'error', 'This raffle is not open'); END IF;
  IF j.ends_at > now() THEN RETURN jsonb_build_object('success', false, 'error', 'This raffle has not ended yet'); END IF;
  IF j.prize_name IS NULL OR j.prize_name = 'Prize to be announced' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add a prize before drawing');
  END IF;

  SELECT coalesce(sum(entry_count), 0) INTO v_total FROM public.jackpot_entries WHERE jackpot_id = p_jackpot_id;
  IF v_total = 0 THEN
    UPDATE public.weekly_jackpots
    SET drawn_at = now(), draw_total = 0, draw_method = 'no entries', status = 'closed', updated_at = now()
    WHERE id = p_jackpot_id;
    RETURN jsonb_build_object('success', true, 'winner_user_id', NULL, 'total', 0);
  END IF;

  v_ticket := public._raffle_pick(v_total);
  SELECT o.entry_id, o.user_id INTO v_entry, v_winner FROM public._raffle_owner(p_jackpot_id, v_ticket) o;

  v_manual := coalesce(trim(j.prize_products), '') <> '' OR (j.prize_credit = 0 AND j.prize_spins = 0);

  IF j.prize_spins > 0 THEN
    UPDATE public.golfer_profiles SET spins = spins + j.prize_spins, updated_at = now() WHERE user_id = v_winner;
  END IF;
  IF j.prize_credit > 0 THEN
    SELECT id INTO v_wallet FROM public.wallets WHERE user_id = v_winner FOR UPDATE;
    IF v_wallet IS NULL THEN
      INSERT INTO public.wallets (user_id, balance) VALUES (v_winner, 0) RETURNING id INTO v_wallet;
    END IF;
    UPDATE public.wallets SET balance = balance + j.prize_credit, updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.transactions (user_id, wallet_id, type, amount, description, metadata)
    VALUES (v_winner, v_wallet, 'winnings', j.prize_credit, 'Weekly raffle prize', jsonb_build_object('jackpot_id', p_jackpot_id));
  END IF;

  UPDATE public.weekly_jackpots
  SET winner_user_id = v_winner, winning_entry_id = v_entry, winner_selected_at = now(),
      drawn_at = now(), draw_total = v_total, draw_ticket = v_ticket,
      draw_method = 'secure random ticket (gen_random_uuid, rejection sampling)',
      awarded_at = now(),
      fulfilled_at = CASE WHEN v_manual THEN NULL ELSE now() END,
      status = CASE WHEN v_manual THEN 'closed' ELSE 'fulfilled' END,
      updated_at = now()
  WHERE id = p_jackpot_id;

  IF p_admin IS NOT NULL THEN
    INSERT INTO public.admin_audit_log (admin_user_id, action, entity_type, entity_id, after)
    VALUES (p_admin, 'select_winner', 'weekly_jackpot', p_jackpot_id,
            jsonb_build_object('winner_user_id', v_winner, 'ticket', v_ticket, 'total', v_total));
  END IF;

  RETURN jsonb_build_object('success', true, 'winner_user_id', v_winner, 'ticket', v_ticket, 'total', v_total, 'needs_fulfilment', v_manual);
END;
$$;

-- The schedule calls this. Draws every ended, undrawn week that has a prize.
CREATE OR REPLACE FUNCTION public.run_weekly_raffle()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_n INTEGER := 0;
  v_res JSONB;
BEGIN
  FOR r IN
    SELECT id FROM public.weekly_jackpots
    WHERE status IN ('draft', 'active') AND drawn_at IS NULL AND ends_at <= now()
      AND prize_name IS NOT NULL AND prize_name <> 'Prize to be announced'
    ORDER BY ends_at LIMIT 5
  LOOP
    BEGIN
      v_res := public._raffle_draw(r.id, NULL);
      IF (v_res->>'success')::boolean THEN v_n := v_n + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'raffle draw % failed: %', r.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_n;
END;
$$;

-- Admin "draw now" for a week that has ended (e.g. a prize was added late). Cannot be repeated.
CREATE OR REPLACE FUNCTION public.select_jackpot_winner(p_jackpot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.golfer_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  RETURN public._raffle_draw(p_jackpot_id, auth.uid());
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin: queue prizes for the coming weeks
-- ---------------------------------------------------------------------------
-- p_items: [{ week_start: 'YYYY-MM-DD' (the Sunday the week begins, 8 pm Eastern), prize_name, description?,
--             prize_value?, prize_credit?, prize_spins?, prize_products?, prize_image? }, ...]  (up to 20)
CREATE OR REPLACE FUNCTION public.admin_queue_raffle_prizes(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  it JSONB;
  v_day DATE;
  v_start TIMESTAMPTZ;
  v_id UUID;
  v_drawn TIMESTAMPTZ;
  v_name TEXT;
  v_credit NUMERIC;
  v_spins INTEGER;
  v_saved INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  IF v_admin IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.golfer_profiles WHERE user_id = v_admin AND role IN ('admin', 'super_admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Send between 1 and 20 weeks');
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      v_day := (it->>'week_start')::date;
      IF extract(dow FROM v_day) <> 0 THEN RAISE EXCEPTION '% is not a Sunday', v_day; END IF;
      v_start := (v_day + interval '20 hours') AT TIME ZONE 'America/New_York';
      IF public._raffle_week_end(v_start) <= now() THEN RAISE EXCEPTION '% has already ended', v_day; END IF;
      v_name := nullif(trim(it->>'prize_name'), '');
      IF v_name IS NULL THEN RAISE EXCEPTION '% needs a prize name', v_day; END IF;
      v_credit := coalesce(nullif(it->>'prize_credit', '')::numeric, 0);
      v_spins := coalesce(nullif(it->>'prize_spins', '')::integer, 0);
      IF v_credit < 0 OR v_credit > 10000 OR v_spins < 0 OR v_spins > 10000 THEN RAISE EXCEPTION '% has an invalid credit or Spinz amount', v_day; END IF;

      SELECT id, drawn_at INTO v_id, v_drawn FROM public.weekly_jackpots
      WHERE starts_at = v_start AND status <> 'cancelled' ORDER BY created_at LIMIT 1;
      IF v_id IS NOT NULL AND v_drawn IS NOT NULL THEN RAISE EXCEPTION '% was already drawn', v_day; END IF;

      IF v_id IS NULL THEN
        INSERT INTO public.weekly_jackpots (title, description, prize_name, prize_value, prize_image_url, prize_credit, prize_spins, prize_products, starts_at, ends_at, status)
        VALUES ('Weekly Raffle', it->>'description', v_name, nullif(it->>'prize_value', '')::numeric, nullif(it->>'prize_image', ''),
                v_credit, v_spins, nullif(trim(it->>'prize_products'), ''), v_start, public._raffle_week_end(v_start),
                CASE WHEN v_start <= now() THEN 'active' ELSE 'draft' END)
        RETURNING id INTO v_id;
      ELSE
        UPDATE public.weekly_jackpots
        SET description = it->>'description', prize_name = v_name, prize_value = nullif(it->>'prize_value', '')::numeric,
            prize_image_url = nullif(it->>'prize_image', ''), prize_credit = v_credit, prize_spins = v_spins,
            prize_products = nullif(trim(it->>'prize_products'), ''), updated_at = now()
        WHERE id = v_id;
      END IF;
      INSERT INTO public.admin_audit_log (admin_user_id, action, entity_type, entity_id, after)
      VALUES (v_admin, 'queue_raffle_prize', 'weekly_jackpot', v_id, it);
      v_saved := v_saved + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('week_start', it->>'week_start', 'error', SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'saved', v_saved, 'errors', v_errors);
END;
$$;

-- ---------------------------------------------------------------------------
-- Player views
-- ---------------------------------------------------------------------------
-- Replaces the old "active jackpot" reader: now follows the clock, not a manual status flip.
CREATE OR REPLACE FUNCTION public.get_active_jackpot_for_user()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := public._raffle_current(false);
  v_jackpot JSONB;
  v_mine BIGINT := 0;
  v_total BIGINT := 0;
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('jackpot', NULL, 'user_entries', 0, 'total_entries', 0);
  END IF;
  SELECT to_jsonb(j) INTO v_jackpot FROM public.weekly_jackpots j WHERE id = v_id;
  SELECT coalesce(sum(entry_count), 0) INTO v_total FROM public.jackpot_entries WHERE jackpot_id = v_id;
  SELECT coalesce(sum(entry_count), 0) INTO v_mine FROM public.jackpot_entries WHERE jackpot_id = v_id AND user_id = auth.uid();
  RETURN jsonb_build_object('jackpot', v_jackpot, 'user_entries', v_mine, 'total_entries', v_total);
END;
$$;

-- Everything the Home card needs in one call: this week's prize, my entries, and last week's winner.
CREATE OR REPLACE FUNCTION public.get_raffle_home()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID := public._raffle_current(false);
  j public.weekly_jackpots;
  v_mine BIGINT := 0;
  v_last public.weekly_jackpots;
  v_name TEXT;
  v_this JSONB := NULL;
  v_result JSONB := NULL;
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT * INTO j FROM public.weekly_jackpots WHERE id = v_id;
    SELECT coalesce(sum(entry_count), 0) INTO v_mine FROM public.jackpot_entries WHERE jackpot_id = v_id AND user_id = v_uid;
    v_this := jsonb_build_object(
      'prize_name', CASE WHEN j.prize_name = 'Prize to be announced' THEN NULL ELSE j.prize_name END,
      'prize_credit', j.prize_credit, 'prize_spins', j.prize_spins, 'prize_products', j.prize_products,
      'ends_at', j.ends_at, 'my_entries', v_mine);
  END IF;

  SELECT * INTO v_last FROM public.weekly_jackpots
  WHERE drawn_at IS NOT NULL AND winner_user_id IS NOT NULL AND drawn_at > now() - interval '7 days'
  ORDER BY drawn_at DESC LIMIT 1;
  IF FOUND THEN
    SELECT display_name INTO v_name FROM public.golfer_profiles WHERE user_id = v_last.winner_user_id;
    v_result := jsonb_build_object('id', v_last.id, 'prize_name', v_last.prize_name, 'winner_name', coalesce(v_name, 'A lucky golfer'),
                                   'i_won', v_last.winner_user_id = v_uid, 'drawn_at', v_last.drawn_at);
  END IF;

  RETURN jsonb_build_object('this_week', v_this, 'last_result', v_result);
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._raffle_week_start(TIMESTAMPTZ), public._raffle_week_end(TIMESTAMPTZ),
  public._raffle_current(BOOLEAN), public._raffle_add_entries(UUID, INTEGER), public._raffle_on_clovers(),
  public._raffle_pick(BIGINT), public._raffle_owner(UUID, BIGINT), public._raffle_draw(UUID, UUID),
  public.run_weekly_raffle(), public.award_jackpot_entry(UUID, INTEGER, UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.select_jackpot_winner(UUID), public.admin_queue_raffle_prizes(JSONB),
  public.get_active_jackpot_for_user(), public.get_raffle_home() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_jackpot_winner(UUID), public.admin_queue_raffle_prizes(JSONB),
  public.get_active_jackpot_for_user(), public.get_raffle_home() TO authenticated;

-- ---------------------------------------------------------------------------
-- Schedule: check every 5 minutes; a week is drawn the moment it ends (Sunday 8 pm Eastern).
-- Skipped quietly where pg_cron is not available; admin can still "draw now".
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'weekly-raffle';
    PERFORM cron.schedule('weekly-raffle', '*/5 * * * *', 'SELECT public.run_weekly_raffle()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not schedule the weekly raffle (%). Enable pg_cron in Supabase, then run: SELECT cron.schedule(''weekly-raffle'', ''*/5 * * * *'', ''SELECT public.run_weekly_raffle()'');', SQLERRM;
END $$;
