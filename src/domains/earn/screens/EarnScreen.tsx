/**
 * UPGRADE — Waitlist tiers + Lucky Golf Shop
 */

import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { useState } from 'react';
import { Check, X, Sparkles, Crown, ShoppingBag, ExternalLink } from 'lucide-react';

// ── Waitlist Modal ─────────────────────────────────────────────────────────────
function WaitlistModal({ tier, onClose }: { tier: 'clover' | 'gold'; onClose: () => void }) {
  const [joined, setJoined] = useState(false);
  const isGold = tier === 'gold';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        className="bg-background border border-border rounded-2xl p-6 w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isGold ? <Crown className="w-5 h-5 text-yellow-500" /> : <CloverIcon className="w-5 h-5 text-primary" />}
            <h3 className="font-black text-lg uppercase tracking-wide">
              {isGold ? 'Gold Club' : 'Clover Club'}
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {joined ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-primary" />
            </div>
            <p className="font-black text-xl mb-2">You're on the list!</p>
            <p className="text-muted-foreground text-sm">
              We'll notify you when {isGold ? 'Gold Club' : 'Clover Club'} launches after MVP beta.
            </p>
            <Button className="mt-5 w-full" onClick={onClose}>Got it</Button>
          </motion.div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm mb-5">
              {isGold
                ? 'Gold Club brings advanced AI coaching, deeper performance insights, and priority access to new features. Launching after MVP beta.'
                : 'Clover Club unlocks advanced tracking, exclusive rewards, beta perks, and early access to new features. Launching after MVP beta.'}
            </p>
            <Button
              className="w-full font-black uppercase tracking-wider"
              variant={isGold ? 'gold' : 'default'}
              onClick={() => setJoined(true)}
            >
              {isGold ? <Crown className="w-4 h-4 mr-2" /> : <CloverIcon className="w-4 h-4 mr-2" />}
              Join Waitlist
            </Button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Shop Products ──────────────────────────────────────────────────────────────
const PRODUCTS = [
  { id: 'lgw01', name: 'V1 Gold Lucky Golf Wedge', price: 99.00, image: 'https://www.luckygolf.com/cdn/shop/files/3_15.webp?v=1759072357', badge: 'FEATURED', url: 'https://www.luckygolf.com/products/v1-gold-lucky-golf-wedge' },
  { id: 'lgw02', name: 'V2 Signature Gold Wedge', price: 109.00, image: 'https://www.luckygolf.com/cdn/shop/files/Photoroom_20250106_180935.png?v=1741366122', badge: 'NEW', url: 'https://www.luckygolf.com/products/v2-signature-gold-wedge-1' },
  { id: 'lgd01', name: 'Lucky Gold Driver', price: 299.00, image: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_20220428_103621.png?v=1703705639', badge: 'BEST SELLER', url: 'https://www.luckygolf.com/products/lucky-gold-driver-pre-order_' },
  { id: 'lgp01', name: 'Signature Gold Putter', price: 199.00, image: 'https://www.luckygolf.com/cdn/shop/files/PhotoRoom_20230204_160908_7d44cf4e-171c-4270-b983-8ff4006f2ce1.png?v=1697769977&width=400', badge: 'TOP RATED', url: 'https://www.luckygolf.com/products/signature-gold-putters' },
  { id: 'polo-azalea', name: 'Azalea Classic Polo', price: 67.00, image: 'https://www.luckygolf.com/cdn/shop/files/Flower1.webp?v=1779472480&width=400', badge: 'NEW', url: 'https://www.luckygolf.com/products/azalea-classic-polo' },
  { id: 'polo-blackout', name: 'Blackout Blade Polo', price: 67.00, image: 'https://www.luckygolf.com/cdn/shop/files/StrokePlay1.webp?v=1779472570', url: 'https://www.luckygolf.com/products/blackout-blade-polo' },
  { id: 'glove', name: 'Lucky Clover Tour Glove', price: 17.95, image: 'https://www.luckygolf.com/cdn/shop/products/PhotoRoom_000_20220517_095432.png?v=1654540304&width=400', url: 'https://www.luckygolf.com/products/lucky-clover-tour-glove' },
  { id: 'hat', name: 'Green Lucky Hat', price: 24.95, image: 'https://www.luckygolf.com/cdn/shop/files/3M6A9896.jpg?v=1703705685&width=400', url: 'https://www.luckygolf.com/products/green-lucky-hat' },
];

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function EarnScreen() {
  const { profile } = useAuth();
  const [waitlist, setWaitlist] = useState<'clover' | 'gold' | null>(null);

  return (
    <AppLayout>
      <AnimatePresence>
        {waitlist && <WaitlistModal tier={waitlist} onClose={() => setWaitlist(null)} />}
      </AnimatePresence>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-black uppercase tracking-wider">Upgrade</h1>
          <p className="text-sm text-muted-foreground">Coming after MVP beta — join the waitlist</p>
        </motion.div>

        {/* Clover Club Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-card p-6 border-primary/30 bg-gradient-to-br from-primary/5 to-emerald-900/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <CloverIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-black text-lg">Clover Club</p>
              <p className="text-xs text-primary font-bold uppercase tracking-widest">Upgrade Tier</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Advanced tracking, exclusive rewards, beta perks, and first access to new features as we build them.
          </p>
          <ul className="space-y-1.5 mb-5">
            {['Advanced practice analytics', 'Exclusive beta features', 'Priority clover rewards', 'Early access program'].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button className="w-full font-black uppercase tracking-wider" onClick={() => setWaitlist('clover')}>
            <CloverIcon className="w-4 h-4 mr-2" /> Join Waitlist
          </Button>
        </motion.div>

        {/* Gold Club Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card p-6 border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-amber-900/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Crown className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="font-black text-lg">Gold Club</p>
              <p className="text-xs text-yellow-500 font-bold uppercase tracking-widest">Premium Tier</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Advanced AI coaching, deeper performance insights, priority features, and premium club benefits.
          </p>
          <ul className="space-y-1.5 mb-5">
            {['AI coaching suite (Pro + Zen)', 'Swing analysis & modeling', 'Gold Machine access', 'Priority support & features'].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button variant="gold" className="w-full font-black uppercase tracking-wider" onClick={() => setWaitlist('gold')}>
            <Crown className="w-4 h-4 mr-2" /> Join Waitlist
          </Button>
        </motion.div>

        {/* Shop */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h2 className="font-black text-lg uppercase tracking-wider">Lucky Golf Shop</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PRODUCTS.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.04 }}
                className="glass-card overflow-hidden cursor-pointer group"
                onClick={() => window.open(p.url, '_blank')}
              >
                <div className="aspect-square bg-muted relative overflow-hidden">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  {p.badge && (
                    <span className="absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded bg-primary text-primary-foreground uppercase tracking-widest">
                      {p.badge}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-bold line-clamp-2 leading-tight mb-1">{p.name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-primary">${p.price.toFixed(2)}</p>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </AppLayout>
  );
}
