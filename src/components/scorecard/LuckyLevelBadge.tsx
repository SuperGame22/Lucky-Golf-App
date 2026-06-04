import { motion } from "framer-motion";
import { Sparkles, Trophy, Star } from "lucide-react";
import { CloverIcon } from "@/components/icons/CloverIcon";

interface LuckyLevelBadgeProps {
  luckyLevel: number;
  isGoldPlayer: boolean;
  totalScore: number;
  scoreDiff: number;
}

const getLuckyLevelInfo = (level: number) => {
  if (level >= 5) return { name: "Legendary Luck", color: "text-yellow-400", bg: "bg-yellow-400/20" };
  if (level >= 4) return { name: "Golden Fortune", color: "text-amber-400", bg: "bg-amber-400/20" };
  if (level >= 3) return { name: "Lucky Charm", color: "text-primary", bg: "bg-primary/20" };
  if (level >= 2) return { name: "Four-Leaf Finder", color: "text-emerald-400", bg: "bg-emerald-400/20" };
  return { name: "Wee Bit o' Luck", color: "text-muted-foreground", bg: "bg-muted" };
};

export const LuckyLevelBadge = ({
  luckyLevel,
  isGoldPlayer,
  totalScore,
  scoreDiff,
}: LuckyLevelBadgeProps) => {
  const levelInfo = getLuckyLevelInfo(luckyLevel);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${levelInfo.bg}`}>
            <CloverIcon className={`w-6 h-6 ${levelInfo.color}`} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lucky Level</p>
            <p className={`font-display font-bold ${levelInfo.color}`}>
              {levelInfo.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${
                i < luckyLevel
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>

      {isGoldPlayer && totalScore > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-xl border border-yellow-500/30"
        >
          <Trophy className="w-6 h-6 text-yellow-400" />
          <div>
            <p className="font-display font-bold text-yellow-400 flex items-center gap-1">
              Gold Player <Sparkles className="w-4 h-4" />
            </p>
            <p className="text-xs text-muted-foreground">
              Shootin' under par like a true champion!
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
