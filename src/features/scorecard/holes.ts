/**
 * Scorecard holes and totals.
 *
 * Par and yardage come only from the selected course's hole_data. A hole with no data shows
 * "par unknown". It still counts toward the stroke total, but it is left out of score-to-par, so
 * the card never compares the player against made-up pars.
 */

export type CourseHole = { hole: number; par: number | null; yards_est: number | null };

export type ScorecardHole = {
  number: number;
  /** null = par unknown for this hole */
  par: number | null;
  /** approximate yards, null = unknown */
  distance: number | null;
};

/** Starting stroke count on the +/- control for a hole: its par, or 4 when the par is unknown. */
export const DEFAULT_STROKES_UNKNOWN_PAR = 4;
export const defaultStrokes = (hole: ScorecardHole): number => hole.par ?? DEFAULT_STROKES_UNKNOWN_PAR;

const validPar = (p: unknown): number | null =>
  typeof p === 'number' && Number.isInteger(p) && p >= 2 && p <= 7 ? p : null;
const validYards = (y: unknown): number | null =>
  typeof y === 'number' && Number.isFinite(y) && y > 0 ? Math.round(y) : null;

/** Holes 1..18 with real data where the course has it, and null (unknown) everywhere else. */
export function buildHoles(holeData?: CourseHole[] | null): ScorecardHole[] {
  return Array.from({ length: 18 }, (_, i) => {
    const n = i + 1;
    const real = Array.isArray(holeData) ? holeData.find((h) => h && h.hole === n) : undefined;
    return { number: n, par: validPar(real?.par), distance: validYards(real?.yards_est) };
  });
}

export type ScoreSummary = {
  /** strokes on every played hole */
  totalScore: number;
  holesPlayed: number;
  /** sum of par over holes in the round with a known par */
  knownPar: number;
  /** holes in the round with a known par / unknown par */
  knownParHoles: number;
  unknownParHoles: number;
  /** strokes minus par over played holes whose par is known (0 when none) */
  scoreDiff: number;
  /** played holes that count toward scoreDiff */
  playedKnownPar: number;
  /** true when every hole in the round has a known par */
  fullPar: boolean;
};

export function summarize(holes: ScorecardHole[], scores: Record<number, number>): ScoreSummary {
  let totalScore = 0, holesPlayed = 0, knownPar = 0, knownParHoles = 0, scoreDiff = 0, playedKnownPar = 0;
  for (const h of holes) {
    const s = scores[h.number];
    const played = typeof s === 'number' && s > 0;
    if (played) { totalScore += s; holesPlayed++; }
    if (h.par != null) {
      knownPar += h.par;
      knownParHoles++;
      if (played) { scoreDiff += s - h.par; playedKnownPar++; }
    }
  }
  const unknownParHoles = holes.length - knownParHoles;
  return { totalScore, holesPlayed, knownPar, knownParHoles, unknownParHoles, scoreDiff, playedKnownPar, fullPar: unknownParHoles === 0 };
}

/** "Par 36", "Par 32 · 1 hole unknown", or "Par unknown" for a set of holes. */
export function parLabel(holes: ScorecardHole[]): string {
  const known = holes.filter((h) => h.par != null);
  if (known.length === 0) return 'Par unknown';
  const par = known.reduce((a, h) => a + (h.par as number), 0);
  const unknown = holes.length - known.length;
  return unknown === 0 ? `Par ${par}` : `Par ${par} · ${unknown} hole${unknown === 1 ? '' : 's'} unknown`;
}

/** "+3", "-2" or "E". */
export const formatDiff = (d: number): string => (d > 0 ? `+${d}` : d < 0 ? `${d}` : 'E');
