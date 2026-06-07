/**
 * CAREER — Real profile data from golfer_profiles, empty states for no data
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { FeedbackModal } from '@/components/FeedbackModal';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, TrendingUp, Award, Crown, BarChart3, Target, Play, Settings, MessageSquareText } from 'lucide-react';

interface RoundStats {
  total: number;
  bestScore: number | null;
}

export default function CareerScreen() {
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { profile, user } = useAuth();
  const [roundStats, setRoundStats] = useState<RoundStats>({ total: 0, bestScore: null });

  const handicap = profile?.handicap_index ?? 0;
  const luckyLevel = profile?.lucky_level ?? 1;
  const clovers = profile?.clovers ?? 0;
  const displayName = profile?.display_name || 'Golfer';
  const isVIP = luckyLevel >= 5;

  useEffect(() => {
    if (!user) return;
    supabase
      .from('rounds')
      .select('total_score, total_par')
      .eq('user_id', user.id)
      .eq('completed', true)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const best = data.reduce((min, r) =>
          r.total_score < min.total_score ? r : min, data[0]);
        setRoundStats({ total: data.length, bestScore: best.total_score });
      });
  }, [user]);

  return (
    <div className="min-h-screen pb-20 bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              Career
              {isVIP && <Crown className="w-6 h-6 text-yellow-500" />}
            </h1>
            <p className="text-sm text-muted-foreground">{displayName}'s golf journey</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigate('/profile/edit')} data-testid="edit-profile-btn">
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Tier Progress */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 bg-gradient-to-br from-primary/10 to-accent/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Lucky Level: {luckyLevel}</p>
            <Button size="sm" variant="outline" onClick={() => navigate('/membership')}>Upgrade</Button>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(luckyLevel * 20, 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{luckyLevel < 5 ? `${5 - luckyLevel} levels to VIP` : 'VIP Status'}</p>
        </motion.div>

        {/* Stats Grid — Real data or zeros */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Handicap', value: handicap > 0 ? handicap : '—', icon: Target },
            { label: 'Rounds', value: roundStats.total, icon: BarChart3 },
            { label: 'Best Score', value: roundStats.bestScore ?? '—', icon: Trophy },
            { label: 'Clovers', value: clovers, icon: TrendingUp },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }} className="glass-card p-4">
                <Icon className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-display font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Feature Cards */}
        {[
          { title: 'Enhanced Stats', description: 'Deep dive into your performance metrics', path: '/career/stats', tier: 'clover', icon: BarChart3 },
          { title: 'Score Patterns', description: 'Analyze your scoring trends over time', path: '/career/patterns', tier: 'gold', icon: TrendingUp },
          { title: 'Leaderboards', description: 'See where you rank globally and locally', path: '/career/leaderboards', tier: 'free', icon: Trophy },
          { title: 'Achievements', description: 'Your badges, milestones, and wins', path: '/career/achievements', tier: 'free', icon: Award },
        ].map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div key={feature.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className="glass-card p-4 flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(feature.path)}>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold">{feature.title}</p>
                  {feature.tier !== 'free' && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${feature.tier === "clover" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"}`}>
                      {feature.tier.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          );
        })}

        {/* Empty State CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="glass-card p-6 text-center">
          <Play className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">Play rounds to build your career stats</p>
          <Button onClick={() => navigate('/play/start')}>Start a Round</Button>
        </motion.div>

        {/* Beta Feedback */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Button
            variant="outline"
            className="w-full h-12 font-bold uppercase tracking-wider text-xs border-primary/30 hover:bg-primary/10 gap-2"
            onClick={() => setFeedbackOpen(true)}
            data-testid="send-feedback-btn"
          >
            <MessageSquareText className="w-4 h-4" /> Send Beta Feedback
          </Button>
        </motion.div>
      </div>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
