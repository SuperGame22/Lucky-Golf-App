import { STICK } from "../config/constants";

export interface SyntheticOptions {
  distanceYd: number;
  stickHeightIn?: number;
  focalRatio?: number;
  width?: number;
  height?: number;
  /** Hand-shake amplitude in pixels. */
  shakePx?: number;
  flag?: boolean;
}

export interface SyntheticSource {
  stream: MediaStream;
  setDistance(yd: number): void;
  stop(): void;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Paint the static part of the scene once: sky, tree line, striped fairway, putting green. */
function paintBackground(W: number, H: number, baseY: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const rand = mulberry(7);
  const horizon = H * 0.4;

  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#7fb4e6");
  sky.addColorStop(1, "#cfe4f2");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, horizon);

  // Distant trees: dark blobs along the horizon.
  g.fillStyle = "#1f3b24";
  for (let x = -40; x < W + 40; x += 38) {
    const r = 46 + rand() * 60;
    g.beginPath();
    g.ellipse(x + rand() * 30, horizon - r * 0.35, r * 0.8, r, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#2c5232";
  g.fillRect(0, horizon - 6, W, 30);

  // Fairway with mow stripes.
  const turf = g.createLinearGradient(0, horizon, 0, H);
  turf.addColorStop(0, "#5b9a4b");
  turf.addColorStop(1, "#2f6a2c");
  g.fillStyle = turf;
  g.fillRect(0, horizon + 18, W, H - horizon);
  for (let i = -6; i < 14; i++) {
    g.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    g.beginPath();
    g.moveTo(W / 2 + (i - 1) * 150 * 0.2, horizon + 18);
    g.lineTo(W / 2 + (i + 0) * 150 * 0.2, horizon + 18);
    g.lineTo(W / 2 + i * 260 + 130, H);
    g.lineTo(W / 2 + i * 260 - 130, H);
    g.fill();
  }

  // Putting green around the pin.
  const green = g.createRadialGradient(W / 2, baseY, 6, W / 2, baseY, 360);
  green.addColorStop(0, "#7cc467");
  green.addColorStop(1, "rgba(124,196,103,0)");
  g.fillStyle = green;
  g.beginPath();
  g.ellipse(W / 2, baseY + 10, 380, 120, 0, 0, Math.PI * 2);
  g.fill();

  // Blade texture.
  for (let i = 0; i < 9000; i++) {
    const y = horizon + 30 + rand() * (H - horizon - 30);
    const x = rand() * W;
    const len = 2 + ((y - horizon) / H) * 10;
    g.fillStyle = rand() > 0.5 ? "rgba(20,70,25,0.25)" : "rgba(170,225,140,0.18)";
    g.fillRect(x, y, 1, len);
  }
  return c;
}

/**
 * A fake rear camera: a golf scene with a real-sized flagstick at a chosen
 * distance and a little hand shake, delivered as a MediaStream so the app
 * treats it exactly like the real camera. Debug use only.
 */
export function createSyntheticSource(opts: SyntheticOptions): SyntheticSource {
  const W = opts.width ?? 1080;
  const H = opts.height ?? 1920;
  const focalPx = Math.max(W, H) * (opts.focalRatio ?? 0.75);
  const stickIn = opts.stickHeightIn ?? STICK.defaultHeightIn;
  let distance = opts.distanceYd;
  const baseY0 = H * 0.5;
  const bg = paintBackground(W, H, baseY0);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const shake = opts.shakePx ?? 1.5;
  let raf = 0;
  let live = true;

  const draw = (ms: number) => {
    if (!live) return;
    const t = ms / 1000;
    const jx = shake * (Math.sin(t * 8.1) * 0.6 + Math.sin(t * 19.3 + 1) * 0.4);
    const jy = shake * (Math.sin(t * 6.7 + 2) * 0.6 + Math.sin(t * 17.9) * 0.4);
    ctx.drawImage(bg, 0, 0);

    const pxPerIn = focalPx / (distance * 36);
    const h = stickIn * pxPerIn;
    const w = STICK.diameterIn * pxPerIn;
    const x = W / 2 + jx;
    const base = baseY0 + jy;
    // Fractional widths get anti-aliased by the canvas, so a distant stick is a faint sub-pixel line.
    ctx.fillStyle = "#f6f6f2";
    ctx.fillRect(x - w / 2, base - h, w, h);
    if (opts.flag !== false) {
      ctx.fillStyle = "#e0312a";
      ctx.fillRect(x + w / 2, base - h, 14 * pxPerIn, 10 * pxPerIn);
    }
    // The cup: a 4.25 in wide, ~1 in deep dark spot centred on the base, at true scale.
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, base, 2.1 * pxPerIn, 0.5 * pxPerIn, 0, 0, Math.PI * 2);
    ctx.fill();
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  const stream = canvas.captureStream(30);
  return {
    stream,
    setDistance(yd: number) {
      distance = Math.max(3, yd);
    },
    stop() {
      live = false;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((tr) => tr.stop());
    },
  };
}
