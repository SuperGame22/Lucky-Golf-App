import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CloverIcon } from "@/components/icons/CloverIcon";
import { ScorecardHeader } from "@/components/scorecard/ScorecardHeader";
import { HoleScoreEntry } from "@/components/scorecard/HoleScoreEntry";
import { HoleGrid } from "@/components/scorecard/HoleGrid";
import { LuckyLevelBadge } from "@/components/scorecard/LuckyLevelBadge";
import { FindPlayers } from "@/components/scorecard/FindPlayers";
import { motion } from "framer-motion";

const holes = Array.from({ length: 9 }, (_, i) => ({
  number: i + 1,
  par: [4, 3, 5, 4, 4, 3, 5, 4, 4][i],
  distance: [380, 165, 520, 410, 395, 185, 545, 425, 405][i],
}));

const Scorecard = () => {
  const [scores, setScores] = useState<Record<number, number>>({});
  const [putts, setPutts] = useState<Record<number, number>>({});
  const [activeHole, setActiveHole] = useState(1);

  const updateScore = (hole: number, delta: number) => {
    setScores((prev) => ({
      ...prev,
      [hole]: Math.max(1, (prev[hole] || holes[hole - 1].par) + delta),
    }));
  };

  const updatePutts = (hole: number, delta: number) => {
    setPutts((prev) => ({
      ...prev,
      [hole]: Math.max(0, (prev[hole] || 2) + delta),
    }));
  };

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const totalPar = holes.reduce((a, h) => a + h.par, 0);
  const totalPutts = Object.values(putts).reduce((a, b) => a + b, 0);
  const scoreDiff = totalScore - totalPar;
  const holesPlayed = Object.keys(scores).length;

  // Calculate Lucky Level (1-5 based on performance)
  const calculateLuckyLevel = () => {
    if (holesPlayed < 3) return 3; // Default level
    const avgOverPar = scoreDiff / holesPlayed;
    if (avgOverPar <= -0.5) return 5; // Way under par
    if (avgOverPar <= 0) return 4; // At or under par
    if (avgOverPar <= 0.5) return 3; // Slightly over
    if (avgOverPar <= 1) return 2; // Over par
    return 1; // Struggling
  };

  const luckyLevel = calculateLuckyLevel();
  const isGoldPlayer = holesPlayed >= 3 && scoreDiff < 0;

  const handleNext = () => {
    if (!scores[activeHole]) {
      setScores((prev) => ({
        ...prev,
        [activeHole]: holes[activeHole - 1].par,
      }));
    }
    if (!putts[activeHole]) {
      setPutts((prev) => ({
        ...prev,
        [activeHole]: 2,
      }));
    }
    if (activeHole < 9) {
      setActiveHole(activeHole + 1);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <ScorecardHeader
          totalScore={totalScore}
          totalPar={totalPar}
          totalPutts={totalPutts}
          scoreDiff={scoreDiff}
        />

        <HoleScoreEntry
          activeHole={activeHole}
          hole={holes[activeHole - 1]}
          score={scores[activeHole] || holes[activeHole - 1].par}
          putts={putts[activeHole] || 2}
          onScoreChange={(delta) => updateScore(activeHole, delta)}
          onPuttsChange={(delta) => updatePutts(activeHole, delta)}
          onPrevious={() => setActiveHole(Math.max(1, activeHole - 1))}
          onNext={handleNext}
          isFirst={activeHole === 1}
          isLast={activeHole === 9}
        />

        <HoleGrid
          holes={holes}
          scores={scores}
          putts={putts}
          activeHole={activeHole}
          onHoleSelect={setActiveHole}
        />

        <LuckyLevelBadge
          luckyLevel={luckyLevel}
          isGoldPlayer={isGoldPlayer}
          totalScore={totalScore}
          scoreDiff={scoreDiff}
        />

        {/* Clover Reward Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4"
        >
          <CloverIcon className="w-10 h-10 text-primary" />
          <div>
            <p className="font-medium">Complete your round</p>
            <p className="text-sm text-muted-foreground">
              Earn <span className="text-primary font-bold">+5 clovers</span> for
              finishing!
            </p>
          </div>
        </motion.div>

        <FindPlayers userLuckyLevel={luckyLevel} />
      </div>
    </AppLayout>
  );
};

export default Scorecard;
