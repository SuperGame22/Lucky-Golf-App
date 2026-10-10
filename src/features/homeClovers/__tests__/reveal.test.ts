import { describe, expect, it } from "vitest";
import { CLEAR_GAP_MS, CLOVER_HOLD_MS, LEAF_MS, MAX_ANIMATED_CLOVERS, SLOWDOWN, buildRevealPlan, revealDurationMs, type RevealInput } from "../reveal";

const input = (o: Partial<RevealInput>): RevealInput => ({ clovers: 0, weekCount: 0, pending: 0, pendingLeaves: 0, restLeaves: 0, spendPendingClovers: 0, ...o });
/** Spending: `dollars` spent on top of `restLeaves` leaves already lit. */
const spend = (dollars: number, restLeaves = 0, clovers = 10, weekCount = 0) =>
  input({ clovers, weekCount, pendingLeaves: dollars, restLeaves, pending: Math.floor((restLeaves + dollars) / 4), spendPendingClovers: Math.floor((restLeaves + dollars) / 4) });

describe("home clover reveal", () => {
  it("does nothing when there is nothing new, but keeps the leaves that are already lit", () => {
    const plan = buildRevealPlan(input({ clovers: 12, weekCount: 3, restLeaves: 2 }));
    expect(plan).toMatchObject({ startCount: 12, startWeek: 3, startLit: 2, endLit: 2, steps: [] });
  });

  it("$16 spent: 16 leaves light one at a time, +1 clover and +1 this week every fourth", () => {
    const plan = buildRevealPlan(spend(16, 0, 9, 2));
    expect(plan.startCount).toBe(5);
    expect(plan.startWeek).toBe(2);
    expect(plan.steps.filter((s) => s.lit > 0).map((s) => s.lit)).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4]);
    expect(plan.steps.filter((s) => s.pulse).map((s) => [s.count, s.week])).toEqual([[6, 3], [7, 4], [8, 5], [9, 6]]);
    expect(plan.endLit).toBe(0);
  });

  it("$6 spent: one clover and two leaves stay lit (the carry)", () => {
    const plan = buildRevealPlan(spend(6, 0, 11, 0));
    expect(plan.steps.filter((s) => s.pulse)).toHaveLength(1);
    expect(plan.steps.filter((s) => s.lit > 0).map((s) => s.lit)).toEqual([1, 2, 3, 4, 1, 2]);
    expect(plan.endLit).toBe(2);
    expect(plan.steps[plan.steps.length - 1]).toMatchObject({ lit: 2, count: 11 });
  });

  it("starts from the leaves already lit: 2 lit + $2 completes a clover", () => {
    const plan = buildRevealPlan(spend(2, 2, 6, 1));
    expect(plan.startLit).toBe(2);
    expect(plan.steps.map((s) => [s.lit, s.pulse])).toEqual([[3, false], [4, true], [0, false]]);
    expect(plan.steps[1]).toMatchObject({ count: 6, week: 2 });
    expect(plan.endLit).toBe(0);
  });

  it("2 lit + $1 more just lights a third leaf, no clover", () => {
    const plan = buildRevealPlan(spend(1, 2, 6, 1));
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({ lit: 3, count: 6, week: 1, pulse: false });
    expect(plan.endLit).toBe(3);
  });

  it("clovers that were not spending light a full set of four and keep the carried leaves", () => {
    // 5 whole clovers from a prize, with 2 leaves already lit
    const plan = buildRevealPlan(input({ clovers: 15, pending: 5, restLeaves: 2 }));
    expect(plan.steps.filter((s) => s.pulse)).toHaveLength(5);
    expect(plan.startCount).toBe(10);
    expect(plan.endLit).toBe(2);
    expect(plan.steps[plan.steps.length - 1]).toMatchObject({ count: 15, lit: 2 });
  });

  it("spending and other clovers in one reveal both count", () => {
    const plan = buildRevealPlan({ clovers: 14, weekCount: 0, pending: 3, pendingLeaves: 4, restLeaves: 0, spendPendingClovers: 1 });
    expect(plan.steps.filter((s) => s.pulse)).toHaveLength(3);
    expect(plan.steps[plan.steps.length - 1]).toMatchObject({ count: 14, week: 3 });
  });

  it("the count never moves on a step that is not the fourth leaf", () => {
    const plan = buildRevealPlan(spend(10, 1, 9, 0));
    let prev = plan.startCount;
    for (const s of plan.steps) {
      if (!s.pulse) expect(s.count).toBe(prev);
      prev = s.count;
    }
  });

  it("runs all but the last two clovers fast, then slows 20% on the fifth and 20% again on the sixth", () => {
    const plan = buildRevealPlan(spend(24, 0, 30, 0)); // 6 clovers
    const perClover: number[] = [];
    let acc = 0;
    for (const s of plan.steps) {
      if (s.lit !== 1) acc += s.delayMs; // leaf 1 is the starting gun
      if (s.lit === 0) { perClover.push(acc); acc = 0; }
    }
    expect(perClover).toHaveLength(6);
    const fast = perClover[0];
    expect(perClover.slice(0, 4)).toEqual([fast, fast, fast, fast]);
    expect(fast).toBe(3 * LEAF_MS + CLOVER_HOLD_MS);
    expect(Math.abs(perClover[4] / fast - SLOWDOWN)).toBeLessThan(0.01);
    expect(Math.abs(perClover[5] / perClover[4] - SLOWDOWN)).toBeLessThan(0.01);
  });

  it("the fast pace is faster than the old 120ms per leaf", () => {
    expect(LEAF_MS).toBeLessThan(120);
  });

  it("shortens a huge backlog but still ends on the right numbers", () => {
    const plan = buildRevealPlan(spend(2000, 0, 520, 4)); // 500 clovers
    expect(plan.steps.filter((s) => s.pulse)).toHaveLength(MAX_ANIMATED_CLOVERS);
    expect(plan.startCount).toBe(520 - MAX_ANIMATED_CLOVERS);
    expect(plan.startWeek).toBe(4 + 500 - MAX_ANIMATED_CLOVERS);
    expect(plan.steps[plan.steps.length - 1]).toMatchObject({ count: 520, week: 504 });
    expect(revealDurationMs(plan)).toBeLessThan(12000);
  });

  it("ignores nonsense input", () => {
    expect(buildRevealPlan(input({ pending: -3, pendingLeaves: -2, restLeaves: 9 })).steps).toEqual([]);
    expect(buildRevealPlan(input({ clovers: 5, pending: 1.9 })).steps.filter((s) => s.pulse)).toHaveLength(1);
  });

  it("shows the leaves dark for an eighth of a second before the next clover's first leaf lights", () => {
    const plan = buildRevealPlan({ clovers: 2, weekCount: 0, pending: 0, pendingLeaves: 6, restLeaves: 0, spendPendingClovers: 0 });
    const lits = plan.steps.map((s) => s.lit);
    expect(lits).toEqual([1, 2, 3, 4, 0, 1, 2]);
    expect(plan.steps[4].lit).toBe(0); // cleared
    expect(plan.steps[5]).toMatchObject({ lit: 1, delayMs: CLEAR_GAP_MS });
    expect(CLEAR_GAP_MS).toBe(125);
  });
});
