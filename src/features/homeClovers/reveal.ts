/**
 * The Home-page clover reveal: new clovers light up the clover leaf by leaf, and each time
 * four leaves are lit the clover count and the weekly count go up by one. Pure, so the
 * sequence can be tested without a browser.
 */

export const LEAVES_PER_CLOVER = 4;
/** Pause between one leaf lighting and the next, at the fast pace. */
export const LEAF_MS = 90;
/** Pause when the fourth leaf lights and the count ticks up, before the leaves clear, at the fast pace. */
export const CLOVER_HOLD_MS = 220;
/** Every clover runs at the fast pace except the last two, which ease off: the second-to-last
 *  is this much slower than the fast pace, and the last is this much slower again. */
export const SLOWDOWN = 1.2;
/** A very large backlog is shortened to this many animated clovers; the rest is added up front. */
export const MAX_ANIMATED_CLOVERS = 15;

export interface RevealStep {
  /** Wait this long after the previous step. */
  delayMs: number;
  /** Leaves lit, 0-4. */
  lit: number;
  /** Clover count shown. */
  count: number;
  /** "+N this week" shown. */
  week: number;
  /** True on the step where a clover completes (drives the glow and +1). */
  pulse: boolean;
}

export interface RevealPlan {
  /** What the page shows before the first step: the old counts, with any skipped backlog added. */
  startCount: number;
  startWeek: number;
  steps: RevealStep[];
}

/**
 * @param pending clovers earned but not yet shown
 * @param clovers the real balance (already includes `pending`)
 * @param weekCount the weekly count as acknowledged so far (does not yet include `pending`)
 */
export function buildRevealPlan(pending: number, clovers: number, weekCount: number): RevealPlan {
  const n = Math.max(0, Math.floor(pending));
  const animated = Math.min(n, MAX_ANIMATED_CLOVERS);
  const skipped = n - animated;
  const startCount = Math.max(0, clovers - animated);
  const startWeek = weekCount + skipped;

  const steps: RevealStep[] = [];
  let count = startCount;
  let week = startWeek;
  for (let c = 0; c < animated; c++) {
    const fromEnd = animated - 1 - c; // 0 = last clover, 1 = second to last
    const slow = fromEnd === 0 ? SLOWDOWN * SLOWDOWN : fromEnd === 1 ? SLOWDOWN : 1;
    const leafMs = Math.round(LEAF_MS * slow);
    const holdMs = Math.round(CLOVER_HOLD_MS * slow);
    for (let leaf = 1; leaf <= LEAVES_PER_CLOVER; leaf++) {
      const done = leaf === LEAVES_PER_CLOVER;
      if (done) {
        count += 1;
        week += 1;
      }
      steps.push({ delayMs: leaf === 1 && c > 0 ? 0 : leafMs, lit: leaf, count, week, pulse: done });
    }
    steps.push({ delayMs: holdMs, lit: 0, count, week, pulse: false });
  }
  return { startCount, startWeek, steps };
}

/** Total time the reveal takes, for tests and for showing the animation is bounded. */
export const revealDurationMs = (plan: RevealPlan) => plan.steps.reduce((sum, s) => sum + s.delayMs, 0);
