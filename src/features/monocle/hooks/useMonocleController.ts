import { useCallback, useEffect, useRef, useState } from "react";
import { CAMERA } from "../config/constants";
import { logMonocleSession } from "../analytics/sessionLog";
import type { DebugConfig } from "../debug/debugMode";
import {
  assessCamera,
  assessDevice,
  blockers,
  CameraAssessment,
  DeviceReport,
  shouldUsePrecisionResolution,
} from "../device/capabilities";
import { CAMERA_ERROR_COPY, CameraController, CameraError, CameraInfo, mapCameraError } from "../device/camera";
import { MotionPermission, MotionTracker } from "../device/motion";
import { createSyntheticSource, SyntheticSource } from "../device/syntheticSource";
import { cameraKey, resolveFocalRatio } from "../engine/calibration";
import type { Size } from "../engine/geometry";
import type { Optics } from "../engine/pipeline";
import { MonocleSession } from "../engine/session";
import type { BracketFrame, BracketHandles, SessionSnapshot } from "../engine/types";
import type { MonocleSettingsApi } from "../settings/useMonocleSettings";
import { DetectorClient } from "../vision/detectorClient";

export type Phase = "idle" | "starting" | "running" | "error";

export interface UiError {
  code: string;
  title: string;
  body: string;
}

const BLOCKER_COPY: Record<string, UiError> = {
  insecure: { code: "insecure", ...CAMERA_ERROR_COPY.insecure },
  "no-camera-api": { code: "unsupported", ...CAMERA_ERROR_COPY.unsupported },
  "no-canvas": { code: "unsupported", ...CAMERA_ERROR_COPY.unsupported },
};

export interface BracketState {
  frame: BracketFrame;
  mode: "measure" | "calibrate";
}

interface Args {
  settings: MonocleSettingsApi;
  userId: string | null | undefined;
  debug: DebugConfig;
}

