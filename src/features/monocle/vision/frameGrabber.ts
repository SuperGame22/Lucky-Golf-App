import type { Rect } from "../engine/geometry";

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Copies a crop of the live video into pixels. The crop is optionally rotated
 * to cancel phone roll, so a plumb flagstick is vertical in the analysed pixels.
 * Rotation preserves lengths, so measured pixel heights stay valid.
 */
export class RoiGrabber {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private ctx: Ctx2D | null = null;

  private ensure(w: number, h: number) {
    if (!this.canvas) {
      this.canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true, alpha: false }) as Ctx2D;
    }
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return this.ctx as Ctx2D;
  }

  grab(source: CanvasImageSource, sourceSize: { w: number; h: number }, roi: Rect, rollRad = 0): ImageData {
    const w = Math.max(1, Math.round(roi.w));
    const h = Math.max(1, Math.round(roi.h));
    const ctx = this.ensure(w, h);

    if (Math.abs(rollRad) < 0.003) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(source, roi.x, roi.y, w, h, 0, 0, w, h);
    } else {
      // Source region large enough to fill the crop after rotating.
      const c = Math.abs(Math.cos(rollRad));
      const s = Math.abs(Math.sin(rollRad));
      const bw = Math.ceil(w * c + h * s) + 2;
      const bh = Math.ceil(w * s + h * c) + 2;
      const cx = roi.x + w / 2;
      const cy = roi.y + h / 2;
      const sx = Math.max(0, Math.floor(cx - bw / 2));
      const sy = Math.max(0, Math.floor(cy - bh / 2));
      const sw = Math.min(sourceSize.w - sx, bw);
      const sh = Math.min(sourceSize.h - sy, bh);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-rollRad);
      ctx.drawImage(source, sx, sy, sw, sh, sx - cx, sy - cy, sw, sh);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    return ctx.getImageData(0, 0, w, h);
  }
}
