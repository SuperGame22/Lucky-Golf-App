/**
 * PLAY — Free tier on-course tools
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, FileText, Play } from 'lucide-react';

const FEATURES = [
  { title: 'GPS Rangefinder', desc: 'Distance measurements to the pin', icon: MapPin, path: '/play/rangefinder' },
  { title: 'Scorecard', desc: 'Track scores hole by hole', icon: FileText, path: '/play/scorecard' },
];

export default function PlayScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-20 bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Play</h1>
          <p className="text-sm text-muted-foreground">Your on-course companion</p>
        </div>

        {/* Start Round CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6">
          <h2 className="font-display font-bold mb-4">Start a New Round</h2>
          <Button className="w-full" size="lg" onClick={() => navigate('/play/start')}>
            <Play className="w-5 h-5 mr-2" /> Start Round
          </Button>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid grid-cols-2 gap-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.path} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-4 flex flex-col items-start gap-3 cursor-pointer hover:border-primary/50 transition-all hover:scale-105"
                onClick={() => navigate(f.path)}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Recent Rounds */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass-card p-6">
          <h2 className="font-display font-bold mb-4">Recent Rounds</h2>
          <div className="text-center py-6">
            <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No rounds played yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Start your first round to see history here</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
