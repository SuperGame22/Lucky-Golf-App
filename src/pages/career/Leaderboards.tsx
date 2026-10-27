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
  key: string;
  rank: number;
  display_name: string;
  best_to_par: number;
  rounds: number;
  isYou: boolean;
}

type BoardRpc = (fn: 'get_leaderboard', args: { p_days: number }) => PromiseLike<{
  data: { success?: boolean; leaders?: { rank: number; name: string; best_to_par: number; rounds: number; is_you: boolean }[] } | null;
  error: { message: string } | null;
}>;

const toPar = (n: number) => (n > 0 ? `+${n}` : n === 0 ? 'E' : String(n));

export default function Leaderboards() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const myName = profile?.display_name || 'You';
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      // Everyone's best round comes from the server (other players' rounds are private to the app).
      const { data, error } = await (supabase.rpc as unknown as BoardRpc).call(supabase, 'get_leaderboard', { p_days: 90 });
      if (!alive) return;
      if (!error && data?.success) {
        setLeaders((data.leaders ?? []).map((l, i) => ({
          key: `${l.rank}-${i}`, rank: l.rank, display_name: l.name, best_to_par: l.best_to_par, rounds: l.rounds, isYou: l.is_you,
        })));
        setLoading(false);
        return;
      }
      // Older database without get_leaderboard: show the player's own best so the page still works.
      const { data: mine } = await supabase
        .from('rounds')
        .select('score_diff, holes_played')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('holes_played', 9);
      if (!alive) return;
      const rows = (mine ?? []).filter((r) => r.score_diff != null);
      if (rows.length) {
        const best = Math.min(...rows.map((r) => Math.round((r.score_diff * 18) / Math.max(1, r.holes_played ?? 18))));
        setLeaders([{ key: 'me', rank: 1, display_name: myName, best_to_par: best, rounds: rows.length, isYou: true }]);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, myName]);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate('/career')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Leaderboard</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Best round to par · last 90 days</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : leaders.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">No rankings yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Complete a 9- or 18-hole round to appear on the leaderboard</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaders.map((l, i) => (
              <motion.div key={l.key} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className={`glass-card p-4 flex items-center gap-3 ${l.isYou ? 'border-primary/50 bg-primary/5' : ''}`}>
                <div className="w-8 text-center">
                  {l.rank === 1 ? <Crown className="w-5 h-5 text-yellow-500 mx-auto" />
                    : l.rank === 2 ? <Medal className="w-5 h-5 text-gray-400 mx-auto" />
                    : l.rank === 3 ? <Medal className="w-5 h-5 text-orange-500 mx-auto" />
                    : <span className="text-sm font-black text-muted-foreground">#{l.rank}</span>}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{l.display_name} {l.isYou && <span className="text-primary text-xs">(You)</span>}</p>
                  <p className="text-[10px] text-muted-foreground">{l.rounds} round{l.rounds !== 1 ? 's' : ''}</p>
                </div>
                <span className="font-black text-lg">{toPar(l.best_to_par)}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
