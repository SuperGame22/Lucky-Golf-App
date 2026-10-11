/**
 * PRACTICE — Free tier drills + coach
 * Three sections, one card each, all cards identical in size and type style.
 */

import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { Target, Brain, BarChart3, ChevronRight, type LucideIcon } from 'lucide-react';

type Section = {
  header: string;
  title: string;
  desc: string;
  path: string;
  icon?: LucideIcon;
  emoji?: string;
};

const SECTIONS: Section[] = [
  { header: 'Coach', title: 'Coach Ace', desc: 'AI swing coach — ask anything about your game', path: '/coach/ace', emoji: '🏌️' },
  { header: 'Skill Drills', title: 'Lucky Putts', desc: '5-hole putting with physics', path: '/practice/putting', icon: Target },
  { header: 'Tracking', title: 'Score Patterns', desc: 'Scoring trends over time', path: '/career/patterns', icon: BarChart3 },
];

export default function PracticeScreen() {
  const navigate = useNavigate();

  return (
    <AppLayout hideHeader>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Practice</h1>
          <p className="text-sm text-muted-foreground">Sharpen your game</p>
        </div>

        {SECTIONS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.path}>
              <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">{s.header}</p>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-5 cursor-pointer hover:border-primary/50 transition-colors border-primary/20 bg-primary/5"
                onClick={() => navigate(s.path)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl">
                    {s.emoji ?? (Icon && <Icon className="w-6 h-6 text-primary" />)}
                  </div>
                  <div className="flex-1">
                    <p className="font-black uppercase tracking-wider">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary" />
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
