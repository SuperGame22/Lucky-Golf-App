import { describe, expect, it } from "vitest";
import { layoutExclusions, pickCloverPosition, seededRandom } from "../clovers/spawnPosition";
import { rectsIntersect, reticleRect, inflate, Rect } from "../engine/geometry";
import { mulberry32 } from "../testing/synthScene";

const PHONES = [
  { w: 390, h: 844 },
  { w: 360, h: 640 },
  { w: 430, h: 932 },
  { w: 844, h: 390 },
];

const exclusions = layoutExclusions;

describe("clover placement", () => {
  it("never overlaps the aiming box, the readout or the top bar, on any screen size", () => {
    for (const c of PHONES) {
      const ex = exclusions(c);
      let placed = 0;
      for (let seed = 0; seed < 300; seed++) {
        const p = pickCloverPosition(c, ex, mulberry32(seed));
        if (!p) continue;
        placed++;
        const box: Rect = { x: p.x - 26, y: p.y - 26, w: 52, h: 52 };
        for (const e of ex) expect(rectsIntersect(e, box), `${c.w}x${c.h} seed ${seed}`).toBe(false);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w).toBeLessThanOrEqual(c.w);
        expect(box.y + box.h).toBeLessThanOrEqual(c.h);
      }
      expect(placed, `${c.w}x${c.h}`).toBeGreaterThan(150);
    }
  });

  it("keeps clear space around the aiming box, not just no overlap", () => {
    const c = PHONES[0];
    const keepOut = inflate(reticleRect(c), 14);
    for (let seed = 0; seed < 200; seed++) {
      const p = pickCloverPosition(c, exclusions(c), mulberry32(seed));
      if (p) expect(rectsIntersect(keepOut, { x: p.x - 26, y: p.y - 26, w: 52, h: 52 })).toBe(false);
    }
  });

  it("skips the clover rather than covering the rangefinder when there is no room", () => {
    const c = { w: 390, h: 844 };
    expect(pickCloverPosition(c, [{ x: 0, y: 0, w: 390, h: 844 }], mulberry32(1))).toBeNull();
  });

  it("is reproducible from a clover id, so a reload puts it back where it was", () => {
    const c = PHONES[0];
    const id = "5b0d0b52-97c8-4b5b-9d7d-2a1d3a3f0c11";
    const a = pickCloverPosition(c, exclusions(c), seededRandom(id));
    const b = pickCloverPosition(c, exclusions(c), seededRandom(id));
    expect(a).toEqual(b);
    expect(pickCloverPosition(c, exclusions(c), seededRandom(id + "x"))).not.toEqual(a);
  });
});
