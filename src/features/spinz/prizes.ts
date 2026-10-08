import type { ComponentType } from 'react';
import { Flag, Gift, RotateCcw, Ticket, Crown, Waves } from 'lucide-react';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { buildSlices } from './wheel';

// ── Change these to update the three featured physical prizes ──
export const PRIZE_A_LABEL = 'Lucky Wedge';
export const PRIZE_B_LABEL = 'Lucky Putter';
export const PRIZE_C_LABEL = 'Lucky Driver';

// Discount codes shown to winners (rotate or update as needed)
export const DISCOUNT_CODES: Record<string, string> = {
  '10% Off': 'LUCKY10',
  '15% Off': 'LUCKY15',
  '20% Off': 'LUCKY20',
  '25% Off': 'LUCKY25',
  '30% Off': 'LUCKY30',
};

export type PrizeType = 'prize' | 'clovers' | 'discount' | 'free_spin' | 'free_putt' | 'membership' | 'none';

export interface Prize {
  label: string;
  color: string;
  icon: ComponentType<{ className?: string }>;
  rare?: boolean;
  clovers: number;
  type: PrizeType;
  membershipMonths?: number;
  /** Relative angular weight. 1 = a normal full-width slice. Defaults to 1. */
  width?: number;
  /** Short text for the wheel itself, when different from `label` (used
   *  in toasts/results) — for slices too thin for the full label. */
  wheelLabel?: string;
  /** Where the wheel label is centred, in % of the wheel radius. Defaults to
   *  LABEL_RADIUS; pulled in for long labels so they stay clear of the rim. */
  labelRadius?: number;
}

export const SAND_FILL = '#E6D9B4'; // light sand/cream, slightly muted so it doesn't pop too hard
export const GOLD_FILL = '#FFC94A'; // brighter gold — closer to the text-gradient-gold accent used below the wheel

/** Default label position, out of 50 — well past the hub, just inside the rim. */
export const LABEL_RADIUS = 37;

/** Share of a sand/gold/sand cluster taken by the gold slice (the cluster is one normal slice wide). */
export const GOLD_SHARE = 0.25;
const SAND_WIDTH = (1 - GOLD_SHARE) / 2;

const SAND: Prize = {
  label: 'Sand Trap', wheelLabel: 'Sand', color: 'from-amber-300 to-yellow-600', icon: Waves, clovers: 0, type: 'none', width: SAND_WIDTH,
};

const gold = (label: string): Prize => ({
  label, color: 'from-yellow-500 to-amber-600', icon: Gift, rare: true, clovers: 0, type: 'prize', width: GOLD_SHARE,
});

// A full-width filler slice that's just sand — same light color as the
// slivers flanking the gold slices, but a normal-size, normal-width slot.
const sandBunker = (): Prize => ({
  label: 'Sand Bunker', color: 'from-amber-200 to-yellow-400', icon: Waves, clovers: 0, type: 'none',
});

// One 120° arc: a sand/gold/sand cluster (together one normal slice wide, the
// gold being GOLD_SHARE of it) plus 9 normal-weight filler slices — 10
// weight-units per arc, so all three arcs land exactly 120° apart.
function arc(goldLabel: string, fillers: Prize[]): Prize[] {
  return [{ ...SAND }, gold(goldLabel), { ...SAND }, ...fillers];
}

// The two long Clover Club labels sit a little further in so the end of the word clears the rim.
const CLUB_LABEL_RADIUS = 34;

export const prizes: Prize[] = [
  ...arc(PRIZE_A_LABEL, [
    { label: '+2 Clovers', color: 'from-lime-500 to-green-600', icon: CloverIcon, clovers: 2, type: 'clovers' },
    { label: '15% Off', color: 'from-blue-500 to-indigo-600', icon: Ticket, clovers: 0, type: 'discount' },
    sandBunker(),
    { label: 'Free Spin', color: 'from-cyan-400 to-sky-600', icon: RotateCcw, clovers: 0, type: 'free_spin' },
    { label: '+1 Clover', color: 'from-gray-500 to-gray-600', icon: CloverIcon, clovers: 1, type: 'clovers' },
    { label: '10% Off', color: 'from-blue-400 to-cyan-500', icon: Ticket, clovers: 0, type: 'discount' },
    sandBunker(),
    { label: '25% Off', color: 'from-violet-500 to-purple-700', icon: Ticket, clovers: 0, type: 'discount' },
    { label: 'Free Putt', color: 'from-emerald-400 to-green-600', icon: Flag, clovers: 0, type: 'free_putt' },
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
    { label: '1mo Clover Club', color: 'from-purple-400 to-fuchsia-600', icon: Crown, clovers: 0, type: 'membership', membershipMonths: 1, labelRadius: CLUB_LABEL_RADIUS },
    { label: '25% Off', color: 'from-violet-500 to-purple-700', icon: Ticket, clovers: 0, type: 'discount' },
    sandBunker(),
    { label: '15% Off', color: 'from-blue-500 to-indigo-600', icon: Ticket, clovers: 0, type: 'discount' },
    { label: '+2 Clovers', color: 'from-lime-500 to-green-600', icon: CloverIcon, clovers: 2, type: 'clovers' },
    { label: '10% Off', color: 'from-blue-400 to-cyan-500', icon: Ticket, clovers: 0, type: 'discount' },
    sandBunker(),
    { label: 'Free Spin', color: 'from-cyan-400 to-sky-600', icon: RotateCcw, clovers: 0, type: 'free_spin' },
    { label: '3mo Clover Club', color: 'from-purple-500 to-fuchsia-700', icon: Crown, clovers: 0, type: 'membership', membershipMonths: 3, labelRadius: CLUB_LABEL_RADIUS },
  ]),
];

/** Start/mid/end angle of every slice (0° = wheel-top), computed once since `prizes` is static. */
export const SLICE_ANGLES = buildSlices(prizes.map((p) => p.width ?? 1));

// Selection weight is intentionally decoupled from `width` (which only
// controls each slice's visual size on the wheel). Every slice gets equal
// selection weight EXCEPT the three club prizes (driver/putter/wedge, the
// `rare` gold slices), which are deliberately under-weighted so they're won
// 1/3 as often as before while everything else keeps the same relative odds
// among itself. The wheel animation itself is unaffected — still a normal
// random spin, just with the "which prize" step weighted.
const CLUB_SELECTION_WEIGHT = 11 / 35; // solved so 3 clubs vs 33 others => combined club odds = (previous 3/36) / 3 = 1/36
export const SELECTION_WEIGHTS = prizes.map((p) => (p.rare ? CLUB_SELECTION_WEIGHT : 1));

/** Index of the Free Putt slice. */
export const FREE_PUTT_INDEX = prizes.findIndex((p) => p.type === 'free_putt');

/**
 * Picks the winning slice. The Free Putt slice is a real giveaway (a putt credit), so the
 * database rolls for it in consume_spin() and the page only ever lands on it when told to;
 * every other pick leaves it out, which keeps the rest of the odds in the same proportions.
 */
export function pickPrizeIndex(random: () => number = Math.random): number {
  const weights = SELECTION_WEIGHTS.map((w, i) => (i === FREE_PUTT_INDEX ? 0 : w));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
