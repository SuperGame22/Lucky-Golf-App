import { describe, expect, it } from "vitest";
import { GOLD_SHARE, SLICE_ANGLES, LABEL_RADIUS, prizes } from "../prizes";
import { buildSlices, cubicBezier, rotationToLand, sliceUnderPointer } from "../wheel";

const goldIndexes = prizes.map((p, i) => (p.rare ? i : -1)).filter((i) => i >= 0);
const isGold = (i: number) => !!prizes[i].rare;
const width = (i: number) => SLICE_ANGLES[i].endDeg - SLICE_ANGLES[i].startDeg;
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe("wheel layout", () => {
  it("fills the circle exactly", () => {
    expect(SLICE_ANGLES[0].startDeg).toBe(0);
    expect(near(SLICE_ANGLES[SLICE_ANGLES.length - 1].endDeg, 360)).toBe(true);
    expect(near(SLICE_ANGLES.reduce((sum, _, i) => sum + width(i), 0), 360)).toBe(true);
  });

  it("makes gold a quarter of its sand / gold / sand slice, and that slice one normal slice wide", () => {
    expect(goldIndexes).toHaveLength(3);
    const normal = width(3); // first filler
    for (const g of goldIndexes) {
      expect(prizes[g - 1].type).toBe("none");
      expect(prizes[g + 1].type).toBe("none");
      const cluster = width(g - 1) + width(g) + width(g + 1);
      expect(near(cluster, normal)).toBe(true);
      expect(near(width(g) / cluster, GOLD_SHARE)).toBe(true);
      expect(near(width(g) / cluster, 0.25)).toBe(true);
      expect(near(width(g - 1), width(g + 1))).toBe(true);
    }
  });

  it("keeps the three gold slices an even 120° apart", () => {
    const mids = goldIndexes.map((g) => SLICE_ANGLES[g].midDeg);
    expect(near(mids[1] - mids[0], 120)).toBe(true);
    expect(near(mids[2] - mids[1], 120)).toBe(true);
  });

  it("has one Free Putt and no 6-month Clover Club", () => {
    expect(prizes.filter((p) => p.type === "free_putt")).toHaveLength(1);
    expect(prizes.some((p) => p.label.startsWith("6mo"))).toBe(false);
    expect(prizes.filter((p) => p.type === "membership").map((p) => p.label)).toEqual(["1mo Clover Club", "3mo Clover Club"]);
  });

  it("pulls the Clover Club labels in toward the hub", () => {
    for (const p of prizes.filter((p) => p.type === "membership")) {
      expect(p.labelRadius).toBeDefined();
      expect(p.labelRadius!).toBeLessThan(LABEL_RADIUS);
    }
  });
});

describe("where the wheel stops", () => {
  it("always stops with the chosen slice under the pointer, from any starting rotation", () => {
    for (const start of [0, 17.3, 359.9, 1234.5, -90]) {
      SLICE_ANGLES.forEach((s, i) => {
        const rot = rotationToLand(start, s.midDeg, 13);
        expect(rot).toBeGreaterThanOrEqual(start + 13 * 360);
        expect(sliceUnderPointer(SLICE_ANGLES, rot, isGold)).toBe(i);
      });
    }
  });

  it("resolves a stop exactly on a sand/gold border to the sand", () => {
    for (const g of goldIndexes) {
      const left = SLICE_ANGLES[g].startDeg;
      const right = SLICE_ANGLES[g].endDeg;
      // the wheel point under the pointer is (360 - rotation), so rotate by (360 - border)
      expect(sliceUnderPointer(SLICE_ANGLES, 360 - left, isGold)).toBe(g - 1);
      expect(sliceUnderPointer(SLICE_ANGLES, 360 - right, isGold)).toBe(g + 1);
      expect(prizes[sliceUnderPointer(SLICE_ANGLES, 360 - left, isGold)].type).toBe("none");
      expect(prizes[sliceUnderPointer(SLICE_ANGLES, 360 - right, isGold)].type).toBe("none");
    }
  });

  it("still gives the gold when the stop is inside it, even a hair from the border", () => {
    for (const g of goldIndexes) {
      const { startDeg, endDeg, midDeg } = SLICE_ANGLES[g];
      for (const a of [startDeg + 1e-4, midDeg, endDeg - 1e-4]) {
        expect(sliceUnderPointer(SLICE_ANGLES, 360 - a, isGold)).toBe(g);
      }
    }
  });

  it("handles the seam at the top of the wheel", () => {
    expect(sliceUnderPointer(SLICE_ANGLES, 0, isGold)).toBe(0);
    expect(sliceUnderPointer(SLICE_ANGLES, 360, isGold)).toBe(0);
    expect(sliceUnderPointer(SLICE_ANGLES, -1e-12, isGold)).toBe(0);
  });

  it("buildSlices splits by weight", () => {
    const s = buildSlices([1, 1, 2]);
    expect(s.map((x) => x.endDeg - x.startDeg)).toEqual([90, 90, 180]);
  });
});

describe("cubicBezier (the spin easing)", () => {
  const ease = cubicBezier(0.25, 1, 0.5, 1);
  it("starts at exactly 0 and ends at exactly 1", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-0.5)).toBe(0);
    expect(ease(2)).toBe(1);
  });
  it("only ever moves forward, never overshoots, and slows to a standstill", () => {
    let prev = 0;
    let lastStep = Infinity;
    for (let i = 1; i <= 2000; i++) {
      const v = ease(i / 2000);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1);
      lastStep = v - prev;
      prev = v;
    }
    expect(lastStep).toBeLessThan(1e-6); // the final frames barely move
  });
  it("matches the CSS ease-out curve at known points", () => {
    const cssEase = cubicBezier(0.25, 0.1, 0.25, 1); // CSS "ease": about 0.80 at the halfway mark
    expect(cssEase(0.5)).toBeCloseTo(0.8024, 3);
    const linear = cubicBezier(0, 0, 1, 1);
    expect(linear(0.3)).toBeCloseTo(0.3, 5);
  });
});
