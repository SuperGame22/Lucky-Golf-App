/**
 * Clover Packs - Purchase clover credits
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { ArrowLeft, Zap, Star, Check } from 'lucide-react';

const PACKS = [
  { id: 1, clovers: 20, price: 4.99, popular: false, bonus: null },
  { id: 2, clovers: 50, price: 9.99, popular: true, bonus: '+5 FREE' },
  { id: 3, clovers: 120, price: 19.99, popular: false, bonus: '+20 FREE' },
  { id: 4, clovers: 300, price: 39.99, popular: false, bonus: '+75 FREE' },
];

export default function CloverPacks() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number | null>(2);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/earn')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Clover Packs</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Stock up on clovers</p>
          </div>
        </div>

        {/* Current Balance */}
        <div className="glass-card p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CloverIcon className="w-10 h-10" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Balance</p>
              <p className="text-2xl font-black">47 Clovers</p>
            </div>
          </div>
        </div>

        {/* Packs */}
        <div className="space-y-3">
          {PACKS.map((pack, i) => (
            <motion.div key={pack.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(pack.id)}
              className={`glass-card p-5 cursor-pointer transition-all relative ${
                selected === pack.id ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/30'
              } ${pack.popular ? 'ring-2 ring-primary/30' : ''}`}
            >
              {pack.popular && (
                <span className="absolute -top-2 right-4 bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                  Most Popular
                </span>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">🍀</div>
                  <div>
                    <p className="text-xl font-black">{pack.clovers} Clovers</p>
                    {pack.bonus && <p className="text-xs text-primary font-bold">{pack.bonus}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black">${pack.price}</p>
                  <p className="text-[10px] text-muted-foreground">${(pack.price / pack.clovers).toFixed(2)}/clover</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <Button className="w-full h-14 text-lg font-black uppercase tracking-wider" disabled={!selected}
          data-testid="purchase-pack-btn"
        >
          <Zap className="w-5 h-5 mr-2" /> Purchase
        </Button>

        <p className="text-[10px] text-center text-muted-foreground">Secure payment via Stripe. Clovers added instantly.</p>
      </div>
    </AppLayout>
  );
}
