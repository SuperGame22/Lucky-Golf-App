import { Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RecommendationConfig } from "../config/wedges";
import { displayForReading } from "../engine/display";
import { clamp, Point, Size } from "../engine/geometry";
import type { BracketFrame, BracketHandles, BracketResult } from "../engine/types";

interface Known {
  objectHeightIn: number;
  distanceIn: number;
  label: string;
}

interface Props {
  frame: BracketFrame;
  mode: "measure" | "calibrate";
  config: RecommendationConfig;
  known?: Known;
  defaultRatio: number;
  measure: (h: BracketHandles) => Promise<BracketResult | null>;
  calibrate: (h: BracketHandles, known: Known) => Promise<{ ratio: number; heightPx: number } | null>;
  onSaveCalibration: (ratio: number) => void;
  onClose: () => void;
}

type Which = "top" | "base";
interface View {
  zoom: number;
  cx: number;
  cy: number;
}

const HIT = 36;
const MIN_ZOOM = 1;
const MAX_ZOOM = 24;

/**
 * Tap to bracket. The live view is frozen on the sharpest recent frame, so hand
 * movement no longer matters: drag the gold handle to the top of the flag and the
 * green one to the base. A loupe shows the pixels under your finger, and on
 * release each end snaps to a clear edge within a couple of pixels.
 */
