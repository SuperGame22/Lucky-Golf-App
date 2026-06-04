/**
 * Leaderboards - Global & Local Rankings
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Crown, Medal } from 'lucide-react';

const LEADERS: any[] = [];

export default function Leaderboards() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'global' | 'local' | 'friends'>('global');

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/career')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Leaderboards</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">See where you rank</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['global', 'local', 'friends'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >{t}</button>
          ))}
        </div>

        {LEADERS.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">No rankings yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Complete rounds to appear on the leaderboard</p>
          </div>
        ) : (
        <div className="space-y-2">
          {LEADERS.map((l, i) => (
            <motion.div key={l.rank} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className={`glass-card p-4 flex items-center gap-3 ${l.isYou ? 'border-primary/50 bg-primary/5' : ''}`}
            >
              <span className={`text-lg font-black w-8 text-center ${
                l.rank === 1 ? 'text-yellow-500' : l.rank === 2 ? 'text-gray-400' : l.rank === 3 ? 'text-orange-600' : 'text-muted-foreground'
              }`}>
                {l.rank <= 3 ? (l.rank === 1 ? <Crown className="w-5 h-5 text-yellow-500 mx-auto" /> : <Medal className="w-5 h-5 mx-auto" />) : `#${l.rank}`}
              </span>
              <span className="text-2xl">{l.avatar}</span>
              <div className="flex-1">
                <p className="font-bold text-sm">{l.name} {l.isYou && <span className="text-primary text-xs">(You)</span>}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{l.rounds} rounds</p>
              </div>
              <span className="font-black text-lg">{l.score}</span>
            </motion.div>
          ))}
        </div>
        )}
      </div>
    </AppLayout>
  );
}
