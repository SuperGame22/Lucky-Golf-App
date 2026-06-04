/**
 * Score Patterns Analysis
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp } from 'lucide-react';

const PATTERNS = [
  { hole: 'Par 3s', avg: '+0.8', best: 'Birdie', worst: 'Triple', color: 'text-yellow-400' },
  { hole: 'Par 4s', avg: '+1.2', best: 'Eagle', worst: 'Double', color: 'text-green-400' },
  { hole: 'Par 5s', avg: '+0.5', best: 'Birdie', worst: 'Bogey', color: 'text-primary' },
];

const SCORING_DIST = [
  { label: 'Eagles', count: 2, pct: 1 },
  { label: 'Birdies', count: 18, pct: 10 },
  { label: 'Pars', count: 72, pct: 40 },
  { label: 'Bogeys', count: 54, pct: 30 },
  { label: 'Doubles+', count: 34, pct: 19 },
];

export default function ScorePatterns() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/career')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Score Patterns</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Analyze your scoring trends</p>
          </div>
        </div>

        {/* By Hole Type */}
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">By Hole Type</p>
          <div className="space-y-3">
            {PATTERNS.map(p => (
              <div key={p.hole} className="glass-card p-4 flex items-center justify-between">
                <div>
                  <p className="font-black">{p.hole}</p>
                  <p className="text-xs text-muted-foreground">Best: {p.best} · Worst: {p.worst}</p>
                </div>
                <span className={`text-xl font-black ${p.color}`}>{p.avg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scoring Distribution */}
        <div className="glass-card p-5">
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4">Scoring Distribution</p>
          <div className="space-y-3">
            {SCORING_DIST.map((d, i) => (
              <div key={d.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold">{d.label}</span>
                  <span className="text-xs text-muted-foreground">{d.count} ({d.pct}%)</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${d.pct}%` }} transition={{ delay: i * 0.1 }}
                    className="bg-primary h-2.5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
