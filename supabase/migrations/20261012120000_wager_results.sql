-- Lucky Wagers: the database decides the winner, and other players confirm it.
--
-- Until now the host's phone worked out who won and told settle_competition() to pay them.
-- Now:
--   1. Every player's hole scores are saved in the database as they play (wager_submit_score).
--   2. When all 9 holes are in, the host asks for the result (wager_propose_result). The
--      database works out the winner from the saved scores and the wager mode; nobody types a winner.
--   3. The other players confirm or dispute that result (wager_confirm_result). The host's own
--      agreement is implied. The pot is paid once a strict majority of the players agree:
--          2 players: the partner must confirm            (1 partner)
--          3 players: the host needs one partner          (1 partner)
--          4 players: the host needs two partners         (2 partners)
--      i.e. partners needed = players / 2, rounded down.
--      If majority becomes impossible (too many disputes) the wager goes to REVIEW.
--   4. An admin can push a wager in review (or one that never got confirmed) through, or refund
--      every buy-in (admin_resolve_wager). Anyone in the wager can flag it for review.
--   5. Ties split the pot evenly (any odd cent goes to the earliest-joined tied player).
--
-- This step only ADDS things. settle_competition() is closed to everything except a host
-- cancelling a wager nobody else joined by 20261012130000_close_legacy_settle.sql, which
-- should be run once the app release that goes with this is live.
--
-- To roll back: drop the functions and tables created here (wager_* / _wager_* / admin_*wager*).

DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'competitions'
        AND column_name IN ('id', 'creator_id', 'buy_in', 'pot_total', 'status', 'winner_id')) <> 6 THEN
    RAISE EXCEPTION 'Wager results: competitions needs id, creator_id, buy_in, pot_total, status, winner_id';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'competition_players'
        AND column_name IN ('competition_id', 'user_id', 'has_paid', 'created_at')) <> 4 THEN
    RAISE EXCEPTION 'Wager results: competition_players needs competition_id, user_id, has_paid, created_at';
  END IF;
  IF to_regclass('public.wallets') IS NULL OR to_regclass('public.transactions') IS NULL THEN
    RAISE EXCEPTION 'Wager results: wallets / transactions not found';
  END IF;
  IF to_regclass('public.golfer_profiles') IS NULL THEN
    RAISE EXCEPTION 'Wager results: golfer_profiles not found';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.wager_games (
  competition_id UUID PRIMARY KEY REFERENCES public.competitions(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('winner-takes-all', 'king-of-pars')),
  holes INTEGER NOT NULL DEFAULT 9 CHECK (holes BETWEEN 1 AND 18),
  pars INTEGER[] NOT NULL DEFAULT ARRAY[4,3,5,4,4,3,5,4,4],
  state TEXT NOT NULL DEFAULT 'playing' CHECK (state IN ('playing', 'awaiting', 'review', 'paid', 'refunded')),
  result JSONB,
  proposed_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.wager_scores (
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hole INTEGER NOT NULL CHECK (hole >= 1),
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 15),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (competition_id, user_id, hole)
);

CREATE TABLE public.wager_confirmations (
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agrees BOOLEAN NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (competition_id, user_id)
);

ALTER TABLE public.wager_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wager_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wager_confirmations ENABLE ROW LEVEL SECURITY;

-- Players in a wager can read its records; nobody can write them directly.
CREATE POLICY "Wager players can view the game" ON public.wager_games FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.competition_players cp WHERE cp.competition_id = wager_games.competition_id AND cp.user_id = auth.uid()));
CREATE POLICY "Wager players can view scores" ON public.wager_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.competition_players cp WHERE cp.competition_id = wager_scores.competition_id AND cp.user_id = auth.uid()));
CREATE POLICY "Wager players can view confirmations" ON public.wager_confirmations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.competition_players cp WHERE cp.competition_id = wager_confirmations.competition_id AND cp.user_id = auth.uid()));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.wager_games, public.wager_scores, public.wager_confirmations FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internals (not callable by players)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._wager_is_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.golfer_profiles WHERE user_id = p_user_id AND role IN ('admin', 'super_admin'));
$$;

