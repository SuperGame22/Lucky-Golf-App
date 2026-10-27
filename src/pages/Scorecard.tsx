import { useEffect, useState } from "react";
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
import { clearDraft, readDraft, summarize, writeDraft } from '@/features/scorecard/draft';

// Placeholder par/yardage (par 72 total), used when no course is selected or a hole has no data.
const PLACEHOLDER_HOLES = Array.from({ length: 18 }, (_, i) => ({
  number: i + 1,
  par: [4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 4, 3, 5, 4, 3, 5, 4, 4][i],
  distance: [
    380, 165, 520, 410, 395, 185, 545, 425, 405, 400, 390, 175, 535, 415, 170,
    530, 405, 550,
  ][i],
}));

export type RoundLength = 9 | 18;

type CourseHole = { hole: number; par: number | null; yards_est: number | null };
export type SelectedCourse = {
  id: number;
  name: string;
  city: string | null;
  state: string;
  holes: number | null;
  hole_data: CourseHole[] | null;
};

// Merge real course data (approximate yards) over the placeholders, hole by hole.
const buildHoles = (course?: SelectedCourse) =>
  PLACEHOLDER_HOLES.map((ph) => {
    const real = course?.hole_data?.find((h) => h.hole === ph.number);
    return {
      number: ph.number,
      par: real?.par ?? ph.par,
      distance: real?.yards_est ?? ph.distance,
    };
  });

const CLOVERS_PER_ROUND = 5; // display only; the amount and daily limit are enforced by award_round_clovers()

// award_round_clovers isn't in the generated Supabase types, so call it through a narrow signature.
type AwardRoundRpc = (fn: 'award_round_clovers', args: { p_round_id: string }) => PromiseLike<{ data: { success?: boolean; clovers?: number } | null }>;

const Scorecard = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const course = (location.state as { course?: SelectedCourse } | null)?.course;
  const allHoles = buildHoles(course);
  const courseId = course?.id ?? null;
  // Pick up a round in progress on this course (kept in the browser while playing).
  const [draft] = useState(() => readDraft(localStorage, courseId));
  const [scores, setScores] = useState<Record<number, number>>(draft?.scores ?? {});
  const [putts, setPutts] = useState<Record<number, number>>(draft?.putts ?? {});
  const [activeHole, setActiveHole] = useState(draft?.activeHole ?? 1);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [roundLength, setRoundLength] = useState<RoundLength>(draft?.roundLength ?? (course?.holes && course.holes >= 18 ? 18 : 9));
  const holes = allHoles.slice(0, roundLength);

  useEffect(() => {
    if (draft) toast.message('Picked up your round in progress');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the round in the browser as it's played; cleared once it's saved.
  useEffect(() => {
    if (finished) return;
    writeDraft(localStorage, { courseId, roundLength, scores, putts, activeHole });
  }, [courseId, roundLength, scores, putts, activeHole, finished]);

  const handleRoundLengthChange = (length: RoundLength) => {
    if (length === roundLength) return;
    const hasScores = Object.keys(scores).length > 0 || Object.keys(putts).length > 0;
    if (hasScores && !window.confirm("Switching round length will clear your current scores. Continue?")) {
      return;
    }
    clearDraft(localStorage);
    setRoundLength(length);
    setScores({});
    setPutts({});
    setActiveHole(1);
    setFinished(false);
  };

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

  // Score against the par of the holes played so far (not the whole course).
  const summary = summarize(holes, scores, putts);
  const totalScore = summary.total;
  const totalPar = holes.reduce((a, h) => a + h.par, 0);
  const totalPutts = summary.puttsTotal;
  const scoreDiff = summary.diff;
  const holesPlayed = summary.played;

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
    // Only holes actually scored are saved; an unfinished round is kept but doesn't count as complete.
    const complete = holesPlayed === roundLength;
    if (!complete && !window.confirm(
      `You've scored ${holesPlayed} of ${roundLength} holes. Save it as an unfinished round? Only complete rounds earn clovers and count toward stats.`,
    )) return;
    setSaving(true);

    try {
      const { data: inserted, error } = await supabase.from('rounds').insert({
        user_id: user.id,
        course_name: course?.name ?? 'Practice Round',
        holes: roundLength,
        scores: summary.scoresByHole as number[],
        putts: summary.puttsByHole as number[],
        total_score: summary.total,
        total_par: summary.par,
        score_diff: summary.diff,
        total_putts: summary.puttsTotal,
        holes_played: holesPlayed,
        completed: complete,
        clovers_earned: 0, // the server fills this in when it awards the clovers
      }).select('id').single();

      if (error) throw error;
      clearDraft(localStorage);

      // The database pays the round's clovers (once per round, with a daily limit) and says how many.
      let earned = 0;
      if (complete) {
        try {
          const { data: award } = await (supabase.rpc as unknown as AwardRoundRpc).call(supabase, 'award_round_clovers', { p_round_id: inserted.id });
          earned = award?.success ? award.clovers ?? 0 : 0;
        } catch { /* the round is saved either way */ }
        await refreshProfile();
      }

      setFinished(true);
      toast.success(earned > 0 ? `Round saved! +${earned} clovers earned 🍀` : complete ? 'Round saved!' : 'Unfinished round saved');
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
        [activeHole]: holes[activeHole - 1].par,
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
          totalPar={totalPar}
          totalPutts={totalPutts}
          scoreDiff={scoreDiff}
          roundLength={roundLength}
          courseName={course?.name}
          activeHole={activeHole}
          onRoundLengthChange={handleRoundLengthChange}
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

        <FindPlayers userLuckyLevel={luckyLevel} courseName={course?.name} />
      </div>
    </AppLayout>
  );
};

export default Scorecard;
