/**
 * Achievements - Badges & Milestones
 * Unlocked based on real round/clover data
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

const ACHIEVEMENTS = [
  { id: 'first_round', name: 'First Round', desc: 'Complete your first round', icon: '🏌️', check: (stats: any) => stats.rounds >= 1 },
  { id: 'five_rounds', name: 'Regulars Club', desc: 'Complete 5 rounds', icon: '🏅', check: (s: any) => s.rounds >= 5 },
  { id: 'ten_rounds', name: 'Dedicated Golfer', desc: 'Complete 10 rounds', icon: '🔟', check: (s: any) => s.rounds >= 10 },
  { id: 'hundred_rounds', name: 'Marathon', desc: 'Play 100 rounds', icon: '🏃', check: (s: any) => s.rounds >= 100 },
  { id: 'under_par', name: 'Under Par', desc: 'Finish a round under par', icon: '🔥', check: (s: any) => s.bestDiff < 0 },
  { id: 'clover_100', name: 'Clover Collector', desc: 'Earn 100 clovers', icon: '🍀', check: (s: any) => s.clovers >= 100 },
  { id: 'clover_500', name: 'Clover Hoarder', desc: 'Earn 500 clovers', icon: '🌿', check: (s: any) => s.clovers >= 500 },
  { id: 'ace', name: 'Ace!', desc: 'Score a hole-in-one', icon: '⛳', check: () => false },
  { id: 'wager_win', name: 'Wager King', desc: 'Win 10 Lucky Wagers', icon: '👑', check: () => false },
  { id: 'social', name: 'Social Butterfly', desc: 'Play with 10 different players', icon: '🦋', check: () => false },
];

export default function Achievements() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ rounds: 0, bestDiff: 0, clovers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('rounds').select('score_diff').eq('user_id', user.id).eq('completed', true),
    ]).then(([{ data: rounds }]) => {
      const total = rounds?.length ?? 0;
      const bestDiff = rounds?.length ? Math.min(...rounds.map(r => r.score_diff)) : 0;
      setStats({ rounds: total, bestDiff, clovers: profile?.clovers ?? 0 });
      setLoading(false);
    });
  }, [user, profile]);

  const unlocked = ACHIEVEMENTS.filter(a => a.check(stats));
  const earned = unlocked.length;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/career')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Achievements</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">{earned}/{ACHIEVEMENTS.length} unlocked</p>
          </div>
        </div>

        <div className="w-full bg-muted rounded-full h-3">
          <motion.div initial={{ width: 0 }} animate={{ width: `${(earned / ACHIEVEMENTS.length) * 100}%` }}
            className="bg-primary h-3 rounded-full" />
        </div>

        {loading ? (
          <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {ACHIEVEMENTS.map((a, i) => {
              const isEarned = a.check(stats);
              return (
                <motion.div key={a.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                  className={`glass-card p-4 text-center ${isEarned ? 'border-primary/30 bg-primary/5' : 'opacity-40'}`}>
                  <span className="text-4xl block mb-2">{isEarned ? a.icon : '🔒'}</span>
                  <p className="font-black text-sm">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{a.desc}</p>
                  {isEarned && <p className="text-[9px] text-primary font-bold mt-2 uppercase tracking-widest">Unlocked ✓</p>}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
