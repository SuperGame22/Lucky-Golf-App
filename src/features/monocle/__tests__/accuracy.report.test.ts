import { describe, it } from "vitest";

/**
 * Prints a measured-accuracy table for the detector on synthetic frames.
 * Opt-in because it is slow and only prints:  npm run test:accuracy
 * Re-run it after changing the detector and compare the numbers in docs/monocle.md.
 */
const run = process.env.MONOCLE_REPORT ? describe : describe.skip;
import { StickDetector } from "../vision/detector";
import { renderSynthRoi, SynthOptions } from "../testing/synthScene";
import { distanceYards } from "../engine/distance";

const F = 1440;
const W = 240;
const H = 1180;

run("detector accuracy report", () => {
for (const flag of [true, false]) {
  it(`experiment: accuracy by distance (flag=${flag})`, () => {
    const det = new StickDetector();
    const rows: Record<string, string | number | null>[] = [];
    for (const bg of ["grass", "sky-grass", "trees-grass"] as const) {
      for (const d of [25, 40, 60, 80, 100, 120]) {
        const errs: number[] = [];
        const scores: number[] = [];
        let found = 0;
        let amb = 0;
        const N = 8;
        for (let seed = 1; seed <= N; seed++) {
          const opts: SynthOptions = { width: W, height: H, distanceYd: d, focalPx: F, background: bg, flag, seed };
          const f = renderSynthRoi(opts);
          const r = det.detect({ data: f.data, width: W, height: H });
          const b = r.best;
          if (b && Math.abs(b.xBase - f.truth.xBase) < 6 && Math.abs(b.yBase - f.truth.yBase) < 25) {
            found++;
            if (b.topAmbiguous) amb++;
            const est = distanceYards({ heightPx: b.heightPx, stickHeightIn: 84, focalPx: F });
            errs.push((est - d) / d);
            scores.push(b.score);
          }
        }
        const rms = errs.length ? Math.sqrt(errs.reduce((a, b) => a + b * b, 0) / errs.length) : null;
        rows.push({
          bg,
          d,
          found: `${found}/${N}`,
          ambiguous: amb,
          meanErrPct: errs.length ? +(100 * errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(1) : null,
          rmsErrPct: rms != null ? +(100 * rms).toFixed(1) : null,
          maxAbsPct: errs.length ? +(100 * Math.max(...errs.map(Math.abs))).toFixed(1) : null,
          score: scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(0) : null,
        });
      }
    }
    console.log("flag =", flag);
    console.table(rows);
  }, 120000);
}
});
