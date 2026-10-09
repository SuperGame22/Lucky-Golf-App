-- Website (Shopify) purchases earn clovers, and Spinz discounts live on the player's account.
--
-- 1. SITE PURCHASES
--    The Shopify "order paid" notification calls record_site_purchase(email, order, dollars)
--    (service key only). Spend is added up with the same carry-over rule as putt purchases
--    (every $4 in total = 1 clover; leftover dollars keep counting, and light the leaves on Home).
--    The player is found by the order's email, but only a VERIFIED email counts. If nobody has
--    that email yet, the purchase is kept as pending and paid out the moment a player with that
--    verified email signs in (claim_my_purchases), so nothing is lost and nobody has to hurry.
--
-- 2. DISCOUNTS
--    A player has at most one active discount. Winning a new one on the wheel replaces the old
--    one (even a bigger one) and it lasts one month. The database records it; a separate
--    function (issue-discount) turns it into a single-use Shopify code. Expired ones are
--    marked expired the next time they are looked at.
--
-- Needs 20261011120000_spend_carry.sql and 20261010120000_server_side_clovers.sql first.
--
-- Not covered: refunds / cancelled orders do not take clovers back.
--
-- To roll back: drop the tables and functions created here and restore consume_spin(boolean)
--   and spend_carry_on_purchase() from 20261010120000 / 20261011120000.

DO $$
BEGIN
  IF to_regclass('public.spend_progress') IS NULL OR to_regclass('public.spin_wheel_slices') IS NULL
     OR to_regprocedure('public.add_clovers(uuid, integer)') IS NULL OR to_regprocedure('public.consume_spin(boolean)') IS NULL THEN
    RAISE EXCEPTION 'Site purchases and discounts: apply 20261010120000 and 20261011120000 first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Shared: add spend and top up clovers (also used by putt purchases)
-- ---------------------------------------------------------------------------
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
    PERFORM public.add_clovers(p_user_id, v_due);
    UPDATE public.spend_progress SET clovers_given = clovers_given + v_due WHERE user_id = p_user_id;
    RETURN v_due;
  END IF;
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public._apply_spend(UUID, BIGINT, INTEGER) FROM PUBLIC, anon, authenticated;

-- Putt purchases use the shared function (same behaviour as before).
CREATE OR REPLACE FUNCTION public.spend_carry_on_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public._apply_spend(
      NEW.user_id,
      round(coalesce(NEW.amount, 0) * 100)::bigint,
      coalesce((NEW.metadata->>'bonus_clovers')::integer, 0)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let the clover bookkeeping undo a purchase.
    RAISE WARNING 'spend_carry_on_purchase failed for %: %', NEW.user_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_carry_on_purchase() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Site purchases
-- ---------------------------------------------------------------------------
CREATE TABLE public.site_purchases (
  ref TEXT PRIMARY KEY,                         -- the order, e.g. 'shopify:5012345678'
  source TEXT NOT NULL DEFAULT 'shopify',
  email TEXT NOT NULL,                          -- lower-cased
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dollars NUMERIC(12, 2) NOT NULL CHECK (dollars > 0),
  clovers_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  applied_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX site_purchases_pending_idx ON public.site_purchases (email) WHERE applied_at IS NULL;
CREATE INDEX site_purchases_user_idx ON public.site_purchases (user_id, created_at DESC);

ALTER TABLE public.site_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can view their own site purchases" ON public.site_purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.site_purchases FROM anon, authenticated;

-- Called by the Shopify order webhook with the service key.
CREATE OR REPLACE FUNCTION public.record_site_purchase(p_email TEXT, p_ref TEXT, p_dollars NUMERIC, p_source TEXT DEFAULT 'shopify')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(btrim(coalesce(p_email, '')));
  v_user UUID;
  v_inserted INTEGER;
  v_clovers INTEGER;
BEGIN
  IF v_email = '' OR position('@' IN v_email) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email');
  END IF;
  IF p_ref IS NULL OR btrim(p_ref) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing order reference');
  END IF;
  IF p_dollars IS NULL OR p_dollars <= 0 OR p_dollars > 100000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  INSERT INTO public.site_purchases (ref, source, email, dollars)
  VALUES (btrim(p_ref), coalesce(p_source, 'shopify'), v_email, round(p_dollars, 2))
  ON CONFLICT (ref) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  -- Only a verified email identifies a player.
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = v_email AND email_confirmed_at IS NOT NULL LIMIT 1;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', true, 'pending', true);
  END IF;

  v_clovers := public._apply_spend(v_user, round(p_dollars * 100)::bigint);
  UPDATE public.site_purchases SET user_id = v_user, clovers_awarded = v_clovers, applied_at = now() WHERE ref = btrim(p_ref);
  RETURN jsonb_build_object('success', true, 'applied', true, 'clovers', v_clovers);
END;
$$;

-- Sign-in: pay out any website purchases made before this player had a verified account.
CREATE OR REPLACE FUNCTION public.claim_my_purchases()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  r RECORD;
  v_clovers INTEGER;
  v_n INTEGER := 0;
  v_total INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', true, 'claimed', 0, 'clovers', 0, 'unverified', true);
  END IF;

  FOR r IN SELECT ref, dollars FROM public.site_purchases
           WHERE email = v_email AND applied_at IS NULL
           ORDER BY created_at, ref FOR UPDATE SKIP LOCKED LOOP
    v_clovers := public._apply_spend(v_uid, round(r.dollars * 100)::bigint);
    UPDATE public.site_purchases SET user_id = v_uid, clovers_awarded = v_clovers, applied_at = now() WHERE ref = r.ref;
    v_n := v_n + 1;
    v_total := v_total + v_clovers;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'claimed', v_n, 'clovers', v_total);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Discounts
-- ---------------------------------------------------------------------------
CREATE TABLE public.player_discounts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 100),
  source TEXT NOT NULL DEFAULT 'spin',
  spin_log_id BIGINT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced', 'expired', 'used')),
  shopify_code TEXT,
  shopify_rule_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE
);

