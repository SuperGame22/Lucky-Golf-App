/**
 * HOME â€” Dashboard pulling real user data from golfer_profiles
 */

import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { getRecentTransactions } from '@/services/cloverService';
import { CloverIcon } from '@/components/icons/CloverIcon';
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
  { icon: Gift, label: 'Lucky Spin', path: '/earn/spin', color: 'bg-primary/80 text-primary-foreground hover:bg-primary/90' },
  { icon: ShoppingBag, label: 'Shop', path: '/earn/shop', color: 'bg-primary/80 text-primary-foreground hover:bg-primary/90' },
];

export default function HomeScreen() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Golfer';
  const clovers = profile?.clovers ?? 0;
  const totalClovers = profile?.total_clovers ?? 0;
  const handicap = profile?.handicap_index ?? 0;
  const luckyLevel = profile?.lucky_level ?? 1;
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
              {handicap > 0 ? `HCP ${handicap} Â· ` : ''}Level {luckyLevel}
            </p>
          </div>
        </motion.div>

        {/* Clover Balance */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden glass-card p-5 glow-green">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-shrink-0">
              <p className="text-lg font-semibold text-muted-foreground mb-2">Your Clovers</p>
              <div className="flex items-center gap-4">
                <CloverIcon className="w-12 h-14 text-primary animate-float" />
                <span className="text-7xl font-display font-black text-gradient-green">{clovers}</span>
              </div>
              {totalClovers > clovers && (
                <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
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
            <motion.div key={action.path} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}>
              <Link to={action.path}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 relative ${action.color}`}>
                <action.icon className="w-8 h-8" />
                <span className="text-xs font-medium">{action.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Wagers CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card p-5 cursor-pointer hover:border-primary/50 transition-colors"
        onCheck={{() => navigate('/play/wagers')}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-MLÌŒ›^][\ËXÙ[\ˆ\ÝYžKXÙ[\ˆ‚ˆÜ\šÛ\ÈÛ\ÜÓ˜[YOHËMˆMˆ^^Y[ÝËMLˆÏ‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH™›^LH‚ˆÛ\ÜÓ˜[YOH™›ÛY\Ü^H›ÛX›Û“XÚÞHØYÙ\œÏÜ‚ˆÛ\ÜÓ˜[YOH^^È^[]]YY›Ü™YÜ›Ý[™Ú[[™ÙH[Ý\ˆœšY[™È[ˆ™X[][YOÜ‚ˆÙ]‚ˆ]ÛˆÚ^™OHœÛH”^OÐ]Û‚ˆÙ]‚ˆÛ[Ý[Û‹™]‚‚ˆËÊˆXÝ]š]H8 %œ›ÛHÝ\X˜\ÙH˜[œØXÝ[ÛœÈ
‹ßBˆ[Ý[Û‹™]ˆ[š]X[^ÞÈÜXÚ]NˆNˆŒ_H[š[X]O^ÞÈÜXÚ]NˆKNˆ_H˜[œÚ][Û^ÞÈ[^Nˆ_BˆÛ\ÜÓ˜[YOH™Û\ÜËXØ\™MH‚ˆÈÛ\ÜÓ˜[YOH™›ÛY\Ü^H›Û\Ù[ZX›Û^[ÈX‹LÈXÝ]š]OÚÏ‚ˆØXÝ]š]K›[™ÝOOHÈ
ˆ]ˆÛ\ÜÓ˜[YOH^XÙ[\ˆKMˆ‚ˆ\™Ù]Û\ÜÓ˜[YOHËNN^[]]YY›Ü™YÜ›Ý[™Í^X]]ÈX‹LˆˆÏ‚ˆÛ\ÜÓ˜[YOH^\ÛH^[]]YY›Ü™YÜ›Ý[™“›È™XÙ[XÝ]š]OÜ‚ˆÛ\ÜÓ˜[YOH^^È^[]]YY›Ü™YÜ›Ý[™ÍŒ]LH”^HH›Ý[™ÜˆÜ[ˆHÚY[ÈÙ]Ý\YÜ‚ˆÙ]‚ˆ
Hˆ
ˆ]ˆÛ\ÜÓ˜[YOHœÜXÙK^KLÈ‚ˆØXÝ]š]K›X\

Žˆ[žKNˆ[X™\ŠHOˆ
ˆ]ˆÙ^O^Ý‹šY_HÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆ\ÝYžKX™]ÙY[ˆLˆ›Ý[™Y[ÈÝ™\Ž˜™Ë[]]YÍL˜[œÚ][Û‹XÛÛÜœÈ‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆØ\LÈ‚ˆ]ˆÛ\ÜÓ˜[YOHËNN™Ë\š[X\žKÌL›Ý[™YY[›^][\ËXÙ[\ˆ‚ˆÝ‹\HOOH	ÝÚ[›š[™ÜÉÈÈ›ÜHÛ\ÜÓ˜[YOHËMM^\š[X\žHˆÏˆˆ\™Ù]Û\ÜÓ˜[YOHËMM^\š[X\žHˆÏŸBˆÙ]‚ˆ]‚ˆÛ\ÜÓ˜[YOH^\ÛH›Û[YY][HžÝ‹™\ØÜš\[Ûˆ‹\_OÜ‚ˆÛ\ÜÓ˜[YOH^^È^[]]YY›Ü™YÜ›Ý[™žÛ™]È]J‹˜Ü™X]YØ]
KÓØØ[Q]TÝš[™Ê
_OÜ‚ˆÙ]‚ˆÙ]‚ˆÜ[ˆÛ\ÜÓ˜[YO^Ø^\ÛH›ÛX›Û	Ý‹˜[[Ý[ˆÈ	Ý^YÜ™Y[‹M	Èˆ	Ý^\™YM	ßXO‚ˆÝ‹˜[[Ý[ˆÈ	ÊÉÈˆ	Éß^Ý‹˜[[Ý[BˆÜÜ[‚ˆÙ]‚ˆ
J_BˆÙ]‚ˆ
_BˆÛ[Ý[Û‹™]‚ˆÙ]‚ˆÐ\^[Ý]‚ˆ
NÂŸB