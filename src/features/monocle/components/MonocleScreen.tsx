import { Crosshair, Settings, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloverIcon } from "@/components/icons/CloverIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useClovers } from "@/contexts/CloverContext";
import { cn } from "@/lib/utils";
import { useCloverSpawns } from "../clovers/useCloverSpawns";
import { readDebugConfig } from "../debug/debugMode";
import { DebugOverlay } from "../debug/DebugOverlay";
import { deriveDisplay } from "../engine/display";
import { reticleRect, Size } from "../engine/geometry";
import { resolveFocalRatio } from "../engine/calibration";
import { useMonocleController } from "../hooks/useMonocleController";
import { useWakeLock } from "../hooks/useWakeLock";
import { useAuthUserId, useMonocleSettings } from "../settings/useMonocleSettings";
import { BracketEditor } from "./BracketEditor";
import { CloverLayer } from "./CloverLayer";
import { LockMarkers } from "./LockMarkers";
import { OldPhoneNotice } from "./OldPhoneNotice";
import { Readout } from "./Readout";
import { Reticle, ReticleTone } from "./Reticle";
import { CalibrationRequest, SettingsSheet } from "./SettingsSheet";
import { ErrorScreen, StartScreen } from "./Screens";

const ZERO: Size = { w: 0, h: 0 };

