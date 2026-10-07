import { describe, expect, it } from "vitest";
import {
  displayPlusMinus,
  distanceSigmaYards,
  distanceYards,
  endpointSigmaFromScore,
  heightPxAtDistance,
} from "../engine/distance";
import { focalRatioFromMeasurement, cameraKey, resolveFocalRatio } from "../engine/calibration";

const F = 1440; // 0.75 x a 1920 px long side

describe("pinhole distance", () => {
  it("gives ~39 px for a 7 ft stick at 87 yd and inverts exactly", () => {
    const px = heightPxAtDistance(87, 84, F);
    expect(px).toBeCloseTo(38.6, 1);
    expect(distanceYards({ heightPx: px, stickHeightIn: 84, focalPx: F })).toBeCloseTo(87, 6);
  });

  it("scales inversely with apparent height", () => {
    const a = distanceYards({ heightPx: 50, stickHeightIn: 84, focalPx: F });
    const b = distanceYards({ heightPx: 25, stickHeightIn: 84, focalPx: F });
    expect(b / a).toBeCloseTo(2, 9);
  });

  it("an 8 ft stick at the same pixel height is further away than a 7 ft one", () => {
    const seven = distanceYards({ heightPx: 40, stickHeightIn: 84, focalPx: F });
    const eight = distanceYards({ heightPx: 40, stickHeightIn: 96, focalPx: F });
    expect(eight / seven).toBeCloseTo(96 / 84, 9);
  });

  it("corrects for foreshortening when looking up or down", () => {
    const flat = distanceYards({ heightPx: 40, stickHeightIn: 84, focalPx: F });
    const tilted = distanceYards({ heightPx: 40, stickHeightIn: 84, focalPx: F, elevationRad: (20 * Math.PI) / 180 });
    expect(tilted / flat).toBeCloseTo(Math.cos((20 * Math.PI) / 180), 9);
  });

  it("returns Infinity for a zero-height stick instead of NaN", () => {
    expect(distanceYards({ heightPx: 0, stickHeightIn: 84, focalPx: F })).toBe(Infinity);
  });
});

describe("accuracy estimate", () => {
  const at = (yd: number, calibrated: boolean, user = calibrated) => {
    const heightPx = heightPxAtDistance(yd, 84, F);
    return distanceSigmaYards({
      heightPx,
      distanceYds: yd,
      endpointSigmaPx: endpointSigmaFromScore(40),
      calibrated,
      stickHeightFromUser: user,
    });
  };

  it("grows with distance", () => {
    expect(at(100, true)).toBeGreaterThan(at(50, true));
  });

  it("is about 4-5 yd at 100 yd once calibrated, and roughly double without calibration", () => {
    expect(at(100, true)).toBeGreaterThan(3.5);
    expect(at(100, true)).toBeLessThan(6);
    expect(at(100, false, false)).toBeGreaterThan(at(100, true) * 1.6);
  });

  it("never promises better than 1 yard", () => {
    expect(displayPlusMinus(0.2)).toBe(1);
    expect(displayPlusMinus(4.4)).toBe(4);
  });

  it("endpoint error shrinks as detection gets stronger", () => {
    expect(endpointSigmaFromScore(200)).toBeLessThan(endpointSigmaFromScore(20));
  });
});

describe("calibration", () => {
  it("recovers the focal ratio from a door at 10 ft", () => {
    // A door (80 in) at 120 in with f = 1440 px appears 960 px tall.
    const ratio = focalRatioFromMeasurement({ heightPx: 960, objectHeightIn: 80, distanceIn: 120, longSidePx: 1920 });
    expect(ratio).toBeCloseTo(0.75, 9);
  });

  it("rejects physically implausible results", () => {
    expect(focalRatioFromMeasurement({ heightPx: 5, objectHeightIn: 80, distanceIn: 120, longSidePx: 1920 })).toBeNull();
    expect(focalRatioFromMeasurement({ heightPx: 0, objectHeightIn: 80, distanceIn: 120, longSidePx: 1920 })).toBeNull();
  });

  it("falls back to the default when no calibration exists", () => {
    const key = cameraKey({ label: "Back Camera", aspect: 16 / 9, screenW: 390, screenH: 844, dpr: 3 });
    expect(resolveFocalRatio({}, key)).toEqual({ ratio: 0.75, calibrated: false });
    expect(resolveFocalRatio({ [key]: { ratio: 0.82, at: "2026-10-06" } }, key)).toEqual({ ratio: 0.82, calibrated: true });
  });

  it("keys do not depend on screen orientation", () => {
    const a = cameraKey({ label: "Back Camera", aspect: 1.78, screenW: 390, screenH: 844, dpr: 3 });
    const b = cameraKey({ label: "Back Camera", aspect: 1.78, screenW: 844, screenH: 390, dpr: 3 });
    expect(a).toBe(b);
  });
});
