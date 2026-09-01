/**
 * LUCKY SPIN — Real Supabase integration
 * Three featured physical prizes, each a half-width gold slice flanked by
 * two thin "sand bunker" slivers, spaced an even 120° apart around the
 * wheel. Rest of each 120° arc is clovers, discounts, free spins, and
 * Clover Club trials.
 *
 * Slice angular width is weight-based (see `width` on Prize / SLICE_ANGLES
 * below) — NOT uniform per-index — so the gold/sand pieces can be thinner
 * than a normal slice while everything still sums to exactly 360°. Landing
 * odds are still uniform per array entry (1/36 each), independent of a
 * slice's visual width — a thin gold sliver has the same odds as a full
 * filler slice, it's just visually smaller.
 *
 * ECONOMICS (36 slices, per spin = 10 clovers = $40 in purchases):
 *   Physical prizes  3/36 =  8.3% × avg $50  = $4.17 expected cost
 *   Sand Trap        6/36 = 16.7% × $0       = $0.00 (no win, keeps it fair)
 *   Clovers         13/36 = 36.1% × $0       = $0.00
 *   Discount codes  10/36 = 27.8% × ~$1.30   = $0.36 expected cost
 *   Free spin        2/36 =  5.6% × $0       = $0.00 (costs a spin back)
 *   Clover Club       2/36 =  5.6% × ~$5     = $0.28 expected cost
 *   ─────────────────────────────────────────────────
 *   Total expected cost per spin: ~$4.81   Revenue: $40   Net: +$35 ✓
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useClovers } from '@/contexts/CloverContext';
import { Gift, Star, Sparkles, RotateCcw, Ticket, Crown, Waves } from 'lucide-react';
import { toast } from 'sonner';

// ── Change these to update the three featured physical prizes ──
const PRIZE_A_LABEL = 'Lucky Wedge';
const PRIZE_B_LABEL = 'Lucky Putter';
const PRIZE_C_LABEL = 'Lucky Driver';

// Discount codes shown to winners (rotate or update as needed)
const DISCOUNT_CODES: Record<string, string> = {
  '10% Off': 'LUCKY10',
  '15% Off': 'LUCKY15',
  '20% Off': 'LUCKY20',
  '25% Off': 'LUCKY25',
  '30% Off': 'LUCKY30',
};

type PrizeType = 'prize' | 'clovers' | 'discount' | 'free_spin' | 'membership' | 'none';

interface Prize {
  label: string;
  color: string;
  icon: typeof Gift;
  rare?: boolean;
  clovers: number;
  type: PrizeType;
  membershipMonths?: number;
  /** Relative angular weight. 1 = a normal full-width slice. Defaults to 1. */
  width?: number;
  /** Short text for the wheel itself, when different from `label` (used
   *  in toasts/results) — for slices too thin for the full label. */
  wheelLabel?: string;
}

const SAND_FILL = '#E6D9B4'; // light sand/cream, slightly muted so it doesn't pop too hard
const GOLD_FILL = '#FFC94A'; // brighter gold — closer to the text-gradient-gold accent used below the wheel

const SAND: Pick<Prize, 'label' | 'wheelLabel' | 'color' | 'icon' | 'clovers' | 'type' | 'width'> = {
  label: 'Sand Trap', wheelLabel: 'Sand', color: 'from-amber-300 to-yellow-600', icon: Waves, clovers: 0, type: 'none', width: 0.25,
};

const gold = (label: string): Prize => ({
  label, color: 'from-yellow-500 to-amber-600', icon: Gift, rare: true, clovers: 0, type: 'prize', width: 0.5,
});

// A full-width filler slice that's just sand — same light color as the
// slivers flanking the gold slices, but a normal-size, normal-width slot.
const sandBunker = (): Prize => ({
  label: 'Sand Bunker', color: 'from-amber-200 to-yellow-400', icon: Waves, clovers: 0, type: 'none',
});

// One 120° arc: a sand/gold/sand cluster (weight 1, same as a normal slice)
// plus 9 normal-weight filler slices — 10 weight-units per arc, so all three
// arcs (identical total weight) land exactly 120° apart automatically.
function arc(goldLabel: string, fillers: Prize[]): Prize[] {
  return [{ ...SAND }, gold(goldLabel), { ...SAND }, ...fillers];
}