/** The full-screen Monocle experience. Everything here runs on the device. */
export const MonocleScreen = () => {
  const navigate = useNavigate();
  const debug = useMemo(() => readDebugConfig(), []);
  const userId = useAuthUserId();
  const settings = useMonocleSettings(userId);
  const { cloverBalance, refreshBalance } = useClovers();
  const { refreshProfile } = useAuth();
  const c = useMonocleController({ settings, userId, debug });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationRequest | null>(null);
  const [showCandidates, setShowCandidates] = useState(true);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && navigator.onLine === false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Full-screen: no page scroll or rubber-banding behind the camera.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const running = c.phase === "running";
  useWakeLock(running);

  // Say once, briefly, that motion sensors are off; don't leave a pill over the viewfinder.
  const [motionNote, setMotionNote] = useState(false);
  useEffect(() => {
    if (!running || c.motionPermission !== "denied") return;
    setMotionNote(true);
    const t = setTimeout(() => setMotionNote(false), 6000);
    return () => clearTimeout(t);
  }, [running, c.motionPermission]);

  const container = c.container ?? ZERO;
  const landscape = container.w > container.h;
  const reticle = useMemo(() => reticleRect(container), [container]);
  const snap = c.snapshot;
  const display = useMemo(
    () => deriveDisplay(snap ?? EMPTY_SNAPSHOT, settings.settings.wedgeConfig),
    [snap, settings.settings.wedgeConfig],
  );

  const cloverEnabled = running && !snap?.paused && !c.bracket && !calibration;
  const clovers = useCloverSpawns({
    enabled: cloverEnabled,
    userId,
    container: c.container,
    // The app keeps the balance in the signed-in profile, so refresh both.
    onCollected: () => void Promise.all([refreshBalance(), refreshProfile()]),
  });

  const tone: ReticleTone =
    display.kind === "far" ? "far" : display.kind === "wedge" || display.kind === "short-game" || display.kind === "close" ? "locked" : display.kind === "locking" ? "locking" : "idle";

  const back = useCallback(() => {
    c.stop();
    if (window.history.length > 1) navigate(-1);
    else navigate("/rangefinder");
  }, [c, navigate]);

  const { ratio: focalRatio, calibrated } = resolveFocalRatio(settings.settings.calibrations, c.cameraKey ?? "");
  const cam = c.camInfo;
  const video = useMemo(() => ({ w: cam?.width ?? 0, h: cam?.height ?? 0 }), [cam]);
  const showOldPhone = !!c.camAssessment?.warn && !noticeDismissed && running;
  const chipTarget = { x: container.w - 78, y: 36 };
  const bracketMode = c.bracket?.mode ?? "measure";

  return (
    <div
      ref={c.containerRef}
      className="fixed inset-0 h-[100dvh] w-screen touch-none select-none overflow-hidden overscroll-none bg-black text-white"
      data-testid="monocle-screen"
    >
      <video ref={c.videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay aria-hidden />

      {running && container.w > 0 && (
        <>
          {/* Soft scrim keeps the top bar readable on bright grass or sky. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/60 to-transparent" />
          <Reticle rect={reticle} tone={tone} />
          {snap?.detection && video.w > 0 && (
            <LockMarkers detection={snap.detection} video={video} container={container} locked={snap.reading.status === "locked"} />
          )}
          {debug.enabled && showCandidates && snap?.debug.roi && video.w > 0 && <DebugCrop snapshot={snap} video={video} container={container} />}
          <Readout display={display} landscape={landscape} onBracket={() => c.openBracket("measure")} />
          <CloverLayer
            clover={clovers.clover}
            collecting={clovers.collecting}
            toast={clovers.toast}
            onCollect={clovers.collect}
            motion={c.motion}
            target={chipTarget}
          />
        </>
      )}

      {/* Top bar */}
      {running && (
        <div className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-3 pt-[env(safe-area-inset-top)]">
          <button type="button" onClick={back} className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 backdrop-blur" aria-label="Close Monocle" data-testid="monocle-close">
            <X className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => c.openBracket("measure")}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 backdrop-blur disabled:opacity-40"
              aria-label="Tap to bracket"
              disabled={!snap || snap.paused}
            >
              <Crosshair className="h-5 w-5" />
            </button>
            <div className="flex h-12 items-center gap-1.5 rounded-full bg-black/55 px-3 backdrop-blur" data-testid="monocle-clover-count" aria-label={`${cloverBalance} clovers`}>
              <CloverIcon className="h-6 w-auto" />
              <span className="text-base font-extrabold tabular-nums">{userId ? cloverBalance : "–"}</span>
            </div>
            <button type="button" onClick={() => setSettingsOpen(true)} className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 backdrop-blur" aria-label="Monocle settings" data-testid="monocle-settings-button">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {showOldPhone && c.camAssessment && (
        <OldPhoneNotice reasons={c.camAssessment.reasons} showReasons={debug.enabled} onDismiss={() => setNoticeDismissed(true)} />
      )}

      {running && motionNote && (
        <p className="absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+64px)] z-20 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1.5 text-xs text-white/90" role="status">
          Motion sensors are off. Hold the phone steady and upright.
        </p>
      )}

      {/* Calibration guidance */}
      {calibration && running && !c.bracket && (
        <div className="absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+68px)] z-30 rounded-2xl bg-black/85 p-3 text-center ring-1 ring-accent/60" data-testid="monocle-calibration-banner">
          <p className="text-sm font-bold">
            Stand {calibration.distanceFt} ft from the {calibration.label.toLowerCase()}. Put one vertical edge in the box with the top and bottom both in view.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setCalibration(null)} className="h-12 flex-1 rounded-xl bg-white/10 font-bold">
              CANCEL
            </button>
            <button type="button" onClick={() => c.openBracket("calibrate")} className="h-12 flex-1 rounded-xl bg-accent font-extrabold text-accent-foreground" data-testid="monocle-capture">
              CAPTURE
            </button>
          </div>
        </div>
      )}

      {(c.phase === "idle" || c.phase === "starting") && (
        <StartScreen
          device={c.device}
          starting={c.phase === "starting"}
          signedIn={userId === undefined ? undefined : !!userId}
          offline={offline}
          onStart={() => void c.start()}
          onBack={() => navigate(-1)}
        />
      )}
      {c.phase === "error" && c.error && <ErrorScreen error={c.error} onRetry={() => void c.start()} onBack={() => navigate(-1)} />}

      {c.bracket && (
        <BracketEditor
          key={c.bracket.frame.image.data.byteLength + c.bracket.mode}
          frame={c.bracket.frame}
          mode={bracketMode}
          config={settings.settings.wedgeConfig}
          known={calibration ? { objectHeightIn: calibration.objectHeightIn, distanceIn: calibration.distanceIn, label: calibration.label.toLowerCase() } : undefined}
          defaultRatio={focalRatio}
          measure={c.measureBracket}
          calibrate={c.calibrateFromBracket}
          onSaveCalibration={(ratio) => {
            if (c.cameraKey) settings.setCalibration(c.cameraKey, ratio);
            setCalibration(null);
          }}
          onClose={c.closeBracket}
        />
      )}

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        api={settings}
        cameraKey={c.cameraKey}
        calibrated={calibrated}
        calibrationRatio={focalRatio}
        device={c.device}
        signedIn={userId === undefined ? undefined : !!userId}
        canCalibrate={running}
        onStartCalibration={setCalibration}
      />

      {debug.enabled && (
        <DebugOverlay
          snapshot={snap}
          display={display}
          device={c.device}
          cam={cam}
          synthetic={debug.synthetic}
          syntheticDistance={debug.syntheticDistance}
          onSyntheticDistance={c.setSyntheticDistance}
          onFile={c.loadDebugFile}
          showCandidates={showCandidates}
          onToggleCandidates={setShowCandidates}
        />
      )}
    </div>
  );
};

/** Debug: the analysed crop and every candidate the detector found. */
const DebugCrop = ({ snapshot, video, container }: { snapshot: NonNullable<ReturnType<typeof useMonocleController>["snapshot"]>; video: Size; container: Size }) => {
  const roi = snapshot.debug.roi!;
  const scale = Math.max(container.w / video.w, container.h / video.h);
  const visW = container.w / scale;
  const visH = container.h / scale;
  const ox = (video.w - visW) / 2;
  const oy = (video.h - visH) / 2;
  const sx = (x: number) => (x - ox) * scale;
  const sy = (y: number) => (y - oy) * scale;
  return (
    <svg className={cn("pointer-events-none absolute inset-0 z-10 h-full w-full")} aria-hidden data-testid="monocle-debug-crop">
      <rect x={sx(roi.x)} y={sy(roi.y)} width={roi.w * scale} height={roi.h * scale} fill="none" stroke="#e879f9" strokeWidth={1.5} strokeDasharray="6 4" />
    </svg>
  );
};

const EMPTY_SNAPSHOT = {
  running: false,
  paused: false,
  reading: { status: "searching", yards: null, plusMinus: null, confidence: 0, samples: 0, medianYards: null, stdErrPct: null, spreadPct: null },
  far: false,
  detection: null,
  hint: "point-at-flag",
  lighting: "ok",
  shaking: false,
  motionAvailable: false,
  bracketOffered: false,
  calibrated: false,
  debug: {} as never,
} as const;
