import { clamp, inflate, Point, Rect, rectsIntersect, reticleRect, Size } from "../engine/geometry";

/** Height of the top bar (close, clover count, settings), in CSS px. */
export const TOP_BAR_PX = 64;

/**
 * Screen regions a clover must never cover: the aiming box, the top bar and the
 * readout block (distance, club, warnings, buttons). The real screen lays itself
 * out to these same rectangles.
 */
export function layoutExclusions(container: Size): Rect[] {
  const landscape = container.w > container.h;
  return [
    reticleRect(container),
    { x: 0, y: 0, w: container.w, h: TOP_BAR_PX },
    landscape
      ? { x: container.w * 0.58, y: 0, w: container.w * 0.42, h: container.h }
      : { x: 0, y: container.h * 0.64, w: container.w, h: container.h * 0.36 },
  ];
}

export interface PlacementOptions {
  size?: number;
  /** Band of the screen height (fractions) a clover may sit in: beside the aiming box, mid-frame. */
  grassFrom?: number;
  grassTo?: number;
  /** Extra clear space around each exclusion rectangle, in px. */
  padding?: number;
  edge?: number;
  tries?: number;
}

/**
 * Where a clover may appear: low in the frame (on the grass), never over the
 * aiming box, the readout, the buttons or the screen edge. Returns the centre
 * point, or null when there is no clear spot (the clover is then skipped, never
 * placed over the rangefinder).
 */
export function pickCloverPosition(container: Size, exclusions: Rect[], rand: () => number, opts: PlacementOptions = {}): Point | null {
  const size = opts.size ?? 52;
  const from = opts.grassFrom ?? 0.3;
  const to = opts.grassTo ?? 0.62;
  const pad = opts.padding ?? 14;
  const edge = opts.edge ?? 20;
  const tries = opts.tries ?? 40;
  const keepOut = exclusions.map((r) => inflate(r, pad));

  for (let i = 0; i < tries; i++) {
    const cx = clamp(edge + size / 2 + rand() * (container.w - 2 * edge - size), size / 2, container.w - size / 2);
    const cy = container.h * (from + rand() * (to - from));
    const box: Rect = { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
    if (box.x < edge || box.x + box.w > container.w - edge || box.y < edge || box.y + box.h > container.h - edge) continue;
    if (keepOut.some((k) => rectsIntersect(k, box))) continue;
    return { x: cx, y: cy };
  }
  return null;
}

/** Stable pseudo-random generator from a string, so a clover resumes in the same spot after a reload. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
