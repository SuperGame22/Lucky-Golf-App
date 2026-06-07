/**
 * PLAY — Free tier on-course tools
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, FileText, Play, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const FEATURES = [
  { title: 'GPS Rangefinder', desc: 'Distance measurements to the pin', icon: MapPin, path: '/play/rangefinder' },
  { title: 'Scorecard', desc: 'Track scores hole by hole', icon: FileText, path: '/play/scorecard' },
];

export default function PlayScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rounds, setRounds] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('rounds')
      .select('id, course_name, total_score, total_par, score_diff, holes_played, created_at')
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRounds(data || []));
  }, [user]);

  return (
    <div className="min-h-screen pb-20 bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Play</h1>
          <p className="text-sm text-muted-foreground">Your on-course companion</p>
        </div>

        {/* Start Round CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
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
          {rounds.length === 0 ? (
            <div className="text-center py-6">
              <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No rounds played yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Finish a round to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.map(r => {
                const diff = r.score_diff;
                const diffStr = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
                const diffColor = diff < 0 ? 'text-green-400' : diff === 0 ? 'text-primary' : 'text-muted-foreground';
                return (
                  <div key={r.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/play/rounds/${r.id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{r.course_name || 'Practice Round'}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.holes_played || 9} holes · {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${diffColor}`}>{diffStr}</p>
                      <p className="text-xs text-muted-foreground">{r.total_score} strokes</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
