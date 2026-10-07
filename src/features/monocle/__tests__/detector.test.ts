import { describe, expect, it } from "vitest";
import { StickDetector } from "../vision/detector";
import { renderSynthRoi, SynthOptions } from "../testing/synthScene";
import { distanceYards } from "../engine/distance";

/**
 * These run the detector on physically-modelled synthetic frames (sub-pixel
 * stick width, optical blur, turf texture, sensor noise) at known distances.
 * They pin the behaviour measured while building the detector; they are not a
 * substitute for field testing on real optics.
 */

const F = 1440; // focal length in px for a 1920 px long side at the default 0.75 ratio
const W = 240;
const H = 1180;

const frame = (o: Partial<SynthOptions> & { distanceYd: number }) =>
  renderSynthRoi({ width: W, height: H, focalPx: F, flag: true, seed: 1, ...o });

const estimate = (heightPx: number) => distanceYards({ heightPx, stickHeightIn: 84, focalPx: F });

describe("StickDetector: distance recovery on turf", () => {
  const det = new StickDetector();
  const cases: [number, number][] = [
    [25, 0.03],
    [40, 0.03],
    [60, 0.04],
    [80, 0.08],
    [100, 0.12],
  ];
  for (const [d, tol] of cases) {
    it(`measures a stick at ${d} yd to within ${Math.round(tol * 100)}% on every seed tried`, () => {
      for (const seed of [1, 2, 3, 4]) {
        const f = frame({ distanceYd: d, seed });
        const { best } = det.detect({ data: f.data, width: W, height: H });
        expect(best, `no detection at ${d} yd seed ${seed}`).not.toBeNull();
        expect(Math.abs(best!.xBase - f.truth.xBase)).toBeLessThan(3);
        expect(Math.abs(estimate(best!.heightPx) - d) / d).toBeLessThan(tol);
      }
    });
  }

  it("is deterministic", () => {
    const f = frame({ distanceYd: 70 });
    const a = det.detect({ data: f.data, width: W, height: H }).best;
    const b = new StickDetector().detect({ data: f.data, width: W, height: H }).best;
    expect(a).toEqual(b);
  });
});

describe("StickDetector: other conditions", () => {
  const det = new StickDetector();

  it("finds a bare pole with no flag", () => {
    const f = frame({ distanceYd: 50, flag: false });
    const { best } = det.detect({ data: f.data, width: W, height: H });
    expect(best).not.toBeNull();
    expect(Math.abs(estimate(best!.heightPx) - 50) / 50).toBeLessThan(0.04);
  });

  it("follows a stick that is off-centre", () => {
    const f = frame({ distanceYd: 60, centerX: W / 2 + 45 });
    const { best } = det.detect({ data: f.data, width: W, height: H });
    expect(best).not.toBeNull();
    expect(Math.abs(best!.xBase - f.truth.xBase)).toBeLessThan(3);
  });

  it("tolerates a 2 degree lean without losing length", () => {
    const f = frame({ distanceYd: 60, tiltDeg: 2 });
    const { best } = det.detect({ data: f.data, width: W, height: H });
    expect(best).not.toBeNull();
    expect(Math.abs(estimate(best!.heightPx) - 60) / 60).toBeLessThan(0.06);
  });

  it("copes with a darker, yellowish stick and more sensor noise", () => {
    const f = frame({ distanceYd: 55, stickLuma: 200, noiseSigma: 9 });
    const { best } = det.detect({ data: f.data, width: W, height: H });
    expect(best).not.toBeNull();
    expect(Math.abs(estimate(best!.heightPx) - 55) / 55).toBeLessThan(0.08);
  });

  it("reports flag evidence when there is a flag and little when there is not", () => {
    const withFlag = det.detect({ ...frameInput(frame({ distanceYd: 40 })) }).best!;
    const without = det.detect({ ...frameInput(frame({ distanceYd: 40, flag: false })) }).best!;
    expect(withFlag.flagEvidence).toBeGreaterThan(0.3);
    expect(without.flagEvidence).toBeLessThan(0.15);
  });

  it("does not hallucinate a flagstick in background-only frames", () => {
    for (const background of ["grass", "sky-grass", "trees-grass"] as const) {
      for (const seed of [11, 12, 13]) {
        // 3000 yd: the stick is far shorter than the minimum length, i.e. effectively absent.
        const f = frame({ distanceYd: 3000, background, flag: false, seed });
        expect(det.detect({ data: f.data, width: W, height: H }).best, `${background} seed ${seed}`).toBeNull();
      }
    }
  });

  it("reports frame statistics for the lighting checks", () => {
    const f = frame({ distanceYd: 60 });
    const { stats } = det.detect({ data: f.data, width: W, height: H });
    expect(stats.meanLuma).toBeGreaterThan(40);
    expect(stats.meanLuma).toBeLessThan(200);
    expect(stats.clipHigh).toBeLessThan(0.01);
    expect(stats.sharpness).toBeGreaterThan(0);
  });
});