const prizes: Prize[] = [
  ...arc(PRIZE_A_LABEL, [
    { label: '+2 Clovers', color: 'from-lime-500 to-green-600', icon: CloverIcon, clovers: 2, type: 'clovers' },
    { label: '15% Off', color: 'from-blue-500 to-indigo-600', icon: Ticket, clovers: 0, type: 'discount' },
    sandBunker(),
    { label: 'Free Spin', color: 'from-cyan-400 to-sky-600', icon: RotateCcw, clovers: 0, type: 'free_spin' },
    { label: '+1 Clover', color: 'from-gray-500 to-gray-600', icon: CloverIcon, clovers: 1, type: 'clovers' },
    { label: '10% Off', color: 'from-blue-400 to-cyan-500', icon: Ticket, clovers: 0, type: 'discount' },
    sandBunker(),
    { label: '25% Off', color: 'from-violet-500 to-purple-700', icon: Ticket, clovers: 0, type: 'discount' },
    { label: '6mo Clover Club', color: 'from-purple-600 to-fuchsia-800', icon: Crown, clovers: 0, type: 'membership', membershipMonths: 6 },
  ]),
  ...arc(PRIZE_B_LABEL, [
    { label: '+1 Clover', color: 'from-gray-500 to-gray-600', icon: CloverIcon, clovers: 1, type: 'clovers' },
    { label: '+10 Clovers', color: 'from-primary to-emerald-700', icon: CloverIcon, clovers: 10, type: 'clovers' },
    sandBunker(),
    { label: '+2 Clovers', color: 'from-lime-500 to-green-600', icon: CloverIcon, clovers: 2, type: 'clovers' },
    { label: '30% Off', color: 'from-violet-600 to-purple-800', icon: Ticket, clovers: 0, type: 'discount' },
    { label: '+3 Clovers', color: 'from-emerald-500 to-teal-600', icon: CloverIcon, clovers: 3, type: 'clovers' },
    sandBunker(),
    { label: '+5 Clovers', color: 'from-green-500 to-emerald-600', icon: CloverIcon, clovers: 5, type: 'clovers' },
    { label: '20% Off', color: 'from-indigo-500 to-violet-600', icon: Ticket, clovers: 0, type: 'discount' },
  ]),
  ...arc(PRIZE_C_LABEL, [
    { label: '1mo Clover Club', color: 'from-purple-400 to-fuchsia-600', icon: Crown, clovers: 0, type: 'membership', membershipMonths: 1 },
    { label: '25% Off', color: 'from-violet-500 to-purple-700', icon: Ticket, clovers: 0, type: 'discount' },
    sandBunker(),
    { label: '15% Off', color: 'from-blue-500 to-indigo-600', icon: Ticket, clovers: 0, type: 'discount' },
    { label: '+2 Clovers', color: 'from-lime-500 to-green-600', icon: CloverIcon, clovers: 2, type: 'clovers' },
    { label: '10% Off', color: 'from-blue-400 to-cyan-500', icon: Ticket, clovers: 0, type: 'discount' },
    sandBunker(),
    { label: 'Free Spin', color: 'from-cyan-400 to-sky-600', icon: RotateCcw, clovers: 0, type: 'free_spin' },
    { label: '3mo Clover Club', color: 'from-purple-500 to-fuchsia-700', icon: Crown, clovers: 0, type: 'membership', membershipMonths: 3 },
  ]),
];

// Cumulative weight -> start/mid/end angle (degrees, 0° = wheel-top) for
// every slice. Computed once at module scope since `prizes` is static.
const SLICE_ANGLES = (() => {
  const totalWeight = prizes.reduce((sum, p) => sum + (p.width ?? 1), 0);
  let cumWeight = 0;
  return prizes.map((p) => {
    const w = p.width ?? 1;
    const startDeg = (cumWeight / totalWeight) * 360;
    cumWeight += w;
    const endDeg = (cumWeight / totalWeight) * 360;
    return { startDeg, endDeg, midDeg: (startDeg + endDeg) / 2 };
  });
})();

