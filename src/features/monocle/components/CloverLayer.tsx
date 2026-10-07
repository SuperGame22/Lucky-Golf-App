import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CloverIcon } from "@/components/icons/CloverIcon";
import { cn } from "@/lib/utils";
import type { ActiveClover, CloverToast } from "../clovers/useCloverSpawns";
import type { MotionTracker } from "../device/motion";

interface Props {
  clover: ActiveClover | null;
  collecting: boolean;
  toast: CloverToast | null;
  onCollect: () => void;
  motion: MotionTracker | null;
  /** Where the counter chip is, so the collected clover can fly to it. */
  target: { x: number; y: number };
}

/**
 * The Lucky Clover: a small flat overlay that sways in the grass beside the
 * aiming box. It drifts slightly with the phone's motion so it feels placed in
 * the scene (it is not anchored in 3D). It never sits over the rangefinder.
 */
export const CloverLayer = ({ clover, collecting, toast, onCollect, motion: tracker, target }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<{ id: string; x: number; y: number; rare: boolean } | null>(null);
  const base = useRef<{ id: string; yaw: number | null; pitch: number | null } | null>(null);

  // Parallax: shift against the phone's rotation relative to when the clover appeared.
  useEffect(() => {
    if (!clover || !tracker) return;
    let raf = 0;
    const tick = () => {
      const s = tracker.snapshot();
      const el = wrapRef.current;
      if (el && s.available && s.yawDeg != null && s.pitchDeg != null) {
        if (!base.current || base.current.id !== clover.id) base.current = { id: clover.id, yaw: s.yawDeg, pitch: s.pitchDeg };
        let dyaw = s.yawDeg - (base.current.yaw as number);
        if (dyaw > 180) dyaw -= 360;
        if (dyaw < -180) dyaw += 360;
        const dx = Math.max(-36, Math.min(36, dyaw * 3));
        const dy = Math.max(-36, Math.min(36, (s.pitchDeg - (base.current.pitch as number)) * 3));
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clover, tracker]);

  const tap = () => {
    if (!clover || collecting) return;
    if (!clover.local) setFlight({ id: clover.id, x: clover.x, y: clover.y, rare: clover.kind === "rare" });
    onCollect();
  };

  return (
    <>
      <div ref={wrapRef} className="pointer-events-none absolute inset-0 z-10 will-change-transform">
        <AnimatePresence>
          {clover && !flight && (
            <motion.button
              key={clover.id}
              type="button"
              onClick={tap}
              // Centred with margins, not translate classes: framer-motion owns the transform.
              className="pointer-events-auto absolute flex h-[76px] w-[76px] items-center justify-center"
              style={{ left: clover.x, top: clover.y, marginLeft: -38, marginTop: -38 }}
              initial={{ scale: 0, opacity: 0, rotate: -40 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.2, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              aria-label={clover.local ? "Lucky clover. Sign in to collect." : "Collect lucky clover"}
              data-testid="monocle-clover"
            >
              <motion.span
                animate={{ y: [0, -4, 0], rotate: [-5, 5, -5] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="block"
              >
                <CloverIcon
                  className={cn(
                    // A soft light halo keeps the dark green leaf readable against trees and shade.
                    "h-[46px] w-auto [filter:drop-shadow(0_0_5px_rgba(255,255,255,0.75))_drop-shadow(0_3px_5px_rgba(0,0,0,0.6))_brightness(1.12)]",
                    clover.kind === "rare" && "[filter:drop-shadow(0_0_10px_hsl(var(--lucky-gold)))_drop-shadow(0_3px_5px_rgba(0,0,0,0.6))_hue-rotate(-60deg)_saturate(1.6)_brightness(1.2)]",
                  )}
                />
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Collected: fly to the counter. */}
      <AnimatePresence>
        {flight && (
          <motion.div
            key={`fly-${flight.id}`}
            className="pointer-events-none absolute z-30"
            style={{ left: flight.x, top: flight.y, marginLeft: -23, marginTop: -23 }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: target.x - flight.x, y: target.y - flight.y, scale: 0.45, opacity: [1, 1, 0.9, 0], rotate: 360 }}
            transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
            onAnimationComplete={() => setFlight(null)}
          >
            <CloverIcon className="h-[46px] w-auto drop-shadow-[0_0_14px_hsl(var(--lucky-gold)/0.9)]" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            role="status"
            data-testid="monocle-clover-toast"
            className={cn(
              "pointer-events-none absolute inset-x-0 top-[30%] z-40 mx-auto w-fit whitespace-nowrap rounded-2xl px-5 py-3 text-lg font-extrabold tracking-wide shadow-xl",
              toast.tone === "win" && "bg-accent text-accent-foreground",
              toast.tone === "info" && "bg-white text-black",
              toast.tone === "warn" && "bg-black/85 text-white ring-1 ring-white/30",
            )}
            initial={{ opacity: 0, y: 12, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
