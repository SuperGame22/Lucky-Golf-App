import { describe, expect, it } from "vitest";
import { DistanceStabilizer, RangeGate, StabilizerSample } from "../engine/stabilizer";
import { mulberry32 } from "../testing/synthScene";

const sample = (t: number, yards: number, confidence = 0.9): StabilizerSample => ({
  t,
  yards,
  sigmaPixel: 3,
  sigmaSystematic: 3,
  confidence,
});

/** Feed `count` samples at 12 Hz around `centre` with the given 1-sigma noise. */
function feed(s: DistanceStabilizer, startMs: number, count: number, centre: number, noise: number, seed = 1, conf = 0.9) {
  const rand = mulberry32(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = startMs + i * 83;
    const n = (rand() + rand() + rand() + rand() - 2) * 1.73 * noise; // ~N(0, noise)
    out.push(s.push(sample(t, centre + n, conf), t));
  }
  return out;
}

describe("DistanceStabilizer", () => {
  it("shows nothing until it has enough agreeing samples", () => {
    const s = new DistanceStabilizer();
    const r = feed(s, 0, 4, 87, 1);
    expect(r.every((x) => x.status !== "locked" && x.yards === null)).toBe(true);
  });

  it("turns 86, 87, 87, 88, 87 into a steady 87", () => {
    const s = new DistanceStabilizer();
    const seq = [86, 87, 87, 88, 87, 86, 87, 88, 87, 87, 86, 88, 87, 87];
    let last = null;
    seq.forEach((y, i) => (last = s.push(sample(i * 83, y), i * 83)));
    expect(last!.status).toBe("locked");
    expect(last!.yards).toBe(87);
  });

  it("does not flicker: noisy input produces at most one adjacent change in the displayed value", () => {
    const s = new DistanceStabilizer();
    const readings = feed(s, 0, 80, 87.4, 2.2, 7);
    const shown = readings.filter((r) => r.status === "locked").map((r) => r.yards as number);
    expect(shown.length).toBeGreaterThan(40);
    const distinct = new Set(shown);
    expect(distinct.size).toBeLessThanOrEqual(2);
    for (const v of distinct) expect(Math.abs(v - 87.4)).toBeLessThan(1.7);
  });

  it("locks within about a second at 12 Hz", () => {
    const s = new DistanceStabilizer();
    const readings = feed(s, 0, 30, 70, 1.2);
    const firstLocked = readings.findIndex((r) => r.status === "locked");
    expect(firstLocked).toBeGreaterThan(-1);
    expect(firstLocked * 83).toBeLessThanOrEqual(1100);
  });

  it("refuses to lock on low-confidence samples", () => {
    const s = new DistanceStabilizer();
    const readings = feed(s, 0, 40, 87, 1, 3, 0.2);
    expect(readings.some((r) => r.status === "locked")).toBe(false);
    expect(readings[readings.length - 1].status).toBe("locking");
  });

  it("refuses to lock when readings disagree wildly (flipping between objects)", () => {
    const s = new DistanceStabilizer();
    const out = [];
    for (let i = 0; i < 40; i++) out.push(s.push(sample(i * 83, i % 2 ? 60 : 100), i * 83));
    expect(out.some((r) => r.status === "locked")).toBe(false);
  });

  it("rejects an occasional outlier frame", () => {
    const s = new DistanceStabilizer();
    const rand = mulberry32(5);
    let last = null;
    for (let i = 0; i < 30; i++) {
      const y = i % 9 === 4 ? 140 : 87 + (rand() - 0.5) * 2;
      last = s.push(sample(i * 83, y), i * 83);
    }
    expect(last!.status).toBe("locked");
    expect(last!.yards).toBe(87);
  });

  it("re-locks quickly on a new target instead of dragging through the old value", () => {
    const s = new DistanceStabilizer();
    feed(s, 0, 20, 87, 1);
    const after = feed(s, 20 * 83, 24, 62, 1, 9);
    const relock = after.findIndex((r) => r.status === "locked" && r.yards !== null && Math.abs(r.yards - 62) <= 2);
    expect(relock).toBeGreaterThan(-1);
    expect(relock * 83).toBeLessThanOrEqual(1600);
    // Never shows a number between the two targets as a locked value.
    for (const r of after) if (r.status === "locked") expect(Math.abs((r.yards as number) - 62) <= 3 || Math.abs((r.yards as number) - 87) <= 3).toBe(true);
  });

  it("holds the last value dimmed briefly when the target drops out, then clears", () => {
    const s = new DistanceStabilizer();
    feed(s, 0, 20, 87, 1);
    const tLast = 19 * 83;
    const soon = s.push(null, tLast + 300);
    expect(soon.status).toBe("stale");
    expect(soon.yards).toBe(87);
    const later = s.push(null, tLast + 1000);
    expect(later.status).toBe("searching");
    expect(later.yards).toBeNull();
  });

  it("reports a plus/minus that includes the unaveraged systematic error", () => {
    const s = new DistanceStabilizer();
    const r = feed(s, 0, 30, 87, 0.5);
    const last = r[r.length - 1];
    expect(last.plusMinus).toBeGreaterThanOrEqual(3);
  });

  it("reset clears everything", () => {
    const s = new DistanceStabilizer();
    feed(s, 0, 20, 87, 1);
    s.reset();
    expect(s.push(null, 2000).status).toBe("searching");
  });
});

describe("DistanceStabilizer on a slow device", () => {
  it("still locks at about 1.2 samples a second, just more slowly", () => {
    const s = new DistanceStabilizer();
    const dt = 830;
    let lockedAt = -1;
    let last = null;
    for (let i = 0; i < 20; i++) {
      const t = i * dt;
      last = s.push(sample(t, 87 + (i % 3 === 0 ? 0.4 : -0.3)), t);
      if (lockedAt < 0 && last.status === "locked") lockedAt = i;
    }
    expect(lockedAt).toBeGreaterThan(-1);
    expect(lockedAt).toBeLessThanOrEqual(12);
    expect(last!.status).toBe("locked");
    expect(last!.yards).toBe(87);
  });

  it("does not drop a slow device's number between two of its own frames", () => {
    const s = new DistanceStabilizer();
    const dt = 830;
    for (let i = 0; i < 14; i++) s.push(sample(i * dt, 87), i * dt);
    const tLast = 13 * dt;
    expect(s.push(null, tLast + 700).yards).toBe(87);
    expect(s.push(null, tLast + 3000).status).toBe("searching");
  });
});

describe("RangeGate", () => {
  it("flips to far only above the limit and back only well below it", () => {
    const g = new RangeGate(120, 2);
    expect(g.update(119)).toBe(false);
    expect(g.update(120)).toBe(false);
    expect(g.update(121)).toBe(true);
    expect(g.update(120)).toBe(true);
    expect(g.update(119)).toBe(true);
    expect(g.update(118)).toBe(false);
  });

  it("keeps its state when there is no reading", () => {
    const g = new RangeGate(120, 2);
    g.update(140);
    expect(g.update(null)).toBe(true);
  });
});
