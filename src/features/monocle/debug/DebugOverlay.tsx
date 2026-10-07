import { Bug, ChevronDown, Copy, Download, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { DeviceReport } from "../device/capabilities";
import type { CameraInfo } from "../device/camera";
import type { DisplayState } from "../engine/display";
import type { SessionSnapshot } from "../engine/types";
import { AccuracySample, samplesToCsv, summarizeAccuracy } from "./accuracyLog";

interface Props {
  snapshot: SessionSnapshot | null;
  display: DisplayState;
  device: DeviceReport | null;
  cam: CameraInfo | null;
  synthetic: boolean;
  syntheticDistance: number;
  onSyntheticDistance: (yd: number) => void;
  onFile: (f: File) => void;
  showCandidates: boolean;
  onToggleCandidates: (v: boolean) => void;
}

const f = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "-" : v.toFixed(d));

/**
 * Developer overlay for measuring Monocle against a laser rangefinder and for
 * watching performance. Only reachable with the debug URL parameter (see debugMode.ts).
 */
export const DebugOverlay = ({ snapshot, display, device, cam, synthetic, syntheticDistance, onSyntheticDistance, onFile, showCandidates, onToggleCandidates }: Props) => {
  const [open, setOpen] = useState(false);
  const [truth, setTruth] = useState("");
  const [log, setLog] = useState<AccuracySample[]>([]);
  const [dist, setDist] = useState(syntheticDistance);
  const fileRef = useRef<HTMLInputElement>(null);
  const d = snapshot?.debug;
  const r = snapshot?.reading;
  const summary = summarizeAccuracy(log);

  const addSample = () => {
    const t = Number(truth);
    if (!(t > 0)) return;
    setLog((l) => [
      ...l,
      {
        truthYards: t,
        shownYards: r?.yards ?? null,
        rawYards: d?.rawYards ?? null,
        heightPx: d?.heightPx ?? null,
        score: d?.score ?? null,
        confidence: r?.confidence ?? null,
        at: Date.now(),
      },
    ]);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([samplesToCsv(log)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `monocle-accuracy-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pointer-events-none absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-2 z-[60] flex max-w-[min(94vw,420px)] flex-col-reverse items-start gap-1 font-mono text-[11px] leading-snug text-white" data-testid="monocle-debug">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pointer-events-auto flex items-center gap-1 rounded-md bg-fuchsia-600 px-2 py-1 font-bold"
      >
        <Bug className="h-3.5 w-3.5" /> DEBUG {open ? <ChevronDown className="h-3 w-3" /> : null}
      </button>
      {open && (
        <div className="pointer-events-auto max-h-[58dvh] overflow-y-auto rounded-lg bg-black/90 p-2 ring-1 ring-fuchsia-500/60">
          <Row k="camera" v={cam ? `${cam.width}x${cam.height} @ ${f(d?.camFps, 0)} fps  ${cam.label || "?"} (${cam.facingMode ?? "?"})` : "-"} />
          <Row k="analysis" v={`${f(d?.analysisHz, 1)} Hz  proc ${f(d?.procMsAvg)} ms avg / ${f(d?.procMsP95)} p95  ${d?.usingWorker ? "worker" : "main thread"}`} />
          <Row k="device" v={device ? `tier ${device.tier}  bench ${f(device.benchMs)} ms  cores ${device.hardwareConcurrency}  mem ${device.deviceMemoryGb ?? "?"} GB` : "-"} />
          <Row k="support" v={device ? `webgl ${device.webgl ? "y" : "n"}  webgpu ${device.webgpu ? "y" : "n"}  motion ${device.motionEvents ? "y" : "n"}  worker ${device.worker ? "y" : "n"}` : "-"} />
          <Row k="sensors" v={`avail ${snapshot?.motionAvailable ? "y" : "n"}  roll ${f(d?.rollDeg)}°  elev ${f(d?.elevationDeg)}°  shake ${f(d?.shakeDps, 0)}°/s`} />
          <Row k="scene" v={`luma ${f(d?.meanLuma, 0)}  light ${snapshot?.lighting ?? "-"}`} />
          <Row k="measure" v={`raw ${f(d?.rawYards)} yd  h ${f(d?.heightPx)} px  score ${f(d?.score, 0)}  f-ratio ${f(d?.focalRatio, 3)}${snapshot?.calibrated ? " (cal)" : ""}`} />
          <Row k="reading" v={`${r?.status ?? "-"}  shown ${r?.yards ?? "-"}  ±${r?.plusMinus ?? "-"}  median ${f(r?.medianYards)}  n ${r?.samples ?? 0}  se ${f((r?.stdErrPct ?? NaN) * 100)}%  spread ${f((r?.spreadPct ?? NaN) * 100)}%  conf ${f(r?.confidence, 2)}`} />
          <Row k="display" v={`${display.kind}  "${display.number ?? ""}"  ${display.club ? `${display.club.text} ${display.club.swingText}` : ""}  ${display.banner?.text ?? ""}`} />
          <Row k="hint" v={`${snapshot?.hint ?? "-"}  far ${snapshot?.far ? "y" : "n"}  bracketOffered ${snapshot?.bracketOffered ? "y" : "n"}`} />
          {d?.candidates?.length ? (
            <div className="mt-1 text-white/80">
              candidates:
              {d.candidates.map((c, i) => (
                <div key={i}>
                  {i}: x{f(c.xBase, 0)} h{f(c.heightPx)} s{f(c.score, 0)} rk{f(c.rank, 0)} fl{f(c.flagEvidence, 2)}
                  {c.clipped ? " clip" : ""}
                  {c.topAmbiguous ? " amb" : ""}
                </div>
              ))}
            </div>
          ) : null}

          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={showCandidates} onChange={(e) => onToggleCandidates(e.target.checked)} /> draw crop + candidates
          </label>

          {synthetic ? (
            <div className="mt-2">
              synthetic distance {dist} yd
              <input
                type="range"
                min={10}
                max={160}
                value={dist}
                onChange={(e) => {
                  setDist(Number(e.target.value));
                  onSyntheticDistance(Number(e.target.value));
                }}
                className="block w-full"
                aria-label="Synthetic distance"
              />
            </div>
          ) : (
            <div className="mt-2">
              <button type="button" className="rounded bg-white/15 px-2 py-1" onClick={() => fileRef.current?.click()}>
                play a video file as the camera
              </button>
              <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </div>
          )}

          <div className="mt-3 border-t border-white/20 pt-2">
            <div className="font-bold text-fuchsia-300">known-distance test</div>
            <div className="mt-1 flex gap-1">
              <input
                value={truth}
                onChange={(e) => setTruth(e.target.value)}
                inputMode="decimal"
                placeholder="laser yards"
                className="w-24 rounded bg-white/15 px-2 py-1 text-white placeholder:text-white/40"
                aria-label="True distance in yards"
              />
              <button type="button" className="rounded bg-fuchsia-600 px-2 py-1 font-bold" onClick={addSample}>
                log
              </button>
              <button type="button" className="rounded bg-white/15 px-2 py-1" onClick={() => void navigator.clipboard?.writeText(JSON.stringify({ summary, log }, null, 2))} aria-label="Copy JSON">
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="rounded bg-white/15 px-2 py-1" onClick={download} aria-label="Download CSV">
                <Download className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="rounded bg-white/15 px-2 py-1" onClick={() => setLog([])} aria-label="Clear log">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1 text-white/80">
              n {summary.scored}/{summary.n}  mean {f(summary.meanErrorYards)} yd ({f(summary.meanErrorPct)}%)  rms {f(summary.rmsYards)}  max {f(summary.maxAbsYards)}  ≤5% {f(summary.within5pct * 100, 0)}%
            </div>
            {log.slice(-6).map((s, i) => (
              <div key={i} className="text-white/60">
                truth {s.truthYards}  shown {s.shownYards ?? "-"}  err {s.shownYards != null ? s.shownYards - s.truthYards : "-"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex gap-2">
    <span className="w-14 shrink-0 text-fuchsia-300">{k}</span>
    <span className="break-all">{v}</span>
  </div>
);
