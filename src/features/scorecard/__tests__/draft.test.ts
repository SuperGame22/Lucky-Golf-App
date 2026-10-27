import { describe, expect, it } from "vitest";
import { DRAFT_KEY, clearDraft, readDraft, summarize, writeDraft } from "../draft";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe("scorecard draft", () => {
  it("round-trips a draft for the same course", () => {
    const s = mem();
    writeDraft(s, { courseId: 7, roundLength: 9, scores: { 1: 4, 2: 5 }, putts: { 1: 2 }, activeHole: 3 }, 1000);
    expect(readDraft(s, 7, 2000)).toMatchObject({ roundLength: 9, scores: { 1: 4, 2: 5 }, putts: { 1: 2 }, activeHole: 3 });
  });

  it("ignores another course, stale drafts, junk and empty rounds", () => {
    const s = mem();
    writeDraft(s, { courseId: 7, roundLength: 9, scores: { 1: 4 }, putts: {}, activeHole: 1 }, 0);
    expect(readDraft(s, 8, 1)).toBeNull();
    expect(readDraft(s, null, 1)).toBeNull();
    expect(readDraft(s, 7, 19 * 3600 * 1000)).toBeNull();
    s.setItem(DRAFT_KEY, "{not json");
    expect(readDraft(s, 7, 1)).toBeNull();
    s.setItem(DRAFT_KEY, JSON.stringify({ courseId: 7, roundLength: 9, scores: { 1: 99, 20: 4 }, putts: {}, activeHole: 1, savedAt: 1 }));
    expect(readDraft(s, 7, 2)).toBeNull();
    clearDraft(s);
    writeDraft(s, { courseId: 7, roundLength: 9, scores: {}, putts: {}, activeHole: 1 });
    expect(s.m.has(DRAFT_KEY)).toBe(false); // nothing to keep, and nothing written
  });

  it("clears", () => {
    const s = mem();
    writeDraft(s, { courseId: null, roundLength: 18, scores: { 1: 4 }, putts: {}, activeHole: 1 });
    clearDraft(s);
    expect(readDraft(s, null)).toBeNull();
  });

  it("summarizes only the holes played, against their own par", () => {
    const holes = [{ number: 1, par: 4 }, { number: 2, par: 3 }, { number: 3, par: 5 }];
    const r = summarize(holes, { 1: 5, 3: 5 }, { 1: 2, 3: 1 });
    expect(r).toMatchObject({ played: 2, scores: [5, 5], putts: [2, 1], total: 10, par: 9, diff: 1, puttsTotal: 3 });
  });
});

describe("writeDraft never erases a round in progress", () => {
  it("keeps the stored round when told to write an empty card", () => {
    const s = mem();
    writeDraft(s, { courseId: 7, roundLength: 18, scores: { 1: 4 }, putts: {}, activeHole: 2 });
    writeDraft(s, { courseId: null, roundLength: 9, scores: {}, putts: {}, activeHole: 1 });
    expect(readDraft(s, 7)?.scores).toEqual({ 1: 4 });
  });
  it("numbers holes by position for unfinished rounds", () => {
    const holes = [1, 2, 3, 4].map((n) => ({ number: n, par: 4 }));
    const r = summarize(holes, { 1: 4, 2: 5, 4: 3 }, { 1: 2, 2: 2, 4: 1 });
    expect(r.scoresByHole).toEqual([4, 5, null, 3]);
    expect(r.puttsByHole).toEqual([2, 2, null, 1]);
  });
});
