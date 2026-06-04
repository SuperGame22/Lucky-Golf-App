/**
 * PLAY Domain - On-Course Experience
 * Live round ecosystem with GPS, scorecard, overlays
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  FileText,
  Users,
  Target,
  Sparkles,
  MessageSquare,
  Play,
} from 'lucide-react';

export default function PlayScreen() {
  const navigate = useNavigate();
  const hasActiveRound = false; // Will be from state

  const features = [
    {
      id: 'gps',
      title: 'GPS & Rangefinder',
      description: 'Course GPS with distance measurements',
      icon: MapPin,
      path: '/play/rangefinder',
      tier: 'free',
    },
    {
      id: 'scorecard',
      title: 'Scorecard',
      description: 'Track scores and performance',
      icon: FileText,
      path: '/play/scorecard',
      tier: 'free',
    },
    {
      id: 'wagers',
      title: 'Lucky Wagers',
      description: 'Add fun side bets to your round',
      icon: Sparkles,
      path: '/play/wagers',
      tier: 'free',
    },
    {
      id: 'flyover',
      title: 'Hole Flyover',
      description: '3D hole visualization',
      icon: Target,
      path: '/play/flyover',
      tier: 'free',
    },
    {
      id: 'foursome',
      title: 'Foursome Finder',
      description: 'Find and join playing partners',
      icon: Users,
      path: '/play/foursome',
      tier: 'clover',
      badge: 'CLOVER',
    },
    {
      id: 'caddie',
      title: 'Personal Caddie',
      description: 'AI-powered shot recommendations',
      icon: MessageSquare,
      path: '/play/caddie',
      tier: 'gold',
      badge: 'GOLD',
    },
  ];

  return (
    <div className="min-h-screen pb-20 bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">Play</h1>
          <p className="text-sm text-muted-foreground">Your on-course companion</p>
        </div>

        {/* Active Round Alert */}
        {hasActiveRound ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 bg-primary/10 border-primary/20"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Play className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Round in Progress</p>
                <p className="text-sm text-muted-foreground">Pebble Beach - Hole 7</p>
              </div>
            </div>
            <Button className="w-full" size="lg" onClick={() => navigate('/play/round')}>
              Resume Round
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6"
          >
            <h2 className="font-display font-bold mb-4">Start a New Round</h2>
            <Button className="w-full" size="lg" onClick={() => navigate('/play/start')}>
              <Play className="w-5 h-5 mr-2" />
              Start Round
            </Button>
          </motion.div>
        )}

        {/* Feature Grid */}
        <div className="grid grid-cols-2 gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-4 flex flex-col items-start gap-3 cursor-pointer hover:border-primary/50 transition-all hover:scale-105"
                onClick={() => navigate(feature.path)}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold">{feature.title}</p>
                    {feature.badge && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-bold">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Recent Rounds — Empty State */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6"
        >
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
