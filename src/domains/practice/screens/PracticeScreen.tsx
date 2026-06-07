/**
 * PRACTICE — Free tier drills + coach
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Target, TrendingUp, Brain, Crosshair, Clock, BarChart3 } from 'lucide-react';

const DRILLS = [
  { title: 'Putting Grid', desc: '5-hole putting with physics', icon: Target, path: '/practice/putting' },
  { title: 'Distance Control', desc: 'Hit target yardages', icon: Crosshair, path: '/practice/distance' },
];

const TRACKING = [
  { title: 'Practice Sessions', desc: 'Your drill history', icon: Clock, path: '/practice/sessions' },
  { title: 'Score Patterns', desc: 'Scoring trends over time', icon: BarChart3, path: '/career/patterns' },
];

export default function PracticeScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-20 bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Practice</h1>
          <p className="text-sm text-muted-foreground">Sharpen your game</p>
        </div>

        {/* AI Coach CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 cursor-pointer hover:border-primary/50 transition-colors border-primary/20 bg-primary/5"
          onClick={() => navigate('/coach/ace')}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl">🏌️</div>
            <div className="flex-1">
              <p className="font-black uppercase tracking-wider">Coach Ace</p>
              <p className="text-xs text-muted-foreground">AI swing coach — ask anything about your game</p>
            </div>
            <Brain className="w-5 h-5 text-primary" />
          </div>
        </motion.div>

        {/* Drills */}
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Skill Drills</p>
          <div className="grid grid-cols-2 gap-4">
            {DRILLS.map((d, i) => {
              const Icon = d.icon;
              return (
                <motion.div key={d.path} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card p-4 flex flex-col gap-3 cursor-pointer hover:border-primary/50 transition-all hover:scale-105"
                  onClick={() => navigate(d.path)}>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Tracking */}
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Tracking</p>
          <div className="space-y-3">
            {TRACKING.map((t, i) => {
              const Icon = t.icon;
              return (
                <motion.div key={t.path} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="glass-card p-4 flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(t.path)}>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