/** Owns the camera, sensors, detector and session for the Monocle screen. */
export function useMonocleController({ settings, userId, debug }: Args) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<UiError | null>(null);
  const [device, setDevice] = useState<DeviceReport | null>(null);
  const [camInfo, setCamInfo] = useState<CameraInfo | null>(null);
  const [camAssessment, setCamAssessment] = useState<CameraAssessment | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [container, setContainer] = useState<Size | null>(null);
  const [bracket, setBracket] = useState<BracketState | null>(null);
  const [motionPermission, setMotionPermission] = useState<MotionPermission | null>(null);
  const [cameraKeyValue, setCameraKeyValue] = useState<string | null>(null);
  const [motionTracker, setMotionTracker] = useState<MotionTracker | null>(null);

  const cameraRef = useRef<CameraController | null>(null);
  const motionRef = useRef<MotionTracker | null>(null);
  const detectorRef = useRef<DetectorClient | null>(null);
  const sessionRef = useRef<MonocleSession | null>(null);
  const syntheticRef = useRef<SyntheticSource | null>(null);
  const deviceRef = useRef<DeviceReport | null>(null);
  const camKeyRef = useRef("camera");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const userRef = useRef(userId);
  userRef.current = userId;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const startingRef = useRef(false);
  const autoResume = useRef(false);
  const downgraded = useRef(false);
  const assessmentRef = useRef<CameraAssessment | null>(null);
  assessmentRef.current = camAssessment;

  // Work out what this device can do once the page is idle, so the benchmark is not
  // competing with page load. start() falls back to assessing on demand.
  useEffect(() => {
    const run = () =>
      assessDevice().then((d) => {
        deviceRef.current = d;
        setDevice(d);
      });
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => void run(), { timeout: 2000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => void run(), 400);
    return () => clearTimeout(t);
  }, []);

  // Size of the on-screen box the video fills.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainer({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const getOptics = useCallback((): Optics => {
    const s = settingsRef.current;
    const { ratio, calibrated } = resolveFocalRatio(s.settings.calibrations, camKeyRef.current);
    return { stickHeightIn: s.settings.stickHeightIn, stickFromUser: s.stickFromUser, focalRatio: ratio, calibrated };
  }, []);

  const teardown = useCallback(() => {
    const session = sessionRef.current;
    if (session) {
      const summary = session.summary();
      session.stop();
      sessionRef.current = null;
      const uid = userRef.current;
      if (uid) {
        void logMonocleSession(uid, summary, {
          tier: deviceRef.current?.tier ?? "ok",
          calibrated: getOptics().calibrated,
          oldPhoneWarning: !!assessmentRef.current?.warn,
        });
      }
    }
    motionRef.current?.stop();
    cameraRef.current?.stop();
    syntheticRef.current?.stop();
    syntheticRef.current = null;
    detectorRef.current?.dispose();
    detectorRef.current = null;
    setSnapshot(null);
    setBracket(null);
  }, [getOptics]);

  const fail = useCallback(
    (e: unknown) => {
      teardown();
      const ce = mapCameraError(e);
      const copy = CAMERA_ERROR_COPY[ce.code];
      setError({ code: ce.code, title: copy.title, body: copy.body });
      setPhase("error");
    },
    [teardown],
  );

  const start = useCallback(async () => {
    if (startingRef.current || !videoRef.current) return;
    startingRef.current = true;
    setError(null);
    setPhase("starting");
    downgraded.current = false;

    const motion = (motionRef.current ??= new MotionTracker());
    // iOS only shows its motion prompt for a call made directly from the tap.
    const motionAsk = motion.requestPermission();

    try {
      const dev = deviceRef.current ?? (await assessDevice());
      deviceRef.current = dev;
      setDevice(dev);
      const blocked = blockers(dev);
      if (blocked.length) {
        const b = BLOCKER_COPY[blocked[0]];
        setError(b);
        setPhase("error");
        return;
      }

      setMotionPermission(await motionAsk);

      const cam = (cameraRef.current ??= new CameraController(videoRef.current));
      let info: CameraInfo;
      if (debug.enabled && debug.synthetic) {
        syntheticRef.current = createSyntheticSource({ distanceYd: debug.syntheticDistance });
        info = await cam.attach(syntheticRef.current.stream);
      } else {
        info = await cam.start(shouldUsePrecisionResolution(dev) ? CAMERA.precision : CAMERA.baseline);
      }
      if (!debug.enabled && info.facingMode === "user") {
        cam.stop();
        throw new CameraError("no-rear-camera", CAMERA_ERROR_COPY["no-rear-camera"].body);
      }

      const short = Math.min(info.width, info.height) || 1;
      const key = cameraKey({
        label: info.label,
        aspect: Math.max(info.width, info.height) / short,
        screenW: screen.width,
        screenH: screen.height,
        dpr: window.devicePixelRatio || 1,
      });
      camKeyRef.current = key;
      setCameraKeyValue(key);
      setCamInfo(info);
      setCamAssessment(assessCamera({ width: info.width, height: info.height, fps: info.fps }, dev));
      cam.onEnded = () => fail(new CameraError("in-use", CAMERA_ERROR_COPY["in-use"].body));

      motion.start();
      setMotionTracker(motion);
      const detector = (detectorRef.current ??= new DetectorClient());
      const session = new MonocleSession({
        video: videoRef.current,
        container: () => {
          const el = containerRef.current;
          return { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 };
        },
        optics: getOptics,
        maxYards: () => settingsRef.current.settings.wedgeConfig.maxYards,
        motion,
        detector,
      });
      session.onSlow = () => {
        // The device cannot keep up: fewer pixels is better than a laggy, unreliable reading.
        if (downgraded.current || debug.synthetic) return;
        downgraded.current = true;
        void cameraRef.current?.start(CAMERA.lowFallback).then((i) => {
          setCamInfo(i);
          setCamAssessment(assessCamera({ width: i.width, height: i.height, fps: i.fps }, dev));
        });
      };
      session.subscribe(setSnapshot);
      session.start();
      sessionRef.current = session;
      setPhase("running");
    } catch (e) {
      fail(e);
    } finally {
      startingRef.current = false;
    }
  }, [debug, fail, getOptics]);

  const stop = useCallback(() => {
    autoResume.current = false;
    teardown();
    setPhase("idle");
  }, [teardown]);

  // After a few seconds of live frames, judge the device by what it actually did.
  const runStartedAt = useRef(0);
  const runtimeChecked = useRef(false);
  useEffect(() => {
    if (phase === "running") {
      runStartedAt.current = performance.now();
      runtimeChecked.current = false;
    }
  }, [phase]);
  useEffect(() => {
    if (phase !== "running" || runtimeChecked.current) return;
    const d = snapshot?.debug;
    const dev = deviceRef.current;
    if (!d || !dev || !camInfo || d.procMsAvg <= 0) return;
    if (performance.now() - runStartedAt.current < 4000) return;
    runtimeChecked.current = true;
    setCamAssessment(assessCamera({ width: camInfo.width, height: camInfo.height, fps: camInfo.fps }, dev, d.procMsAvg));
  }, [phase, snapshot, camInfo]);

  // Release the camera when the tab is hidden (battery, privacy) and reopen it on return.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (phaseRef.current === "running") {
          autoResume.current = true;
          teardown();
          setPhase("idle");
        }
      } else if (autoResume.current) {
        autoResume.current = false;
        void start();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [start, teardown]);

  // Always release the camera when leaving the screen.
  useEffect(
    () => () => {
      teardown();
    },
    [teardown],
  );

  // ---- tap to bracket / calibration ---------------------------------------

  const openBracket = useCallback((mode: BracketState["mode"] = "measure") => {
    const frame = sessionRef.current?.freezeForBracket();
    if (frame) setBracket({ frame, mode });
  }, []);

  const closeBracket = useCallback(() => {
    setBracket(null);
    sessionRef.current?.resume();
  }, []);

  const measureBracket = useCallback(
    (handles: BracketHandles) => {
      const session = sessionRef.current;
      return bracket && session ? session.measureBracket(bracket.frame, handles) : Promise.resolve(null);
    },
    [bracket],
  );

  const calibrateFromBracket = useCallback(
    (handles: BracketHandles, known: { objectHeightIn: number; distanceIn: number }) => {
      const session = sessionRef.current;
      return bracket && session ? session.calibrate(bracket.frame, handles, known) : Promise.resolve(null);
    },
    [bracket],
  );

  const setSyntheticDistance = useCallback((yd: number) => syntheticRef.current?.setDistance(yd), []);

  const loadDebugFile = useCallback(
    async (file: File) => {
      const cam = cameraRef.current;
      if (!cam || !debug.enabled) return;
      try {
        if (file.type.startsWith("video/")) {
          const info = await cam.attachFile(URL.createObjectURL(file));
          setCamInfo(info);
        }
      } catch {
        /* the file could not be played */
      }
    },
    [debug.enabled],
  );

  return {
    videoRef,
    containerRef,
    container,
    phase,
    error,
    device,
    camInfo,
    camAssessment,
    snapshot,
    motionPermission,
    cameraKey: cameraKeyValue,
    motion: motionTracker,
    bracket,
    start,
    stop,
    openBracket,
    closeBracket,
    measureBracket,
    calibrateFromBracket,
    setSyntheticDistance,
    loadDebugFile,
    session: sessionRef,
  };
}
