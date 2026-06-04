/**
 * Weekly Raffle - Enter to win the jackpot
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { ArrowLeft, Gift, Clock, Users, Trophy, Ticket } from 'lucide-react';

export default function WeeklyRaffle() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState(3);
  const jackpot = 5000;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/earn')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Weekly Raffle</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Win the jackpot</p>
          </div>
        </div>

        {/* Jackpot Display */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 text-center bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20"
        >
          <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">This Week's Jackpot</p>
          <p className="text-5xl font-black text-yellow-500">${jackpot.toLocaleString()}</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> 2 days left</div>
            <div className="flex items-center gap-1"><Users className="w-4 h-4" /> 1,247 entries</div>
          </div>
        </motion.div>

        {/* Your Entries */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Your Entries</p>
              <p className="text-3xl font-black">{entries}</p>
            </div>
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">1 clover = 1 entry</span>
            </div>
          </div>
          <Button className="w-full font-black uppercase tracking-wider" onClick={() => setEntries(prev => prev + 1)}
            data-testid="buy-entry-btn"
          >
            <CloverIcon className="w-4 h-4 mr-2" /> Buy Entry (1 Clover)
          </Button>
        </div>

        {/* Past Winners */}
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Recent Winners</p>
          <div className="space-y-2">
            {[
              { name: 'Tiger M.', amount: '$4,200', date: 'Last week' },
              { name: 'Sarah K.', amount: '$3,800', date: '2 weeks ago' },
              { name: 'Mike T.', amount: '$5,100', date: '3 weeks ago' },
            ].map((w, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border">
                <div>
                  <p className="font-bold text-sm">{w.name}</p>
                  <p className="text-[10px] text-muted-foreground">{w.date}</p>
                </div>
                <span className="font-black text-yellow-500">{w.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
