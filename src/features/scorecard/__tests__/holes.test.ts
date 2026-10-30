import { describe, it, expect } from 'vitest';
import { buildHoles, summarize, parLabel, defaultStrokes, formatDiff, type CourseHole } from '../holes';

const PARS = [4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 4, 3, 5, 4, 3, 5, 4, 4];
const full: CourseHole[] = PARS.map((par, i) => ({ hole: i + 1, par, yards_est: 300 + i }));

describe('buildHoles', () => {
  it('uses real pars and yards for a course with full data (no change for complete courses)', () => {
    const h = buildHoles(full);
    expect(h).toHaveLength(18);
    expect(h.map((x) => x.par)).toEqual(PARS);
    expect(h[0].distance).toBe(300);
    expect(h.reduce((a, x) => a + (x.par ?? 0), 0)).toBe(72);
  });

  it('marks holes without data as unknown instead of inventing a par', () => {
    const h = buildHoles([{ hole: 1, par: 4, yards_est: null }, { hole: 2, par: null, yards_est: 150 }]);
    expect(h[0]).toEqual({ number: 1, par: 4, distance: null });
    expect(h[1]).toEqual({ number: 2, par: null, distance: 150 });
    expect(h.slice(2).every((x) => x.par === null && x.distance === null)).toBe(true);
  });

  it('treats no course (practice round) as all unknown', () => {
    expect(buildHoles(undefined).every((x) => x.par === null)).toBe(true);
    expect(buildHoles(null).every((x) => x.par === null)).toBe(true);
  });

  it('ignores impossible pars', () => {
    const h = buildHoles([{ hole: 1, par: 0, yards_est: 0 }, { hole: 2, par: 12, yards_est: -5 }]);
    expect(h[0].par).toBeNull();
    expect(h[1].par).toBeNull();
    expect(h[0].distance).toBeNull();
  });
});

describe('summarize', () => {
  it('matches the old totals on a full-data course', () => {
    const holes = buildHoles(full).slice(0, 9);
    const s = summarize(holes, { 1: 5, 2: 3, 3: 4 });
    expect(s.totalScore).toBe(12);
    expect(s.knownPar).toBe(36);
    expect(s.scoreDiff).toBe(0); // +1, E, -1
    expect(s.fullPar).toBe(true);
    expect(s.playedKnownPar).toBe(3);
  });

  it('leaves unknown-par holes out of score-to-par but counts their strokes', () => {
    const holes = buildHoles([{ hole: 1, par: 4, yards_est: null }]).slice(0, 9);
    const s = summarize(holes, { 1: 5, 2: 7 });
    expect(s.totalScore).toBe(12);
    expect(s.holesPlayed).toBe(2);
    expect(s.scoreDiff).toBe(1);
    expect(s.playedKnownPar).toBe(1);
    expect(s.knownPar).toBe(4);
    expect(s.unknownParHoles).toBe(8);
    expect(s.fullPar).toBe(false);
  });

  it('gives no score-to-par when no par is known', () => {
    const s = summarize(buildHoles(null).slice(0, 9), { 1: 4, 2: 5 });
    expect(s.playedKnownPar).toBe(0);
    expect(s.scoreDiff).toBe(0);
    expect(s.knownPar).toBe(0);
  });
});

describe('labels', () => {
  it('parLabel', () => {
    expect(parLabel(buildHoles(full).slice(0, 9))).toBe('Par 36');
    expect(parLabel(buildHoles(full.slice(0, 8)).slice(0, 9))).toBe('Par 32 · 1 hole unknown');
    expect(parLabel(buildHoles(null).slice(0, 9))).toBe('Par unknown');
  });
  it('defaultStrokes and formatDiff', () => {
    expect(defaultStrokes({ number: 1, par: 5, distance: null })).toBe(5);
    expect(defaultStrokes({ number: 1, par: null, distance: null })).toBe(4);
    expect(formatDiff(2)).toBe('+2');
    expect(formatDiff(-1)).toBe('-1');
    expect(formatDiff(0)).toBe('E');
  });
});
