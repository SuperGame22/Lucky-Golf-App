/** Enhanced Stats, worked out from the player's completed rounds (newest first). */

export interface RoundRow {
  score_diff: number | null;
  holes_played: number | null;
  putts: number[] | null;
  total_putts: number | null;
  created_at: string;
}

export interface RoundStats {
  rounds: number;
  /** Average score to par, scaled to 18 holes. */
  avgToPar: number | null;
  bestToPar: number | null;
  /** Average putts per 18 holes. */
  puttsPer18: number | null;
  onePuttPct: number | null;
  threePuttPct: number | null;
  /** Last 5 rounds' average to par minus the 5 before (negative = improving). */
  trend: number | null;
}

const per18 = (v: number, holes: number) => (v * 18) / Math.max(1, holes);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

export function computeRoundStats(rows: RoundRow[]): RoundStats {
  const valid = rows.filter((r) => r.score_diff != null && (r.holes_played ?? 0) >= 1);
  const toPar = valid.map((r) => per18(r.score_diff as number, r.holes_played as number));
  const puttRounds = valid.filter((r) => r.total_putts != null && (r.total_putts as number) > 0);
  const holePutts = valid.flatMap((r) => (Array.isArray(r.putts) ? r.putts.filter((p) => Number.isFinite(p)) : []));
  const last5 = avg(toPar.slice(0, 5));
  const prev5 = avg(toPar.slice(5, 10));
  return {
    rounds: valid.length,
    avgToPar: round1(avg(toPar)),
    bestToPar: toPar.length ? Math.round(Math.min(...toPar)) : null,
    puttsPer18: round1(avg(puttRounds.map((r) => per18(r.total_putts as number, r.holes_played as number)))),
    onePuttPct: holePutts.length ? Math.round((100 * holePutts.filter((p) => p <= 1).length) / holePutts.length) : null,
    threePuttPct: holePutts.length ? Math.round((100 * holePutts.filter((p) => p >= 3).length) / holePutts.length) : null,
    trend: last5 != null && prev5 != null && toPar.length >= 10 ? round1(last5 - prev5) : null,
  };
}

export const fmtToPar = (n: number | null) => (n == null ? '—' : n > 0 ? `+${n}` : n === 0 ? 'E' : String(n));
