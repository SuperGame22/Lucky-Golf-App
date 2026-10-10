-- Follow-up to the weekly raffle:
--   * Winners are shown by first name and last initial ("Cole M."), never the full display name.
--   * Beta survey: one row per player per question, answered once, readable only by its owner.
--     Admin can read the tallies.
-- To roll back: DROP TABLE public.beta_survey_answers; DROP FUNCTION public.answer_beta_survey(text, text),
-- public.admin_survey_results(), public._public_name(text); then restore get_raffle_home() from the weekly raffle migration.

DO $$
BEGIN
  IF to_regprocedure('public.get_raffle_home()') IS NULL THEN
    RAISE EXCEPTION 'Run the weekly raffle migration (20261015120000) first';
  END IF;
END $$;

-- "Cole Matthews" -> "Cole M."; a single word stays as it is; empty -> a friendly fallback.
CREATE OR REPLACE FUNCTION public._public_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_parts TEXT[] := regexp_split_to_array(trim(coalesce(p_name, '')), '\s+');
  v_first TEXT;
  v_last TEXT;
BEGIN
  IF coalesce(v_parts[1], '') = '' THEN RETURN 'A lucky golfer'; END IF;
  v_first := initcap(v_parts[1]);
  IF array_length(v_parts, 1) = 1 THEN RETURN v_first; END IF;
  v_last := v_parts[array_length(v_parts, 1)];
  RETURN v_first || ' ' || upper(left(v_last, 1)) || '.';
END;
$$;

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

  -- The latest drawn week stays on show until the next one is drawn (no 7-day cut-off).
  SELECT * INTO v_last FROM public.weekly_jackpots
  WHERE drawn_at IS NOT NULL AND winner_user_id IS NOT NULL
  ORDER BY drawn_at DESC LIMIT 1;
  IF FOUND THEN
    SELECT display_name INTO v_name FROM public.golfer_profiles WHERE user_id = v_last.winner_user_id;
    v_result := jsonb_build_object('id', v_last.id, 'prize_name', v_last.prize_name, 'winner_name', public._public_name(v_name),
                                   'i_won', v_last.winner_user_id = v_uid, 'drawn_at', v_last.drawn_at);
  END IF;

  RETURN jsonb_build_object('this_week', v_this, 'last_result', v_result);
END;
$$;

-- ---------------------------------------------------------------------------
-- Beta survey
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beta_survey_answers (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_key)
);

ALTER TABLE public.beta_survey_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS survey_own_read ON public.beta_survey_answers;
CREATE POLICY survey_own_read ON public.beta_survey_answers FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.beta_survey_answers FROM anon, authenticated;

-- Questions and their allowed answers live here so a player cannot save anything else.
CREATE OR REPLACE FUNCTION public.answer_beta_survey(p_key TEXT, p_answer TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT (
    (p_key = 'prize_style' AND p_answer IN ('monthly_bigger', 'weekly_smaller'))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unknown question or answer');
  END IF;
  -- Answered once; a repeat tap changes nothing.
  INSERT INTO public.beta_survey_answers (user_id, question_key, answer)
  VALUES (auth.uid(), p_key, p_answer)
  ON CONFLICT (user_id, question_key) DO NOTHING;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_survey_results()
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
  RETURN jsonb_build_object('success', true, 'results', coalesce(
    (SELECT jsonb_agg(jsonb_build_object('question_key', question_key, 'answer', answer, 'n', n) ORDER BY question_key, answer)
     FROM (SELECT question_key, answer, count(*) AS n FROM public.beta_survey_answers GROUP BY 1, 2) t),
    '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public._public_name(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.answer_beta_survey(TEXT, TEXT), public.admin_survey_results(), public.get_raffle_home() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_beta_survey(TEXT, TEXT), public.admin_survey_results(), public.get_raffle_home() TO authenticated;
