/**
 * HOME — Dashboard pulling real user data from golfer_profiles
 */

import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { getRecentTransactions } from '@/services/cloverService';
import { SpendClover } from '@/components/icons/SpendClover';
import { useHomeClovers } from '@/features/homeClovers/useHomeClovers';
import { checkoutLink, useMyDiscount } from '@/features/discounts/useMyDiscount';
import { GoldCoinIcon } from '@/components/icons/GoldCoinIcon';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Trophy, Target, Gift, ShoppingBag, Sparkles, TrendingUp,
  Play, MessageCircle, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const quickActions = [
  { icon: Trophy, label: 'Scorecard', path: '/play/scorecard', color: 'bg-primary/80 text-primary-foreground hover:bg-primary/90' },
  { icon: Target, label: 'Rangefinder', path: '/play/rangefinder', color: 'bg-primary/80 text-primary-foreground hover:bg-primary/90' },
  { icon: Gift, label: 'Spinz', path: '/earn/spin', color: 'bg-primary/80 text-primary-foreground hover:bg-primary/90' },
  { icon: ShoppingBag, label: 'Shop', path: '/earn/shop', color: 'bg-primary/80 text-primary-foreground hover:bg-primary/90' },
];

export default function HomeScreen() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Golfer';
  // New clovers are held back and revealed here (leaf by leaf) when the page is viewed.
  const reveal = useHomeClovers();
  const { discount, shopConnected } = useMyDiscount();
  const clovers = reveal.ready ? reveal.count : (profile?.clovers ?? 0);
  const totalClovers = profile?.total_clovers ?? 0;
  const handicap = profile?.handicap_index ?? 0;
  const luckyLevel = profile?.lucky_level ?? 1;
  // Placeholder (matches local build) until a weekly clover ledger exists.
  const cloversThisWeek = reveal.week ?? 3;
  const goldBalance = (profile as any)?.gold_balance ?? 0;

  const [activity, setActivity] = useState<any[]>([]);
  useEffect(() => {
    getRecentTransactions(5).then(setActivity);
  }, []);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Welcome, {displayName}</h1>
            <p className="text-muted-foreground text-sm">
              {handicap > 0 ? `HCP ${handicap} · ` : ''}Level {luckyLevel}
            </p>
          </div>
        </motion.div>

        {/* Clover Balance */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden glass-card p-5 glow-green">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-shrink-0">
              <p className="text-lg font-semibold text-muted-foreground mb-2">Your Clovers</p>
              <div className="flex items-center gap-4">
                <SpendClover className="w-[76px] h-[76px]" litLeaves={reveal.lit} earnedPulse={reveal.pulse} />
                <span className={`${String(clovers).length >= 4 ? 'text-[41px] leading-none' : 'text-[51px] leading-none'} font-display font-bold text-gradient-green -ml-3`} style={{ visibility: reveal.ready ? 'visible' : 'hidden' }} data-testid="home-clovers">{clovers}</span>
              </div>
              <div className="flex items-center gap-2 mt-3 text-lg font-medium text-primary">
                <Sparkles className="w-5 h-5" />
                <span data-testid="home-week">+{cloversThisWeek} this week</span>
              </div>
              {totalClovers > clovers && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span>{totalClovers} lifetime earned</span>
                </div>
              )}
              {clovers === 0 && totalClovers === 0 && (
                <p className="text-xs text-muted-foreground mt-3">Play rounds and shop to earn clovers</p>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-1 max-w-[140px]">
              <Link to="/earn/raffle" className="block">
                <motion.div whileHover={{ scale: 1.02 }}
                  className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 transition-colors hover:bg-accent/20">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-accent" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Weekly Raffle</span>
                  </div>
                  <p className="text-sm font-bold text-accent mt-0.5">Enter Now</p>
                </motion.div>
              </Link>
              <Link to="/play/start" className="block">
                <motion.div whileHover={{ scale: 1.02 }}
                  className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 transition-colors hover:bg-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs text-foreground">Start Round</span>
                    </div>
                    <Play className="w-3 h-3 text-primary" />
                  </div>
                </motion.div>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <motion.div key={action.path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}>
              <Link to={action.path}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 relative ${action.color}`}>
                <action.icon className="w-8 h-8" />
                <span className="text-[10px] font-medium text-center leading-tight">{action.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* The player's current Spinz discount (only once the store is connected and a code exists) */}
        {shopConnected && discount?.code && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 border-accent/30 flex items-center justify-between gap-3" data-testid="home-discount">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-accent">Your discount</p>
              <p className="font-display font-bold text-lg">{discount.percent}% off</p>
              <p className="text-xs text-muted-foreground">
                Code <span className="font-mono font-bold text-foreground">{discount.code}</span> · until {new Date(discount.expiresAt).toLocaleDateString()}
              </p>
            </div>
            {checkoutLink(discount.code) && (
              <a href={checkoutLink(discount.code)!} target="_blank" rel="noreferrer">
                <Button size="sm">Use it</Button>
              </a>
            )}
          </motion.div>
        )}

        {/* Wagers CTA */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/play/wagers')}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="flex-1">
              <p className="font-display font-bold">Lucky Wagers</p>
              <p className="text-xs text-muted-foreground">Challenge your friends in real-time</p>
            </div>
            <Button size="sm">Play</Button>
          </div>
        </motion.div>

        {/* Activity — From Supabase transactions */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card p-5">
          <h3 className="font-display font-semibold text-lg mb-3">Activity</h3>
          {activity.length === 0 ? (
            <div className="text-center py-6">
              <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Play a round or spin the wheel to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((txn: any, i: number) => (
                <div key={txn.id || i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      {txn.type === 'winnings' ? <Trophy className="w-4 h-4 text-primary" /> : <Target className="w-4 h-4 text-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{txn.description || txn.type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(txn.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${txn.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {txn.amount > 0 ? '+' : ''}{txn.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
