import { describe, expect, it } from "vitest";
import { MAX_FRAME_MS, STEP_MS, startClock, stepsDue } from "../timestep";

/** Total physics steps taken over `seconds` of play on a screen refreshing at `hz`. */
const stepsOver = (seconds: number, hz: number) => {
  const frame = 1000 / hz;
  const clock = startClock(0);
  let total = 0;
  for (let t = frame; t <= seconds * 1000 + 1e-6; t += frame) total += stepsDue(clock, t);
  return total;
};

describe("putting time step", () => {
  it("rolls the ball the same distance in a second on any screen speed", () => {
    for (const hz of [24, 30, 60, 90, 120, 144]) {
      expect(Math.abs(stepsOver(1, hz) - 60)).toBeLessThanOrEqual(1);
    }
  });
  it("takes one step a frame at 60 Hz, two at 30 Hz, and none some frames at 120 Hz", () => {
    const c60 = startClock(0);
    expect([1, 2, 3].map((i) => stepsDue(c60, i * STEP_MS + 0.001))).toEqual([1, 1, 1]);
    const c30 = startClock(0);
    expect([1, 2, 3].map((i) => stepsDue(c30, i * 2 * STEP_MS + 0.001))).toEqual([2, 2, 2]);
    const c120 = startClock(0);
    const seq = [1, 2, 3, 4].map((i) => stepsDue(c120, (i * STEP_MS) / 2 + 0.001));
    expect(seq.reduce((a, b) => a + b, 0)).toBe(2);
  });
  it("never jumps ahead after a long pause", () => {
    const c = startClock(0);
    expect(stepsDue(c, 5000)).toBe(Math.floor(MAX_FRAME_MS / STEP_MS));
  });
  it("ignores a clock that goes backwards", () => {
    const c = startClock(1000);
    expect(stepsDue(c, 900)).toBe(0);
  });
});
