import { describe, expect, it } from "vitest";
import { sampleConfidence, SampleQuality } from "../engine/confidence";

const good: SampleQuality = { score: 80, heightPx: 50, flagEvidence: 0.6, shakeDps: 3, clipped: false };

describe("sampleConfidence", () => {
  it("is high for a strong, steady, flagged detection", () => {
    expect(sampleConfidence(good)).toBeGreaterThan(0.85);
  });

  it("rises with detection strength", () => {
    expect(sampleConfidence({ ...good, score: 25 })).toBeLessThan(sampleConfidence({ ...good, score: 60 }));
    expect(sampleConfidence({ ...good, score: 10 })).toBeLessThan(0.2);
  });

  it("drops when the phone is shaking", () => {
    expect(sampleConfidence({ ...good, shakeDps: 45 })).toBeLessThan(0.1);
    expect(sampleConfidence({ ...good, shakeDps: 20 })).toBeLessThan(sampleConfidence(good));
  });

  it("is lower for a tiny stick and for one that runs off the crop", () => {
    expect(sampleConfidence({ ...good, heightPx: 14 })).toBeLessThan(sampleConfidence(good));
    expect(sampleConfidence({ ...good, clipped: true })).toBeLessThan(0.4);
  });

  it("still works without motion sensors, with a small penalty", () => {
    const c = sampleConfidence({ ...good, shakeDps: null });
    expect(c).toBeGreaterThan(0.6);
    expect(c).toBeLessThan(sampleConfidence(good));
  });

  it("is bounded to 0..1", () => {
    const hi = sampleConfidence({ ...good, score: 1e6, heightPx: 1e5, flagEvidence: 5 });
    const lo = sampleConfidence({ score: -5, heightPx: 0, flagEvidence: -1, shakeDps: 1e6, clipped: true });
    expect(hi).toBeLessThanOrEqual(1);
    expect(lo).toBeGreaterThanOrEqual(0);
  });
});
