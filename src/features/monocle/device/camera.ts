import { CAMERA } from "../config/constants";

export type CameraErrorCode =
  | "denied"
  | "no-camera"
  | "in-use"
  | "insecure"
  | "unsupported"
  | "no-rear-camera"
  | "unknown";

export class CameraError extends Error {
  constructor(
    public code: CameraErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CameraError";
  }
}

export const CAMERA_ERROR_COPY: Record<CameraErrorCode, { title: string; body: string }> = {
  denied: {
    title: "Camera access is off",
    body: "Allow camera access for Lucky Golf in your browser or phone settings, then try again. Nothing is recorded or uploaded.",
  },
  "no-camera": { title: "No camera found", body: "This device doesn't seem to have a camera Monocle can use." },
  "in-use": {
    title: "Camera is busy",
    body: "Another app or tab is using the camera. Close it and try again.",
  },
  insecure: {
    title: "Needs a secure connection",
    body: "The camera only works over HTTPS. Open the https:// version of Lucky Golf.",
  },
  unsupported: {
    title: "Browser not supported",
    body: "This browser can't open the camera. Try the latest Safari on iPhone or Chrome on Android.",
  },
  "no-rear-camera": {
    title: "No rear camera",
    body: "Monocle needs the rear camera. Only a front camera was found.",
  },
  unknown: { title: "Couldn't start the camera", body: "Something went wrong opening the camera. Try again." },
};

export interface CameraInfo {
  width: number;
  height: number;
  fps: number | null;
  label: string;
  facingMode: string | null;
  deviceId: string | null;
  /** Long side of the delivered frame, in pixels. */
  longSide: number;
}

export function mapCameraError(e: unknown): CameraError {
  if (e instanceof CameraError) return e;
  const name = (e as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return new CameraError("denied", CAMERA_ERROR_COPY.denied.body);
    case "NotFoundError":
    case "DevicesNotFoundError":
      return new CameraError("no-camera", CAMERA_ERROR_COPY["no-camera"].body);
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return new CameraError("in-use", CAMERA_ERROR_COPY["in-use"].body);
    case "TypeError":
      return new CameraError("unsupported", CAMERA_ERROR_COPY.unsupported.body);
    default:
      return new CameraError("unknown", CAMERA_ERROR_COPY.unknown.body);
  }
}

async function openStream(res: { width: number; height: number }): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: res.width },
        height: { ideal: res.height },
        frameRate: { ideal: 30 },
      },
    },
    { audio: false, video: { facingMode: { ideal: "environment" } } },
    { audio: false, video: true },
  ];
  let last: unknown;
  for (const c of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (e) {
      last = e;
      // Only fall back when the constraints were the problem, never on a permission refusal.
      const name = (e as { name?: string })?.name;
      if (name !== "OverconstrainedError" && name !== "ConstraintNotSatisfiedError") throw e;
    }
  }
  throw last;
}

/** Owns the camera stream and the <video> that shows it. */
export class CameraController {
  private stream: MediaStream | null = null;
  private fileUrl: string | null = null;
  info: CameraInfo | null = null;

  constructor(private video: HTMLVideoElement) {}

  get active() {
    return !!this.stream || !!this.fileUrl;
  }

  async start(res: { width: number; height: number } = CAMERA.baseline): Promise<CameraInfo> {
    if (!window.isSecureContext) throw new CameraError("insecure", CAMERA_ERROR_COPY.insecure.body);
    if (!navigator.mediaDevices?.getUserMedia) throw new CameraError("unsupported", CAMERA_ERROR_COPY.unsupported.body);
    this.stop();
    try {
      const stream = await openStream(res);
      return await this.attach(stream);
    } catch (e) {
      throw mapCameraError(e);
    }
  }

  /** Use any MediaStream (a test video, or the synthetic scene in debug mode). */
  async attach(stream: MediaStream): Promise<CameraInfo> {
    this.stream = stream;
    const v = this.video;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "true");
    v.srcObject = stream;
    await v.play().catch(() => undefined);
    await waitForVideo(v, 8000);

    const track = stream.getVideoTracks()[0];
    const s = track?.getSettings?.() ?? {};
    // Best-effort: keep focus and exposure continuous so a distant stick stays sharp.
    try {
      await track?.applyConstraints?.({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
    } catch {
      /* not supported */
    }
    this.info = {
      width: v.videoWidth,
      height: v.videoHeight,
      fps: s.frameRate ?? null,
      label: track?.label ?? "",
      facingMode: (s.facingMode as string | undefined) ?? null,
      deviceId: s.deviceId ?? null,
      longSide: Math.max(v.videoWidth, v.videoHeight),
    };
    stream.getVideoTracks().forEach((t) => t.addEventListener("ended", () => this.onEnded?.()));
    return this.info;
  }

  /** Debug only: loop a recorded clip as if it were the camera. */
  async attachFile(url: string): Promise<CameraInfo> {
    this.stop();
    const v = this.video;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.src = url;
    this.fileUrl = url;
    await v.play().catch(() => undefined);
    await waitForVideo(v, 8000);
    this.info = {
      width: v.videoWidth,
      height: v.videoHeight,
      fps: null,
      label: "file",
      facingMode: "environment",
      deviceId: null,
      longSide: Math.max(v.videoWidth, v.videoHeight),
    };
    return this.info;
  }

  onEnded?: () => void;

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    if (this.fileUrl) {
      this.video.removeAttribute("src");
      this.video.loop = false;
      this.video.load();
      URL.revokeObjectURL(this.fileUrl);
      this.fileUrl = null;
    }
  }
}

function waitForVideo(v: HTMLVideoElement, timeoutMs: number): Promise<void> {
  if (v.videoWidth > 0 && v.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new CameraError("unknown", CAMERA_ERROR_COPY.unknown.body));
    }, timeoutMs);
    const onReady = () => {
      if (v.videoWidth > 0) {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      v.removeEventListener("loadeddata", onReady);
      v.removeEventListener("playing", onReady);
    };
    v.addEventListener("loadeddata", onReady);
    v.addEventListener("playing", onReady);
  });
}
