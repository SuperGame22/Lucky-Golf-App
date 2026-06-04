/**
 * LUCKY COACH — Premium Coaching Hub (Clover Tier)
 * Houses AI Coaches including Coach Ace
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  GraduationCap,
  Brain,
  Target,
  Zap,
  Lock,
  ChevronRight,
  Star,
  MessageSquare,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

const AI_COACHES = [
  {
    id: 'ace',
    name: 'Coach Ace',
    subtitle: 'Swing & Fundamentals',
    description: '40 expert answers on swing mechanics, club selection, rules, mental game, and course strategy.',
    icon: '🏌️',
    path: '/coach/ace',
    topics: 40,
    tier: 'free',
    accent: 'from-primary/20 to-emerald-500/20',
  },
  {
    id: 'pro',
    name: 'Coach Pro',
    subtitle: 'Advanced Strategy',
    description: 'Course management, shot shaping, advanced short game, and competitive play tactics.',
    icon: '🧠',
    path: '/coach/pro',
    topics: 0,
    tier: 'clover',
    accent: 'from-yellow-500/20 to-orange-500/20',
    locked: true,
  },
  {
    id: 'zen',
    name: 'Coach Zen',
    subtitle: 'Mental Performance',
    description: 'Visualization, pressure management, focus routines, and competitive mindset training.',
    icon: '🧘',
    path: '/coach/zen',
    topics: 0,
    tier: 'gold',
    accent: 'from-purple-500/20 to-pink-500/20',
    locked: true,
  },
];

const COACHING_TOOLS = [
  { name: 'Swing Analysis', desc: 'AI-powered swing breakdown', icon: Target, tier: 'clover', locked: true },
  { name: 'Progress Tracker', desc: 'Track coaching milestones', icon: TrendingUp, tier: 'free', path: '/practice/progress' },
  { name: 'Drill Library', desc: 'Custom practice drills', icon: BarChart3, tier: 'clover', locked: true },
];

export default function LuckyCoach() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const displayName = profile?.display_name || 'Golfer';

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider">Lucky Coach</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Premium coaching for {displayName}</p>
            </div>
          </div>
        </motion.div>

        {/* Tier Banner */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary">Clover Tier</p>
              <p className="text-[10px] text-muted-foreground">Unlock more coaches with upgrades</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="font-bold uppercase tracking-wider text-xs" onClick={() => navigate('/membership')}>
            Upgrade
          </Button>
        </motion.div>

        {/* AI Coaches Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="font-black uppercase tracking-wider text-sm">AI Coaches</h2>
          </div>

          <div className="space-y-3">
            {AI_COACHES.map((coach, i) => (
              <motion.div
                key={coach.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => !coach.locked && navigate(coach.path)}
                data-testid={`coach-${coach.id}`}
                className={`glass-card p-5 cursor-pointer border-2 border-transparent transition-all group ${
                  coach.locked ? 'opacity-60' : 'hover:border-primary/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${coach.accent} flex items-center justify-center flex-shrink-0 text-2xl shadow-lg`}>
                    {coach.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-black uppercase tracking-wide text-sm">{coach.name}</h3>
                      {coach.locked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                      {coach.tier !== 'free' && (
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                          coach.tier === 'clover' ? 'bg-primary/20 text-primary' : 'bg-yellow-500/20 text-yellow-500'
                        }`}>{coach.tier}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{coach.subtitle}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{coach.description}</p>
                    {coach.topics > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <MessageSquare className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-bold text-primary">{coach.topics} topics</span>
                      </div>
                    )}
                  </div>
                  {!coach.locked && <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary mt-1 flex-shrink-0" />}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Coaching Tools */}
        <div>
          <h2 className="font-black uppercase tracking-wider text-sm mb-3">Coaching Tools</h2>
          <div className="grid grid-cols-3 gap-3">
            {COACHING_TOOLS.map((tool, i) => {
              const Icon = tool.icon;
              return (
                <motion.div
                  key={tool.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  onClick={() => tool.path && !tool.locked && navigate(tool.path)}
                  className={`glass-card p-3 text-center cursor-pointer hover:border-primary/30 transition-all ${
                    tool.locked ? 'opacity-50' : ''
                  }`}
                >
                  <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-[10px] font-bold leading-tight">{tool.name}</p>
                  {tool.locked && <Lock className="w-3 h-3 text-muted-foreground mx-auto mt-1" />}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
