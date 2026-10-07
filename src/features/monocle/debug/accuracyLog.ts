export interface AccuracySample {
  /** What the laser rangefinder said. */
  truthYards: number;
  /** What Monocle displayed (null if it was not locked). */
  shownYards: number | null;
  rawYards: number | null;
  heightPx: number | null;
  score: number | null;
  confidence: number | null;
  at: number;
}

export interface AccuracySummary {
  n: number;
  scored: number;
  meanErrorYards: number;
  rmsYards: number;
  maxAbsYards: number;
  meanErrorPct: number;
  /** Share of scored samples within 5% of truth. */
  within5pct: number;
}

/** Error is shown minus truth: positive means Monocle read long. */
export function summarizeAccuracy(samples: AccuracySample[]): AccuracySummary {
  const scored = samples.filter((s) => s.shownYards != null && s.truthYards > 0);
  const errs = scored.map((s) => (s.shownYards as number) - s.truthYards);
  const pct = scored.map((s) => ((s.shownYards as number) - s.truthYards) / s.truthYards);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return {
    n: samples.length,
    scored: scored.length,
    meanErrorYards: mean(errs),
    rmsYards: Math.sqrt(mean(errs.map((e) => e * e))),
    maxAbsYards: errs.length ? Math.max(...errs.map(Math.abs)) : 0,
    meanErrorPct: mean(pct) * 100,
    within5pct: scored.length ? pct.filter((p) => Math.abs(p) <= 0.05).length / scored.length : 0,
  };
}

export function samplesToCsv(samples: AccuracySample[]): string {
  const head = "truth_yd,shown_yd,raw_yd,height_px,score,confidence,error_yd,at";
  const rows = samples.map((s) =>
    [
      s.truthYards,
      s.shownYards ?? "",
      s.rawYards?.toFixed(2) ?? "",
      s.heightPx?.toFixed(2) ?? "",
      s.score?.toFixed(1) ?? "",
      s.confidence?.toFixed(2) ?? "",
      s.shownYards != null ? s.shownYards - s.truthYards : "",
      new Date(s.at).toISOString(),
    ].join(","),
  );
  return [head, ...rows].join("\n");
}
