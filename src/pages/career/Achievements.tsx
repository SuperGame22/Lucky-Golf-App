/**
 * Achievements - Badges & Milestones
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Award, Lock } from 'lucide-react';

const ACHIEVEMENTS = [
  { id: 1, name: 'First Round', desc: 'Complete your first round', icon: '🏌️', earned: true, date: 'Jan 15' },
  { id: 2, name: 'Par Machine', desc: '5 pars in a row', icon: '🎯', earned: true, date: 'Feb 2' },
  { id: 3, name: 'Eagle Eye', desc: 'Score an eagle', icon: '🦅', earned: true, date: 'Mar 10' },
  { id: 4, name: 'Clover Collector', desc: 'Earn 100 clovers', icon: '🍀', earned: true, date: 'Mar 22' },
  { id: 5, name: 'Gold Rush', desc: 'Win 500 on Gold Machine', icon: '🏆', earned: false },
  { id: 6, name: 'Social Butterfly', desc: 'Play with 10 different players', icon: '🦋', earned: false },
  { id: 7, name: 'Ace!', desc: 'Score a hole-in-one', icon: '⛳', earned: false },
  { id: 8, name: 'Marathon', desc: 'Play 100 rounds', icon: '🏃', earned: false },
  { id: 9, name: 'Wager King', desc: 'Win 10 Lucky Wagers', icon: '👑', earned: false },
  { id: 10, name: 'Under Par', desc: 'Finish a round under par', icon: '🔥', earned: false },
];

export default function Achievements() {
  const navigate = useNavigate();
  const earned = ACHIEVEMENTS.filter(a => a.earned).length;

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

        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
              className={`glass-card p-4 text-center ${a.earned ? '' : 'opacity-50'}`}
            >
              <span className="text-4xl block mb-2">{a.earned ? a.icon : '🔒'}</span>
              <p className="font-black text-sm">{a.name}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{a.desc}</p>
              {a.earned && a.date && <p className="text-[9px] text-primary font-bold mt-2 uppercase tracking-widest">{a.date}</p>}
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
