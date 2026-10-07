import { RANGE } from "./constants";

export type SwingType = "full" | "three-quarter" | "half";

export const SWING_LABELS: Record<SwingType, string> = {
  full: "FULL SWING",
  "three-quarter": "3/4 SWING",
  half: "HALF SWING",
};

export interface WedgeSpec {
  id: string;
  loft: number;
  /** Carry distance in yards for each swing type. A missing swing is not offered. */
  shots: Partial<Record<SwingType, number>>;
  enabled?: boolean;
}

export interface RecommendationConfig {
  wedges: WedgeSpec[];
  /**
   * Yards-equivalent penalty added to a shot's miss distance so that, when two
   * shots are about equally close, the fuller swing wins.
   */
  swingPenalty: Record<SwingType, number>;
  /** No wedge recommendation beyond this. */
  maxYards: number;
}

/**
 * PLACEHOLDER distances for a mid-handicap golfer. Change these here, or let
 * users override them in settings (stored in monocle_settings.wedge_config).
 */
export const DEFAULT_WEDGE_CONFIG: RecommendationConfig = {
  wedges: [
    { id: "w50", loft: 50, shots: { full: 112, "three-quarter": 96, half: 74 } },
    { id: "w54", loft: 54, shots: { full: 98, "three-quarter": 83, half: 62 } },
    { id: "w56", loft: 56, shots: { full: 88, "three-quarter": 73, half: 54 } },
    { id: "w58", loft: 58, shots: { full: 78, "three-quarter": 64, half: 46 } },
  ],
  swingPenalty: { full: 0, "three-quarter": 1.5, half: 3 },
  maxYards: RANGE.wedgeMaxYards,
};

export const SWING_ORDER: SwingType[] = ["full", "three-quarter", "half"];

/** Merge a stored (possibly partial or stale) config over the defaults. */
export function normalizeWedgeConfig(raw: unknown): RecommendationConfig {
  const base = DEFAULT_WEDGE_CONFIG;
  if (!raw || typeof raw !== "object") return structuredCloneConfig(base);
  const r = raw as Partial<RecommendationConfig>;
  const wedges: WedgeSpec[] = Array.isArray(r.wedges)
    ? r.wedges
        .filter((w): w is WedgeSpec => !!w && typeof w.loft === "number" && !!w.shots)
        .map((w) => ({
          id: String(w.id ?? `w${w.loft}`),
          loft: w.loft,
          enabled: w.enabled !== false,
          shots: Object.fromEntries(
            SWING_ORDER.filter((s) => Number.isFinite(w.shots[s]) && (w.shots[s] as number) > 0).map((s) => [
              s,
              w.shots[s] as number,
            ]),
          ),
        }))
    : [];
  return {
    wedges: wedges.length ? wedges : structuredCloneConfig(base).wedges,
    swingPenalty: { ...base.swingPenalty, ...(r.swingPenalty ?? {}) },
    maxYards: Number.isFinite(r.maxYards) ? (r.maxYards as number) : base.maxYards,
  };
}

function structuredCloneConfig(c: RecommendationConfig): RecommendationConfig {
  return JSON.parse(JSON.stringify(c));
}
