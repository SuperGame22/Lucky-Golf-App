/**
 * Putt Packs - buy putts for Lucky Putts ($1 per putt, bulk discounts).
 * Bonus clovers = 1 per $4 spent (rounded down), credited with the purchase.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { ArrowLeft, Zap, Loader2, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Display only — create-checkout is the source of truth for putts and price.
const PACKS = [
  { id: 1, putts: 5, price: 4, popular: false },
  { id: 2, putts: 10, price: 7, popular: true },
  { id: 3, putts: 15, price: 10, popular: false },
  { id: 4, putts: 30, price: 18, popular: false },
].map(p => ({ ...p, bonus: Math.floor(p.price / 4) }));

export default function PuttingPacks() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selected, setSelected] = useState<number | null>(2);
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async () => {
    if (!selected) return;
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { mode: 'putt_pack', packId: selected },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No checkout URL returned');
      window.location.href = data.url;
    } catch (err) {
      toast({
        title: 'Could not start checkout',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
      setPurchasing(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/earn')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Putt Packs</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Stock up on putts</p>
          </div>
        </div>

        <div className="space-y-3">
          {PACKS.map((pack, i) => (
            <motion.div key={pack.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(pack.id)}
              className={`glass-card p-5 cursor-pointer transition-all relative ${
                selected === pack.id ? '!border-primary !bg-primary/10 ring-2 ring-primary shadow-[0_0_24px_hsl(var(--primary)/0.25)]' : `hover:!border-primary/40 ${pack.popular ? 'ring-1 ring-primary/30' : ''}`
              }`}
            >
              {pack.popular && (
                <span className="absolute -top-2 right-4 bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                  Most Popular
                </span>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-black">{pack.putts} Putts</p>
                    <p className="text-[10px] text-muted-foreground">${(pack.price / pack.putts).toFixed(2)}/putt</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black">${pack.price}</p>
                  <p className="flex items-center justify-end gap-0.5 text-[10px] font-bold text-primary" aria-label={`${pack.bonus} bonus clover${pack.bonus > 1 ? 's' : ''}`}>
                    +<CloverIcon className="w-3 h-3" />{pack.bonus}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <Button className="w-full h-14 text-lg font-black uppercase tracking-wider" disabled={!selected || purchasing}
          data-testid="purchase-putting-pack-btn" onClick={handlePurchase}
        >
          {purchasing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Zap className="w-5 h-5 mr-2" />}
          {purchasing ? 'Redirecting to checkout…' : 'Purchase'}
        </Button>

        <p className="text-[10px] text-center text-muted-foreground">Secure payment via Stripe. Your card is saved for one-click $1 putts.</p>
      </div>
    </AppLayout>
  );
}
