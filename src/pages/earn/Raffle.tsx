/**
 * Weekly Jackpot — real Supabase data
 * Entries = clovers earned during the active week. No buy button.
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Trophy, Clock, Users, Ticket, Gift } from 'lucide-react';

function useCountdown(endsAt: string | null) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return timeLeft;
}

export default function WeeklyRaffle() {
  const navigate = useNavigate();
  const [jackpot, setJackpot] = useState<any>(null);
  const [userEntries, setUserEntries] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(true);
  const countdown = useCountdown(jackpot?.ends_at ?? null);

  useEffect(() => {
    supabase.rpc('get_active_jackpot_for_user').then(({ data, error }) => {
      if (!error && data) {
        setJackpot(data.jackpot ?? null);
        setUserEntries(data.user_entries ?? 0);
        setTotalEntries(data.total_entries ?? 0);
      }
      setLoading(false);
    });
  }, []);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/earn')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Weekly Jackpot</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Earn clovers, win prizes</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : !jackpot ? (
          /* No active jackpot */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-10 text-center">
            <Gift className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="font-black text-lg mb-2">No Active Jackpot</p>
            <p className="text-sm text-muted-foreground">Check back soon — a new jackpot will be posted weekly.</p>
          </motion.div>
        ) : (
          <>
            {/* Prize card */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-8 text-center bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
              {jackpot.prize_image_url ? (
                <img src={jackpot.prize_image_url} alt={jackpot.prize_name}
                  className="w-32 h-32 object-contain mx-auto mb-4 rounded-xl" />
              ) : (
                <Trophy className="w-14 h-14 text-yellow-500 mx-auto mb-4" />
              )}
              <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">This Week's Prize</p>
              <p className="text-2xl font-black text-yellow-400 mb-1">{jackpot.prize_name}</p>
              {jackpot.prize_value && (
                <p className="text-sm text-muted-foreground mb-3">Value: ${Number(jackpot.prize_value).toFixed(2)}</p>
              )}
              {jackpot.description && (
                <p className="text-sm text-muted-foreground mb-4">{jackpot.description}</p>
              )}
              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>{countdown}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{totalEntries.toLocaleString()} entries</span>
                </div>
              </div>
            </motion.div>

            {/* Your entries */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Your Entries</p>
                  <p className="text-4xl font-black mt-1">{userEntries}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CloverIcon className="w-4 h-4 text-primary" />
                  <span>1 clover = 1 entry</span>
                  <Ticket className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="border-t border-border pt-4 text-center space-y-1">
                <p className="text-sm text-muted-foreground">Each clover earned gives you 1 raffle entry for that week.</p>
                <p className="text-sm text-muted-foreground">Entries reset to zero after each raffle.</p>
              </div>
            </motion.div>

            {/* How to earn more entries */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="glass-card p-5">
              <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Earn More Entries</p>
              <div className="space-y-2">
                {[
                  { label: 'Complete a round', clovers: '+5 clovers' },
                  { label: 'Spin the Lucky Wheel', clovers: 'up to +10 clovers' },
                  { label: 'Shop at Lucky Golf', clovers: 'clovers per purchase' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="text-primary font-bold">{item.clovers}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
