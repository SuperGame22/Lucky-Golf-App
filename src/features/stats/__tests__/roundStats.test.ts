import { describe, expect, it } from "vitest";
import { computeRoundStats, fmtToPar } from "../roundStats";

const r = (score_diff: number, holes_played: number, putts: number[] | null = null) => ({
  score_diff, holes_played, putts, total_putts: putts ? putts.reduce((a, b) => a + b, 0) : null, created_at: "2026-10-01",
});

describe("round stats", () => {
  it("is empty without rounds", () => {
    expect(computeRoundStats([])).toEqual({ rounds: 0, avgToPar: null, bestToPar: null, puttsPer18: null, onePuttPct: null, threePuttPct: null, trend: null });
  });

  it("scales 9-hole rounds to 18 and counts putts per hole", () => {
    const s = computeRoundStats([r(2, 9, [1, 2, 2, 3, 2, 2, 2, 2, 2]), r(6, 18)]);
    expect(s.rounds).toBe(2);
    expect(s.avgToPar).toBe(5); // (4 + 6) / 2
    expect(s.bestToPar).toBe(4);
    expect(s.puttsPer18).toBe(36); // 18 putts on 9 holes
    expect(s.onePuttPct).toBe(11); // 1 of 9
    expect(s.threePuttPct).toBe(11);
    expect(s.trend).toBeNull();
  });

  it("trend compares the last 5 with the 5 before", () => {
    const rows = [...Array(5)].map(() => r(2, 18)).concat([...Array(5)].map(() => r(6, 18)));
    expect(computeRoundStats(rows).trend).toBe(-4);
  });

  it("formats to-par", () => {
    expect([fmtToPar(null), fmtToPar(0), fmtToPar(3), fmtToPar(-2)]).toEqual(["—", "E", "+3", "-2"]);
  });
});
