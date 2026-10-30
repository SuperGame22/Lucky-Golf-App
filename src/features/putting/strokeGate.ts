/**
 * One stroke at a time for the putting green.
 *
 * After a release the club takes ~220 ms to swing through the ball (and a paid putt also waits on the
 * server first). The game is still in its "aim" state during that window, so a fast pull-back and
 * release used to be able to start a second stroke on top of the first: two roll loops ran at once,
 * the first one finished and put the game back to "aim", and the putter (drawn at the ball while
 * aiming) then rode along with the ball the second loop was still moving.
 *
 * The gate is closed when a release is accepted and only reopens once the ball has started rolling
 * (input is then blocked by the roll state itself) or the stroke was called off (no putt credit).
 */
export interface StrokeGate {
  /** True while a stroke is between release and the ball starting to roll. */
  readonly busy: boolean;
  /** Claims the gate for a new stroke. Returns false if a stroke is already in flight. */
  begin(): boolean;
  /** Reopens the gate (ball is now rolling, or the stroke was called off). */
  end(): void;
}

export function createStrokeGate(): StrokeGate {
  let busy = false;
  return {
    get busy() { return busy; },
    begin() { if (busy) return false; busy = true; return true; },
    end() { busy = false; },
  };
}
