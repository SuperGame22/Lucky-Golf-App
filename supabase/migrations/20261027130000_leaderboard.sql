-- Leaderboard that works for everyone (overnight review, 2026-10-27).
-- The app used to read other players' rounds and names directly, which row-level security hides, so each
-- player saw only themself. This function returns the public view: first name + last initial and the best
-- score to par over a recent window, with 9-hole rounds counted at 18-hole scale so lengths compare fairly.
-- To roll back: DROP FUNCTION public.get_leaderboard(integer);

-- Same as the raffle's helper ("Cole Matthews" -> "Cole M."), repeated so this file stands alone.
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

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_days INTEGER DEFAULT 90)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_days INTEGER := least(greatest(coalesce(p_days, 90), 1), 3650);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  RETURN jsonb_build_object('success', true, 'days', v_days, 'leaders', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'rank', rnk, 'name', name, 'best_to_par', best, 'rounds', n, 'is_you', is_you
           ) ORDER BY rnk)
    FROM (
      SELECT rank() OVER (ORDER BY b.best, b.n DESC) AS rnk,
             public._public_name(gp.display_name) AS name,
             b.best, b.n, (b.user_id = v_uid) AS is_you
      FROM (
        SELECT r.user_id,
               -- best score to par, 9-hole rounds doubled so they compare with 18
               min(round(r.score_diff::numeric * 18 / greatest(r.holes_played, 1)))::int AS best,
               count(*)::int AS n
        FROM public.rounds r
        WHERE r.completed IS TRUE
          AND r.holes_played BETWEEN 9 AND 18
          -- rounds are written by the app, so ignore impossible ones (better than 1 under par per hole)
          AND r.score_diff >= -r.holes_played
          AND r.score_diff IS NOT NULL
          AND r.created_at > now() - make_interval(days => v_days)
        GROUP BY r.user_id
      ) b
      LEFT JOIN public.golfer_profiles gp ON gp.user_id = b.user_id
      ORDER BY b.best, b.n DESC
      LIMIT 25
    ) t
  ), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(INTEGER) TO authenticated;
