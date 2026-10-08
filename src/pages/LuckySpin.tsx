/**
 * LUCKY SPIN — Real Supabase integration
 * Three featured physical prizes, each a gold slice flanked by two sand
 * slivers (together one normal slice wide, the gold being a quarter of it),
 * spaced an even 120° apart around the wheel. Rest of each 120° arc is
 * clovers, discounts, free spins, free putts and Clover Club trials.
 *
 * Prizes and slice geometry live in features/spinz (prizes.ts, wheel.ts).
 * Slice angular width is weight-based — NOT uniform per-index — so the
 * gold/sand pieces can be thinner than a normal slice while everything still
 * sums to exactly 360°. Landing odds are still uniform per array entry
 * (1/36 each), independent of a slice's visual width.
 *
 * ECONOMICS (36 slices, per spin = 10 clovers = $40 in purchases):
 *   Physical prizes  3/36 =  8.3% × avg $50  = $4.17 expected cost
 *   Sand Trap        6/36 = 16.7% × $0       = $0.00 (no win, keeps it fair)
 *   Clovers         13/36 = 36.1% × $0       = $0.00
 *   Discount codes  10/36 = 27.8% × ~$1.30   = $0.36 expected cost
 *   Free spin        2/36 =  5.6% × $0       = $0.00 (costs a spin back)
 *   Free putt        1/36 =  2.8% × $1       = $0.03 expected cost
 *   Clover Club       2/36 =  5.6% × ~$5     = $0.28 expected cost
 *   ─────────────────────────────────────────────────
 *   Total expected cost per spin: ~$4.84   Revenue: $40   Net: +$35 ✓
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { useAuth } from '@/contexts/AuthContext';
import { Gift, Star, Sparkles, RotateCcw, Crown, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  DISCOUNT_CODES, GOLD_FILL, LABEL_RADIUS, SAND_FILL, SLICE_ANGLES, prizes,
} from '@/features/spinz/prizes';
import { rotationToLand } from '@/features/spinz/wheel';

// consume_spin isn't in the generated Supabase types yet, so call it through a narrow signature.
// The database spends the spin, draws the prize and credits it (clovers, Free Putt, spin back);
// this page only animates the slice it is told about.
type ConsumeSpinRpc = (fn: 'consume_spin', args: { p_server_prize: boolean }) => PromiseLike<{ data: { success?: boolean; slice?: number } | null }>;

/** SVG path for a pie wedge from the hub to the rim, in degrees clockwise from the wheel top. */
const wedgePath = (startDeg: number, endDeg: number) => {
  const a1 = (startDeg - 90) * (Math.PI / 180);
  const a2 = (endDeg - 90) * (Math.PI / 180);
  return `M 50 50 L ${50 + 50 * Math.cos(a1)} ${50 + 50 * Math.sin(a1)} A 50 50 0 0 1 ${50 + 50 * Math.cos(a2)} ${50 + 50 * Math.sin(a2)} Z`;
};

