/**
 * Career Stats — real data from rounds table
 * Computable: scoring avg, putts/round, best/worst, rounds played, total clovers
 * Coming Soon: fairways, GIR, scrambling, driving distance (need per-hole tracking)
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, BarChart3, TrendingUp, Target, Percent, Lock, Trophy, ClipboardList } from 'lucide-react';

export default function CareerStats() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('rounds')
      .select('total_score, total_par, score_diff, total_putts, holes_played, created_at')
      .eq('user_id', user.id).eq('completed', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setRounds(data || []); setLoading(false); });
  }, [user]);

  const n = rounds.length;
  const scoringAvg = n ? (rounds.reduce((s, r) => s + r.score_diff, 0) / n) : null;
  const puttsAvg   = n ? (rounds.reduce((s, r) => s + (r.total_putts || 0), 0) / n) : null;
  const best       = n ? Math.min(...rounds.map(r => r.score_diff)) : null;
  const worst      = n ? Math.max(...rounds.map(r => r.score_diff)) : null;
  // Simple USGA-style handicap estimate: avg of best 8 of last 20 score diffs
  const diffs = rounds.slice(0, 20).map(r => r.score_diff).sort((a, b) => a - b);
  const hcpSample = diffs.slice(0, Math.min(8, diffs.length));
  const handicap  = hcpSample.length ? (hcpSample.reduce((s, d) => s + d, 0) / hcpSample.length * 0.96) : null;

  const fmt = (v: number | null, prefix = '', decimals = 1) =>
    v === null ? '—' : `${prefix}${v >= 0 && prefix === '+' ? '+' : ''}${v.toFixed(decimals)}`;

  const liveStats = [
    { label: 'Rounds Played', value: n > 0 ? String(n) : '—', sub: 'total completed', icon: ClipboardList, live: true },
    { label: 'Scoring Avg', value: scoringAvg !== null ? (scoringAvg >= 0 ? `+${scoringAvg.toFixed(1)}` : scoringAvg.toFixed(1)) : '—', sub: 'vs par', icon: BarChart3, live: true },
    { label: 'Putts / Round', value: puttsAvg !== null ? puttsAvg.toFixed(1) : '—', sub: 'avg putts', icon: Target, live: true },
    { label: 'Best Round', value: best !== null ? (best >= 0 ? `+${best}` : `${best}`) : '—', sub: 'vs par', icon: Trophy, live: true },
    { label: 'Worst Round', value: worst !== null ? (worst >= 0 ? `+${worst}` : `${worst}`) : '—', sub: 'vs par', icon: TrendingUp, live: true },
    { label: 'Est. Handicap', value: handicap !== null ? handicap.toFixed(1) : '—', sub: 'best 8 of 20', icon: Percent, live: true },
  ];

  const comingSoon = [
    { label: 'Fairways Hit', sub: 'per-hole tracking needed' },
    { label: 'Greens in Reg', sub: 'per-hole tracking needed' },
    { label: 'Scrambling %', sub: 'per-hole tracking needed' },
    { label: 'Driving Distance', sub: 'rangefinder data needed' },
  ];

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/career')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Enhanced Stats</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Deep performance metrics</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : n === 0 ? (
          <div className="glass-card p-10 text-center">
            <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold">No rounds yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Complete a round to see your stats</p>
            <Button size="sm" onClick={() => navigate('/play/start')}>Start a Round</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {liveStats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }} className="glass-card p-4">
                    <Icon className="w-5 h-5 text-primary mb-2" />
                    <p className="text-2xl font-black">{stat.value}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{stat.sub}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Coming Soon */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-muted-foreground/50" />
                <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Coming Soon</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {comingSoon.map(s => (
                  <div key={s.label} className="bg-muted/30 rounded-xl p-3 opacity-50">
                    <p className="text-sm font-bold text-muted-foreground">—</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
