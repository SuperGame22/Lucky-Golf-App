/** Distance Control drill: pure helpers so the screen can't record more shots than there are drills. */
export interface Drill { target: number; club: string; tolerance: number }
export interface ShotResult { target: number; actual: number; diff: number }

export const DISTANCE_DRILLS: Drill[] = [
  { target: 50, club: 'Sand Wedge', tolerance: 5 },
  { target: 100, club: 'Pitching Wedge', tolerance: 8 },
  { target: 150, club: '7 Iron', tolerance: 10 },
  { target: 200, club: '5 Iron', tolerance: 12 },
];

/** The drill to show: the next unplayed one, or the last one once the set is done. */
export function currentDrillIndex(results: ShotResult[], drills: Drill[] = DISTANCE_DRILLS): number {
  return Math.min(results.length, drills.length - 1);
}

/**
 * Adds a shot for the next unplayed drill. A second tap that lands before the button disables
 * (or any tap after the last drill) is ignored, so the set never grows past the drill count.
 */
export function addShot(results: ShotResult[], actual: number, drills: Drill[] = DISTANCE_DRILLS): ShotResult[] {
  if (results.length >= drills.length) return results;
  const target = drills[results.length].target;
  return [...results, { target, actual, diff: Math.abs(actual - target) }];
}

export function isHit(result: ShotResult, index: number, drills: Drill[] = DISTANCE_DRILLS): boolean {
  return result.diff <= (drills[index]?.tolerance ?? 10);
}

export function countHits(results: ShotResult[], drills: Drill[] = DISTANCE_DRILLS): number {
  return results.filter((r, i) => isHit(r, i, drills)).length;
}