export const BracketEditor = ({ frame, mode, config, known, defaultRatio, measure, calibrate, onSaveCalibration, onClose }: Props) => {
  const img = frame.image;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const [handles, setHandles] = useState<{ top: Point; base: Point }>(() => initialHandles(frame));
  const [dragging, setDragging] = useState<Which | null>(null);
  const [provisional, setProvisional] = useState<BracketResult | null>(null);
  const [done, setDone] = useState(false);
  const [calib, setCalib] = useState<{ ratio: number; heightPx: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [calibFailed, setCalibFailed] = useState(false);
  const hadSuggestion = !!frame.suggestion;

  const src = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d")!.putImageData(img, 0, 0);
    return c;
  }, [img]);

  // Track the canvas size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Start zoomed in on where the detector thought the stick was.
  useEffect(() => {
    if (view || !size.w) return;
    const { top, base } = handles;
    const len = Math.hypot(base.x - top.x, base.y - top.y);
    if (hadSuggestion) {
      setView({ zoom: clamp((0.5 * size.h) / Math.max(len, 12), MIN_ZOOM, 16), cx: (top.x + base.x) / 2, cy: (top.y + base.y) / 2 });
    } else {
      setView({ zoom: clamp(size.h / Math.min(img.height, 420), MIN_ZOOM, 8), cx: img.width / 2, cy: img.height * 0.5 });
    }
  }, [size, view, handles, hadSuggestion, img.height, img.width]);

  const toScreen = useCallback(
    (p: Point): Point => (view ? { x: (p.x - view.cx) * view.zoom + size.w / 2, y: (p.y - view.cy) * view.zoom + size.h / 2 } : { x: 0, y: 0 }),
    [view, size],
  );
  const toImage = useCallback(
    (p: Point): Point => (view ? { x: (p.x - size.w / 2) / view.zoom + view.cx, y: (p.y - size.h / 2) / view.zoom + view.cy } : { x: 0, y: 0 }),
    [view, size],
  );

  // Draw the magnified frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !view || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.imageSmoothingEnabled = view.zoom < 1.6;
    // A little contrast helps a faint, distant stick stand out (not supported everywhere; harmless if not).
    if ("filter" in ctx) (ctx as CanvasRenderingContext2D).filter = "contrast(1.3) brightness(1.05)";
    ctx.translate(size.w / 2, size.h / 2);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-view.cx, -view.cy);
    ctx.drawImage(src, 0, 0);
  }, [view, size, src]);

  // Loupe under the finger.
  useEffect(() => {
    const canvas = loupeRef.current;
    if (!canvas || !dragging) return;
    const p = handles[dragging];
    const ctx = canvas.getContext("2d")!;
    const span = 18;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, p.x - span / 2, p.y - span / 2, span, span, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }, [dragging, handles, src]);

  // Live estimate while adjusting.
  const measureTimer = useRef<ReturnType<typeof setTimeout>>();
  const requestMeasure = useCallback(
    (h: { top: Point; base: Point }, snap: boolean) => {
      clearTimeout(measureTimer.current);
      measureTimer.current = setTimeout(
        async () => {
          if (h.base.y - h.top.y < 4) return setProvisional(null);
          const r = await measure({ xTop: h.top.x, yTop: h.top.y, xBase: h.base.x, yBase: h.base.y });
          setProvisional(r);
          if (snap && r?.snapped) setHandles({ top: { x: r.handles.xTop, y: r.handles.yTop }, base: { x: r.handles.xBase, y: r.handles.yBase } });
        },
        snap ? 0 : 160,
      );
    },
    [measure],
  );
  useEffect(() => () => clearTimeout(measureTimer.current), []);
  useEffect(() => {
    if (hadSuggestion) requestMeasure(handles, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- gestures -------------------------------------------------------------
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<
    | { kind: "drag"; which: Which; offset: Point }
    | { kind: "pan"; start: Point; cx: number; cy: number }
    | { kind: "pinch"; dist: number; zoom: number }
    | null
  >(null);

  const rel = (e: React.PointerEvent): Point => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!view || done) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = rel(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
      setDragging(null);
      return;
    }
    const sTop = toScreen(handles.top);
    const sBase = toScreen(handles.base);
    const dTop = Math.hypot(p.x - sTop.x, p.y - sTop.y);
    const dBase = Math.hypot(p.x - sBase.x, p.y - sBase.y);
    if (Math.min(dTop, dBase) <= HIT) {
      const which: Which = dTop <= dBase ? "top" : "base";
      const s = which === "top" ? sTop : sBase;
      gesture.current = { kind: "drag", which, offset: { x: s.x - p.x, y: s.y - p.y } };
      setDragging(which);
    } else {
      gesture.current = { kind: "pan", start: p, cx: view.cx, cy: view.cy };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || !view || !pointers.current.has(e.pointerId)) return;
    const p = rel(e);
    pointers.current.set(e.pointerId, p);
    if (g.kind === "drag") {
      const target = toImage({ x: p.x + g.offset.x, y: p.y + g.offset.y });
      const next = { x: clamp(target.x, 0, img.width - 1), y: clamp(target.y, 0, img.height - 1) };
      const h = { ...handles, [g.which]: next };
      setHandles(h);
      requestMeasure(h, false);
    } else if (g.kind === "pan") {
      setView({ ...view, cx: g.cx - (p.x - g.start.x) / view.zoom, cy: g.cy - (p.y - g.start.y) / view.zoom });
    } else if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setView({ ...view, zoom: clamp((g.zoom * dist) / Math.max(1, g.dist), MIN_ZOOM, MAX_ZOOM) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      if (g?.kind === "drag") {
        setDragging(null);
        requestMeasure(handles, true);
      }
    } else if (pointers.current.size === 1 && g?.kind === "pinch") {
      const [p] = [...pointers.current.values()];
      gesture.current = view ? { kind: "pan", start: p, cx: view.cx, cy: view.cy } : null;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!view) return;
    setView({ ...view, zoom: clamp(view.zoom * Math.exp(-e.deltaY / 400), MIN_ZOOM, MAX_ZOOM) });
  };

  const stepZoom = (f: number) => view && setView({ ...view, zoom: clamp(view.zoom * f, MIN_ZOOM, MAX_ZOOM) });

  // ---- finishing ------------------------------------------------------------
  const asHandles = (): BracketHandles => ({ xTop: handles.top.x, yTop: handles.top.y, xBase: handles.base.x, yBase: handles.base.y });

  const finish = async () => {
    if (handles.base.y - handles.top.y < 4) return;
    setBusy(true);
    try {
      if (mode === "calibrate" && known) {
        const r = await calibrate(asHandles(), known);
        setCalib(r);
        setCalibFailed(!r);
      } else {
        const r = await measure(asHandles());
        setProvisional(r);
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  const display = provisional && mode === "measure" ? displayForReading(provisional.yards, provisional.plusMinus, config) : null;
  const sTop = view ? toScreen(handles.top) : null;
  const sBase = view ? toScreen(handles.base) : null;
  const active = dragging ? toScreen(handles[dragging]) : null;
  const loupePos = active
    ? { left: clamp(active.x - 60, 8, Math.max(8, size.w - 128)), top: active.y - 175 < 8 ? active.y + 70 : active.y - 175 }
    : null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black text-white" data-testid="monocle-bracket">
      <div className="z-10 flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <p className="flex-1 text-center text-sm font-bold leading-tight">
          {mode === "calibrate" ? `Mark the top and bottom of the ${known?.label ?? "object"}` : "Drag the gold handle to the top of the flag, green to the base"}
        </p>
        <div className="min-w-[64px] text-right text-sm font-extrabold tabular-nums text-accent" data-testid="monocle-bracket-live">
          {provisional && mode === "measure" && !done ? `≈ ${Math.round(provisional.yards)} YD` : ""}
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ imageRendering: view && view.zoom >= 1.6 ? "pixelated" : "auto" }} />

        {sTop && sBase && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <line x1={sTop.x} y1={sTop.y} x2={sBase.x} y2={sBase.y} stroke="white" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="4 5" />
          </svg>
        )}
        {([["top", sTop, "hsl(var(--lucky-gold))"], ["base", sBase, "hsl(152 76% 50%)"]] as const).map(([which, s, color]) =>
          s ? (
            <div
              key={which}
              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: s.x, top: s.y, width: 44, height: 44 }}
              data-testid={`monocle-handle-${which}`}
            >
              <span className="block h-7 w-7 rounded-full border-[3px] bg-black/20" style={{ borderColor: color }} />
              <span className="absolute h-[2px] w-3" style={{ background: color }} />
              <span className="absolute h-3 w-[2px]" style={{ background: color }} />
              <span className="absolute -top-3 text-[10px] font-extrabold tracking-widest" style={{ color }}>
                {which === "top" ? "TOP" : "BASE"}
              </span>
            </div>
          ) : null,
        )}

        {loupePos && (
          <canvas
            ref={loupeRef}
            width={120}
            height={120}
            className="pointer-events-none absolute rounded-full border-2 border-white shadow-2xl"
            style={{ left: loupePos.left, top: loupePos.top, width: 120, height: 120, imageRendering: "pixelated" }}
            data-testid="monocle-loupe"
          />
        )}
      </div>

      <div className="z-10 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        {!done ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => stepZoom(0.6)} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10" aria-label="Zoom out">
              <Minus className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => stepZoom(1.7)} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10" aria-label="Zoom in">
              <Plus className="h-6 w-6" />
            </button>
            <Button variant="gold" size="xl" className="h-14 flex-1 text-lg" onClick={finish} disabled={busy || handles.base.y - handles.top.y < 4} data-testid="monocle-bracket-done">
              {busy ? "MEASURING…" : "DONE"}
            </Button>
          </div>
        ) : mode === "calibrate" ? (
          <div className="text-center">
            {calib ? (
              <>
                <p className="text-lg font-bold">
                  Camera ratio {calib.ratio.toFixed(3)} <span className="text-white/60">(default {defaultRatio.toFixed(2)})</span>
                </p>
                <p className="mt-1 text-sm text-white/70">Saving this for this camera cuts the extra distance error from about ±7% to about ±2%.</p>
                <div className="mt-3 flex gap-3">
                  <Button variant="ghost" size="lg" className="h-14 flex-1 text-white hover:bg-white/10" onClick={() => setDone(false)}>
                    ADJUST
                  </Button>
                  <Button
                    variant="gold"
                    size="lg"
                    className="h-14 flex-1"
                    data-testid="monocle-calibration-save"
                    onClick={() => {
                      onSaveCalibration(calib.ratio);
                      onClose();
                    }}
                  >
                    SAVE
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-base font-bold text-accent">{calibFailed ? "That result doesn't look right. Check the height and distance, and try again." : ""}</p>
                <Button variant="ghost" size="lg" className="mt-3 h-14 w-full text-white hover:bg-white/10" onClick={() => setDone(false)}>
                  ADJUST
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="text-center" data-testid="monocle-bracket-result">
            {display && provisional ? (
              <>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-[84px] font-extrabold leading-none tabular-nums">{display.number}</span>
                  <span className="text-xl font-bold tracking-[0.2em]">YARDS</span>
                  {display.plusMinus && <span className="text-base font-semibold text-white/70">{display.plusMinus}</span>}
                </div>
                {display.club && (
                  <p className="mt-2 text-2xl font-extrabold">
                    <span className="text-accent">{display.club.text}</span>
                    <span className="mx-2 text-white/40">·</span>
                    {display.club.swingText}
                  </p>
                )}
                {display.banner && display.kind !== "wedge" && (
                  <p className="mt-2 inline-block rounded-xl bg-accent px-4 py-2 text-lg font-extrabold text-accent-foreground">{display.banner.text}</p>
                )}
                <p className="mt-2 text-xs text-white/50">Measured by hand on a frozen frame</p>
              </>
            ) : (
              <p className="text-base font-bold text-accent">Couldn't measure that. Move the handles and try again.</p>
            )}
            <div className="mt-3 flex gap-3">
              <Button variant="ghost" size="lg" className="h-14 flex-1 text-white hover:bg-white/10" onClick={() => setDone(false)}>
                ADJUST
              </Button>
              <Button variant="gold" size="lg" className="h-14 flex-1" onClick={onClose} data-testid="monocle-bracket-live-button">
                BACK TO LIVE
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function initialHandles(frame: BracketFrame): { top: Point; base: Point } {
  const s = frame.suggestion;
  if (s) return { top: { x: s.xTop, y: s.yTop }, base: { x: s.xBase, y: s.yBase } };
  const w = frame.image.width;
  const h = frame.image.height;
  return { top: { x: w / 2, y: h * 0.42 }, base: { x: w / 2, y: h * 0.58 } };
}
