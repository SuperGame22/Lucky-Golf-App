/**
 * Leaderboards — Real data from rounds table
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Trophy, Crown, Medal } from 'lucide-react';

interface Leader {
  user_id: string;
  display_name: string;
  best_score: number;
  rounds: number;
  isYou: boolean;
}

export default function Leaderboards() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('rounds')
      .select('user_id, total_score, score_diff')
      .eq('completed', true)
      .order('total_score', { ascending: true })
      .limit(50)
      .then(async ({ data: rounds }) => {
        if (!rounds?.length) { setLoading(false); return; }

        // Group by user — best score per user
        const byUser = new Map<string, { best: number; rounds: number }>();
        for (const r of rounds) {
          const existing = byUser.get(r.user_id);
          if (!existing || r.total_score < existing.best) {
            byUser.set(r.user_id, { best: r.total_score, rounds: (existing?.rounds ?? 0) + 1 });
          } else {
            byUser.set(r.user_id, { ...existing, rounds: existing.rounds + 1 });
          }
        }

        // Fetch display names
        const userIds = Array.from(byUser.keys());
        const { data: profiles } = await supabase
          .from('golfer_profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        const nameMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) ?? []);

        const result: Leader[] = Array.from(byUser.entries())
          .map(([uid, stats]) => ({
            user_id: uid,
            display_name: nameMap.get(uid) || 'Golfer',
            best_score: stats.best,
            rounds: stats.rounds,
            isYou: uid === user?.id,
          }))
          .sort((a, b) => a.best_score - b.best_score)
          .slice(0, 20);

        setLeaders(result);
        setLoading(false);
      });
  }, [user]);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/career')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Leaderboard</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Best scores this season</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : leaders.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">No rankings yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Complete rounds to appear on the leaderboard</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaders.map((l, i) => (
              <motion.div key={l.user_id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className={`glass-card p-4 flex items-center gap-3 ${l.isYou ? 'border-primary/50 bg-primary/5' : ''}`}>
                <div className="w-8 text-center">
                  {i === 0 ? <Crown className="w-5 h-5 text-yellow-500 mx-auto" />
                    : i === 1 ? <Medal className="w-5 h-5 text-gray-400 mx-auto" />
                    : i === 2 ? <Medal className="w-5 h-5 text-orange-500 mx-auto" />
                    : <span className="text-sm font-black text-muted-foreground">#{i + 1}</span>}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{l.display_name} {l.isYou && <span className="text-primary text-xs">(You)</span>}</p>
                  <p className="text-[10px] text-muted-foreground">{l.rounds} round{l.rounds !== 1 ? 's' : ''}</p>
                </div>
                <span className="font-black text-lg">{l.best_score}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
