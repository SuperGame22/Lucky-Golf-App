import { CAMERA } from "../config/constants";
import { StickDetector } from "../vision/detector";

export type DeviceTier = "high" | "ok" | "low";

export interface DeviceReport {
  secureContext: boolean;
  getUserMedia: boolean;
  worker: boolean;
  webgl: boolean;
  webgpu: boolean;
  motionEvents: boolean;
  orientationEvents: boolean;
  /** iOS asks for motion access from a user gesture. */
  motionNeedsPermission: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  hardwareConcurrency: number;
  deviceMemoryGb: number | null;
  /** Few cores or little memory: a static sign of an older phone. */
  lowEnd: boolean;
  /** Median detector time on a reference crop, in ms. Null until benchmarked. */
  benchMs: number | null;
  tier: DeviceTier;
}

/** Why Monocle cannot run at all. Everything else is advisory. */
export type Blocker = "insecure" | "no-camera-api" | "no-canvas";

export function sniffCapabilities(): DeviceReport {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  const win = typeof window !== "undefined" ? window : ({} as Window & typeof globalThis);
  const ua = nav.userAgent ?? "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);

  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }

  const motionCtor = (win as unknown as { DeviceMotionEvent?: { requestPermission?: unknown } }).DeviceMotionEvent;
  const cores = nav.hardwareConcurrency ?? 2;
  const memory = (nav as unknown as { deviceMemory?: number }).deviceMemory ?? null;
  return {
    secureContext: !!win.isSecureContext,
    getUserMedia: !!nav.mediaDevices?.getUserMedia,
    worker: typeof Worker !== "undefined",
    webgl,
    webgpu: "gpu" in nav,
    motionEvents: "DeviceMotionEvent" in win,
    orientationEvents: "DeviceOrientationEvent" in win,
    motionNeedsPermission: typeof motionCtor?.requestPermission === "function",
    isIOS,
    isStandalone:
      (win.matchMedia?.("(display-mode: standalone)").matches ?? false) ||
      (nav as unknown as { standalone?: boolean }).standalone === true,
    hardwareConcurrency: cores,
    deviceMemoryGb: memory,
    lowEnd: cores < 4 || (memory != null && memory <= 2),
    benchMs: null,
    tier: "ok",
  };
}

export function blockers(r: DeviceReport): Blocker[] {
  const out: Blocker[] = [];
  if (!r.secureContext) out.push("insecure");
  if (!r.getUserMedia) out.push("no-camera-api");
  if (typeof document === "undefined" || !document.createElement("canvas").getContext) out.push("no-canvas");
  return out;
}

/** Cheap pseudo-random crop so the benchmark has no dependency on test fixtures. */
function referenceCrop(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  let s = 12345;
  for (let i = 0; i < w * h; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const v = 90 + ((s >>> 24) % 30);
    data[i * 4] = v * 0.6;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v * 0.4;
    data[i * 4 + 3] = 255;
  }
  return data;
}

/**
 * Best-case detector time (ms) on a typical 1080p-portrait crop. Takes the fastest
 * of several runs after warm-up, because a busy moment (page load, a background
 * tab) inflates individual runs. The live per-frame time is measured separately.
 */
export function benchmarkDetector(runs = 5): number {
  const w = 240;
  const h = 1180;
  const data = referenceCrop(w, h);
  const det = new StickDetector();
  for (let i = 0; i < 2; i++) det.detect({ data, width: w, height: h }); // warm up the JIT, allocate buffers
  let best = Infinity;
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    det.detect({ data, width: w, height: h });
    best = Math.min(best, performance.now() - t);
  }
  return best;
}

export function classifyTier(r: Pick<DeviceReport, "lowEnd">, benchMs: number): DeviceTier {
  if (benchMs >= 60 || r.lowEnd) return "low";
  if (benchMs < 18) return "high";
  return "ok";
}

export async function assessDevice(): Promise<DeviceReport> {
  const report = sniffCapabilities();
  try {
    report.benchMs = benchmarkDetector();
    report.tier = classifyTier(report, report.benchMs);
    if (report.hardwareConcurrency < 6 && report.tier === "high") report.tier = "ok";
  } catch {
    report.tier = "ok";
  }
  return report;
}

export interface CameraAssessment {
  /** Show the "your camera may not be accurate enough" notice. */
  warn: boolean;
  reasons: string[];
}

export const OLD_PHONE_NOTICE =
  "Your camera may not be accurate enough for reliable distance measurements. For best results, use a newer smartphone.";

export function assessCamera(
  cam: { width: number; height: number; fps: number | null },
  device: Pick<DeviceReport, "lowEnd">,
  /** Average detector time per frame while running, once known. */
  runtimeProcMs?: number | null,
): CameraAssessment {
  const reasons: string[] = [];
  const longSide = Math.max(cam.width, cam.height);
  if (longSide < 1280) reasons.push(`camera resolution is only ${cam.width}x${cam.height}`);
  if (cam.fps != null && cam.fps < CAMERA.minHealthyFps) reasons.push(`camera runs at ${Math.round(cam.fps)} fps`);
  if (device.lowEnd) reasons.push("this device has limited processing power");
  if (runtimeProcMs != null && runtimeProcMs > SLOW_FRAME_MS) reasons.push(`each frame takes ${Math.round(runtimeProcMs)} ms to process`);
  return { warn: reasons.length > 0, reasons };
}

/** Average per-frame processing time above which accuracy and responsiveness suffer. */
export const SLOW_FRAME_MS = 60;

export function shouldUsePrecisionResolution(device: DeviceReport): boolean {
  return device.tier === "high";
}