-- At most one active discount per player: a new one replaces the old one.
CREATE UNIQUE INDEX player_discounts_one_active ON public.player_discounts (user_id) WHERE status = 'active';
CREATE INDEX player_discounts_user_idx ON public.player_discounts (user_id, created_at DESC);

ALTER TABLE public.player_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can view their own discounts" ON public.player_discounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.player_discounts FROM anon, authenticated;
REVOKE USAGE, SELECT, UPDATE ON SEQUENCE public.player_discounts_id_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._grant_discount(p_user_id UUID, p_percent INTEGER, p_spin_log_id BIGINT DEFAULT NULL)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  UPDATE public.player_discounts SET status = 'replaced' WHERE user_id = p_user_id AND status = 'active';
  INSERT INTO public.player_discounts (user_id, percent, spin_log_id, expires_at)
  VALUES (p_user_id, p_percent, p_spin_log_id, now() + interval '1 month')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._grant_discount(UUID, INTEGER, BIGINT) FROM PUBLIC, anon, authenticated;

-- My current discount (and whether it still needs a Shopify code).
CREATE OR REPLACE FUNCTION public.get_my_discount()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.player_discounts;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  UPDATE public.player_discounts SET status = 'expired' WHERE user_id = auth.uid() AND status = 'active' AND expires_at <= now();
  SELECT * INTO d FROM public.player_discounts WHERE user_id = auth.uid() AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'active', false);
  END IF;
  RETURN jsonb_build_object('success', true, 'active', true, 'id', d.id, 'percent', d.percent, 'expires_at', d.expires_at,
                            'code', d.shopify_code, 'needs_code', d.shopify_code IS NULL);
END;
$$;