const LuckySpin = () => {
  const { profile, refreshProfile } = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  // True for a moment after a spin so the wheel can be re-based to a small angle without animating.
  const [instant, setInstant] = useState(false);
  const finishRef = useRef<(() => void) | null>(null);
  const [result, setResult] = useState<typeof prizes[0] | null>(null);
  // Spinz are only won by sinking putts in Lucky Putts. The balance lives on the server
  // (profile.spins). While a spin is in flight the one being used is already taken off the
  // count, but the profile is only refreshed when the wheel stops so the result isn't given away.
  const spinsRemaining = Math.max((profile?.spins ?? 0) - (spinning ? 1 : 0), 0);
  const [canRespin, setCanRespin] = useState(false);

  // Pick up spins won since the profile was last loaded.
  useEffect(() => { refreshProfile(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    // The server spends one saved spin, draws the prize and credits it.
    let prizeIndex = -1;
    try {
      const { data } = await (supabase.rpc as unknown as ConsumeSpinRpc).call(supabase, 'consume_spin', { p_server_prize: true });
      if (data?.success && Number.isInteger(data.slice) && data.slice! >= 0 && data.slice! < prizes.length) prizeIndex = data.slice!;
    } catch { /* treated as no spin below */ }
    if (prizeIndex < 0) {
      setSpinning(false);
      toast.error('No spins available — sink a putt in Lucky Putts to win one.');
      refreshProfile();
      return;
    }

    const { midDeg } = SLICE_ANGLES[prizeIndex];
    // Land the chosen slice's midpoint under the pointer (top, 0°) — never on a
    // border, so the result always matches what the pointer shows. Rotation is
    // cumulative across spins, so rotationToLand corrects for wherever the
    // wheel already stopped last time.
    setInstant(false);
    setRotation(prev => rotationToLand(prev, midDeg, SPIN_ROTATIONS));

    // Everything that happens at the end (result card, toasts, balances) waits for the wheel to
    // actually stop (its transition ending), not a timer that can fire a little early on a phone
    // that was busy starting the spin, which showed up as a jolt in the last moment.
    let finished = false;
    const finish = async () => {
      if (finished) return;
      finished = true;
      finishRef.current = null;
      const won = prizes[prizeIndex];
      // Pick up the new balances (clovers, putts, spins) now that the wheel has stopped.
      await refreshProfile();
      setSpinning(false);
      setResult(won);

      if (won.type === 'clovers' && won.clovers > 0) {
        toast.success(`+${won.clovers} clovers added to your balance!`);
      } else if (won.type === 'discount') {
        const code = DISCOUNT_CODES[won.label] ?? 'LUCKY';
        toast.success(`Your code: ${code} — use at checkout!`, { duration: 8000 });
      } else if (won.type === 'prize') {
        toast.success(`🎉 You won the ${won.label}! We'll reach out to arrange delivery.`, { duration: 10000 });
      } else if (won.type === 'free_spin') {
        toast.success(`🎁 Free spin! Your spin was handed back.`, { duration: 6000 });
      } else if (won.type === 'free_putt') {
        toast.success(`⛳ Free Putt! It's been added to your Lucky Putts.`, { duration: 8000 });
      } else if (won.type === 'membership') {
        toast.success(`👑 ${won.label} unlocked! We'll activate it on your account.`, { duration: 10000 });
      } else if (won.type === 'none') {
        toast(`🏖️ Sand Trap — no prize this time.`, { duration: 5000 });
      }

      if (won.type !== 'prize') setCanRespin(true); // the Re-spin button only shows while spins remain

      // Keep the angle small for the next spin (same picture, no animation).
      setInstant(true);
      setRotation(r => ((r % 360) + 360) % 360);
      requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
    };
    finishRef.current = finish;
    // Safety net if the browser never reports the transition ending (e.g. a hidden tab).
    setTimeout(finish, SPIN_DURATION_S * 1000 + 1500);
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
        </motion.div>

        {/* Wheel */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="relative flex items-center justify-center py-4 overflow-hidden -mx-[2.5%]">
          <div className="absolute w-64 h-64 bg-gradient-to-r from-primary via-accent to-primary rounded-full blur-3xl opacity-20 animate-pulse pointer-events-none" />
          <div className="relative flex items-center justify-center w-full">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
              <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-t-[30px] border-l-transparent border-r-transparent border-t-accent drop-shadow-lg" />
            </div>
            {/* Static shadow: a filter on the rotating element would be repainted every frame. */}
            <div className="absolute rounded-full shadow-2xl pointer-events-none" style={{ width: '100%', aspectRatio: '1 / 1' }} />
            {/* The turn is a CSS transition, which the browser runs on the GPU compositor, so
                the long slow-down stays smooth even if the page is busy. */}
            <div
              style={{
                willChange: 'transform', width: '100%', aspectRatio: '1 / 1',
                transform: `rotate(${rotation}deg)`,
                transition: instant ? 'none' : `transform ${SPIN_DURATION_S}s cubic-bezier(${SPIN_EASE.join(',')})`,
              }}
              onTransitionEnd={(e) => { if (e.target === e.currentTarget && e.propertyName === 'transform') finishRef.current?.(); }}
              className="relative">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {prizes.map((prize, i) => {
                  const { startDeg, endDeg } = SLICE_ANGLES[i];
                  // The sand slivers are painted as part of their sand/gold/sand cluster below.
                  if (prize.type === 'none' && (prize.width ?? 1) < 1) return null;
                  if (prize.rare) {
                    // Gold sits on one continuous sand wedge, so there is no border line (and no
                    // hairline gap) between sand and gold; the cluster is outlined as one slice.
                    const cluster = wedgePath(SLICE_ANGLES[i - 1].startDeg, SLICE_ANGLES[i + 1].endDeg);
                    return (
                      <g key={i}>
                        <path d={cluster} fill={SAND_FILL} stroke="hsl(var(--border))" strokeWidth="0.3" />
                        <path d={wedgePath(startDeg, endDeg)} fill={GOLD_FILL} />
                      </g>
                    );
                  }
                  const isSandSlice = prize.type === 'none';
                  const fillClass = i % 2 === 0 ? 'text-card' : 'text-muted';
                  return (
                    <path key={i}
                      d={wedgePath(startDeg, endDeg)}
                      className={isSandSlice ? '' : `fill-current ${fillClass}`}
                      fill={isSandSlice ? SAND_FILL : undefined}
                      stroke="hsl(var(--border))" strokeWidth="0.3" />
                  );
                })}
                {/* Thin gold rim so every slice meets the same line. */}
                <circle cx="50" cy="50" r="49.85" fill="none" stroke={GOLD_FILL} strokeWidth="0.3" />
                <circle cx="50" cy="50" r="8" fill={GOLD_FILL} />
              </svg>
              {/* Labels run "long ways" — radially outward, out near the rim
                  where they're actually readable, oriented along each
                  slice's centerline. Sand slivers use a short "Sand"
                  wheelLabel at a smaller size since they're still thin. */}
              {prizes.map((prize, i) => {
                const angle = SLICE_ANGLES[i].midDeg - 90;
                const rad = angle * (Math.PI / 180);
                const R = prize.labelRadius ?? LABEL_RADIUS; // out of 50 — well past the hub, just inside the rim
                const isSand = prize.type === 'none';
                // Only the thin sand slivers flanking the gold slices need the
                // tiny label; full-width Sand Bunker fillers read fine at the
                // normal size.
                const isThinSliver = isSand && (prize.width ?? 1) < 1;
                return (
                  <div key={i}
                    className={`absolute leading-none whitespace-nowrap ${isThinSliver ? 'text-[5px] font-bold' : prize.rare ? 'text-[10.8px] font-semibold' : 'text-[11.3px] font-semibold'} ${prize.rare ? 'text-accent-foreground' : isSand ? 'text-amber-950' : 'text-foreground'}`}
                    style={{
                      left: `${50 + R * Math.cos(rad)}%`,
                      top: `${50 + R * Math.sin(rad)}%`,
                      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                    }}>
                    {prize.wheelLabel ?? prize.label}
                  </div>
                );
              })}
            </div>
            {/* Static hub logo — sits outside the rotating wheel so it
                stays upright instead of spinning with it. */}
            <img src="/clover-logo.png" alt="Lucky Golf" draggable={false}
              className="absolute pointer-events-none select-none drop-shadow-md"
              style={{ left: '50%', top: '50%', width: '11%', aspectRatio: '1 / 1', objectFit: 'contain', transform: 'translate(-50%, -50%)' }} />
          </div>
        </motion.div>

        {/* Spin Button — stays directly under the wheel; the result card (below)
            renders underneath it instead of pushing it down the page. */}
        <Button variant="gold" size="xl" className="w-full" onClick={spin}
          disabled={spinning || spinsRemaining <= 0} data-testid="spin-btn">
          {spinning ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <CloverIcon className="w-6 h-6" />
            </motion.div>
          ) : (<><Gift className="w-6 h-6" /> Use a Spin</>)}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {spinsRemaining > 0 ? `${spinsRemaining} spin${spinsRemaining > 1 ? 's' : ''} available!` : 'Sink a putt in Lucky Putts to win your next spin'}
        </p>
        <p className="text-center text-xs text-amber-300/90" data-testid="discount-note">
          🎅 Secret-Santa rules: a new discount swaps in for your old one, and it keeps for a month. Spin wisely!
        </p>

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
                  <p className="text-xs text-amber-300/90 mt-2">🎅 Secret-Santa style: this swaps out any discount you had. Good for a month!</p>
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
                <p className="text-sm text-cyan-400 mt-1 font-bold">Your spin was handed back — go again!</p>
              )}
              {result.type === 'free_putt' && (
                <div className="flex items-center justify-center gap-1 mt-3 flex-col">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <Flag className="w-4 h-4" /><span className="text-sm font-black uppercase tracking-wider">+1 Putt</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Added to your putts in Lucky Putts</p>
                </div>
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
