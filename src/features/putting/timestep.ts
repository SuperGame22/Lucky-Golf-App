/**
 * Fixed-timestep clock for the putting ball. The physics advances in steps of 1/60 s, however often the
 * screen redraws, so the ball rolls at the same pace on a 30, 60 or 120 Hz screen.
 */
export const STEP_MS = 1000 / 60;
/** A long pause (hidden tab, slow frame) is cut to this, so the ball never jumps ahead to catch up. */
export const MAX_FRAME_MS = 100;

export interface StepClock { acc: number; last: number }

export const startClock = (now: number): StepClock => ({ acc: 0, last: now });

/** Call once per frame; returns how many whole physics steps are due. */
export function stepsDue(clock: StepClock, now: number): number {
  clock.acc += Math.min(Math.max(now - clock.last, 0), MAX_FRAME_MS) / STEP_MS;
  clock.last = now;
  const n = Math.floor(clock.acc);
  clock.acc -= n;
  return n;
}
