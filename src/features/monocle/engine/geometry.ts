export interface Size {
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The part of a video (in video pixels) that is visible when the video is shown
 * with `object-fit: cover` inside a container.
 */
export function coverVisibleRect(video: Size, container: Size): Rect {
  const scale = Math.max(container.w / video.w, container.h / video.h);
  const w = container.w / scale;
  const h = container.h / scale;
  return { x: (video.w - w) / 2, y: (video.h - h) / 2, w, h };
}

export function coverScale(video: Size, container: Size): number {
  return Math.max(container.w / video.w, container.h / video.h);
}

export function screenPointToVideo(p: Point, video: Size, container: Size): Point {
  const vis = coverVisibleRect(video, container);
  return { x: vis.x + (p.x / container.w) * vis.w, y: vis.y + (p.y / container.h) * vis.h };
}

export function videoPointToScreen(p: Point, video: Size, container: Size): Point {
  const vis = coverVisibleRect(video, container);
  return { x: ((p.x - vis.x) / vis.w) * container.w, y: ((p.y - vis.y) / vis.h) * container.h };
}

export function screenRectToVideo(r: Rect, video: Size, container: Size): Rect {
  const a = screenPointToVideo({ x: r.x, y: r.y }, video, container);
  const b = screenPointToVideo({ x: r.x + r.w, y: r.y + r.h }, video, container);
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

/**
 * The "put the flag in here" box, in screen (CSS) pixels. Tall and narrow
 * because the stick is. Portrait puts it in the upper-middle so the readout
 * has room underneath; landscape shifts it left to leave room on the right.
 */
export function reticleRect(container: Size): Rect {
  const landscape = container.w > container.h;
  const h = container.h * (landscape ? 0.62 : 0.46);
  const w = Math.max(56, h * 0.3);
  const cx = container.w * (landscape ? 0.4 : 0.5);
  const cy = container.h * (landscape ? 0.46 : 0.4);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * Region of the video we actually analyse: the reticle plus slack so a stick
 * that is slightly off-centre or tilted is still seen. Integer video pixels.
 */
export function analysisRoi(video: Size, container: Size, reticle = reticleRect(container)): Rect {
  const slackX = reticle.w * 0.35;
  const slackY = reticle.h * 0.06;
  const screen: Rect = {
    x: reticle.x - slackX,
    y: reticle.y - slackY,
    w: reticle.w + slackX * 2,
    h: reticle.h + slackY * 2,
  };
  const v = screenRectToVideo(screen, video, container);
  const x0 = Math.max(0, Math.floor(v.x));
  const y0 = Math.max(0, Math.floor(v.y));
  const x1 = Math.min(video.w, Math.ceil(v.x + v.w));
  const y1 = Math.min(video.h, Math.ceil(v.y + v.h));
  return { x: x0, y: y0, w: Math.max(8, x1 - x0), h: Math.max(8, y1 - y0) };
}

export function rectContains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function inflate(r: Rect, dx: number, dy = dx): Rect {
  return { x: r.x - dx, y: r.y - dy, w: r.w + dx * 2, h: r.h + dy * 2 };
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Convert a point in the analysed crop back to video pixels. The crop was
 * rotated by -roll about its centre to straighten the stick, so undo that.
 */
export function cropPointToVideo(p: Point, roi: Rect, rollRad = 0): Point {
  const dx = p.x - roi.w / 2;
  const dy = p.y - roi.h / 2;
  const c = Math.cos(rollRad);
  const s = Math.sin(rollRad);
  return { x: roi.x + roi.w / 2 + dx * c - dy * s, y: roi.y + roi.h / 2 + dx * s + dy * c };
}
