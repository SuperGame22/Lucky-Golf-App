import { describe, it, expect } from 'vitest';
import { createStrokeGate } from '../strokeGate';

describe('stroke gate (club must not ride along with the ball)', () => {
  it('lets one stroke through and refuses a second release while the first is swinging', () => {
    const g = createStrokeGate();
    expect(g.busy).toBe(false);
    expect(g.begin()).toBe(true);
    expect(g.busy).toBe(true);
    // a fast second pull-back + release during the 220 ms swing
    expect(g.begin()).toBe(false);
    expect(g.busy).toBe(true);
  });

  it('opens again once the ball is rolling or the stroke is called off', () => {
    const g = createStrokeGate();
    g.begin();
    g.end();
    expect(g.busy).toBe(false);
    expect(g.begin()).toBe(true);
  });

  it('simulates rapid releases: only one roll starts per stroke', () => {
    const g = createStrokeGate();
    let rolls = 0;
    const release = () => { if (g.begin()) pending.push(() => { rolls++; g.end(); }); };
    const pending: Array<() => void> = [];
    release(); release(); release(); // three fast releases inside one swing
    pending.splice(0).forEach((f) => f()); // swing timer fires, ball starts rolling
    expect(rolls).toBe(1);
    release();
    pending.splice(0).forEach((f) => f());
    expect(rolls).toBe(2);
  });
});
