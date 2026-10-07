import { describe, expect, it } from "vitest";
import { DEFAULT_WEDGE_CONFIG, RecommendationConfig, normalizeWedgeConfig } from "../config/wedges";
import { listShots, recommendWedge } from "../engine/recommend";

describe("wedge recommendation engine", () => {
  it("offers 4 wedges x 3 swings by default", () => {
    expect(listShots(DEFAULT_WEDGE_CONFIG)).toHaveLength(12);
  });

  it("picks the shot whose carry is closest", () => {
    const rec = recommendWedge(110, DEFAULT_WEDGE_CONFIG);
    expect(rec.kind).toBe("club");
    if (rec.kind === "club") {
      expect(rec.best.wedge.loft).toBe(50);
      expect(rec.best.swing).toBe("full");
    }
  });

  it("covers the whole 40-120 yd range with a small miss", () => {
    for (let d = 40; d <= 120; d++) {
      const rec = recommendWedge(d, DEFAULT_WEDGE_CONFIG);
      expect(rec.kind).toBe("club");
      if (rec.kind === "club") expect(Math.abs(rec.best.deltaYards)).toBeLessThanOrEqual(8);
    }
  });

  it("prefers a fuller swing when two shots are about equally close", () => {
    const config: RecommendationConfig = {
      ...DEFAULT_WEDGE_CONFIG,
      wedges: [
        { id: "a", loft: 52, shots: { full: 80, half: 80 } },
      ],
    };
    const rec = recommendWedge(80, config);
    expect(rec.kind === "club" && rec.best.swing).toBe("full");
  });

  it("is driven by config: changing a distance changes the answer", () => {
    const base = recommendWedge(100, DEFAULT_WEDGE_CONFIG);
    const changed = recommendWedge(100, {
      ...DEFAULT_WEDGE_CONFIG,
      wedges: DEFAULT_WEDGE_CONFIG.wedges.map((w) => (w.loft === 58 ? { ...w, shots: { ...w.shots, full: 100 } } : w)),
    });
    expect(base.kind === "club" && base.best.wedge.loft).not.toBe(58);
    expect(changed.kind === "club" && changed.best.wedge.loft).toBe(58);
  });

  it("ignores disabled wedges", () => {
    const config: RecommendationConfig = {
      ...DEFAULT_WEDGE_CONFIG,
      wedges: DEFAULT_WEDGE_CONFIG.wedges.map((w) => (w.loft === 50 ? { ...w, enabled: false } : w)),
    };
    const rec = recommendWedge(110, config);
    expect(rec.kind === "club" && rec.best.wedge.loft).not.toBe(50);
  });

  it("gives no club beyond the wedge limit", () => {
    expect(recommendWedge(120, DEFAULT_WEDGE_CONFIG).kind).toBe("club");
    expect(recommendWedge(121, DEFAULT_WEDGE_CONFIG).kind).toBe("too-far");
    expect(recommendWedge(300, DEFAULT_WEDGE_CONFIG).kind).toBe("too-far");
  });

  it("the cut-off itself is configurable", () => {
    expect(recommendWedge(130, { ...DEFAULT_WEDGE_CONFIG, maxYards: 140 }).kind).toBe("club");
  });

  it("calls anything well inside the shortest shot a short-game shot", () => {
    expect(recommendWedge(12, DEFAULT_WEDGE_CONFIG).kind).toBe("short-game");
  });

  it("offers a runner-up on a different wedge", () => {
    const rec = recommendWedge(78, DEFAULT_WEDGE_CONFIG);
    expect(rec.kind).toBe("club");
    if (rec.kind === "club" && rec.runnerUp) expect(rec.runnerUp.wedge.id).not.toBe(rec.best.wedge.id);
  });

  it("survives an empty or corrupt stored config", () => {
    expect(normalizeWedgeConfig(null).wedges).toHaveLength(4);
    expect(normalizeWedgeConfig({ wedges: "nope" }).wedges).toHaveLength(4);
    const partial = normalizeWedgeConfig({ wedges: [{ id: "x", loft: 60, shots: { full: 60, half: -5 } }] });
    expect(partial.wedges).toHaveLength(1);
    expect(partial.wedges[0].shots).toEqual({ full: 60 });
  });
});
