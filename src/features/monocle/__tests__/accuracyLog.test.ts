import { describe, expect, it } from "vitest";
import { AccuracySample, samplesToCsv, summarizeAccuracy } from "../debug/accuracyLog";

const s = (truth: number, shown: number | null): AccuracySample => ({
  truthYards: truth,
  shownYards: shown,
  rawYards: shown,
  heightPx: 40,
  score: 50,
  confidence: 0.9,
  at: 0,
});

describe("accuracy log", () => {
  it("summarises error against a laser reading", () => {
    const r = summarizeAccuracy([s(100, 102), s(100, 98), s(50, 51), s(50, null)]);
    expect(r.n).toBe(4);
    expect(r.scored).toBe(3);
    expect(r.meanErrorYards).toBeCloseTo((2 - 2 + 1) / 3, 9);
    expect(r.rmsYards).toBeCloseTo(Math.sqrt((4 + 4 + 1) / 3), 9);
    expect(r.maxAbsYards).toBe(2);
    expect(r.within5pct).toBe(1);
  });

  it("handles an empty log", () => {
    expect(summarizeAccuracy([])).toMatchObject({ n: 0, scored: 0, rmsYards: 0, within5pct: 0 });
  });

  it("exports csv with a header and signed errors", () => {
    const csv = samplesToCsv([s(100, 103)]);
    const [head, row] = csv.split("\n");
    expect(head.startsWith("truth_yd,shown_yd")).toBe(true);
    expect(row.split(",")[6]).toBe("3");
  });
});
