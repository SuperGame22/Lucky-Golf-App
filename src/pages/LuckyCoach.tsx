/**
 * LUCKY COACH — Free tier: Coach Ace only
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, ChevronRight } from 'lucide-react';

export default function LuckyCoach() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const displayName = profile?.display_name || 'Golfer';

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Lucky Coach</h1>
              <p className="text-sm text-muted-foreground">Hey {displayName}, ready to improve?</p>
            </div>
          </div>
        </motion.div>

        {/* Coach Ace */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-card p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-emerald-900/5 cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => navigate('/coach/ace')}>
          <div className="flex items-start gap-4">
            <div className="text-4xl">🏌️</div>
            <div className="flex-1">
              <p className="font-black text-lg">Coach Ace</p>
              <p className="text-xs text-primary font-bold uppercase tracking-widest mb-2">Swing & Fundamentals</p>
              <p className="text-sm text-muted-foreground">Ask anything — swing mechanics, club selection, course strategy, rules, mental game. Powered by AI.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground mt-1" />
          </div>
          <Button className="w-full mt-4 font-black uppercase tracking-wider" onClick={() => navigate('/coach/ace')}>
            Chat with Coach Ace
          </Button>
        </motion.div>

        {/* Quick topics */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Ask Coach Ace about</p>
          <div className="flex flex-wrap gap-2">
            {['Fix my slice', 'Club selection', 'Putting tips', 'Course management', 'Mental game', 'Sand trap escape', 'Grip pressure', 'Ball position'].map(t => (
              <button key={t}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => navigate('/coach/ace')}>
                {t}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
