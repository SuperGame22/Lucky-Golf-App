import { describe, expect, it } from "vitest";
import { CLOVER_HOLD_MS, LEAF_MS, MAX_ANIMATED_CLOVERS, buildRevealPlan, revealDurationMs } from "../reveal";

describe("home clover reveal", () => {
  it("does nothing when there is nothing new", () => {
    const plan = buildRevealPlan(0, 12, 3);
    expect(plan).toEqual({ startCount: 12, startWeek: 3, steps: [] });
  });

  it("shows the old counts first, then lights four leaves per clover", () => {
    // $16 spent: 4 clovers = 16 lit leaves, on top of a balance of 9 (5 before) and 2 this week
    const plan = buildRevealPlan(4, 9, 2);
    expect(plan.startCount).toBe(5);
    expect(plan.startWeek).toBe(2);
    const lights = plan.steps.filter((s) => s.lit > 0);
    expect(lights).toHaveLength(16);
    expect(lights.map((s) => s.lit)).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it("adds exactly one to the count and the weekly number each time four leaves are lit", () => {
    const plan = buildRevealPlan(4, 9, 2);
    const pulses = plan.steps.filter((s) => s.pulse);
    expect(pulses.map((s) => [s.count, s.week])).toEqual([[6, 3], [7, 4], [8, 5], [9, 6]]);
    // the count never moves on a step that is not the fourth leaf
    let prev = plan.startCount;
    for (const s of plan.steps) {
      if (!s.pulse) expect(s.count).toBe(prev);
      prev = s.count;
    }
  });

  it("ends on the real balance with the leaves cleared", () => {
    const plan = buildRevealPlan(10, 22, 1); // $40 spent = 10 clovers
    const last = plan.steps[plan.steps.length - 1];
    expect(last).toMatchObject({ lit: 0, count: 22, week: 11, pulse: false });
    expect(plan.steps.filter((s) => s.lit > 0)).toHaveLength(40);
  });

  it("keeps a steady rhythm: one leaf at a time", () => {
    const plan = buildRevealPlan(2, 2, 0);
    expect(plan.steps.slice(0, 5).map((s) => s.delayMs)).toEqual([LEAF_MS, LEAF_MS, LEAF_MS, LEAF_MS, CLOVER_HOLD_MS]);
  });

  it("shortens a huge backlog but still ends on the right numbers", () => {
    const plan = buildRevealPlan(500, 520, 4);
    expect(plan.steps.filter((s) => s.pulse)).toHaveLength(MAX_ANIMATED_CLOVERS);
    expect(plan.startCount).toBe(520 - MAX_ANIMATED_CLOVERS);
    expect(plan.startWeek).toBe(4 + 500 - MAX_ANIMATED_CLOVERS);
    expect(plan.steps[plan.steps.length - 1]).toMatchObject({ count: 520, week: 504 });
    expect(revealDurationMs(plan)).toBeLessThan(12000);
  });

  it("ignores nonsense input", () => {
    expect(buildRevealPlan(-3, 5, 0).steps).toEqual([]);
    expect(buildRevealPlan(1.9, 5, 0).steps.filter((s) => s.pulse)).toHaveLength(1);
  });
});
