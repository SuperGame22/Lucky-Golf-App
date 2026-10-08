-- Carrying leftover dollars toward the next clover.
--
-- The rule is 1 clover per $4 spent, but each putt purchase was rounded down on its own, so
-- five $1 putts earned nothing. From now on spend adds up per player: every $4 of total spend
-- is one clover, and the dollars in between are kept (a $6 spend is 1 clover and 2 leaves
-- lit; the next $2 completes another clover).
--
-- How it works without touching the live payment functions: credit_putts() already writes a
-- 'purchase' row to public.transactions (metadata has 'putts' and 'bonus_clovers', the clovers
-- it gave for that purchase). A trigger on those rows adds the dollars to spend_progress and
-- tops the player up to floor(total spend / $4) clovers, counting what credit_putts already
-- gave. A purchase can never fail because of this: any error in the top-up is logged as a
-- warning and the purchase goes through unchanged.
--
-- Home page: the same totals feed the clover on Home. Each dollar spent lights one leaf, four
-- leaves make a clover, and the leaves left over stay lit. get_home_clovers() now also says
-- how many leaves are lit already (rest_leaves) and how many are new (pending_leaves).
--
-- Not counted: clover packs bought directly (their clovers are explicit, not a rate) and
-- wallet top-ups. Promotions multipliers are not applied here.
--
-- Needs 20261009120000_home_clover_state.sql and 20261010120000_server_side_clovers.sql first.
--
-- To roll back: DROP TRIGGER spend_carry_after_purchase ON public.transactions;
--   DROP FUNCTION public.spend_carry_on_purchase(); DROP TABLE public.spend_progress;
--   then re-run the two home-clover functions from 20261009120000_home_clover_state.sql.

DO $$
BEGIN
  IF to_regclass('public.transactions') IS NULL THEN
    RAISE EXCEPTION 'Spend carry: public.transactions not found';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transactions'
        AND column_name IN ('user_id', 'type', 'amount', 'metadata')) <> 4 THEN
    RAISE EXCEPTION 'Spend carry: transactions needs user_id, type, amount and metadata columns';
  END IF;
  IF to_regprocedure('public.add_clovers(uuid, integer)') IS NULL THEN
    RAISE EXCEPTION 'Spend carry: public.add_clovers(uuid, integer) not found';
  END IF;
  IF to_regprocedure('public._home_clover_state(uuid)') IS NULL OR to_regprocedure('public.ack_home_clovers(integer)') IS NULL THEN
    RAISE EXCEPTION 'Spend carry: apply 20261009120000_home_clover_state.sql first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Running total of spend per player
-- ---------------------------------------------------------------------------
CREATE TABLE public.spend_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cents_total BIGINT NOT NULL DEFAULT 0 CHECK (cents_total >= 0),
  clovers_given INTEGER NOT NULL DEFAULT 0 CHECK (clovers_given >= 0),  -- clovers handed out for this spend so far
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spend_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own spend progress"
  ON public.spend_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spend_progress FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Every putt purchase adds to the total and tops the clovers up
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spend_carry_on_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cents BIGINT;
  v_bonus INTEGER;
  v_total BIGINT;
  v_given INTEGER;
  v_due INTEGER;
BEGIN
  BEGIN
    v_cents := round(coalesce(NEW.amount, 0) * 100);
    IF v_cents <= 0 THEN
      RETURN NEW;
    END IF;
    v_bonus := coalesce((NEW.metadata->>'bonus_clovers')::integer, 0);

    INSERT INTO public.spend_progress (user_id, cents_total, clovers_given)
    VALUES (NEW.user_id, v_cents, v_bonus)
    ON CONFLICT (user_id) DO UPDATE
      SET cents_total = public.spend_progress.cents_total + v_cents,
          clovers_given = public.spend_progress.clovers_given + v_bonus,
          updated_at = now()
    RETURNING cents_total, clovers_given INTO v_total, v_given;

    v_due := (v_total / 400)::integer - v_given;
    IF v_due > 0 THEN
      PERFORM public.add_clovers(NEW.user_id, v_due);
      UPDATE public.spend_progress SET clovers_given = clovers_given + v_due WHERE user_id = NEW.user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never let the clover bookkeeping undo a purchase.
    RAISE WARNING 'spend_carry_on_purchase failed for %: %', NEW.user_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_carry_on_purchase() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER spend_carry_after_purchase
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  WHEN (NEW.type::text = 'purchase' AND NEW.metadata ? 'putts')
  EXECUTE FUNCTION public.spend_carry_on_purchase();

