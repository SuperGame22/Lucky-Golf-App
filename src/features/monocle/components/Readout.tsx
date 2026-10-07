import { Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DisplayState } from "../engine/display";

const BANNER_TONE = {
  info: "bg-white/15 text-white",
  warn: "bg-accent text-accent-foreground",
  alert: "bg-accent text-accent-foreground shadow-[0_0_32px_hsl(var(--lucky-gold)/0.55)]",
} as const;

/**
 * The big number, the club and any warning. Solid dark fade behind it and a
 * heavy white numeral so it stays legible in direct sun.
 */
export const Readout = ({
  display,
  landscape,
  onBracket,
}: {
  display: DisplayState;
  landscape: boolean;
  onBracket: () => void;
}) => {
  const hasNumber = display.number != null;
  const wide = (display.number?.length ?? 0) >= 4;
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-20 flex flex-col items-center justify-end text-center",
        landscape
          ? "inset-y-0 right-0 w-[42%] justify-center bg-gradient-to-l from-black via-black/85 to-transparent pl-6 pr-[max(1rem,env(safe-area-inset-right))]"
          : "inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16",
      )}
      data-testid="monocle-readout"
    >
      <div
        className={cn(
          "font-sans font-extrabold leading-none tracking-tight tabular-nums text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.8)] transition-opacity",
          display.stale && "opacity-50",
          !hasNumber && "text-white/25",
        )}
        style={{
          // "120+" is four characters wide: scale down so it never touches the screen edges.
          fontSize: landscape
            ? `clamp(48px, ${wide ? 22 : 28}dvh, ${wide ? 104 : 132}px)`
            : `clamp(56px, ${wide ? 13.5 : 17}dvh, ${wide ? 116 : 148}px)`,
        }}
        aria-live="polite"
        aria-label={hasNumber ? `${display.number} yards` : "No reading"}
        data-testid="monocle-number"
      >
        {display.number ?? "– –"}
      </div>

      {hasNumber && (
        <div className="mt-1 flex items-baseline gap-2 text-white">
          <span className="text-xl font-bold tracking-[0.2em]">YARDS</span>
          {display.plusMinus && <span className="text-base font-semibold text-white/70" data-testid="monocle-pm">{display.plusMinus}</span>}
        </div>
      )}

      {display.club && (
        <div
          className="mt-3 rounded-2xl bg-black/60 px-5 py-2 text-[26px] font-extrabold leading-tight text-white ring-1 ring-white/20"
          data-testid="monocle-club"
        >
          <span className="text-accent">{display.club.text}</span>
          <span className="mx-2 text-white/40">·</span>
          {display.club.swingText}
        </div>
      )}

      {display.banner && (
        <div
          className={cn(
            "mt-3 max-w-full text-balance rounded-xl px-4 py-2 font-extrabold leading-tight tracking-wide",
            display.kind === "far" ? "text-[22px]" : "text-[15px]",
            BANNER_TONE[display.banner.tone],
          )}
          role="status"
          data-testid="monocle-banner"
        >
          {display.banner.text}
        </div>
      )}

      {display.offerBracket && (
        <button
          type="button"
          onClick={onBracket}
          className="pointer-events-auto mt-3 flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-white text-base font-extrabold tracking-wide text-black active:scale-[0.98]"
          data-testid="monocle-bracket-button"
        >
          <Crosshair className="h-5 w-5" />
          TAP TO BRACKET
        </button>
      )}
    </div>
  );
};