describe("StickDetector: known failure modes are flagged, not reported confidently", () => {
  const det = new StickDetector();

  it("flags a white stick whose top vanishes into bright sky", () => {
    let flagged = 0;
    let found = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const f = frame({ distanceYd: 70, background: "sky-grass", seed });
      const { best } = det.detect({ data: f.data, width: W, height: H });
      if (!best) continue;
      found++;
      // The measured length is wrong here (it stops at the horizon), so it must be marked.
      if (estimate(best.heightPx) > 70 * 1.15) {
        expect(best.topAmbiguous, `seed ${seed} wrong but not flagged`).toBe(true);
        flagged++;
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(flagged).toBeGreaterThan(0);
  });

  it("prefers the flagstick over a long thin pole that runs off the crop", () => {
    const f = frame({ distanceYd: 60 });
    // Add a 1 px bright vertical line (a pole) across the whole crop, off to the side.
    const poleX = Math.round(W / 2) - 70;
    for (let y = 0; y < H; y++) {
      for (let c = 0; c < 3; c++) f.data[(y * W + poleX) * 4 + c] = Math.min(255, f.data[(y * W + poleX) * 4 + c] + 90);
    }
    const { best, candidates } = det.detect({ data: f.data, width: W, height: H });
    expect(candidates.some((c) => c.clipped)).toBe(true);
    expect(best!.clipped).toBe(false);
    expect(Math.abs(best!.xBase - f.truth.xBase)).toBeLessThan(3);
  });

  it("marks a stick too close to fit in the crop as clipped", () => {
    const f = frame({ distanceYd: 2.5, baseY: H - 10 });
    const { best } = det.detect({ data: f.data, width: W, height: H });
    if (best) expect(best.clipped).toBe(true);
  });
});

describe("tap-to-bracket: measureFromHints", () => {
  const det = new StickDetector();

  it("refines hand-placed ends that are within a pixel or two of the real ends", () => {
    for (const seed of [3, 4, 5]) {
      const f = frame({ distanceYd: 60, seed });
      const t = f.truth;
      const m = det.measureFromHints(
        { data: f.data, width: W, height: H },
        { xTop: t.xTop, yTop: t.yTop + 1.5, xBase: t.xBase, yBase: t.yBase - 1.5 },
      )!;
      expect(m).not.toBeNull();
      // The user was 3 px short in total; snapping must recover most of it.
      expect(Math.abs(m.heightPx - t.heightPx), `seed ${seed}`).toBeLessThan(1.3);
    }
  });

  it("does not make an accurate placement worse", () => {
    const f = frame({ distanceYd: 80, seed: 4 });
    const t = f.truth;
    const m = det.measureFromHints({ data: f.data, width: W, height: H }, { xTop: t.xTop, yTop: t.yTop, xBase: t.xBase, yBase: t.yBase })!;
    expect(Math.abs(m.heightPx - t.heightPx)).toBeLessThan(1.3);
  });

  it("leaves an end exactly where the user put it when it is far from any edge", () => {
    const f = frame({ distanceYd: 60, seed: 3 });
    const t = f.truth;
    const m = det.measureFromHints(
      { data: f.data, width: W, height: H },
      { xTop: t.xTop, yTop: t.yTop - 30, xBase: t.xBase, yBase: t.yBase },
    )!;
    expect(m.snappedTop).toBe(false);
    expect(m.yTop).toBe(t.yTop - 30);
  });

  it("rejects degenerate hints", () => {
    const f = frame({ distanceYd: 60 });
    expect(det.measureFromHints({ data: f.data, width: W, height: H }, { xTop: 100, yTop: 200, xBase: 100, yBase: 201 })).toBeNull();
  });
});

function frameInput(f: ReturnType<typeof frame>) {
  return { data: f.data, width: f.width, height: f.height };
}
