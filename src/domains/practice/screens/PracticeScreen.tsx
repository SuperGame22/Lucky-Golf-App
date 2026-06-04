/**
 * PRACTICE Domain - Skill Development Layer
 * Improvement, coaching, analytics, training
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Target,
  TrendingUp,
  Lock,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { FeatureGate } from '@/core/tier-gating/FeatureGate';
import { useAuth } from '@/contexts/AuthContext';

export default function PracticeScreen() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const userTier = profile?.lucky_level && profile.lucky_level >= 3 ? 'gold' : profile?.lucky_level && profile.lucky_level >= 2 ? 'clover' : 'free';

  const features = [
    {
      id: 'ai-coaches',
      title: 'AI Coaches',
      description: 'Personal coaching powered by AI',
      icon: Brain,
      items: [
        { name: 'Lucky Coach', tier: 'free', path: '/coach' },
        { name: 'Gold Coach', tier: 'gold', feature: 'practice:ai-coach-gold' as const },
      ],
    },
    {
      id: 'simulators',
      title: 'Skill Simulators',
      description: 'Practice specific skills',
      icon: Target,
      items: [
        { name: 'Rangefinder Simulator', tier: 'free', path: '/practice/rangefinder' },
        { name: 'Putting Grid', tier: 'free', path: '/practice/putting' },
        { name: 'Distance Control', tier: 'clover', path: '/practice/distance' },
      ],
    },
    {
      id: 'analytics',
      title: 'Performance Analytics',
      description: 'Track your improvement',
      icon: TrendingUp,
      items: [
        { name: 'Practice Sessions', tier: 'free', path: '/practice/sessions' },
        { name: 'Progress Charts', tier: 'clover', path: '/practice/progress' },
        { name: 'Pattern Analyzer', tier: 'clover', feature: 'practice:pattern-analyzer' as const },
      ],
    },
    {
      id: 'advanced',
      title: 'Advanced Training',
      description: 'Premium skill development',
      icon: Sparkles,
      items: [
        { name: 'Enhanced Stats', tier: 'gold', feature: 'practice:enhanced-stats' as const },
        { name: 'Swing Modeling', tier: 'gold', feature: 'practice:advanced-swing-modeling' as const },
      ],
    },
  ];

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'gold':
        return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
      case 'clover':
        return 'bg-primary/20 text-primary';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">Practice</h1>
          <p className="text-sm text-muted-foreground">Improve your game with AI-powered training</p>
        </div>

        {/* Feature Sections */}
        {features.map((section, sectionIndex) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIndex * 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Icon className="w-6 h-6 text-primary" />
                <div>
                  <h2 className="font-display font-bold">{section.title}</h2>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
              </div>

              <div className="space-y-2">
                {section.items.map((item) => {
                  const isLocked = item.tier !== 'free' && userTier === 'free';

                  return (
                    <div
                      key={item.name}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isLocked
                          ? 'border-border bg-muted/30'
                          : 'border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer'
                      } transition-colors`}
                      onClick={() => {
                        if (!isLocked && item.path) {
                          navigate(item.path);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {isLocked && <Lock className="w-4 h-4 text-muted-foreground" />}
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      {item.tier !== 'free' && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getTierBadgeColor(item.tier)}`}>
                          {item.tier.toUpperCase()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}

        {/* Upgrade CTA */}
        {userTier === 'free' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20"
          >
            <h3 className="font-display font-bold mb-2">Unlock Premium Training</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get access to AI coaches, advanced analytics, and personalized practice plans
            </p>
            <Button className="w-full" onClick={() => navigate('/membership')}>
              Upgrade Now
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
