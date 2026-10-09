import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Ticket, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { describePrize, timeLeft } from '@/features/raffle/raffle';

interface RaffleHome {
  this_week: { prize_name: string | null; prize_credit: number; prize_spins: number; prize_products: string | null; ends_at: string; my_entries: number } | null;
  last_result: { id: string; prize_name: string; winner_name: string; i_won: boolean; drawn_at: string } | null;
}

/** Home card: this week's prize, my entries, and last week's winner. */
export function RaffleCard() {
  const [data, setData] = useState<RaffleHome | null>(null);

  useEffect(() => {
    let live = true;
    (supabase.rpc as unknown as (fn: string) => PromiseLike<{ data: unknown; error: unknown }>).call(supabase, 'get_raffle_home')
      .then(({ data: d, error }) => { if (live && !error && d) setData(d as RaffleHome); }, () => undefined);
    return () => { live = false; };
  }, []);

  if (!data || (!data.this_week && !data.last_result)) return null;
  const { this_week: week, last_result: last } = data;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {last && (
        <div className={`glass-card p-4 flex items-center gap-3 ${last.i_won ? 'border-yellow-500/50' : ''}`} data-testid="raffle-result">
          <Trophy className="w-6 h-6 text-yellow-500 shrink-0" />
          <p className="text-sm">
            {last.i_won
              ? <><b>You won the weekly raffle!</b> Your prize: {last.prize_name}.</>
              : <><b>{last.winner_name}</b> won last week's raffle: {last.prize_name}.</>}
          </p>
        </div>
      )}
      {week && (
        <Link to="/earn/raffle" className="glass-card p-4 flex items-center gap-3 block" data-testid="raffle-card">
          <Ticket className="w-6 h-6 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">This week's prize</p>
            <p className="font-bold truncate">{week.prize_name ?? 'Coming soon'}</p>
            {describePrize(week) && week.prize_name && <p className="text-xs text-muted-foreground truncate">{describePrize(week)}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-display font-bold text-gradient-green leading-none" data-testid="raffle-entries">{week.my_entries}</p>
            <p className="text-[10px] text-muted-foreground">entries · {timeLeft(week.ends_at)}</p>
          </div>
        </Link>
      )}
    </motion.div>
  );
}
