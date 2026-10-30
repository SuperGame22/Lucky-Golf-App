import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { formatDiff } from "@/features/scorecard/holes";

interface ScorecardHeaderProps {
  totalScore: number;
  totalPutts: number;
  /** strokes minus par over played holes with a known par */
  scoreDiff: number;
  /** played holes that count toward scoreDiff (0 = no score-to-par to show) */
  playedKnownPar: number;
  /** played holes whose par is unknown */
  unknownParPlayed: number;
  roundLength: 9 | 18;
  activeHole: number;
  onRoundLengthChange: (length: 9 | 18) => void;
}

export const ScorecardHeader = ({
  totalScore,
  totalPutts,
  scoreDiff,
  playedKnownPar,
  unknownParPlayed,
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
            data-testid="score-to-par"
            className={`text-sm font-medium ${
              playedKnownPar > 0 && scoreDiff > 0
                ? "text-destructive"
                : playedKnownPar > 0 && scoreDiff < 0
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            {totalScore > 0 && playedKnownPar > 0
              ? formatDiff(scoreDiff)
              : totalScore > 0
              ? "Par unknown"
              : "--"}
          </p>
          {totalScore > 0 && playedKnownPar > 0 && unknownParPlayed > 0 && (
            <p className="text-[10px] text-muted-foreground" data-testid="score-to-par-partial">
              thru {playedKnownPar} hole{playedKnownPar === 1 ? "" : "s"} with par
            </p>
          )}
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
