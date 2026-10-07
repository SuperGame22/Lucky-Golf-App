import { RANGE } from "../config/constants";
import { RecommendationConfig, SWING_LABELS, SwingType } from "../config/wedges";
import { recommendWedge } from "./recommend";
import type { Hint, SessionSnapshot } from "./types";

export type DisplayKind = "searching" | "locking" | "wedge" | "far" | "close" | "short-game";

export interface ClubDisplay {
  loft: number;
  swing: SwingType;
  text: string;
  swingText: string;
  runnerUp: { loft: number; swingText: string } | null;
}

export interface DisplayState {
  kind: DisplayKind;
  /** The big number. Null while there is nothing trustworthy to show. */
  number: string | null;
  plusMinus: string | null;
  club: ClubDisplay | null;
  banner: { tone: "info" | "warn" | "alert"; text: string } | null;
  /** The number is the last locked value and the target is currently lost. */
  stale: boolean;
  offerBracket: boolean;
}

export const HINT_TEXT: Record<Exclude<Hint, null>, { tone: "info" | "warn" | "alert"; text: string }> = {
  "point-at-flag": { tone: "info", text: "POINT AT THE FLAG" },
  "no-flag": { tone: "warn", text: "NO FLAG FOUND. CENTER IT IN THE BOX" },
  "hold-steady": { tone: "warn", text: "HOLD STEADY" },
  "too-dark": { tone: "warn", text: "TOO DARK" },
  "too-bright": { tone: "warn", text: "TOO MUCH GLARE" },
  "step-back": { tone: "warn", text: "STEP BACK" },
  "too-far": { tone: "warn", text: "TARGET TOO FAR TO MEASURE" },
  "top-hidden": { tone: "warn", text: "FLAG TOP HARD TO SEE. TRY TAP TO BRACKET" },
};

export const FAR_MESSAGE = "DON'T SWITCH TO WEDGES YET";

/**
 * What the golfer sees, derived from the session state and the wedge config.
 * Pure so every rule (120 yd cut-off, locking, warnings) is unit-tested.
 */
export function deriveDisplay(s: SessionSnapshot, config: RecommendationConfig): DisplayState {
  const r = s.reading;
  const hasNumber = (r.status === "locked" || r.status === "stale") && r.yards != null;
  const stale = r.status === "stale";
  const max = config.maxYards ?? RANGE.wedgeMaxYards;

  if (!hasNumber) {
    // "Point at the flag" and "no flag found" only make sense while nothing is detected.
    const problem = s.hint && s.hint !== "point-at-flag" && s.hint !== "no-flag" ? HINT_TEXT[s.hint] : null;
    if (r.status === "locking") {
      return base({ kind: "locking", banner: problem ?? { tone: "info", text: "LOCKING ON…" }, offerBracket: s.bracketOffered });
    }
    return base({ kind: "searching", banner: s.hint ? HINT_TEXT[s.hint] : HINT_TEXT["point-at-flag"], offerBracket: s.bracketOffered });
  }

  const yards = r.yards as number;
  const pm = r.plusMinus != null ? `±${r.plusMinus}` : null;
  // A live warning outranks a stale number's silence, but never replaces a fresh number.
  const warn = stale && s.hint ? HINT_TEXT[s.hint] : null;

  if (yards < RANGE.minRangeYards) {
    return base({
      kind: "close",
      number: "<5",
      banner: HINT_TEXT["step-back"],
      stale,
      offerBracket: s.bracketOffered,
    });
  }

  if (s.far) {
    return base({
      kind: "far",
      number: `${max}+`,
      banner: { tone: "alert", text: FAR_MESSAGE },
      stale,
      offerBracket: false,
    });
  }

  const rec = recommendWedge(yards, config);
  if (rec.kind === "club") {
    const o = rec.best;
    return base({
      kind: "wedge",
      number: String(yards),
      plusMinus: pm,
      club: {
        loft: o.wedge.loft,
        swing: o.swing,
        text: `${o.wedge.loft}°`,
        swingText: SWING_LABELS[o.swing],
        runnerUp: rec.runnerUp ? { loft: rec.runnerUp.wedge.loft, swingText: SWING_LABELS[rec.runnerUp.swing] } : null,
      },
      banner: warn,
      stale,
      offerBracket: s.bracketOffered,
    });
  }
  if (rec.kind === "short-game") {
    return base({
      kind: "short-game",
      number: String(yards),
      plusMinus: pm,
      banner: { tone: "info", text: "SHORT GAME. CHIP OR PITCH" },
      stale,
      offerBracket: s.bracketOffered,
    });
  }
  // Config says too-far even though the gate did not (e.g. config changed mid-session).
  return base({
    kind: "far",
    number: `${max}+`,
    banner: { tone: "alert", text: FAR_MESSAGE },
    stale,
    offerBracket: false,
  });
}

function base(p: Partial<DisplayState> & { kind: DisplayKind }): DisplayState {
  return {
    number: null,
    plusMinus: null,
    club: null,
    banner: null,
    stale: false,
    offerBracket: false,
    ...p,
  };
}

/** The same display rules for a single deliberate reading (tap to bracket, calibration checks). */
export function displayForReading(yards: number, plusMinus: number | null, config: RecommendationConfig): DisplayState {
  const max = config.maxYards ?? RANGE.wedgeMaxYards;
  const snap = {
    reading: {
      status: "locked",
      yards: Math.round(yards),
      plusMinus,
      confidence: 1,
      samples: 1,
      medianYards: yards,
      stdErrPct: 0,
      spreadPct: 0,
    },
    far: yards > max,
    hint: null,
    bracketOffered: false,
  } as unknown as SessionSnapshot;
  return deriveDisplay(snap, config);
}
