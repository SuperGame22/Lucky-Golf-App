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
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { errMessage } from '@/lib/errors';
import { buildHoles, summarize, defaultStrokes, type CourseHole } from '@/features/scorecard/holes';

export type RoundLength = 9 | 18;

export type SelectedCourse = {
  id: number;
  name: string;
  city: string | null;
  state: string;
  holes: number | null;
  hole_data: CourseHole[] | null;
};

const CLOVERS_PER_ROUND = 5; // display only; the amount and daily limit are enforced by award_round_clovers()

// award_round_clovers isn't in the generated Supabase types, so call it through a narrow signature.
type AwardRoundRpc = (fn: 'award_round_clovers', args: { p_round_id: string }) => PromiseLike<{ data: { success?: boolean; clovers?: number } | null }>;

const Scorecard = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const course = (location.state as { course?: SelectedCourse } | null)?.course;
  const allHoles = buildHoles(course?.hole_data);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [putts, setPutts] = useState<Record<number, number>>({});
  const [activeHole, setActiveHole] = useState(1);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [roundLength, setRoundLength] = useState<RoundLength>(course?.holes && course.holes >= 18 ? 18 : 9);
  const holes = allHoles.slice(0, roundLength);

  const handleRoundLengthChange = (length: RoundLength) => {
    if (length === roundLength) return;
    const hasScores = Object.keys(scores).length > 0 || Object.keys(putts).length > 0;
    if (hasScores && !window.confirm("Switching round length will clear your current scores. Continue?")) {
      return;
    }
    setRoundLength(length);
    setScores({});
    setPutts({});
    setActiveHole(1);
    setFinished(false);
  };

  const updateScore = (hole: number, delta: number) => {
    setScores((prev) => ({
      ...prev,
      [hole]: Math.max(1, (prev[hole] || defaultStrokes(holes[hole - 1])) + delta),
    }));
  };

  const updatePutts = (hole: number, delta: number) => {
    setPutts((prev) => ({
      ...prev,
      [hole]: Math.max(0, (prev[hole] || 2) + delta),
    }));
  };

  // Score-to-par only counts holes whose par is known (see features/scorecard/holes.ts).
  const summary = summarize(holes, scores);
  const { totalScore, scoreDiff, holesPlayed, playedKnownPar } = summary;
  const totalPutts = Object.values(putts).reduce((a, b) => a + b, 0);

  // Calculate Lucky Level (1-5 based on performance)
  const calculateLuckyLevel = () => {
    if (playedKnownPar < 3) return 3; // Default level (also when par is unknown)
    const avgOverPar = scoreDiff / playedKnownPar;
    if (avgOverPar <= -0.5) return 5; // Way under par
    if (avgOverPar <= 0) return 4; // At or under par
    if (avgOverPar <= 0.5) return 3; // Slightly over
    if (avgOverPar <= 1) return 2; // Over par
    return 1; // Struggling
  };

  const luckyLevel = calculateLuckyLevel();
  const isGoldPlayer = playedKnownPar >= 3 && scoreDiff < 0;

  const finishRound = async () => {
    if (!user || saving) return;
    setSaving(true);

    // Fill in any unplayed holes with their starting stroke count (par, or 4 when par is unknown)
    const finalScores = { ...scores };
    const finalPutts = { ...putts };
    holes.forEach(h => {
      if (!finalScores[h.number]) finalScores[h.number] = defaultStrokes(h);
      if (!finalPutts[h.number]) finalPutts[h.number] = 2;
    });

    const finalTotal = Object.values(finalScores).reduce((a, b) => a + b, 0);
    // total_par / score_diff cover only holes with a known par (0 / 0 when the course has no par data).
    const finalSummary = summarize(holes, finalScores);
    const finalPuttsTotal = Object.values(finalPutts).reduce((a, b) => a + b, 0);

    try {
      // Save round
      const { data: inserted, error } = await supabase.from('rounds').insert({
        user_id: user.id,
        course_name: course?.name ?? 'Practice Round',
        holes: roundLength,
        scores: Object.values(finalScores),
        putts: Object.values(finalPutts),
        total_score: finalTotal,
        total_par: finalSummary.knownPar,
        score_diff: finalSummary.scoreDiff,
        total_putts: finalPuttsTotal,
        holes_played: roundLength,
        completed: true,
        clovers_earned: 0, // the server fills this in when it awards the clovers
      }).select('id').single();

      if (error) throw error;

      // The database pays the round's clovers (once per round, with a daily limit) and says how many.
      let earned = 0;
      try {
        const { data: award } = await (supabase.rpc as unknown as AwardRoundRpc).call(supabase, 'award_round_clovers', { p_round_id: inserted.id });
        earned = award?.success ? award.clovers ?? 0 : 0;
      } catch { /* the round is saved either way */ }
      await refreshProfile();

      setFinished(true);
      toast.success(earned > 0 ? `Round saved! +${earned} clovers earned 🍀` : 'Round saved!');
    } catch (e) {
      toast.error(errMessage(e, 'Failed to save round'));
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (!scores[activeHole]) {
      setScores((prev) => ({
        ...prev,
        [activeHole]: defaultStrokes(holes[activeHole - 1]),
      }));
    }
    if (!putts[activeHole]) {
      setPutts((prev) => ({
        ...prev,
        [activeHole]: 2,
      }));
    }
    if (activeHole < roundLength) {
      setActiveHole(activeHole + 1);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <ScorecardHeader
          totalScore={totalScore}
          totalPutts={totalPutts}
          scoreDiff={scoreDiff}
          playedKnownPar={playedKnownPar}
          unknownParPlayed={holesPlayed - playedKnownPar}
          roundLength={roundLength}
          activeHole={activeHole}
          onRoundLengthChange={handleRoundLengthChange}
        />

        <HoleScoreEntry
          activeHole={activeHole}
          hole={holes[activeHole - 1]}
          score={scores[activeHole] || defaultStrokes(holes[activeHole - 1])}
          putts={putts[activeHole] || 2}
          onScoreChange={(delta) => updateScore(activeHole, delta)}
          onPuttsChange={(delta) => updatePutts(activeHole, delta)}
          onPrevious={() => setActiveHole(Math.max(1, activeHole - 1))}
          onNext={handleNext}
          isFirst={activeHole === 1}
          isLast={activeHole === roundLength}
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
        {!summary.fullPar && (
          <p className="text-xs text-muted-foreground text-center -mt-3" data-testid="par-unknown-note">
            {summary.knownParHoles === 0
              ? "Par isn't known for this course yet, so score-to-par and Lucky Level aren't shown."
              : `Par isn't known for ${summary.unknownParHoles} of these holes; they count toward strokes but not score-to-par.`}
          </p>
        )}

        {/* Clover Reward / Finish */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
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
