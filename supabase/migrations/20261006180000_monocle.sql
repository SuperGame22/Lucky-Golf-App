-- Monocle wedge rangefinder: user settings, Lucky Clover campaigns, spawned clovers and
-- session analytics.
--
-- Written for the Lucky Golf app (Lucky-Golf-App): clovers live in
-- public.golfer_profiles (clovers, total_clovers) and are credited through the existing
-- public.add_clovers(p_user_id, p_amount) function, so collected Monocle clovers show up in
-- the same balance as every other clover and follow whatever rules add_clovers enforces.
--
-- Privacy: nothing here stores camera frames or video. Distance is computed on the
-- device; monocle_sessions only holds summary counters.
--
-- Security: clovers are created and collected only by the SECURITY DEFINER functions
-- at the bottom, which act on auth.uid(). Clients can read their own rows but cannot
-- insert, update or delete clovers or campaigns directly.

-- ---------------------------------------------------------------------------
-- 0. Refuse to apply to a database that is not shaped the way this expects.
--    (The whole migration rolls back, so a mismatch changes nothing.)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.golfer_profiles') IS NULL THEN
    RAISE EXCEPTION 'Monocle migration: public.golfer_profiles not found';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'golfer_profiles'
        AND column_name IN ('user_id', 'clovers', 'total_clovers')) <> 3 THEN
    RAISE EXCEPTION 'Monocle migration: golfer_profiles needs user_id, clovers and total_clovers columns';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'add_clovers'
      AND p.proargnames @> ARRAY['p_user_id', 'p_amount']
  ) THEN
    RAISE EXCEPTION 'Monocle migration: public.add_clovers(p_user_id, p_amount) not found';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Per-user settings (stick height, custom wedge distances, camera calibration)
-- ---------------------------------------------------------------------------
CREATE TABLE public.monocle_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stick_height_in NUMERIC NOT NULL DEFAULT 84 CHECK (stick_height_in BETWEEN 48 AND 144),
  -- null = use the app's default wedge distances
  wedge_config JSONB,
  -- { "<camera key>": { "ratio": 0.78, "at": "2026-10-06T..." } }
  calibrations JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.monocle_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monocle settings"
  ON public.monocle_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monocle settings"
  ON public.monocle_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monocle settings"
  ON public.monocle_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.monocle_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_monocle_settings_updated_at
  BEFORE UPDATE ON public.monocle_settings
  FOR EACH ROW EXECUTE FUNCTION public.monocle_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Clover campaigns: edit these rows (SQL editor / dashboard) to run promotions.
-- ---------------------------------------------------------------------------
CREATE TABLE public.clover_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Highest priority among currently-running campaigns wins.
  priority INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  -- Chance that a poll produces a clover (after the spacing rule below).
  spawn_chance NUMERIC NOT NULL DEFAULT 0.5 CHECK (spawn_chance BETWEEN 0 AND 1),
  -- How often the app asks the server whether a clover should appear.
  poll_interval_seconds INTEGER NOT NULL DEFAULT 45 CHECK (poll_interval_seconds >= 10),
  -- Minimum gap between two clovers for one user.
  min_interval_seconds INTEGER NOT NULL DEFAULT 90 CHECK (min_interval_seconds >= 0),
  -- How long a clover stays on screen before it expires.
  lifetime_seconds INTEGER NOT NULL DEFAULT 25 CHECK (lifetime_seconds BETWEEN 5 AND 120),
  -- Max clovers a user can collect per UTC day.
  daily_cap INTEGER NOT NULL DEFAULT 10 CHECK (daily_cap >= 0),
  reward INTEGER NOT NULL DEFAULT 1 CHECK (reward >= 1),
  -- Bonus multiplier for promotions (e.g. 2.0 for a double-clover weekend).
  multiplier NUMERIC NOT NULL DEFAULT 1.0 CHECK (multiplier >= 0),
  -- Special clovers: chance per spawn, and how much more they are worth.
  rare_chance NUMERIC NOT NULL DEFAULT 0.05 CHECK (rare_chance BETWEEN 0 AND 1),
  rare_reward_multiplier NUMERIC NOT NULL DEFAULT 5 CHECK (rare_reward_multiplier >= 1),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clover_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view active clover campaigns"
  ON public.clover_campaigns FOR SELECT TO authenticated
  USING (is_active);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.clover_campaigns FROM anon, authenticated;

