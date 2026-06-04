/**
 * Score Patterns — Real data from completed rounds
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, TrendingUp, BarChart3 } from 'lucide-react';

export default function ScorePatterns() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('rounds').select('total_score, total_par, score_diff, created_at')
      .eq('user_id', user.id).eq('completed', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setRounds(data || []); setLoading(false); });
  }, [user]);

  const avg = rounds.length
    ? (rounds.reduce((s, r) => s + r.score_diff, 0) / rounds.length).toFixed(1)
    : null;
  const best = rounds.length ? Math.min(...rounds.map(r => r.score_diff)) : null;
  const worst = rounds.length ? Math.max(...rounds.map(r => r.score_diff)) : null;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/career')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Score Patterns</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Your scoring trends</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : rounds.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold text-muted-foreground">No rounds yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Complete rounds to see your scoring patterns</p>
            <Button size="sm" onClick={() => navigate('/play/start')}>Start a Round</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-card p-4 text-center">
                <p className="text-2xl font-black text-primary">{avg && Number(avg) > 0 ? '+' + avg : avg}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Avg vs Par</p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-2xl font-black text-green-400">{best !== null && best > 0 ? '+' + best : best}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Best</p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-2xl font-black">{worst !== null && worst > 0 ? '+' + worst : worst}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Worst</p>
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Last {Math.min(rounds.length, 10)} rounds</p>
              </div>
              <div className="flex items-end gap-1 h-24">
                {rounds.slice(-10).map((r, i) => {
                  const max = Math.max(...rounds.slice(-10).map((x: any) => Math.abs(x.score_diff)), 1);
                  const height = Math.max(10, (Math.abs(r.score_diff) / max) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t" style={{ height: height + '%', background: r.score_diff <= 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.5)' }} />
                      <p className="text-[8px] text-muted-foreground">{r.score_diff > 0 ? '+' + r.score_diff : r.score_diff}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
