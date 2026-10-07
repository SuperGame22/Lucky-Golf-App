import { describe, expect, it } from "vitest";
import {
  analysisRoi,
  coverVisibleRect,
  cropPointToVideo,
  reticleRect,
  screenPointToVideo,
  screenRectToVideo,
  videoPointToScreen,
} from "../engine/geometry";

describe("object-fit: cover mapping", () => {
  const video = { w: 1080, h: 1920 };
  const screen = { w: 390, h: 844 };

  it("crops the sides when the screen is narrower than the video", () => {
    const vis = coverVisibleRect(video, screen);
    expect(vis.h).toBeCloseTo(1920, 5);
    expect(vis.w).toBeCloseTo(390 / (844 / 1920), 3);
    expect(vis.x).toBeCloseTo((1080 - vis.w) / 2, 5);
    expect(vis.y).toBeCloseTo(0, 5);
  });

  it("round-trips points between screen and video", () => {
    const p = { x: 120, y: 333 };
    const back = videoPointToScreen(screenPointToVideo(p, video, screen), video, screen);
    expect(back.x).toBeCloseTo(p.x, 6);
    expect(back.y).toBeCloseTo(p.y, 6);
  });

  it("maps the screen centre to the video centre", () => {
    const c = screenPointToVideo({ x: 195, y: 422 }, video, screen);
    expect(c.x).toBeCloseTo(540, 5);
    expect(c.y).toBeCloseTo(960, 5);
  });

  it("crops top and bottom when the screen is wider (landscape)", () => {
    const vis = coverVisibleRect({ w: 1920, h: 1080 }, { w: 400, h: 400 });
    expect(vis.w).toBeCloseTo(1080, 5);
    expect(vis.h).toBeCloseTo(1080, 5);
    expect(vis.x).toBeCloseTo(420, 5);
  });

  it("scales rect sizes consistently", () => {
    const r = screenRectToVideo({ x: 0, y: 0, w: 390, h: 844 }, video, screen);
    expect(r.h).toBeCloseTo(1920, 4);
  });
});

describe("reticle and analysis region", () => {
  it("is tall and narrow, centred horizontally in portrait", () => {
    const r = reticleRect({ w: 390, h: 844 });
    expect(r.h).toBeGreaterThan(r.w * 2.5);
    expect(r.x + r.w / 2).toBeCloseTo(195, 5);
    expect(r.y).toBeGreaterThan(0);
    expect(r.y + r.h).toBeLessThan(844 * 0.7);
  });

  it("leaves room for the readout on the right in landscape", () => {
    const r = reticleRect({ w: 844, h: 390 });
    expect(r.x + r.w / 2).toBeLessThan(844 / 2);
  });

  it("produces an integer region inside the video that contains the reticle", () => {
    const video = { w: 1920, h: 1080 };
    const screen = { w: 390, h: 844 };
    // 16:9 landscape video shown on a portrait screen is cropped hard; the ROI must stay in-frame.
    const roi = analysisRoi(video, screen);
    expect(Number.isInteger(roi.x) && Number.isInteger(roi.y) && Number.isInteger(roi.w) && Number.isInteger(roi.h)).toBe(true);
    expect(roi.x).toBeGreaterThanOrEqual(0);
    expect(roi.y).toBeGreaterThanOrEqual(0);
    expect(roi.x + roi.w).toBeLessThanOrEqual(video.w);
    expect(roi.y + roi.h).toBeLessThanOrEqual(video.h);
    const ret = screenRectToVideo(reticleRect(screen), video, screen);
    expect(roi.x).toBeLessThanOrEqual(ret.x);
    expect(roi.x + roi.w).toBeGreaterThanOrEqual(ret.x + ret.w - 1);
  });
});

describe("crop to video mapping with roll compensation", () => {
  it("is the identity with no roll, offset by the crop origin", () => {
    const p = cropPointToVideo({ x: 10, y: 20 }, { x: 100, y: 200, w: 50, h: 80 }, 0);
    expect(p).toEqual({ x: 110, y: 220 });
  });

  it("undoes the rotation the grabber applies (draw rotated by -roll about the crop centre)", () => {
    const roi = { x: 300, y: 500, w: 240, h: 1180 };
    const roll = (7 * Math.PI) / 180;
    // A video point -> where the grabber puts it in the crop (rotate by -roll about the centre).
    const v = { x: 412, y: 900 };
    const dx = v.x - (roi.x + roi.w / 2);
    const dy = v.y - (roi.y + roi.h / 2);
    const c = Math.cos(-roll);
    const s = Math.sin(-roll);
    const crop = { x: roi.w / 2 + dx * c - dy * s, y: roi.h / 2 + dx * s + dy * c };
    const back = cropPointToVideo(crop, roi, roll);
    expect(back.x).toBeCloseTo(v.x, 6);
    expect(back.y).toBeCloseTo(v.y, 6);
  });
});
