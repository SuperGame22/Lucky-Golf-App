/**
 * LUCKY SPIN — Real Supabase integration
 * Two physical "Featured Prize" slots (opposite each other on the wheel).
 * Rest are clovers, discount codes, free spins, and Clover Club trials.
 * Change PRIZE_A_LABEL / PRIZE_B_LABEL to update the featured prizes anytime.
 *
 * ECONOMICS (per spin = 10 clovers = $40 in purchases):
 *   Physical prizes  2/32 =  6.25% × avg $50 = $3.13 expected cost
 *   Discount codes  12/32 = 37.50% × ~$1.30  = $0.49 expected cost
 *   Clovers         14/32 = 43.75% × $0      = $0.00
 *   Free spin        2/32 =  6.25% × $0      = $0.00 (costs a spin back)
 *   Clover Club       2/32 =  6.25% × ~$5    = $0.31 expected cost
 *   ─────────────────────────────────────────────────
 *   Total expected cost per spin: ~$3.93   Revenue: $40   Net: +$36 ✓
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useClovers } from '@/contexts/CloverContext';
import { Gift, Star, Sparkles, RotateCcw, Ticket, Crown } from 'lucide-react';
import { toast } from 'sonner';

// ── Change these to update the two featured physical prizes ──
const PRIZE_A_LABEL = 'Lucky Wedge';
const PRIZE_B_LABEL = 'Lucky Putter';

// Discount codes shown to winners (rotate or update as needed)
const DISCOUNT_CODES: Record<string, string> = {
  '10% Off': 'LUCKY10',
  '15% Off': 'LUCKY15',
  '20% Off': 'LUCKY20',
  '25% Off': 'LUCKY25',
  '30% Off': 'LUCKY30',
};

type PrizeType = 'prize' | 'clovers' | 'discount' | 'free_spin' | 'membership';

interface Prize {
  label: string;
  color: string;
  icon: typeof Gift;
  rare?: boolean;
  clovers: number;
  type: PrizeType;
  membershipMonths?: number;
}

// 32 slices. The two featured items (index 0 and 16) sit directly opposite
// each other on the wheel. Everything else is deliberately interleaved so
// clovers and discounts don't clump together in one arc.
const prizes: Prize[] = [
  { label: PRIZE_A_LABEL, color: 'from-yellow-500 to-amber-600', icon: Gift, rare: true, clovers: 0, type: 'prize' },
  { label: '+2 Clovers', color: 'from-lime-500 to-green-600', icon: CloverIcon, clovers: 2, type: 'clovers' },
  { label: '15% Off', color: 'from-blue-500 to-indigo-600', icon: Ticket, clovers: 0, type: 'discount' },
  { label: '+5 Clovers', color: 'from-green-500 to-emerald-600', icon: CloverIcon, clovers: 5, type: 'clovers' },
  { label: 'Free Spin', color: 'from-cyan-400 to-sky-600', icon: RotateCcw, clovers: 0, type: 'free_spin' },
  { label: '20% Off', color: 'from-indigo-500 to-violet-600', icon: Ticket, clovers: 0, type: 'discount' },
  { label: '+1 Clover', color: 'from-gray-500 to-gray-600', icon: CloverIcon, clovers: 1, type: 'clovers' },
  { label: '10% Off', color: 'from-blue-400 to-cyan-500', icon: Ticket, clovers: 0, type: 'discount' },
  { label: '+7 Clovers', color: 'from-primary to-lucky-green-light', icon: CloverIcon, clovers: 7, type: 'clovers' },
  { label: '25% Off', color: 'from-violet-500 to-purple-700', icon: Ticket, clovers: 0, type: 'discount' },
  { label: '+3 Clovers', color: 'from-emerald-500 to-teal-600', icon: CloverIcon, clovers: 3, type: 'clovers' },
  { label: '1mo Clover Club', color: 'from-purple-400 to-fuchsia-600', icon: Crown, clovers: 0, type: 'membership', membershipMonths: 1 },
  { label: '+10 Clovers', color: 'from-primary to-emerald-700', icon: CloverIcon, clovers: 10, type: 'clovers' },
  { label: '15% Off', color: 'from-blue-500 to-indigo-600', icon: Ticket, clovers: 0, type: 'discount' },
  { label: '+2 Clovers', color: 'from-lime-500 to-green-600', icon: CloverIcon, clovers: 2, type: 'clovers' },
  { label: '30% Off', color: 'from-violet-600 to-purple-800', icon: Ticket, clovers: 0, type: 'discount' },
  { label: PRIZE_B_LABEL, color: 'from-yellow-500 to-amber-600', icon: Gift, rare: true, clovers: 0, type: 'prize' },
  { label: '+3 Clovers', color: 'from-emerald-500 to-teal-600', icon: CloverIcon, clovers: 3, type: 'clovers' },
  { label: '10% Off', color: 'from-blue-400 to-cyan-500', icon: Ticket, clovers: 0, type: 'discount' },
  { label: '+5 Clovers', color: 'from-green-500 to-emerald-600', icon: CloverIcon, clovers: 5, type: 'clovers' },
  { label: '3mo Clover Club', color: 'from-purple-500 to-fuchsia-700', icon: Crown, clovers: 0, type: 'membership', membershipMonths: 3 },
  { label: '20% Off', color: 'from-indigo-500 to-violet-600', icon: Ticket, clovers: 0, type: 'discount' },
  { label: '+1 Clover', color: 'from-gray-500 to-gray-600', icon: CloverIcon, clovers: 1, type: 'clovers' },
  { label: '25% Off', color: 'from-violet-500 to-purple-700', icon: Ticket, clovers: 0, type: 'discount' },
  { label: '+20 Clovers', color: 'from-primary to-emerald-800', icon: CloverIcon, clovers: 20, type: 'clovers' },
  { label: '15% Off', color: 'from-blue-500 to-indigo-600', icon: Ticket, clovers: 0, type: 'discount' },
  { label: '+2 Clovers', color: 'from-lime-500 to-green-600', icon: CloverIcon, clovers: 2, type: 'clovers' },
  { label: '10% Off', color: 'from-blue-400 to-cyan-500', icon: Ticket, clovers: 0, type: 'discount' },
  { label: '+7 Clovers', color: 'from-primary to-lucky-green-light', icon: CloverIcon, clovers: 7, type: 'clovers' },
  { label: 'Free Spin', color: 'from-cyan-400 to-sky-600', icon: RotateCcw, clovers: 0, type: 'free_spin' },
  { label: '+1 Clover', color: 'from-gray-500 to-gray-600', icon: CloverIcon, clovers: 1, type: 'clovers' },
  { label: '30% Off', color: 'from-violet-600 to-purple-800', icon: Ticket, clovers: 0, type: 'discount' },
];

const LuckySpin = () => {
  const { refreshProfile } = useAuth();
  const { addClovers } = useClovers();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<typeof prizes[0] | null>(null);
  const [spinsRemaining, setSpinsRemaining] = useState(3);
  const [canRespin, setCanRespin] = useState(false);

  const spin = async () => {
    if (spinning || spinsRemaining <= 0) return;
    setSpinning(true);
    setResult(null);
    setCanRespin(false);

    const prizeIndex = Math.floor(Math.random() * prizes.length);
    const segmentAngle = 360 / prizes.length;
    const targetRotation = 360 * 5 + (360 - (prizeIndex * segmentAngle) - segmentAngle / 2);
    setRotation(prev => prev + targetRotation);

    setTimeout(async () => {
      const won = prizes[prizeIndex];
      setSpinning(false);
      setResult(won);
      setSpinsRemaining(prev => prev - 1);

      if (won.type === 'clovers' && won.clovers > 0) {
        await addClovers(won.clovers, `Lucky Spin: ${won.label}`);
        toast.success(`+${won.clovers} clovers added to your balance!`);
      } else if (won.type === 'discount') {
        const code = DISCOUNT_CODES[won.label] ?? 'LUCKY';
        toast.success(`Your code: ${code} — use at checkout!`, { duration: 8000 });
      } else if (won.type === 'prize') {
        toast.success(`🎉 You won the ${won.label}! We'll reach out to arrange delivery.`, { duration: 10000 });
      } else if (won.type === 'free_spin') {
        setSpinsRemaining(prev => prev + 1);
        toast.success(`🎁 Free spin! You've got another one on the house.`, { duration: 6000 });
      } else if (won.type === 'membership') {
        toast.success(`👑 ${won.label} unlocked! We'll activate it on your account.`, { duration: 10000 });
      }

      if (won.type !== 'prize' && spinsRemaining > 1) setCanRespin(true);
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
          <p className="text-muted-foreground">Spin for discounted tee times & prizes!</p>
        </motion.div>

        {/* Wheel */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="relative flex items-center justify-center py-4 overflow-hidden">
          <div className="absolute w-64 h-64 bg-gradient-to-r from-primary via-accent to-primary rounded-full blur-3xl opacity-20 animate-pulse pointer-events-none" />
          <div className="relative flex items-center justify-center w-full">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
              <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-t-[30px] border-l-transparent border-r-transparent border-t-accent drop-shadow-lg" />
            </div>
            <motion.div animate={{ rotate: rotation }} transition={{ duration: 4, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ willChange: 'transform', width: 'min(320px, calc(100vw - 3rem))', height: 'min(320px, calc(100vw - 3rem))' }}
              className="relative">
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
              {/* Labels run "long ways" — radially outward along each slice's
                  centerline, anchored near the hub and rotated to lie flat
                  along the spoke rather than tangent to the rim. */}
              {prizes.map((prize, i) => {
                const angle = (360 / prizes.length) * i + 360 / prizes.length / 2 - 90;
                return (
                  <div key={i}
                    className={`absolute text-[6.5px] font-bold leading-none whitespace-nowrap ${prize.rare ? 'text-accent-foreground' : 'text-foreground'}`}
                    style={{
                      left: '50%', top: '50%',
                      width: '42%',
                      transformOrigin: '0% 50%',
                      transform: `rotate(${angle}deg) translateX(14%) translateY(-50%)`,
                    }}>
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
              {result.type === 'clovers' && result.clovers > 0 && (
                <p className="text-sm text-primary mt-1 font-bold">+{result.clovers} clovers added to your balance</p>
              )}
              {result.type === 'discount' && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">Your discount code:</p>
                  <p className="text-lg font-mono font-black text-accent tracking-widest mt-1">{DISCOUNT_CODES[result.label] ?? 'LUCKY'}</p>
                  <p className="text-xs text-muted-foreground mt-1">Use at checkout · one-time use</p>
                </div>
              )}
              {result.type === 'prize' && (
                <div className="flex items-center justify-center gap-1 mt-3 flex-col">
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Star className="w-4 h-4" /><span className="text-sm font-black uppercase tracking-wider">Featured Prize!</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">We'll reach out to arrange delivery</p>
                </div>
              )}
              {result.type === 'free_spin' && (
                <p className="text-sm text-cyan-400 mt-1 font-bold">+1 spin added — go again!</p>
              )}
              {result.type === 'membership' && (
                <div className="flex items-center justify-center gap-1 mt-3 flex-col">
                  <div className="flex items-center gap-1 text-fuchsia-400">
                    <Crown className="w-4 h-4" /><span className="text-sm font-black uppercase tracking-wider">Clover Club</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">We'll activate this on your account</p>
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
          ) : (<><Gift className="w-6 h-6" /> Use a Spin</>)}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {spinsRemaining > 0 ? `${spinsRemaining} spin${spinsRemaining > 1 ? 's' : ''} available!` : 'Earn 10 clovers to unlock your next spin'}
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