-- The function that creates the Shopify code records it here (service key only).
CREATE OR REPLACE FUNCTION public.set_discount_code(p_discount_id BIGINT, p_code TEXT, p_rule_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.player_discounts SET shopify_code = p_code, shopify_rule_id = p_rule_id
  WHERE id = p_discount_id AND status = 'active' AND shopify_code IS NULL AND expires_at > now();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Discount is no longer active or already has a code');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- The checkout / order webhook marks it used (service key only).
CREATE OR REPLACE FUNCTION public.mark_discount_used(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.player_discounts SET status = 'used', used_at = now() WHERE shopify_code = p_code AND status = 'active';
  RETURN jsonb_build_object('success', FOUND);
END;
$$;

REVOKE ALL ON FUNCTION public.record_site_purchase(TEXT, TEXT, NUMERIC, TEXT), public.set_discount_code(BIGINT, TEXT, TEXT),
  public.mark_discount_used(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_site_purchase(TEXT, TEXT, NUMERIC, TEXT), public.set_discount_code(BIGINT, TEXT, TEXT),
  public.mark_discount_used(TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.claim_my_purchases(), public.get_my_discount() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_my_purchases(), public.get_my_discount() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. A discount slice on the wheel grants the discount
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_spin(p_server_prize BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_left INTEGER;
  v_credits INTEGER;
  v_total NUMERIC;
  v_r NUMERIC;
  v_acc NUMERIC := 0;
  v_slice public.spin_wheel_slices;
  v_result JSONB;
  v_log_id BIGINT;
  v_percent INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  UPDATE public.golfer_profiles
  SET spins = spins - 1, updated_at = now()
  WHERE user_id = v_uid AND spins > 0
  RETURNING spins INTO v_left;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No spins remaining');
  END IF;

  -- The app that is live before this migration's companion release: unchanged behaviour.
  IF NOT p_server_prize THEN
    IF public.free_putt_roll() THEN
      UPDATE public.golfer_profiles
      SET putt_credits = putt_credits + 1, updated_at = now()
      WHERE user_id = v_uid
      RETURNING putt_credits INTO v_credits;
      RETURN jsonb_build_object('success', true, 'spins', v_left, 'free_putt', true, 'credits', v_credits);
    END IF;
    RETURN jsonb_build_object('success', true, 'spins', v_left, 'free_putt', false);
  END IF;

  SELECT sum(weight) INTO v_total FROM public.spin_wheel_slices;
  IF v_total IS NULL OR v_total <= 0 THEN
    RAISE EXCEPTION 'Spin wheel is not configured';  -- rolls the spin back
  END IF;

  v_r := random() * v_total;
  FOR v_slice IN SELECT * FROM public.spin_wheel_slices ORDER BY idx LOOP
    v_acc := v_acc + v_slice.weight;
    EXIT WHEN v_r < v_acc;
  END LOOP;

  v_result := jsonb_build_object('success', true, 'slice', v_slice.idx, 'kind', v_slice.kind, 'clovers', v_slice.clovers);

  IF v_slice.kind = 'clovers' AND v_slice.clovers > 0 THEN
    PERFORM public.add_clovers(v_uid, v_slice.clovers);
  ELSIF v_slice.kind = 'free_putt' THEN
    UPDATE public.golfer_profiles
    SET putt_credits = putt_credits + 1, updated_at = now()
    WHERE user_id = v_uid
    RETURNING putt_credits INTO v_credits;
    v_result := v_result || jsonb_build_object('credits', v_credits);
  ELSIF v_slice.kind = 'free_spin' THEN
    -- The spin is handed back: the player ends up with the spins they started with.
    UPDATE public.golfer_profiles
    SET spins = spins + 1, updated_at = now()
    WHERE user_id = v_uid
    RETURNING spins INTO v_left;
  END IF;

  INSERT INTO public.spin_log (user_id, slice_idx, kind, label, clovers)
  VALUES (v_uid, v_slice.idx, v_slice.kind, v_slice.label, v_slice.clovers)
  RETURNING id INTO v_log_id;

  -- A discount slice puts that discount on the player's account (replacing any earlier one).
  IF v_slice.kind = 'discount' THEN
    v_percent := nullif(substring(v_slice.label FROM '^([0-9]+)%'), '')::integer;
    IF v_percent IS NOT NULL AND v_percent BETWEEN 1 AND 100 THEN
      PERFORM public._grant_discount(v_uid, v_percent, v_log_id);
      v_result := v_result || jsonb_build_object('discount_percent', v_percent);
    END IF;
  END IF;

  RETURN v_result || jsonb_build_object('spins', v_left);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_spin(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_spin(boolean) TO authenticated;
