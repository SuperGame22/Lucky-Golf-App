/**
 * GOLD MACHINE — preview only.
 * The gold economy (finding the leprechaun, generation, cash-out) needs server-side rules before it can go
 * live, so this page shows the concept and nothing here changes a balance.
 */

import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { NoMachineState } from '@/components/gold/NoMachineState';
import { Lock } from 'lucide-react';

const GoldMachine = () => (
  <AppLayout>
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold">Gold Machine</h1>
        <p className="text-muted-foreground text-sm">Build a bigger gold machine to make more gold</p>
      </motion.div>

      <NoMachineState />

      <div className="glass-card p-4 flex items-center gap-3" data-testid="gold-coming-soon">
        <Lock className="w-5 h-5 text-amber-400 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Coming soon for Clover Club and Gold members. Your gold balance will show here once it's live.
        </p>
      </div>
    </div>
  </AppLayout>
);

export default GoldMachine;
