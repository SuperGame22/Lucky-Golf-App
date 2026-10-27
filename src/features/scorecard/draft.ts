/** An in-progress scorecard kept in the browser, so a refresh or a trip to another tab doesn't lose the round. */

export const DRAFT_KEY = 'lg_scorecard_draft';
const MAX_AGE_MS = 18 * 60 * 60 * 1000; // a round older than this is abandoned

export type ScoreMap = Record<number, number>;

export interface ScorecardDraft {
  courseId: number | null;
  roundLength: 9 | 18;
  scores: ScoreMap;
  putts: ScoreMap;
  activeHole: number;
  savedAt: number;
}

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const cleanMap = (m: unknown, max: number, lo: number, hi: number): ScoreMap => {
  const out: ScoreMap = {};
  if (!m || typeof m !== 'object') return out;
  for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
    const hole = Number(k);
    const n = Number(v);
    if (Number.isInteger(hole) && hole >= 1 && hole <= max && Number.isInteger(n) && n >= lo && n <= hi) out[hole] = n;
  }
  return out;
};

/** The saved draft for this course (null course = practice round), if it is recent and well-formed. */
export function readDraft(store: KV, courseId: number | null, now = Date.now()): ScorecardDraft | null {
  let raw: string | null = null;
  try { raw = store.getItem(DRAFT_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || (d.roundLength !== 9 && d.roundLength !== 18)) return null;
    if ((d.courseId ?? null) !== courseId) return null;
    if (typeof d.savedAt !== 'number' || now - d.savedAt > MAX_AGE_MS) return null;
    const scores = cleanMap(d.scores, d.roundLength, 1, 20);
    if (Object.keys(scores).length === 0) return null;
    const activeHole = Number.isInteger(d.activeHole) && d.activeHole >= 1 && d.activeHole <= d.roundLength ? d.activeHole : 1;
    return { courseId, roundLength: d.roundLength, scores, putts: cleanMap(d.putts, d.roundLength, 0, 10), activeHole, savedAt: d.savedAt };
  } catch {
    return null;
  }
}

/** Keeps the round. It never deletes: an empty scorecard (e.g. opened from Home with no course) must not erase a
 *  round in progress. Deleting is only clearDraft(), on save or when the round length is reset. */
export function writeDraft(store: KV, draft: Omit<ScorecardDraft, 'savedAt'>, now = Date.now()): void {
  try {
    if (Object.keys(draft.scores).length === 0) return;
    store.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: now }));
  } catch { /* storage full or blocked: the round just isn't kept */ }
}

export function clearDraft(store: KV): void {
  try { store.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

/** Scores in hole order for the holes actually played, and the par of just those holes. */
export function summarize(holes: { number: number; par: number }[], scores: ScoreMap, putts: ScoreMap) {
  const played = holes.filter((h) => scores[h.number] !== undefined);
  const total = played.reduce((a, h) => a + scores[h.number], 0);
  const par = played.reduce((a, h) => a + h.par, 0);
  const puttsTotal = played.reduce((a, h) => a + (putts[h.number] ?? 0), 0);
  return {
    played: played.length,
    scores: played.map((h) => scores[h.number]),
    putts: played.map((h) => putts[h.number] ?? 0),
    /** One entry per hole of the round (null = not played), so hole numbers stay right on unfinished rounds. */
    scoresByHole: holes.map((h) => scores[h.number] ?? null),
    puttsByHole: holes.map((h) => (scores[h.number] !== undefined ? (putts[h.number] ?? 0) : null)),
    total,
    par,
    diff: total - par,
    puttsTotal,
  };
}
