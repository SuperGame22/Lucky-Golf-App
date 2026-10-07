import { cn } from "@/lib/utils";
import { Size, videoPointToScreen } from "../engine/geometry";
import type { DetectionOverlay } from "../engine/types";

/**
 * Small ticks at the detected top and base of the flagstick, so the golfer can
 * see what the app thinks it found. Shown even when the target is beyond wedge range.
 */
export const LockMarkers = ({
  detection,
  video,
  container,
  locked,
}: {
  detection: DetectionOverlay;
  video: Size;
  container: Size;
  locked: boolean;
}) => {
  const top = videoPointToScreen({ x: detection.xTop, y: detection.yTop }, video, container);
  const base = videoPointToScreen({ x: detection.xBase, y: detection.yBase }, video, container);
  const color = detection.ambiguous ? "hsl(var(--destructive))" : locked ? "hsl(152 76% 50%)" : "hsl(var(--lucky-gold))";
  const tick = 14;
  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 h-full w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]")}
      aria-hidden
      data-testid="monocle-lock-markers"
    >
      <line x1={top.x} y1={top.y} x2={base.x} y2={base.y} stroke={color} strokeWidth={1.5} strokeDasharray="3 5" opacity={0.7} />
      <line x1={top.x - tick} y1={top.y} x2={top.x + tick} y2={top.y} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <line x1={base.x - tick} y1={base.y} x2={base.x + tick} y2={base.y} stroke={color} strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
};
