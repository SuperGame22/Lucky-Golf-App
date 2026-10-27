/**
 * Career Stats - Enhanced Statistics (Clover Club / Gold), from the player's completed rounds.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { computeRoundStats, fmtToPar, type RoundRow, type RoundStats } from '@/features/stats/roundStats';
import { ArrowLeft, BarChart3, TrendingUp, TrendingDown, Target, Trophy, Flag, CircleDot } from 'lucide-react';

export default function CareerStats() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<RoundStats | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from('rounds')
      .select('score_diff, holes_played, putts, total_putts, created_at')
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error('stats:', error.message);
        setStats(computeRoundStats((data ?? []) as RoundRow[]));
      });
    return () => { alive = false; };
  }, [user]);

  const s = stats;
  const tiles = s ? [
    { label: 'Rounds', value: String(s.rounds), icon: Flag },
    { label: 'Scoring Avg (to par / 18)', value: fmtToPar(s.avgToPar), icon: BarChart3 },
    { label: 'Best Round (to par / 18)', value: fmtToPar(s.bestToPar), icon: Trophy },
    { label: 'Putts per 18', value: s.puttsPer18 == null ? '—' : String(s.puttsPer18), icon: Target },
    { label: '1-Putt Holes', value: s.onePuttPct == null ? '—' : `${s.onePuttPct}%`, icon: CircleDot },
    { label: '3-Putt Holes', value: s.threePuttPct == null ? '—' : `${s.threePuttPct}%`, icon: CircleDot },
  ] : [];

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate('/career')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Enhanced Stats</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">From your completed rounds</p>
          </div>
        </div>

        {!s ? (
          <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : s.rounds === 0 ? (
          <div className="glass-card p-8 text-center space-y-3" data-testid="stats-empty">
            <BarChart3 className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">Finish a round to see your stats</p>
            <Button onClick={() => navigate('/play/start')}>Start a Round</Button>
          </div>
        ) : (
          <>
            {s.trend != null && (
              <div className={`glass-card p-4 flex items-center gap-3 ${s.trend <= 0 ? 'border-primary/40' : 'border-destructive/40'}`}>
                {s.trend <= 0 ? <TrendingDown className="w-5 h-5 text-primary" /> : <TrendingUp className="w-5 h-5 text-destructive" />}
                <p className="text-sm">
                  Last 5 rounds: <b>{Math.abs(s.trend)}</b> strokes {s.trend <= 0 ? 'better' : 'worse'} than the 5 before.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3" data-testid="stats-grid">
              {tiles.map((t, i) => {
                const Icon = t.icon;
                return (
                  <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="glass-card p-4">
                    <Icon className="w-5 h-5 text-primary mb-2" />
                    <p className="text-2xl font-black">{t.value}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{t.label}</p>
                  </motion.div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground text-center">Fairways and greens in regulation are coming once the scorecard tracks them.</p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
