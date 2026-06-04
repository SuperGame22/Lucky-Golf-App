import { Button } from "@/components/ui/button";
import { Flag, Plus, Minus, Check, Target } from "lucide-react";
import { motion } from "framer-motion";

interface Hole {
  number: number;
  par: number;
  distance: number;
}

interface HoleScoreEntryProps {
  activeHole: number;
  hole: Hole;
  score: number;
  putts: number;
  onScoreChange: (delta: number) => void;
  onPuttsChange: (delta: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export const HoleScoreEntry = ({
  activeHole,
  hole,
  score,
  putts,
  onScoreChange,
  onPuttsChange,
  onPrevious,
  onNext,
  isFirst,
  isLast,
}: HoleScoreEntryProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-6 glow-green"
    >
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Flag className="w-5 h-5 text-primary" />
          <span className="text-lg font-medium">Hole {activeHole}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Par {hole.par} • {hole.distance} yds
        </p>
      </div>

      {/* Strokes */}
      <div className="flex items-center justify-center gap-6 mb-4">
        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full"
          onClick={() => onScoreChange(-1)}
        >
          <Minus className="w-5 h-5" />
        </Button>

        <div className="text-center">
          <span className="text-5xl font-display font-bold">{score}</span>
          <p className="text-xs text-muted-foreground mt-1">Strokes</p>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full"
          onClick={() => onScoreChange(1)}
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Putts */}
      <div className="flex items-center justify-center gap-4 py-3 bg-muted/30 rounded-xl">
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-full"
          onClick={() => onPuttsChange(-1)}
        >
          <Minus className="w-4 h-4" />
        </Button>

        <div className="text-center flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-2xl font-display font-bold">{putts}</span>
          <span className="text-sm text-muted-foreground">Putts</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-full"
          onClick={() => onPuttsChange(1)}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex justify-center gap-2 mt-6">
        <Button variant="glass" onClick={onPrevious} disabled={isFirst}>
          Previous
        </Button>
        <Button variant="lucky" onClick={onNext}>
          <Check className="w-4 h-4" />
          {isLast ? "Finish" : "Next Hole"}
        </Button>
      </div>
    </motion.div>
  );
};
