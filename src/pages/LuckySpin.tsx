/**
 * LUCKY SPIN — Real Supabase integration
 * Wins update golfer_profiles clovers. No fake winners.
 * Wheel is net-positive at $7/spin: non-clover prizes only land every 4-7 spins.
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useClovers } from '@/contexts/CloverContext';
import { Gift, Star, Sparkles, RotateCcw, Shirt, Clock, Ticket } from 'lucide-react';
import { toast } from 'sonner';

const prizes = [
  { label: 'Tees', color: 'from-primary to-lucky-emerald', icon: Clock, rare: true, clovers: 0 },
  { label: '50% Off', color: 'from-accent to-amber-600', icon: Ticket, clovers: 0 },
  { label: '+5 Clovers', color: 'from-green-500 to-emerald-600', icon: CloverIcon, clovers: 5 },
  { label: 'Polo Shirt', color: 'from-blue-600 to-indigo-600', icon: Shirt, rare: true, clovers: 0 },
  { label: '25% Off', color: 'from-blue-500 to-cyan-500', icon: Ticket, clovers: 0 },
  { label: '+10 Clovers', color: 'from-primary to-lucky-green-light', icon: CloverIcon, clovers: 10 },
  { label: 'Putter', color: 'from-slate-500 to-zinc-600', icon: Gift, rare: true, clovers: 0 },
  { label: '+1 Clover', color: 'from-gray-500 to-gray-600', icon: CloverIcon, clovers: 1 },
  { label: 'Free Hat', color: 'from-purple-500 to-pink-500', icon: Gift, clovers: 0 },
  { label: 'Wedge', color: 'from-orange-500 to-amber-600', icon: Gift, rare: true, clovers: 0 },
  { label: 'Golf Balls', color: 'from-orange-500 to-red-500', icon: Gift, clovers: 0 },
  { label: '+3 Clovers', color: 'from-emerald-500 to-teal-600', icon: CloverIcon, clovers: 3 },
  { label: 'Driver', color: 'from-violet-600 to-purple-700', icon: Gift, rare: true, clovers: 0 },
  { label: '15% Off', color: 'from-teal-500 to-cyan-600', icon: Ticket, clovers: 0 },
  { label: 'Glove', color: 'from-rose-500 to-pink-600', icon: Gift, clovers: 0 },
  { label: '+2 Clovers', color: 'from-lime-500 to-green-600', icon: CloverIcon, clovers: 2 },
];

// Net-positive tuning. Clover wins are biased small; non-clover prizes are gated
// to once per 4-7 spins and weighted toward the cheapest items.
const CLOVER_WEIGHTS: Record<string, number> = { '+1 Clover': 40, '+2 Clovers': 28, '+3 Clovers': 20, '+5 Clovers': 9, '+10 Clovers': 3 };
const PRIZE_WEIGHTS: Record<string, number> = { '15% Off': 22, '25% Off': 16, '50% Off': 6, 'Golf Balls': 12, 'Tees': 12, 'Glove': 10, 'Free Hat': 9, 'Polo Shirt': 5, 'Wedge': 4, 'Putter': 3, 'Driver': 1 };
const CLOVER_IDX = prizes.map((p, i) => ({ p, i })).filter(x => x.p.clovers > 0).map(x => x.i);
const PRIZE_IDX = prizes.map((p, i) => ({ p, i })).filter(x => x.p.clovers === 0).map(x => x.i);

const weightedPick = (idx: number[], weights: Record<string, number>) => {
  const entries = idx.map(i => ({ i, w: weights[prizes[i].label] ?? 1 }));
  const total = entries.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of entries) { r -= e.w; if (r <= 0) return e.i; }
  return entries[entries.length - 1].i;
};

const LuckySpin = () => {
  const { refreshProfile } = useAuth();
  const { addClovers } = useClovers();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<typeof prizes[0] | null>(null);
  const [spinsRemaining, setSpinsRemaining] = useState(3);
  const [canRespin, setCanRespin] = useState(false);

  // Spins since last non-clover prize, and the (4-7) threshold for the next one.
  const sinceRewardRef = useRef(0);
  const nextRewardRef = useRef(4 + Math.floor(Math.random() * 4));

  const spin = async () => {
    if (spinning || spinsRemaining <= 0) return;
    setSpinning(true);
    setResult(null);
    setCanRespin(false);

    // Decide the winning segment FIRST, then rotate the wheel to it.
    sinceRewardRef.current += 1;
    let prizeIndex: number;
    if (sinceRewardRef.current >= nextRewardRef.current) {
      sinceRewardRef.current = 0;
      nextRewardRef.current = 4 + Math.floor(Math.random() * 4); // next prize in 4-7 spins
      prizeIndex = weightedPick(PRIZE_IDX, PRIZE_WEIGHTS);
    } else {
      prizeIndex = weightedPick(CLOVER_IDX, CLOVER_WEIGHTS);
    }

    // Align final rotation so the chosen segment stops under the pointer,
    // regardless of the wheel's current angle (this is what was drifting before).
    const segmentAngle = 360 / prizes.length;
    const targetAngle = (((360 - prizeIndex * segmentAngle - segmentAngle / 2) % 360) + 360) % 360;
    setRotation(prev => {
      const cur = ((prev % 360) + 360) % 360;
      const delta = (((targetAngle - cur) % 360) + 360) % 360;
      return prev + 360 * 5 + delta;
    });

    setTimeout(async () => {
      const won = prizes[prizeIndex];
      setSpinning(false);
      setResult(won);
      setSpinsRemaining(prev => prev - 1);

      if (won.clovers > 0) {
        await addClovers(won.clovers, `Lucky Spin: ${won.label}`);
        await refreshProfile();
        toast.success(`+${won.clovers} clovers added to your balance!`);
      }

      if (!won.rare && spinsRemaining > 1) setCanRespin(true);
    }, 4000);
  };

  const respin = () => {
    if (!canRespin || spinsRemaining <= 0) return;
    setCanRespin(false);
    setResult(null);
    spin();
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-3xl font-display font-bold">Lucky Tees</h1>
          <p className="text-muted-foreground">Spin for discounted tees & prizes!</p>
        </motion.div>

        {/* Wheel */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="relative flex items-center justify-center py-6">
          <div className="absolute w-[26rem] h-[26rem] bg-gradient-to-r from-primary via-accent to-primary rounded-full blur-3xl opacity-30 animate-pulse" />
          <div className="relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
              <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-t-[30px] border-l-transparent border-r-transparent border-t-accent drop-shadow-lg" />
            </div>
            <motion.div animate={{ rotate: rotation }} transition={{ duration: 4, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative w-96 h-96">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
                {prizes.map((prize, i) => {
                  const angle = (360 / prizes.length) * i;
                  const startAngle = (angle - 90) * (Math.PI / 180);
                  const endAngle = (angle + 360 / prizes.length - 90) * (Math.PI / 180);
                  const x1 = 50 + 50 * Math.cos(startAngle);
                  const y1 = 50 + 50 * Math.sin(startAngle);
                  const x2 = 50 + 50 * Math.cos(endAngle);
                  const y2 = 50 + 50 * Math.sin(endAngle);
                  return (
                    <path key={i}
                      d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                      className={`fill-current ${prize.rare ? 'text-accent/80' : i % 2 === 0 ? 'text-card' : 'text-muted'}`}
                      stroke="hsl(var(--border))" strokeWidth="0.3" />
                  );
                })}
                <circle cx="50" cy="50" r="10" className="fill-primary" />
                <circle cx="50" cy="50" r="6" className="fill-background" />
              </svg>
              {prizes.map((prize, i) => {
                const angle = (360 / prizes.length) * i + 360 / prizes.length / 2 - 90;
                const rad = angle * (Math.PI / 180);
                return (
                  <div key={i}
                    className={`absolute text-[8px] font-bold ${prize.rare ? 'text-accent-foreground' : 'text-foreground'}`}
                    style={{ left: `${50 + 35 * Math.cos(rad)}%`, top: `${50 + 35 * Math.sin(rad)}%`, transform: `translate(-50%, -50%) rotate(${angle + 90}deg)` }}>
                    {prize.label}
                  </div>
                );
              })}
            </motion.div>
          </div>
        </motion.div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }} className="glass-card p-6 text-center glow-gold">
              <Sparkles className="w-12 h-12 text-accent mx-auto mb-4" />
              <h3 className="text-2xl font-display font-bold text-gradient-gold mb-2">You Won!</h3>
              <p className="text-xl font-semibold">{result.label}</p>
              {result.clovers > 0 && (
                <p className="text-sm text-primary mt-1 font-bold">+{result.clovers} clovers added to your balance</p>
              )}
              {result.rare && (
                <div className="flex items-center justify-center gap-1 mt-2 text-accent">
                  <Star className="w-4 h-4" /><span className="text-sm font-medium">RARE PRIZE!</span>
                </div>
              )}
              {canRespin && spinsRemaining > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-3">Not happy? Use a spin to try again!</p>
                  <Button variant="outline" size="sm" onClick={respin} className="gap-2">
                    <RotateCcw className="w-4 h-4" /> Re-spin ({spinsRemaining} left)
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Spin Button */}
        <Button variant="gold" size="xl" className="w-full" onClick={spin}
          disabled={spinning || spinsRemaining <= 0} data-testid="spin-btn">
          {spinning ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <CloverIcon className="w-6 h-6" />
            </motion.div>
          ) : (<><Gift className="w-6 h-6" /> Spin for $7</>)}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {spinsRemaining > 0 ? `${spinsRemaining} spin${spinsRemaining > 1 ? 's' : ''} available!` : 'Purchase more spins to continue'}
        </p>

        {/* No fake Recent Winners — show empty state */}
        <div className="glass-card p-5">
          <h3 className="font-display font-semibold text-lg mb-3">Recent Winners</h3>
          <div className="text-center py-4">
            <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No recent wins to show</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Be the first to spin and win!</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default LuckySpin;
