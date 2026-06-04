import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CloverIcon } from "@/components/icons/CloverIcon";
import { ScorecardHeader } from "@/components/scorecard/ScorecardHeader";
import { HoleScoreEntry } from "@/components/scorecard/HoleScoreEntry";
import { HoleGrid } from "@/components/scorecard/HoleGrid";
import { LuckyLevelBadge } from "@/components/scorecard/LuckyLevelBadge";
import { FindPlayers } from "@/components/scorecard/FindPlayers";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Flag } from "lucide-react";

const holes = Array.from({ length: 9 }, (_, i) => ({
  number: i + 1,
  par: [4, 3, 5, 4, 4, 3, 5, 4, 4][i],
  distance: [380, 165, 520, 410, 395, 185, 545, 425, 405][i],
}));

const CLOVERS_PER_ROUND = 5;

const Scorecard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scores, setScores] = useState<Record<number, number>>({});
  const [putts, setPutts] = useState<Record<number, number>>({});
  const [activeHole, setActiveHole] = useState(1);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);

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

  const finishRound = async () => {
    if (!user || saving) return;
    setSaving(true);

    // Fill in any unplayed holes with par
    const finalScores = { ...scores };
    const finalPutts = { ...putts };
    holes.forEach(h => {
      if (!finalScores[h.number]) finalScores[h.number] = h.par;
      if (!finalPutts[h.number]) finalPutts[h.number] = 2;
    });

    const finalTotal = Object.values(finalScores).reduce((a, b) => a + b, 0);
    const finalPuttsTotal = Object.values(finalPutts).reduce((a, b) => a + b, 0);

    try {
      // Save round
      const { error } = await supabase.from('rounds').insert({
        user_id: user.id,
        course_name: 'Practice Round',
        holes: 9,
        scores: Object.values(finalScores),
        putts: Object.values(finalPutts),
        total_score: finalTotal,
        total_par: totalPar,
        score_diff: finalTotal - totalPar,
        total_putts: finalPuttsTotal,
        holes_played: 9,
        completed: true,
        clovers_earned: CLOVERS_PER_ROUND,
      });

      if (error) throw error;

      // Award clovers
      await supabase.rpc('award_clovers', { p_user_id: user.id, p_amount: 20 });

      setFinished(true);
      toast.success(`Round saved! +${CLOVERS_PER_ROUND} clovers earned 🍀`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save round');
    } finally {
      setSaving(false);
    }
  };

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

        {/* Clover Reward / Finish */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4"
        >
          <CloverIcon className="w-10 h-10 text-primary" />
          <div className="flex-1">
            <p className="font-medium">{finished ? 'Round complete!' : 'Complete your round'}</p>
            <p className="text-sm text-muted-foreground">
              Earn <span className="text-primary font-bold">+{CLOVERS_PER_ROUND} clovers</span> for finishing!
            </p>
          </div>
        </motion.div>

        {!finished ? (
          <Button
            className="w-full"
            size="lg"
            onClick={finishRound}
            disabled={saving || holesPlayed < 1}
          >
            <Flag className="w-5 h-5 mr-2" />
            {saving ? 'Saving...' : 'Finish Round'}
          </Button>
        ) : (
          <Button className="w-full" size="lg" variant="outline" onClick={() => navigate('/career')}>
            View Career Stats →
          </Button>
        )}

        <FindPlayers userLuckyLevel={luckyLevel} />
      </div>
    </AppLayout>
  );
};

export default Scorecard;
