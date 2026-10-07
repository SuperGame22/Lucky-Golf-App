import { DEFAULT_WEDGE_CONFIG, RecommendationConfig, SWING_ORDER, SwingType, WedgeSpec } from "../config/wedges";

export interface ShotOption {
  wedge: WedgeSpec;
  swing: SwingType;
  carry: number;
  /** carry - distance: negative means the shot is short of the target. */
  deltaYards: number;
  /** Lower is better. */
  cost: number;
}

export type Recommendation =
  | { kind: "club"; best: ShotOption; runnerUp: ShotOption | null }
  | { kind: "too-far"; maxYards: number }
  | { kind: "short-game"; shortestCarry: number };

export function listShots(config: RecommendationConfig): { wedge: WedgeSpec; swing: SwingType; carry: number }[] {
  const out: { wedge: WedgeSpec; swing: SwingType; carry: number }[] = [];
  for (const wedge of config.wedges) {
    if (wedge.enabled === false) continue;
    for (const swing of SWING_ORDER) {
      const carry = wedge.shots[swing];
      if (carry && carry > 0) out.push({ wedge, swing, carry });
    }
  }
  return out;
}

/**
 * Pick the shot whose carry is closest to the distance, nudged toward fuller
 * swings. Pure and driven entirely by `config`.
 */
export function recommendWedge(distanceYds: number, config: RecommendationConfig = DEFAULT_WEDGE_CONFIG): Recommendation {
  if (distanceYds > config.maxYards) return { kind: "too-far", maxYards: config.maxYards };

  const shots = listShots(config);
  if (shots.length === 0) return { kind: "too-far", maxYards: config.maxYards };

  const shortest = Math.min(...shots.map((s) => s.carry));
  // Well inside the shortest shot we offer: this is a chip or pitch, not a wedge distance.
  if (distanceYds < shortest * 0.6) return { kind: "short-game", shortestCarry: shortest };

  const ranked: ShotOption[] = shots
    .map((s) => ({
      wedge: s.wedge,
      swing: s.swing,
      carry: s.carry,
      deltaYards: s.carry - distanceYds,
      cost: Math.abs(s.carry - distanceYds) + config.swingPenalty[s.swing],
    }))
    .sort((a, b) => a.cost - b.cost || b.carry - a.carry);

  const best = ranked[0];
  const runnerUp = ranked.find((o) => o.wedge.id !== best.wedge.id && Math.abs(o.carry - best.carry) > 0.5) ?? null;
  return { kind: "club", best, runnerUp };
}

export function formatShot(o: Pick<ShotOption, "wedge" | "swing">): string {
  return `${o.wedge.loft}°`;
}