INSERT INTO public.clover_campaigns (slug, name)
VALUES ('default', 'Everyday Lucky Clovers');

-- ---------------------------------------------------------------------------
-- 3. Clovers that have appeared for a user
-- ---------------------------------------------------------------------------
CREATE TABLE public.monocle_clovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.clover_campaigns(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('standard', 'rare')),
  reward INTEGER NOT NULL CHECK (reward >= 1),
  status TEXT NOT NULL DEFAULT 'spawned' CHECK (status IN ('spawned', 'collected', 'expired')),
  spawned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  collected_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX monocle_clovers_user_spawned_idx ON public.monocle_clovers (user_id, spawned_at DESC);
CREATE INDEX monocle_clovers_user_collected_idx ON public.monocle_clovers (user_id, collected_at)
  WHERE status = 'collected';

ALTER TABLE public.monocle_clovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clovers"
  ON public.monocle_clovers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.monocle_clovers FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Session analytics (counters only, never footage)
-- ---------------------------------------------------------------------------
CREATE TABLE public.monocle_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds BETWEEN 0 AND 86400),
  device_tier TEXT CHECK (device_tier IN ('high', 'ok', 'low')),
  camera_width INTEGER CHECK (camera_width BETWEEN 0 AND 20000),
  camera_height INTEGER CHECK (camera_height BETWEEN 0 AND 20000),
  avg_fps NUMERIC CHECK (avg_fps BETWEEN 0 AND 1000),
  avg_proc_ms NUMERIC CHECK (avg_proc_ms BETWEEN 0 AND 100000),
  frames INTEGER CHECK (frames >= 0),
  locks INTEGER CHECK (locks >= 0),
  brackets INTEGER CHECK (brackets >= 0),
  calibrated BOOLEAN,
  old_phone_warning BOOLEAN,
  max_locked_yards INTEGER CHECK (max_locked_yards BETWEEN 0 AND 2000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX monocle_sessions_user_idx ON public.monocle_sessions (user_id, started_at DESC);

ALTER TABLE public.monocle_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monocle sessions"
  ON public.monocle_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can log their own monocle sessions"
  ON public.monocle_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

REVOKE UPDATE, DELETE, TRUNCATE ON public.monocle_sessions FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. monocle_request_clover(): the server decides whether a clover appears
-- ---------------------------------------------------------------------------
-- The app polls this every few tens of seconds while Monocle is open. Frequency,
-- spacing, the daily cap, rare clovers and multipliers all come from the active
-- clover_campaigns row, so promotions are a data change, not a deploy.
CREATE OR REPLACE FUNCTION public.monocle_request_clover()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_camp public.clover_campaigns%ROWTYPE;
  v_active public.monocle_clovers%ROWTYPE;
  v_last TIMESTAMP WITH TIME ZONE;
  v_day_start TIMESTAMP WITH TIME ZONE := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_collected INTEGER;
  v_rare BOOLEAN;
  v_reward INTEGER;
  v_id UUID;
  v_exp TIMESTAMP WITH TIME ZONE;
  v_wait INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Serialise per user so two open tabs cannot both spawn a clover.
  PERFORM pg_advisory_xact_lock(hashtext('monocle_clover:' || v_uid::text));

  SELECT * INTO v_camp
  FROM public.clover_campaigns
  WHERE is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  ORDER BY priority DESC, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('spawned', false, 'reason', 'no_campaign', 'retry_in_seconds', 300);
  END IF;

  UPDATE public.monocle_clovers
  SET status = 'expired'
  WHERE user_id = v_uid AND status = 'spawned' AND expires_at <= now();

  -- A clover is already on screen (e.g. the page was reloaded): hand it back.
  SELECT * INTO v_active
  FROM public.monocle_clovers
  WHERE user_id = v_uid AND status = 'spawned' AND expires_at > now()
  ORDER BY spawned_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'spawned', true,
      'clover', jsonb_build_object(
        'id', v_active.id, 'kind', v_active.kind, 'reward', v_active.reward, 'expires_at', v_active.expires_at
      ),
      'retry_in_seconds', v_camp.poll_interval_seconds
    );
  END IF;

  SELECT count(*) INTO v_collected
  FROM public.monocle_clovers
  WHERE user_id = v_uid AND status = 'collected' AND collected_at >= v_day_start;

  IF v_collected >= v_camp.daily_cap THEN
    RETURN jsonb_build_object('spawned', false, 'reason', 'daily_cap', 'retry_in_seconds', 1800);
  END IF;

  SELECT max(spawned_at) INTO v_last FROM public.monocle_clovers WHERE user_id = v_uid;
  IF v_last IS NOT NULL AND v_last + make_interval(secs => v_camp.min_interval_seconds) > now() THEN
    v_wait := ceil(extract(epoch FROM (v_last + make_interval(secs => v_camp.min_interval_seconds) - now())))::INTEGER + 1;
    RETURN jsonb_build_object('spawned', false, 'reason', 'too_soon', 'retry_in_seconds', v_wait);
  END IF;

  IF random() > v_camp.spawn_chance THEN
    RETURN jsonb_build_object('spawned', false, 'reason', 'no_roll', 'retry_in_seconds', v_camp.poll_interval_seconds);
  END IF;

  v_rare := random() < v_camp.rare_chance;
  v_reward := GREATEST(
    1,
    floor(v_camp.reward * v_camp.multiplier * CASE WHEN v_rare THEN v_camp.rare_reward_multiplier ELSE 1 END)::INTEGER
  );
  v_exp := now() + make_interval(secs => v_camp.lifetime_seconds);

  INSERT INTO public.monocle_clovers (user_id, campaign_id, kind, reward, expires_at)
  VALUES (v_uid, v_camp.id, CASE WHEN v_rare THEN 'rare' ELSE 'standard' END, v_reward, v_exp)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'spawned', true,
    'clover', jsonb_build_object(
      'id', v_id, 'kind', CASE WHEN v_rare THEN 'rare' ELSE 'standard' END, 'reward', v_reward, 'expires_at', v_exp
    ),
    'retry_in_seconds', v_camp.poll_interval_seconds
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. monocle_collect_clover(): collect once, atomically, and credit the player's clovers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.monocle_collect_clover(p_clover_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clover public.monocle_clovers%ROWTYPE;
  v_cap INTEGER;
  v_day_start TIMESTAMP WITH TIME ZONE := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_collected INTEGER;
  v_has_profile BOOLEAN;
  v_new_balance INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('monocle_clover:' || v_uid::text));

  -- Only the owner's clover can be found; anything else looks like "not found".
  SELECT * INTO v_clover
  FROM public.monocle_clovers
  WHERE id = p_clover_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_clover.status = 'collected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_collected');
  END IF;

  IF v_clover.status = 'expired' OR v_clover.expires_at <= now() THEN
    UPDATE public.monocle_clovers SET status = 'expired' WHERE id = v_clover.id AND status = 'spawned';
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  -- A person cannot tap a clover faster than it can appear on screen.
  IF now() - v_clover.spawned_at < interval '600 milliseconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_fast');
  END IF;

  SELECT daily_cap INTO v_cap FROM public.clover_campaigns WHERE id = v_clover.campaign_id;
  v_cap := COALESCE(v_cap, 10);
  SELECT count(*) INTO v_collected
  FROM public.monocle_clovers
  WHERE user_id = v_uid AND status = 'collected' AND collected_at >= v_day_start;
  IF v_collected >= v_cap THEN
    RETURN jsonb_build_object('success', false, 'error', 'daily_cap');
  END IF;

  -- The player's profile must exist before anything is marked collected.
  SELECT true INTO v_has_profile FROM public.golfer_profiles WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;

  UPDATE public.monocle_clovers
  SET status = 'collected', collected_at = now()
  WHERE id = v_clover.id;

  -- Credit through the app's own function so every clover follows the same rules. If it
  -- raises, this whole function (including the status change above) rolls back.
  PERFORM public.add_clovers(p_user_id := v_uid, p_amount := v_clover.reward);

  SELECT clovers INTO v_new_balance FROM public.golfer_profiles WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'clovers_awarded', v_clover.reward,
    'new_balance', v_new_balance,
    'kind', v_clover.kind
  );
END;
$$;

-- Only signed-in users may call these.
REVOKE ALL ON FUNCTION public.monocle_request_clover() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.monocle_collect_clover(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monocle_request_clover() TO authenticated;
GRANT EXECUTE ON FUNCTION public.monocle_collect_clover(UUID) TO authenticated;
