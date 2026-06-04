import { MapPin } from "lucide-react";
import { motion } from "framer-motion";

interface ScorecardHeaderProps {
  totalScore: number;
  totalPar: number;
  totalPutts: number;
  scoreDiff: number;
}

export const ScorecardHeader = ({
  totalScore,
  totalPar,
  totalPutts,
  scoreDiff,
}: ScorecardHeaderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between"
    >
      <div>
        <h1 className="text-2xl font-display font-bold">Scorecard</h1>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>Pebble Beach - Front 9</span>
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
    </motion.div>
  );
};
