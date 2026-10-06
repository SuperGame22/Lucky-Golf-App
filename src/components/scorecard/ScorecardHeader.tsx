import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ScorecardHeaderProps {
  totalScore: number;
  totalPar: number;
  totalPutts: number;
  scoreDiff: number;
  roundLength: 9 | 18;
  activeHole: number;
  onRoundLengthChange: (length: 9 | 18) => void;
}

export const ScorecardHeader = ({
  totalScore,
  totalPar,
  totalPutts,
  scoreDiff,
  roundLength,
  activeHole,
  onRoundLengthChange,
}: ScorecardHeaderProps) => {
  // Course selection is off until a later version, so the subtitle only names the nine in play.
  const roundLabel =
    roundLength === 9 ? "Front 9" : activeHole <= 9 ? "Front 9 of 18" : "Back 9 of 18";
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Scorecard</h1>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{roundLabel}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-display font-bold">
            {totalScore > 0 ? totalScore : "--"}
          </p>
          <p
            className={`text-sm font-medium ${
              scoreDiff > 0
                ? "text-destructive"
                : scoreDiff < 0
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            {totalScore > 0
              ? scoreDiff > 0
                ? `+${scoreDiff}`
                : scoreDiff < 0
                ? scoreDiff
                : "E"
              : "--"}
          </p>
          {totalPutts > 0 && (
            <p className="text-xs text-muted-foreground">{totalPutts} putts</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
        {([9, 18] as const).map((len) => (
          <button
            key={len}
            onClick={() => onRoundLengthChange(len)}
            className={cn(
              "py-2 rounded-lg text-sm font-medium transition-all",
              roundLength === len
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground"
            )}
          >
            {len} Holes
          </button>
        ))}
      </div>
    </motion.div>
  );
};
