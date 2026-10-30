import { describe, it, expect } from 'vitest';
import { afterLipOut, elapsedSeconds } from '../round';

describe('afterLipOut', () => {
  it('returns to rolling only while the lip-out is still showing', () => {
    expect(afterLipOut('lip')).toBe('roll');
  });
  it('never overwrites a finished putt (sunk on the last hole must stay sunk)', () => {
    expect(afterLipOut('sunk')).toBe('sunk');
    expect(afterLipOut('miss')).toBe('miss');
    expect(afterLipOut('sand')).toBe('sand');
    expect(afterLipOut('aim')).toBe('aim');
  });
});

describe('elapsedSeconds', () => {
  it('rounds to whole seconds', () => {
    expect(elapsedSeconds(1000, 62_600)).toBe(62);
  });
  it('is never negative or NaN', () => {
    expect(elapsedSeconds(5000, 1000)).toBe(0);
    expect(elapsedSeconds(NaN, 1000)).toBe(0);
  });
});