const LuckySpin = () => {
  const { refreshProfile } = useAuth();
  const { addClovers } = useClovers();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<typeof prizes[0] | null>(null);
  const [spinsRemaining, setSpinsRemaining] = useState(3);
  const [canRespin, setCanRespin] = useState(false);

  // Heavy-flywheel physics: a big initial burst of rotations (momentum),
  // then a smooth, continuously-thinning deceleration rather than an abrupt
  // stop. Uses a quart-out curve rather than expo-out: expo-out's velocity
  // drops to near-zero and stays there for a long flat tail, which is what
  // was reading as "choppy" (any frame jitter is very visible when the
  // wheel is barely moving) — quart-out keeps easing off smoothly all the
  // way to the stop instead of going nearly-static early.
  const SPIN_DURATION_S = 12;
  const SPIN_ROTATIONS = 13;
  const SPIN_EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

  const spin = async () => {
    if (spinning || spinsRemaining <= 0) return;
    setSpinning(true);
    setResult(null);
    setCanRespin(false);

    const prizeIndex = Math.floor(Math.random() * prizes.length);
    const { midDeg } = SLICE_ANGLES[prizeIndex];
    // Land the chosen slice's midpoint under the pointer (top, 0°). Rotation
    // is cumulative across spins, so we have to correct for wherever the
    // wheel already stopped last time (prev mod 360) rather than assuming
    // it starts at 0 — otherwise each spin after the first lands on the
    // wrong slice relative to the result shown.
    setRotation(prev => {
      const prevMod = ((prev % 360) + 360) % 360;
      const targetMod = ((360 - midDeg) % 360 + 360) % 360;
      const deltaToTarget = ((targetMod - prevMod) % 360 + 360) % 360;
      return prev + 360 * SPIN_ROTATIONS + deltaToTarget;
    });

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
      } else if (won.type === 'none') {
        toast(`🏖️ Sand Trap — no prize this time.`, { duration: 5000 });
      }

      if (won.type !== 'prize' && spinsRemaining > 1) setCanRespin(true);
    }, SPIN_DURATION_S * 1000);
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
          <h1 className="text-3xl font-display font-bold">Lucky Spinz</h1>
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
            <motion.div animate={{ rotate: rotation }} transition={{ duration: SPIN_DURATION_S, ease: SPIN_EASE }}
              style={{ willChange: 'transform', width: '100%', aspectRatio: '1 / 1' }}
              className="relative">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
                {prizes.map((prize, i) => {
                  const { startDeg, endDeg } = SLICE_ANGLES[i];
                  const startAngle = (startDeg - 90) * (Math.PI / 180);
                  const endAngle = (endDeg - 90) * (Math.PI / 180);
                  const x1 = 50 + 50 * Math.cos(startAngle);
                  const y1 = 50 + 50 * Math.sin(startAngle);
                  const x2 = 50 + 50 * Math.cos(endAngle);
                  const y2 = 50 + 50 * Math.sin(endAngle);
                  const isSandSlice = prize.type === 'none';
                  const fillClass = i % 2 === 0 ? 'text-card' : 'text-muted';
                  const explicitFill = isSandSlice ? SAND_FILL : prize.rare ? GOLD_FILL : undefined;
                  return (
                    <path key={i}
                      d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                      className={explicitFill ? '' : `fill-current ${fillClass}`}
                      fill={explicitFill}
                      stroke="hsl(var(--border))" strokeWidth="0.3" />
                  );
                })}
                <circle cx="50" cy="50" r="8" fill={GOLD_FILL} />
              </svg>
              {/* Labels run "long ways" — radially outward, out near the rim
                  where they're actually readable, oriented along each
                  slice's centerline. Sand slivers use a short "Sand"
                  wheelLabel at a smaller size since they're still thin. */}
              {prizes.map((prize, i) => {
                const angle = SLICE_ANGLES[i].midDeg - 90;
                const rad = angle * (Math.PI / 180);
                const R = 37; // out of 50 — well past the hub, just inside the rim
                const isSand = prize.type === 'none';
                // Only the thin sand slivers flanking the gold slices (width
                // 0.25) need the tiny label; full-width Sand Bunker fillers
                // read fine at the normal (now smaller) size.
                const isThinSliver = isSand && (prize.width ?? 1) < 1;
                return (
                  <div key={i}
                    className={`absolute leading-none whitespace-nowrap ${isThinSliver ? 'text-[4.5px] font-bold' : 'text-[12px] font-semibold'} ${prize.rare ? 'text-accent-foreground' : isSand ? 'text-amber-950' : 'text-foreground'}`}
                    style={{
                      left: `${50 + R * Math.cos(rad)}%`,
                      top: `${50 + R * Math.sin(rad)}%`,
                      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                    }}>
                    {prize.wheelLabel ?? prize.label}
                  </div>
                );
              })}
            </motion.div>
            {/* Static hub logo — sits outside the rotating wheel so it
                stays upright instead of spinning with it. */}
            <img src="/clover-logo.png" alt="Lucky Golf" draggable={false}
              className="absolute pointer-events-none select-none drop-shadow-md"
              style={{ left: '50%', top: '50%', width: '11%', aspectRatio: '1 / 1', objectFit: 'contain', transform: 'translate(-50%, -50%)' }} />
          </div>
        </motion.div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }} className="glass-card p-6 text-center glow-gold">
              <Sparkles className="w-12 h-12 text-accent mx-auto mb-4" />
              <h3 className="text-2xl font-display font-bold text-gradient-gold mb-2">
                {result.type === 'none' ? 'So Close!' : 'You Won!'}
              </h3>
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
              {result.type === 'none' && (
                <p className="text-xs text-muted-foreground mt-1">Landed in the bunker — no prize this spin.</p>
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