-- ---------------------------------------------------------------------------
-- 3. Home page: leaves
-- ---------------------------------------------------------------------------
ALTER TABLE public.home_clover_state ADD COLUMN seen_cents BIGINT NOT NULL DEFAULT 0 CHECK (seen_cents >= 0);

CREATE OR REPLACE FUNCTION public._home_clover_state(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clovers INTEGER;
  v_total INTEGER;
  v_cents BIGINT;
  v_this_week DATE := (date_trunc('week', now() AT TIME ZONE 'UTC'))::date;
  v_state public.home_clover_state;
BEGIN
  SELECT clovers, total_clovers INTO v_clovers, v_total
  FROM public.golfer_profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  SELECT coalesce(cents_total, 0) INTO v_cents FROM public.spend_progress WHERE user_id = p_user_id;
  v_cents := coalesce(v_cents, 0);

  INSERT INTO public.home_clover_state (user_id, seen_total, seen_cents, week_start, week_count)
  VALUES (p_user_id, v_total, v_cents, v_this_week, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.home_clover_state
  SET week_start = v_this_week, week_count = 0, updated_at = now()
  WHERE user_id = p_user_id AND week_start < v_this_week;

  SELECT * INTO v_state FROM public.home_clover_state WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'clovers', v_clovers,
    'total', v_total,
    'seen_total', v_state.seen_total,
    'pending', greatest(v_total - v_state.seen_total, 0),
    'week_count', v_state.week_count,
    'cents', v_cents,
    'seen_cents', v_state.seen_cents,
    -- one leaf per whole dollar; four leaves make a clover
    'pending_leaves', greatest((v_cents / 100) - (v_state.seen_cents / 100), 0),
    'rest_leaves', ((v_state.seen_cents % 400) / 100),
    'spend_pending_clovers', greatest((v_cents / 400) - (v_state.seen_cents / 400), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._home_clover_state(UUID) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.ack_home_clovers(INTEGER);

-- p_seen_cents: how much spend the page has shown. Left out (older app), it means "all of it".
CREATE OR REPLACE FUNCTION public.ack_home_clovers(p_seen_total INTEGER, p_seen_cents BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_total INTEGER;
  v_cents BIGINT;
  v_old INTEGER;
  v_old_cents BIGINT;
  v_new INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_seen_total IS NULL OR p_seen_total < 0 OR (p_seen_cents IS NOT NULL AND p_seen_cents < 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  PERFORM public._home_clover_state(v_uid);

  SELECT total_clovers INTO v_total FROM public.golfer_profiles WHERE user_id = v_uid;
  SELECT coalesce(cents_total, 0) INTO v_cents FROM public.spend_progress WHERE user_id = v_uid;
  v_cents := coalesce(v_cents, 0);
  SELECT seen_total, seen_cents INTO v_old, v_old_cents FROM public.home_clover_state WHERE user_id = v_uid FOR UPDATE;

  v_new := least(greatest(v_old, p_seen_total), v_total);

  UPDATE public.home_clover_state
  SET seen_total = v_new,
      seen_cents = least(greatest(v_old_cents, coalesce(p_seen_cents, v_cents)), v_cents),
      week_count = week_count + greatest(v_new - v_old, 0),
      updated_at = now()
  WHERE user_id = v_uid;

  RETURN public._home_clover_state(v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.ack_home_clovers(INTEGER, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ack_home_clovers(INTEGER, BIGINT) TO authenticated;
