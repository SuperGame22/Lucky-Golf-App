/**
 * The Home-page clover reveal. Spending lights the clover one leaf per dollar; every time
 * four leaves are lit the clover count and the weekly count go up by one and the leaves start
 * again. Leaves left over stay lit (a $6 spend is one clover and two leaves still lit).
 * Clovers that did not come from spending light a full set of four. Pure, so the sequence can
 * be tested without a browser.
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

export interface RevealInput {
  /** The real clover balance (already includes everything pending). */
  clovers: number;
  /** The weekly count as acknowledged so far (does not yet include what is pending). */
  weekCount: number;
  /** Clovers earned but not yet shown, from any source. */
  pending: number;
  /** New leaves from spending (one per whole dollar). */
  pendingLeaves: number;
  /** Leaves already lit before the reveal starts. */
  restLeaves: number;
  /** How many of the pending clovers those spending leaves complete. */
  spendPendingClovers: number;
}

export interface RevealPlan {
  /** What the page shows before the first step: the old counts, with any skipped backlog added. */
  startCount: number;
  startWeek: number;
  startLit: number;
  /** Leaves lit when the reveal is over. */
  endLit: number;
  steps: RevealStep[];
}

export function buildRevealPlan(input: RevealInput): RevealPlan {
  const rest = Math.min(Math.max(Math.floor(input.restLeaves), 0), LEAVES_PER_CLOVER - 1);
  const spendLeaves = Math.max(0, Math.floor(input.pendingLeaves));
  const otherClovers = Math.max(0, Math.floor(input.pending) - Math.max(0, Math.floor(input.spendPendingClovers)));
  const leaves = spendLeaves + otherClovers * LEAVES_PER_CLOVER;

  const completions = Math.floor((rest + leaves) / LEAVES_PER_CLOVER);
  const skipped = Math.max(0, completions - MAX_ANIMATED_CLOVERS);
  const animated = completions - skipped;
  const startCount = Math.max(0, input.clovers - animated);
  const startWeek = input.weekCount + skipped;

  const steps: RevealStep[] = [];
  let lit = rest;
  let count = startCount;
  let week = startWeek;
  let done = 0; // clovers completed so far in the animation
  const paceFor = (cycle: number) => {
    const fromEnd = animated - 1 - cycle;
    return fromEnd <= 0 ? SLOWDOWN * SLOWDOWN : fromEnd === 1 ? SLOWDOWN : 1;
  };

  const toShow = leaves - skipped * LEAVES_PER_CLOVER;
  for (let i = 0; i < toShow; i++) {
    const slow = animated === 0 ? SLOWDOWN : paceFor(Math.min(done, animated - 1));
    lit += 1;
    const complete = lit === LEAVES_PER_CLOVER;
    if (complete) {
      count += 1;
      week += 1;
      done += 1;
    }
    const first = steps.length === 0 || steps[steps.length - 1].lit === 0;
    steps.push({ delayMs: first && steps.length > 0 ? 0 : Math.round(LEAF_MS * slow), lit, count, week, pulse: complete });
    if (complete) {
      steps.push({ delayMs: Math.round(CLOVER_HOLD_MS * slow), lit: 0, count, week, pulse: false });
      lit = 0;
    }
  }
  return { startCount, startWeek, startLit: rest, endLit: lit, steps };
}

/** Total time the reveal takes, for tests and for showing the animation is bounded. */
export const revealDurationMs = (plan: RevealPlan) => plan.steps.reduce((sum, s) => sum + s.delayMs, 0);
