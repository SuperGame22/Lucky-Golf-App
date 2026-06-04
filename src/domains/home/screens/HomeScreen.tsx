import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trophy, Target, Gift, ShoppingBag, Sparkles, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

const quickActions = [
  { icon: Trophy, label: 'Scorecard', path: '/play/scorecard' },
  { icon: Target, label: 'Rangefinder', path: '/play/rangefinder' },
  { icon: Gift, label: 'Lucky Spin', path: '/earn/spin' },
  { icon: ShoppingBag, label: 'Shop', path: '/earn/shop' },
];

export default function HomeScreen() {
  const { profile, user } = useAuth();
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Golfer';
  const clovers = profile?.clovers ?? 0;
  const luckyLevel = profile?.lucky_level ?? 1;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold">Welcome, {displayName}</h1>
          <p className="text-sm text-muted-foreground">Level {luckyLevel}</p>
        </motion.div>

        {/* Clovers card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Your Clovers</p>
              <div className="flex items-center gap-3">
                <CloverIcon className="w-8 h-8 text-primary" />
                <span className="text-4xl font-black text-primary">{clovers}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Play rounds and shop to earn clovers</p>
            </div>
            <div className="space-y-2 text-right">
              <Link to="/earn/raffle">
                <div className="bg-accent/10 border border-accent/30 rounded-xl px-3 py-2 text-right cursor-pointer hover:bg-accent/20 transition-colors">
                  <p className="text-[10px] text-accent uppercase tracking-widest font-bold">Weekly Raffle</p>
                  <p className="text-sm font-black text-accent">Enter Now</p>
                </div>
              </Link>
              <Link to="/play/start">
                <div className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-primary/20 transition-colors">
                  <Play className="w-4 h-4 text-primary" />
                  <p className="text-sm font-bold text-primary">Start Round</p>
                </div>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.div key={action.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={action.path}>
                  <div className="glass-card p-4 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors cursor-pointer active:scale-95">
                    <div className="w-10 h-10 rounded-xl bg-primary/80 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-center">{action.label}</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Lucky Wagers */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Link to="/play/wagers">
            <div className="glass-card p-4 flex items-center justify-between hover:border-accent/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="font-bold">Lucky Wagers</p>
                  <p className="text-sm text-muted-foreground">Challenge your friends in real-time</p>
                </div>
              </div>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">Play</Button>
            </div>
          </Link>
        </motion.div>

        {/* Activity empty state */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
          <h3 className="font-display font-semibold mb-4">Activity</h3>
          <div className="text-center py-4">
            <Target className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Play a round or spin the wheel to get started</p>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
