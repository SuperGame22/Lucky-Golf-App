import { attitudeFromEuler, rotationSpeedDps } from "../engine/attitude";
import { MOTION } from "../config/constants";

export interface MotionSnapshot {
  /** Any sensor event has arrived with real values. */
  available: boolean;
  /** Smoothed rotation rate in deg/s, or null with no sensors. */
  shakeDps: number | null;
  /** Clockwise lean of world-vertical in the image, in radians (null when not trustworthy). */
  rollRad: number | null;
  /** Camera elevation above horizontal, in radians. */
  elevationRad: number | null;
  /** Heading and pitch in degrees, for the small parallax on the clover overlay. */
  yawDeg: number | null;
  pitchDeg: number | null;
}

export type MotionPermission = "granted" | "denied" | "unavailable";

type PermissionCtor = { requestPermission?: () => Promise<"granted" | "denied"> };

const screenAngle = () => (typeof screen !== "undefined" && screen.orientation ? screen.orientation.angle : 0) ?? 0;

export class MotionTracker {
  private listening = false;
  private rate: number | null = null;
  private rateAt = 0;
  private lastOrient: { a: number; b: number; g: number; t: number } | null = null;
  private derivedRate: number | null = null;
  private roll: number | null = null;
  private elevation: number | null = null;
  private yaw: number | null = null;
  private pitch: number | null = null;
  private gotEvent = false;

  /**
   * On iOS this must be called synchronously from a tap handler. Elsewhere it
   * resolves immediately.
   */
  requestPermission(): Promise<MotionPermission> {
    const Motion = (typeof window !== "undefined" ? (window as unknown as { DeviceMotionEvent?: PermissionCtor }).DeviceMotionEvent : undefined);
    const Orient = (typeof window !== "undefined" ? (window as unknown as { DeviceOrientationEvent?: PermissionCtor }).DeviceOrientationEvent : undefined);
    if (!Motion && !Orient) return Promise.resolve("unavailable");
    const ask = Motion?.requestPermission ?? Orient?.requestPermission;
    if (typeof ask !== "function") return Promise.resolve("granted");
    return ask
      .call(Motion?.requestPermission ? Motion : Orient)
      .then((r) => (r === "granted" ? "granted" : "denied"))
      .catch(() => "denied");
  }

  start() {
    if (this.listening || typeof window === "undefined") return;
    this.listening = true;
    window.addEventListener("devicemotion", this.onMotion);
    window.addEventListener("deviceorientation", this.onOrientation);
  }

  stop() {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("devicemotion", this.onMotion);
    window.removeEventListener("deviceorientation", this.onOrientation);
  }

  private onMotion = (e: DeviceMotionEvent) => {
    const r = e.rotationRate;
    const speed = r ? rotationSpeedDps(r.alpha, r.beta, r.gamma) : null;
    if (speed == null) return;
    this.gotEvent = true;
    const now = performance.now();
    // Smooth, but let a spike through quickly: a jolt ruins the frame it lands in.
    const prev = this.rate ?? speed;
    this.rate = Math.max(speed * 0.7, prev * 0.6 + speed * 0.4);
    this.rateAt = now;
  };

  private onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    this.gotEvent = true;
    const now = performance.now();
    const att = attitudeFromEuler(e.beta, e.gamma, screenAngle());
    this.roll = Math.abs(att.rollRad) <= (MOTION.maxRollDeg * Math.PI) / 180 ? att.rollRad : null;
    this.elevation = att.elevationRad;
    this.pitch = e.beta - 90;
    this.yaw = e.alpha ?? null;

    // Fallback shake estimate for devices that give orientation but no rotation rate.
    if (this.lastOrient) {
      const dt = (now - this.lastOrient.t) / 1000;
      if (dt > 0.005 && dt < 0.5) {
        const da = angleDiff(e.alpha ?? 0, this.lastOrient.a);
        const db = e.beta - this.lastOrient.b;
        const dg = e.gamma - this.lastOrient.g;
        const inst = Math.hypot(da, db, dg) / dt;
        this.derivedRate = this.derivedRate == null ? inst : this.derivedRate * 0.6 + inst * 0.4;
      }
    }
    this.lastOrient = { a: e.alpha ?? 0, b: e.beta, g: e.gamma, t: now };
  };

  snapshot(): MotionSnapshot {
    const now = performance.now();
    const fresh = this.rate != null && now - this.rateAt < 600;
    const shake = fresh ? this.rate : this.derivedRate != null && this.lastOrient && now - this.lastOrient.t < 600 ? this.derivedRate : null;
    return {
      available: this.gotEvent,
      shakeDps: shake,
      rollRad: this.roll,
      elevationRad: this.elevation,
      yawDeg: this.yaw,
      pitchDeg: this.pitch,
    };
  }
}

function angleDiff(a: number, b: number) {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}
