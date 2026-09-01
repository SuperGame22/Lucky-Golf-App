/**
 * Add Cash — Stripe-funded top-up of the real-money cash balance
 * (wallets.balance), used to fund Foursome Wager buy-ins and payouts.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, Loader2, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';

// Keep in sync with the CASH_AMOUNTS allowlist in
// supabase/functions/create-checkout — display only, the server enforces it.
const AMOUNTS = [10, 25, 50, 100];

export default function AddCash() {
  const navigate = useNavigate();
  const { balance } = useWallet();
  const { toast } = useToast();
  const [selected, setSelected] = useState<number>(25);
  const [purchasing, setPurchasing] = useState(false);

  const handleAddCash = async () => {
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { mode: 'cash', amountUsd: selected },
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
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Add Cash</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Fund real-money wagers</p>
          </div>
        </div>

        {/* Current Balance */}
        <div className="glass-card p-5 flex items-center gap-3">
          <Wallet className="w-10 h-10 text-emerald-400" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Cash Balance</p>
            <p className="text-2xl font-black text-emerald-400">${balance.toFixed(2)}</p>
          </div>
        </div>

        {/* Amounts */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Choose an amount</p>
          <div className="grid grid-cols-2 gap-3">
            {AMOUNTS.map((amt, i) => (
              <motion.div key={amt} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => setSelected(amt)}
                className={`glass-card p-5 cursor-pointer text-center transition-all ${
                  selected === amt ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/30' : 'hover:border-primary/30'
                }`}
              >
                <DollarSign className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                <p className="text-xl font-black">${amt}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <Button className="w-full h-14 text-lg font-black uppercase tracking-wider" disabled={purchasing}
          data-testid="add-cash-btn" onClick={handleAddCash}
        >
          {purchasing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <DollarSign className="w-5 h-5 mr-2" />}
          {purchasing ? 'Redirecting to checkout…' : `Add $${selected}`}
        </Button>

        <p className="text-[10px] text-center text-muted-foreground">Secure payment via Stripe. Cash added instantly to your wallet balance.</p>
      </div>
    </AppLayout>
  );
}
