import { motion } from "framer-motion";

interface Hole {
  number: number;
  par: number;
  distance: number;
}

interface HoleGridProps {
  holes: Hole[];
  scores: Record<number, number>;
  putts: Record<number, number>;
  activeHole: number;
  onHoleSelect: (hole: number) => void;
}

export const HoleGrid = ({
  holes,
  scores,
  putts,
  activeHole,
  onHoleSelect,
}: HoleGridProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-4"
    >
      {/* Hole numbers */}
      <div className="grid grid-cols-9 gap-1 text-center text-xs mb-2">
        {holes.map((hole) => (
          <div key={hole.number} className="text-muted-foreground font-medium">
            {hole.number}
          </div>
        ))}
      </div>

      {/* Par values */}
      <div className="grid grid-cols-9 gap-1 text-center text-xs mb-2">
        {holes.map((hole) => (
          <div key={hole.number} className="text-muted-foreground">
            {hole.par}
          </div>
        ))}
      </div>

      {/* Scores */}
      <div className="grid grid-cols-9 gap-1 mb-2">
        {holes.map((hole) => {
          const score = scores[hole.number];
          const diff = score ? score - hole.par : 0;
          return (
            <button
              key={hole.number}
              onClick={() => onHoleSelect(hole.number)}
              className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                activeHole === hole.number ? "ring-2 ring-primary" : ""
              } ${
                !score
                  ? "bg-muted text-muted-foreground"
                  : diff < 0
                  ? "bg-primary/20 text-primary"
                  : diff > 0
                  ? "bg-destructive/20 text-destructive"
                  : "bg-accent/20 text-accent-foreground"
              }`}
            >
              {score || "-"}
            </button>
          );
        })}
      </div>

      {/* Putts row */}
      <div className="grid grid-cols-9 gap-1 text-center text-xs">
        {holes.map((hole) => (
          <div
            key={hole.number}
            className="text-muted-foreground bg-muted/50 rounded py-1"
          >
            {putts[hole.number] || "-"}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-1">Putts</p>
    </motion.div>
  );
};
