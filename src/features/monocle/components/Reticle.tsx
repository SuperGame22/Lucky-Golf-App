import { cn } from "@/lib/utils";
import type { Rect } from "../engine/geometry";

export type ReticleTone = "idle" | "locking" | "locked" | "far";

const TONE: Record<ReticleTone, string> = {
  idle: "text-white",
  locking: "text-accent",
  locked: "text-[hsl(152_76%_50%)]",
  far: "text-accent",
};

/** The tall, narrow "put the flagstick here" box. Corner brackets only, so the view stays clear. */
export const Reticle = ({ rect, tone }: { rect: Rect; tone: ReticleTone }) => {
  const arm = Math.min(26, rect.w * 0.3);
  return (
    <div
      className={cn("pointer-events-none absolute transition-colors duration-200", TONE[tone])}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      aria-hidden
      data-testid="monocle-reticle"
    >
      <svg width="100%" height="100%" className="overflow-visible drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
        {[
          [0, 0, 1, 1],
          [rect.w, 0, -1, 1],
          [0, rect.h, 1, -1],
          [rect.w, rect.h, -1, -1],
        ].map(([x, y, dx, dy], i) => (
          <path key={i} d={`M ${x + dx * arm} ${y} L ${x} ${y} L ${x} ${y + dy * arm}`} fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" />
        ))}
        {/* centre cross */}
        <path d={`M ${rect.w / 2 - 9} ${rect.h / 2} H ${rect.w / 2 + 9} M ${rect.w / 2} ${rect.h / 2 - 9} V ${rect.h / 2 + 9}`} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" opacity={0.9} />
      </svg>
      <span className="absolute left-1/2 -translate-x-1/2 -bottom-6 whitespace-nowrap text-[11px] font-bold tracking-[0.22em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.95)]">
        TARGET FLAG
      </span>
    </div>
  );
};