-- Standings from the saved scores: {complete, players:[...], winners:[...]}
CREATE OR REPLACE FUNCTION public._wager_standings(p_competition_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g public.wager_games;
  v_players JSONB;
  v_complete BOOLEAN;
  v_winners JSONB;
BEGIN
  SELECT * INTO g FROM public.wager_games WHERE competition_id = p_competition_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  WITH r AS (
    SELECT cp.user_id, cp.created_at AS joined_at,
           count(s.hole)::int AS holes_scored,
           coalesce(sum(s.score), 0)::int AS total,
           count(*) FILTER (WHERE s.score <= g.pars[s.hole])::int AS pars_won
    FROM public.competition_players cp
    LEFT JOIN public.wager_scores s ON s.competition_id = cp.competition_id AND s.user_id = cp.user_id AND s.hole <= g.holes
    WHERE cp.competition_id = p_competition_id AND cp.has_paid
    GROUP BY cp.user_id, cp.created_at
  )
  SELECT jsonb_agg(jsonb_build_object('user_id', user_id, 'holes_scored', holes_scored, 'total', total, 'pars_won', pars_won) ORDER BY joined_at, user_id),
         bool_and(holes_scored = g.holes)
  INTO v_players, v_complete
  FROM r;

  IF v_players IS NULL THEN
    RETURN jsonb_build_object('complete', false, 'players', '[]'::jsonb, 'winners', '[]'::jsonb);
  END IF;

  IF g.mode = 'winner-takes-all' THEN
    SELECT jsonb_agg(p->>'user_id' ORDER BY ord) INTO v_winners
    FROM jsonb_array_elements(v_players) WITH ORDINALITY AS t(p, ord)
    WHERE (p->>'total')::int = (SELECT min((q->>'total')::int) FROM jsonb_array_elements(v_players) q);
  ELSE
    SELECT jsonb_agg(p->>'user_id' ORDER BY ord) INTO v_winners
    FROM jsonb_array_elements(v_players) WITH ORDINALITY AS t(p, ord)
    WHERE (p->>'pars_won')::int = (SELECT max((q->>'pars_won')::int) FROM jsonb_array_elements(v_players) q);
  END IF;

  RETURN jsonb_build_object('complete', coalesce(v_complete, false), 'players', v_players, 'winners', coalesce(v_winners, '[]'::jsonb));
END;
$$;

-- Pay the pot to the winners (split evenly; odd cents to the earliest-joined winners).
CREATE OR REPLACE FUNCTION public._wager_pay(p_competition_id UUID, p_resolved_by UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.competitions;
  g public.wager_games;
  v_winners UUID[];
  v_k INTEGER;
  v_pot_cents BIGINT;
  v_share BIGINT;
  v_extra BIGINT;
  w UUID;
  i INTEGER := 0;
  v_wallet UUID;
  v_cents BIGINT;
BEGIN
  SELECT * INTO c FROM public.competitions WHERE id = p_competition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Competition not found'; END IF;
  IF c.status = 'completed' THEN RETURN jsonb_build_object('success', true, 'duplicate', true); END IF;
  IF c.status = 'cancelled' THEN RAISE EXCEPTION 'Competition was cancelled'; END IF;

  SELECT * INTO g FROM public.wager_games WHERE competition_id = p_competition_id FOR UPDATE;
  IF NOT FOUND OR g.result IS NULL THEN RAISE EXCEPTION 'No result to pay'; END IF;

  -- winners in join order
  SELECT array_agg(u ORDER BY cp.created_at, cp.user_id) INTO v_winners
  FROM (SELECT (jsonb_array_elements_text(g.result->'winners'))::uuid AS u) x
  JOIN public.competition_players cp ON cp.competition_id = p_competition_id AND cp.user_id = x.u AND cp.has_paid;
  v_k := coalesce(array_length(v_winners, 1), 0);
  IF v_k = 0 THEN RAISE EXCEPTION 'No winner in the result'; END IF;

  v_pot_cents := round(c.pot_total * 100);
  v_share := v_pot_cents / v_k;
  v_extra := v_pot_cents - v_share * v_k;

  FOREACH w IN ARRAY v_winners LOOP
    i := i + 1;
    v_cents := v_share + CASE WHEN i <= v_extra THEN 1 ELSE 0 END;
    SELECT id INTO v_wallet FROM public.wallets WHERE user_id = w FOR UPDATE;
    IF v_wallet IS NULL THEN
      INSERT INTO public.wallets (user_id, balance) VALUES (w, 0) RETURNING id INTO v_wallet;
    END IF;
    UPDATE public.wallets SET balance = balance + (v_cents::numeric / 100), updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.transactions (user_id, wallet_id, type, amount, description, metadata)
    VALUES (w, v_wallet, 'winnings', v_cents::numeric / 100,
            CASE WHEN v_k > 1 THEN 'Wager winnings (split)' ELSE 'Won foursome wager' END,
            jsonb_build_object('competition_id', p_competition_id, 'split_between', v_k));
  END LOOP;

  UPDATE public.competitions SET status = 'completed', winner_id = v_winners[1], updated_at = now() WHERE id = p_competition_id;
  UPDATE public.wager_games SET state = 'paid', resolved_at = now(), resolved_by = p_resolved_by WHERE competition_id = p_competition_id;

  RETURN jsonb_build_object('success', true, 'winners', to_jsonb(v_winners), 'pot', c.pot_total);
END;
$$;

-- Give every paying player their buy-in back.
CREATE OR REPLACE FUNCTION public._wager_refund(p_competition_id UUID, p_resolved_by UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.competitions;
  r RECORD;
  v_wallet UUID;
  v_n INTEGER := 0;
BEGIN
  SELECT * INTO c FROM public.competitions WHERE id = p_competition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Competition not found'; END IF;
  IF c.status IN ('completed', 'cancelled') THEN RETURN jsonb_build_object('success', true, 'duplicate', true); END IF;

  FOR r IN SELECT user_id FROM public.competition_players WHERE competition_id = p_competition_id AND has_paid ORDER BY created_at, user_id LOOP
    SELECT id INTO v_wallet FROM public.wallets WHERE user_id = r.user_id FOR UPDATE;
    IF v_wallet IS NULL THEN
      INSERT INTO public.wallets (user_id, balance) VALUES (r.user_id, 0) RETURNING id INTO v_wallet;
    END IF;
    UPDATE public.wallets SET balance = balance + c.buy_in, updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.transactions (user_id, wallet_id, type, amount, description, metadata)
    VALUES (r.user_id, v_wallet, 'refund', c.buy_in, 'Wager buy-in refunded', jsonb_build_object('competition_id', p_competition_id));
    v_n := v_n + 1;
  END LOOP;

  UPDATE public.competitions SET status = 'cancelled', updated_at = now() WHERE id = p_competition_id;
  UPDATE public.wager_games SET state = 'refunded', resolved_at = now(), resolved_by = p_resolved_by WHERE competition_id = p_competition_id;
  RETURN jsonb_build_object('success', true, 'refunded', v_n, 'buy_in', c.buy_in);
END;
$$;

-- After every confirmation: pay, send to review, or keep waiting.
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
  v_needed := v_n / 2;  -- partners who must agree (the host's agreement is implied): 2->1, 3->1, 4->2
  SELECT count(*) FILTER (WHERE wc.agrees), count(*) FILTER (WHERE NOT wc.agrees) INTO v_yes, v_no
  FROM public.wager_confirmations wc
  JOIN public.competition_players cp ON cp.competition_id = wc.competition_id AND cp.user_id = wc.user_id AND cp.has_paid
  WHERE wc.competition_id = p_competition_id AND wc.user_id <> c.creator_id;

  IF v_yes >= v_needed THEN
    v_paid := public._wager_pay(p_competition_id, NULL);
    RETURN jsonb_build_object('state', 'paid', 'payout', v_paid);
  ELSIF v_no > (v_n - 1) - v_needed THEN
    UPDATE public.wager_games SET state = 'review' WHERE competition_id = p_competition_id;
    RETURN jsonb_build_object('state', 'review');
  END IF;
  RETURN jsonb_build_object('state', 'awaiting', 'confirmed', v_yes, 'needed', v_needed);
END;
$$;

REVOKE ALL ON FUNCTION public._wager_is_admin(UUID), public._wager_standings(UUID), public._wager_pay(UUID, UUID),
  public._wager_refund(UUID, UUID), public._wager_evaluate(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Player functions
-- ---------------------------------------------------------------------------
-- Host, once, right after create_competition(): which game is being played.
CREATE OR REPLACE FUNCTION public.wager_set_mode(p_competition_id UUID, p_mode TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.competitions;
  g public.wager_games;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF p_mode NOT IN ('winner-takes-all', 'king-of-pars') THEN RETURN jsonb_build_object('success', false, 'error', 'Unknown mode'); END IF;
  SELECT * INTO c FROM public.competitions WHERE id = p_competition_id;
  IF NOT FOUND OR c.creator_id <> auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'Only the host can set the mode'); END IF;
  IF c.status IN ('completed', 'cancelled') THEN RETURN jsonb_build_object('success', false, 'error', 'Competition is over'); END IF;

  SELECT * INTO g FROM public.wager_games WHERE competition_id = p_competition_id;
  IF FOUND THEN
    IF g.mode <> p_mode THEN RETURN jsonb_build_object('success', false, 'error', 'Mode already set'); END IF;
    RETURN jsonb_build_object('success', true, 'mode', g.mode);
  END IF;
  INSERT INTO public.wager_games (competition_id, mode) VALUES (p_competition_id, p_mode);
  RETURN jsonb_build_object('success', true, 'mode', p_mode);
END;
$$;

-- Any paying player: save my score for a hole (can be corrected until the host asks for the result).
CREATE OR REPLACE FUNCTION public.wager_submit_score(p_competition_id UUID, p_hole INTEGER, p_score INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.wager_games;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT * INTO g FROM public.wager_games WHERE competition_id = p_competition_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Wager not set up'); END IF;
  IF g.state <> 'playing' THEN RETURN jsonb_build_object('success', false, 'error', 'Scores are closed'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.competition_players WHERE competition_id = p_competition_id AND user_id = auth.uid() AND has_paid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a paying player in this wager');
  END IF;
  IF p_hole IS NULL OR p_hole < 1 OR p_hole > g.holes OR p_score IS NULL OR p_score < 1 OR p_score > 15 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid hole or score');
  END IF;

  INSERT INTO public.wager_scores (competition_id, user_id, hole, score)
  VALUES (p_competition_id, auth.uid(), p_hole, p_score)
  ON CONFLICT (competition_id, user_id, hole) DO UPDATE SET score = EXCLUDED.score, updated_at = now();
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Host: all scores are in, work out the result and ask the others to confirm.
CREATE OR REPLACE FUNCTION public.wager_propose_result(p_competition_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.competitions;
  g public.wager_games;
  v_st JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT * INTO c FROM public.competitions WHERE id = p_competition_id;
  IF NOT FOUND OR c.creator_id <> auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'Only the host can finish the wager'); END IF;
  SELECT * INTO g FROM public.wager_games WHERE competition_id = p_competition_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Wager not set up'); END IF;
  IF g.state <> 'playing' THEN RETURN jsonb_build_object('success', true, 'state', g.state); END IF;

  v_st := public._wager_standings(p_competition_id);
  IF NOT (v_st->>'complete')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not every player has all their scores in yet', 'standings', v_st);
  END IF;
  IF (SELECT count(*) FROM public.competition_players WHERE competition_id = p_competition_id AND has_paid) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A wager needs at least two paying players');
  END IF;

  UPDATE public.wager_games SET state = 'awaiting', result = v_st, proposed_at = now() WHERE competition_id = p_competition_id;
  RETURN jsonb_build_object('success', true, 'state', 'awaiting', 'standings', v_st);
END;
$$;

-- Partners: "yes, that is right" or "no, that is wrong".
CREATE OR REPLACE FUNCTION public.wager_confirm_result(p_competition_id UUID, p_agrees BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.competitions;
  g public.wager_games;
  v_eval JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF p_agrees IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Say yes or no'); END IF;
  SELECT * INTO c FROM public.competitions WHERE id = p_competition_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Wager not found'); END IF;
  IF c.creator_id = auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'The host proposed this result, so only partners confirm'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.competition_players WHERE competition_id = p_competition_id AND user_id = auth.uid() AND has_paid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a paying player in this wager');
  END IF;
  SELECT * INTO g FROM public.wager_games WHERE competition_id = p_competition_id FOR UPDATE;
  IF NOT FOUND OR g.state <> 'awaiting' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This wager is not waiting for confirmation', 'state', g.state);
  END IF;

  INSERT INTO public.wager_confirmations (competition_id, user_id, agrees)
  VALUES (p_competition_id, auth.uid(), p_agrees)
  ON CONFLICT (competition_id, user_id) DO UPDATE SET agrees = EXCLUDED.agrees, updated_at = now();

  v_eval := public._wager_evaluate(p_competition_id);
  RETURN jsonb_build_object('success', true) || v_eval;
END;
$$;

-- Anyone in the wager: something is wrong (stuck, missing scores, disagreement) - send it to an admin.
CREATE OR REPLACE FUNCTION public.wager_send_to_review(p_competition_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.wager_games;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.competition_players WHERE competition_id = p_competition_id AND user_id = auth.uid() AND has_paid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a paying player in this wager');
  END IF;
  SELECT * INTO g FROM public.wager_games WHERE competition_id = p_competition_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Wager not set up'); END IF;
  IF g.state NOT IN ('playing', 'awaiting') THEN RETURN jsonb_build_object('success', true, 'state', g.state); END IF;
  UPDATE public.wager_games SET state = 'review' WHERE competition_id = p_competition_id;
  RETURN jsonb_build_object('success', true, 'state', 'review');
END;
$$;

-- What a player's screen needs: the state, the standings, who has confirmed.
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
    'pot', c.pot_total, 'buy_in', c.buy_in, 'players', v_n, 'partners_needed', v_n / 2,
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

-- Wagers waiting for ME to confirm (so a partner who closed the app still sees it).
CREATE OR REPLACE FUNCTION public.wager_pending_for_me()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('competition_id', g.competition_id, 'mode', g.mode, 'pot', c.pot_total, 'proposed_at', g.proposed_at) ORDER BY g.proposed_at)
    FROM public.wager_games g
    JOIN public.competitions c ON c.id = g.competition_id
    JOIN public.competition_players cp ON cp.competition_id = g.competition_id AND cp.user_id = auth.uid() AND cp.has_paid
    WHERE g.state = 'awaiting' AND c.creator_id <> auth.uid()
      AND NOT EXISTS (SELECT 1 FROM public.wager_confirmations wc WHERE wc.competition_id = g.competition_id AND wc.user_id = auth.uid())
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
-- Wagers that need a decision: in review, or waiting on confirmation for 48 hours, or still
-- "playing" after 12 hours (someone's scores never arrived).
CREATE OR REPLACE FUNCTION public.admin_wager_review_list()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public._wager_is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  RETURN jsonb_build_object('success', true, 'wagers', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'competition_id', g.competition_id, 'state', g.state, 'mode', g.mode, 'pot', c.pot_total, 'buy_in', c.buy_in,
      'host_id', c.creator_id, 'created_at', c.created_at, 'proposed_at', g.proposed_at, 'result', g.result,
      'players', (SELECT jsonb_agg(jsonb_build_object('user_id', cp.user_id, 'name', gp.display_name, 'paid', cp.has_paid)) FROM public.competition_players cp LEFT JOIN public.golfer_profiles gp ON gp.user_id = cp.user_id WHERE cp.competition_id = g.competition_id),
      'confirmations', (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', wc.user_id, 'agrees', wc.agrees)), '[]'::jsonb) FROM public.wager_confirmations wc WHERE wc.competition_id = g.competition_id),
      'standings', public._wager_standings(g.competition_id)
    ) ORDER BY g.created_at)
    FROM public.wager_games g JOIN public.competitions c ON c.id = g.competition_id
    WHERE g.state = 'review'
       OR (g.state = 'awaiting' AND g.proposed_at < now() - interval '48 hours')
       OR (g.state = 'playing' AND g.created_at < now() - interval '12 hours' AND c.status NOT IN ('completed', 'cancelled'))
  ), '[]'::jsonb));
END;
$$;

-- Admin: 'pay' the result the scores give (needs a proposed result; for a wager that never got
-- one, the admin can only refund) or 'refund' every buy-in.
CREATE OR REPLACE FUNCTION public.admin_resolve_wager(p_competition_id UUID, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.wager_games;
  v_st JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public._wager_is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  SELECT * INTO g FROM public.wager_games WHERE competition_id = p_competition_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Wager not found'); END IF;
  IF g.state IN ('paid', 'refunded') THEN RETURN jsonb_build_object('success', true, 'duplicate', true, 'state', g.state); END IF;

  IF p_action = 'refund' THEN
    RETURN public._wager_refund(p_competition_id, auth.uid());
  ELSIF p_action = 'pay' THEN
    IF g.result IS NULL THEN
      v_st := public._wager_standings(p_competition_id);
      IF NOT (v_st->>'complete')::boolean THEN
        RETURN jsonb_build_object('success', false, 'error', 'Scores are incomplete; refund instead');
      END IF;
      UPDATE public.wager_games SET result = v_st WHERE competition_id = p_competition_id;
    END IF;
    RETURN public._wager_pay(p_competition_id, auth.uid());
  END IF;
  RETURN jsonb_build_object('success', false, 'error', 'Action must be pay or refund');
END;
$$;

REVOKE ALL ON FUNCTION public.wager_set_mode(UUID, TEXT), public.wager_submit_score(UUID, INTEGER, INTEGER),
  public.wager_propose_result(UUID), public.wager_confirm_result(UUID, BOOLEAN), public.wager_send_to_review(UUID),
  public.wager_status(UUID), public.wager_pending_for_me(), public.admin_wager_review_list(),
  public.admin_resolve_wager(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wager_set_mode(UUID, TEXT), public.wager_submit_score(UUID, INTEGER, INTEGER),
  public.wager_propose_result(UUID), public.wager_confirm_result(UUID, BOOLEAN), public.wager_send_to_review(UUID),
  public.wager_status(UUID), public.wager_pending_for_me(), public.admin_wager_review_list(),
  public.admin_resolve_wager(UUID, TEXT) TO authenticated;
