import { beforeAll, describe, expect, it } from "vitest";
import { StickDetector, DetectionResult } from "../vision/detector";
import { renderSynthRoi, SynthFrame, mulberry32 } from "../testing/synthScene";
import { MeasurementPipeline, Optics, PipelineOutput } from "../engine/pipeline";
import { deriveDisplay, FAR_MESSAGE } from "../engine/display";
import { DEFAULT_WEDGE_CONFIG } from "../config/wedges";
import type { SessionSnapshot } from "../engine/types";

const LONG_SIDE = 1920;
const FOCAL = LONG_SIDE * 0.75;
const W = 240;
const H = 1180;
const HZ = 12;

const optics: Optics = { stickHeightIn: 84, stickFromUser: false, focalRatio: 0.75, calibrated: false };

/** Render a handful of frames with hand-jitter, detect once, then loop them as a video. */
function makeClip(distanceYd: number, opts: Partial<Parameters<typeof renderSynthRoi>[0]> = {}, n = 8) {
  const rand = mulberry32(99);
  const det = new StickDetector();
  const frames: { f: SynthFrame; r: DetectionResult }[] = [];
  for (let i = 0; i < n; i++) {
    const f = renderSynthRoi({
      width: W,
      height: H,
      focalPx: FOCAL,
      distanceYd,
      flag: true,
      seed: 200 + i,
      baseY: H * 0.8 + (rand() - 0.5) * 3,
      centerX: W / 2 + (rand() - 0.5) * 6,
      ...opts,
    });
    frames.push({ f, r: det.detect({ data: f.data, width: W, height: H }) });
  }
  return frames;
}

function run(
  frames: { r: DetectionResult }[],
  seconds: number,
  ctx: { shakeDps?: number | null } = {},
  startMs = 0,
  pipe = new MeasurementPipeline(() => optics),
) {
  const outs: PipelineOutput[] = [];
  const count = Math.round(seconds * HZ);
  for (let i = 0; i < count; i++) {
    const t = startMs + (i * 1000) / HZ;
    outs.push(pipe.process(frames[i % frames.length].r, { t, longSide: LONG_SIDE, shakeDps: ctx.shakeDps ?? 2, elevationRad: 0 }));
  }
  return { outs, pipe };
}

const snapshotOf = (o: PipelineOutput): SessionSnapshot => ({
  running: true,
  paused: false,
  reading: o.reading,
  far: o.far,
  detection: null,
  hint: o.hint,
  lighting: o.lighting,
  shaking: o.shaking,
  motionAvailable: true,
  bracketOffered: o.bracketOffered,
  calibrated: false,
  debug: {} as SessionSnapshot["debug"],
});

describe("end to end: synthetic video -> detector -> pipeline -> display", () => {
  let clip87: ReturnType<typeof makeClip>;
  beforeAll(() => {
    clip87 = makeClip(87);
  });

  it("locks onto a stick at 87 yd and shows 87 with a wedge", () => {
    const { outs } = run(clip87, 4);
    const last = outs[outs.length - 1];
    expect(last.reading.status).toBe("locked");
    expect(Math.abs((last.reading.yards as number) - 87)).toBeLessThanOrEqual(2);
    const d = deriveDisplay(snapshotOf(last), DEFAULT_WEDGE_CONFIG);
    expect(d.kind).toBe("wedge");
    expect(d.number).toBe(String(last.reading.yards));
    expect(d.club).not.toBeNull();
    expect(d.plusMinus).toMatch(/^±\d+$/);
    expect(d.banner).toBeNull();
  });

  it("does not flicker once locked", () => {
    const { outs } = run(clip87, 6);
    const shown = outs.filter((o) => o.reading.status === "locked").map((o) => o.reading.yards);
    expect(new Set(shown).size).toBeLessThanOrEqual(2);
  });

  it("locks within about 1.5 seconds", () => {
    const { outs } = run(clip87, 3);
    const first = outs.findIndex((o) => o.locked);
    expect(first).toBeGreaterThan(-1);
    expect((first * 1000) / HZ).toBeLessThanOrEqual(1500);
  });

  it("uses the stick height the user set: 8 ft makes the same pixels read further away", () => {
    const eight: Optics = { ...optics, stickHeightIn: 96, stickFromUser: true };
    const { outs } = run(clip87, 3, {}, 0, new MeasurementPipeline(() => eight));
    const last = outs[outs.length - 1];
    expect(Math.abs((last.reading.yards as number) - 87 * (96 / 84))).toBeLessThanOrEqual(2);
  });

  it("uses the calibrated focal ratio when there is one", () => {
    const cal: Optics = { ...optics, focalRatio: 0.8, calibrated: true };
    const { outs } = run(clip87, 3, {}, 0, new MeasurementPipeline(() => cal));
    const last = outs[outs.length - 1];
    expect(Math.abs((last.reading.yards as number) - 87 * (0.8 / 0.75))).toBeLessThanOrEqual(2);
  });

  it("refuses to show a number while the phone is shaking, and says so", () => {
    const { outs } = run(clip87, 4, { shakeDps: 50 });
    expect(outs.some((o) => o.reading.status === "locked")).toBe(false);
    const last = outs[outs.length - 1];
    expect(last.hint).toBe("hold-steady");
    expect(deriveDisplay(snapshotOf(last), DEFAULT_WEDGE_CONFIG).banner?.text).toBe("HOLD STEADY");
  });

  it("reports an empty scene: point at the flag, then no flag found, then offers tap to bracket", () => {
    const empty = makeClip(3000, { flag: false }, 3);
    const { outs } = run(empty, 6);
    expect(outs[2].hint).toBe("point-at-flag");
    expect(outs[outs.length - 1].hint).toBe("no-flag");
    expect(outs[2].bracketOffered).toBe(false);
    expect(outs[outs.length - 1].bracketOffered).toBe(true);
    expect(deriveDisplay(snapshotOf(outs[outs.length - 1]), DEFAULT_WEDGE_CONFIG).number).toBeNull();
  });

  it("says too dark when the scene is dark", () => {
    const dark = makeClip(60, {}, 3);
    for (const { f } of dark) for (let i = 0; i < f.data.length; i += 4) {
      f.data[i] *= 0.15; f.data[i + 1] *= 0.15; f.data[i + 2] *= 0.15;
    }
    const det = new StickDetector();
    const rerun = dark.map(({ f }) => ({ r: det.detect({ data: f.data, width: W, height: H }) }));
    const { outs } = run(rerun, 3);
    expect(outs[outs.length - 1].lighting).toBe("dark");
    expect(outs[outs.length - 1].hint).toBe("too-dark");
  });
});

