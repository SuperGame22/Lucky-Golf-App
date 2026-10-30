import { describe, it, expect } from 'vitest';
import { DISTANCE_DRILLS, addShot, countHits, currentDrillIndex, isHit } from '../distance';

describe('distance drill', () => {
  it('records each shot against the next drill in order', () => {
    let r = addShot([], 52);
    r = addShot(r, 90);
    expect(r).toEqual([
      { target: 50, actual: 52, diff: 2 },
      { target: 100, actual: 90, diff: 10 },
    ]);
    expect(currentDrillIndex(r)).toBe(2);
  });
  it('ignores extra taps once every drill has a shot (double-tap on the last shot)', () => {
    let r = DISTANCE_DRILLS.reduce((acc, d) => addShot(acc, d.target), [] as ReturnType<typeof addShot>);
    expect(r).toHaveLength(4);
    const again = addShot(r, 123);
    expect(again).toBe(r);
    r = again;
    expect(currentDrillIndex(r)).toBe(3);
  });
  it('a double-tap mid-drill moves to the next drill instead of repeating the same one', () => {
    const r = addShot(addShot([], 50), 100);
    expect(r.map((x) => x.target)).toEqual([50, 100]);
  });
  it('counts hits by each drill tolerance', () => {
    const r = [
      { target: 50, actual: 55, diff: 5 },
      { target: 100, actual: 109, diff: 9 },
      { target: 150, actual: 140, diff: 10 },
      { target: 200, actual: 213, diff: 13 },
    ];
    expect(r.map((x, i) => isHit(x, i))).toEqual([true, false, true, false]);
    expect(countHits(r)).toBe(2);
  });
});