describe("over the wedge range", () => {
  it("shows 120+ and the warning, with no club, for a target at ~140 yd", () => {
    // Quiet scene so detection is reliable this far out; the logic under test is the cut-off.
    const clip = makeClip(140, { noiseSigma: 2, textureSigma: 2 });
    const { outs } = run(clip, 5);
    const last = outs[outs.length - 1];
    expect(last.reading.status).toBe("locked");
    expect(last.far).toBe(true);
    const d = deriveDisplay(snapshotOf(last), DEFAULT_WEDGE_CONFIG);
    expect(d.kind).toBe("far");
    expect(d.number).toBe("120+");
    expect(d.banner).toEqual({ tone: "alert", text: FAR_MESSAGE });
    expect(d.club).toBeNull();
  });
});

describe("deriveDisplay rules", () => {
  const snap = (over: Partial<SessionSnapshot>): SessionSnapshot => ({
    ...snapshotOf({
      reading: { status: "searching", yards: null, plusMinus: null, confidence: 0, samples: 0, medianYards: null, stdErrPct: null, spreadPct: null },
      far: false, overlay: null, hint: null, lighting: "ok", shaking: false, bracketOffered: false,
      rawYards: null, heightPx: null, score: null, sample: null, prior: null, locked: false, newLock: false,
    }),
    ...over,
  });
  const locked = (yards: number, extra: Partial<SessionSnapshot> = {}) =>
    snap({
      reading: { status: "locked", yards, plusMinus: 4, confidence: 0.9, samples: 12, medianYards: yards, stdErrPct: 0.01, spreadPct: 0.03 },
      ...extra,
    });

  it("shows the club for a locked wedge distance", () => {
    const d = deriveDisplay(locked(110), DEFAULT_WEDGE_CONFIG);
    expect(d.club?.text).toBe("50°");
    expect(d.club?.swingText).toBe("FULL SWING");
  });

  it("shows LOCKING ON while locking and never a number", () => {
    const d = deriveDisplay(snap({ reading: { ...locked(87).reading, status: "locking", yards: null } }), DEFAULT_WEDGE_CONFIG);
    expect(d.number).toBeNull();
    expect(d.banner?.text).toBe("LOCKING ON…");
  });

  it("LOCKING ON beats the generic point-at-the-flag hint, but a real problem beats LOCKING ON", () => {
    const locking = { ...locked(87).reading, status: "locking" as const, yards: null };
    expect(deriveDisplay(snap({ reading: locking, hint: "point-at-flag" }), DEFAULT_WEDGE_CONFIG).banner?.text).toBe("LOCKING ON…");
    expect(deriveDisplay(snap({ reading: locking, hint: "hold-steady" }), DEFAULT_WEDGE_CONFIG).banner?.text).toBe("HOLD STEADY");
  });

  it("dims a stale number instead of dropping it", () => {
    const d = deriveDisplay(locked(87, { reading: { ...locked(87).reading, status: "stale" } }), DEFAULT_WEDGE_CONFIG);
    expect(d.stale).toBe(true);
    expect(d.number).toBe("87");
  });

  it("asks the user to step back when closer than 5 yd", () => {
    const d = deriveDisplay(locked(3), DEFAULT_WEDGE_CONFIG);
    expect(d.kind).toBe("close");
    expect(d.banner?.text).toBe("STEP BACK");
    expect(d.club).toBeNull();
  });

  it("gives short-game shots no wedge", () => {
    const d = deriveDisplay(locked(15), DEFAULT_WEDGE_CONFIG);
    expect(d.kind).toBe("short-game");
    expect(d.club).toBeNull();
  });

  it("honours a changed cut-off in the config", () => {
    const d = deriveDisplay(locked(130), { ...DEFAULT_WEDGE_CONFIG, maxYards: 140 });
    expect(d.kind).toBe("wedge");
  });

  it("surfaces the old-phone-independent hints when nothing is locked", () => {
    for (const [hint, text] of [
      ["too-far", "TARGET TOO FAR TO MEASURE"],
      ["top-hidden", "FLAG TOP HARD TO SEE. TRY TAP TO BRACKET"],
      ["too-bright", "TOO MUCH GLARE"],
    ] as const) {
      expect(deriveDisplay(snap({ hint }), DEFAULT_WEDGE_CONFIG).banner?.text).toBe(text);
    }
  });
});
