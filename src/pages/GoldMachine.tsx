/**
 * GOLD MACHINE — Real Supabase gold_balance integration
 * No hardcoded pot values. Starts at profile's gold_balance.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { GoldMachineVisual } from '@/components/gold/GoldMachineVisual';
import { NoMachineState } from '@/components/gold/NoMachineState';
import { MachineActivation } from '@/components/gold/MachineActivation';
import { useAuth } from '@/contexts/AuthContext';
import { updateGoldBalance } from '@/services/cloverService';
import { Zap, Wrench, ArrowUp, Sparkles, Clock, TrendingUp, Banknote } from 'lucide-react';
import { toast } from 'sonner';

const GoldMachine = () => {
  const { profile, refreshProfile } = useAuth();
  const [hasMachine, setHasMachine] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [potValue, setPotValue] = useState(0);
  const [generationRate, setGenerationRate] = useState(6);
  const [machineHealth, setMachineHealth] = useState(100);
  const [machineLevel, setMachineLevel] = useState(1);
  const [collecting, setCollecting] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);

  // Load real gold balance from profile - machine only active if user has invested clovers
  useEffect(() => {
    const gold = (profile as any)?.gold_balance ?? (profile as any)?.gold ?? 0;
    const invested = (profile as any)?.clovers_invested ?? 0;
    if (gold > 0 || invested > 0) {
      setPotValue(gold);
      // generationRate proportional to clovers invested (1-10 scale)
      const rate = Math.min(10, Math.max(1, Math.floor(invested / 50)));
      setGenerationRate(rate);
      setHasMachine(true);
    }
    // If no investment, machine stays idle (hasMachine = false)
  }, [profile]);

  // Simulate gold generation
  useEffect(() => {
    if (!hasMachine) return;
    const interval = setInterval(() => {
      setPotValue(prev => prev + (generationRate * 0.0001));
    }, 1000);
    return () => clearInterval(interval);
  }, [hasMachine]);

  const activateMachine = () => setShowActivation(true);

  const completeActivation = () => {
    setShowActivation(false);
    setHasMachine(true);
  };

  const collectFlakes = async () => {
    setCollecting(true);
    // Save current pot to profile
    await updateGoldBalance(potValue);
    await refreshProfile();
    toast.success(`${(potValue * 1000).toFixed(0)}mg of gold flakes saved!`);
    setCollecting(false);
  };

  const cashOutGold = async () => {
    if (potValue < 0.01) return;
    setCashingOut(true);
    const amount = potValue;
    // Zero out gold balance
    await updateGoldBalance(0);
    setPotValue(0);
    await refreshProfile();
    toast.success(`Cashed out $${amount.toFixed(2)} in gold!`);
    setCashingOut(false);
  };

  const upgradeMachine = () => {
    if (potValue >= 5) {
      setPotValue(prev => prev - 5);
      setMachineLevel(prev => prev + 1);
      setGenerationRate(prev => prev + 3);
      toast.success('Machine upgraded!');
    }
  };

  const maintainMachine = () => {
    if (potValue >= 1) {
      setPotValue(prev => prev - 1);
      setMachineHealth(100);
      toast.success('Machine maintained to 100%');
    }
  };

  return (
    <AppLayout>
      <AnimatePresence>
        {showActivation && <MachineActivation onComplete={completeActivation} />}
      </AnimatePresence>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold">Gold Machine</h1>
          <p className="text-muted-foreground text-sm">Build a bigger gold machine to make more gold</p>
        </motion.div>

        {!hasMachine ? (
          <NoMachineState onActivate={activateMachine} />
        ) : (
          <>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="relative glass-card p-8 overflow-hidden glow-gold">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                className="absolute -right-20 -top-20 w-60 h-60 bg-accent/10 rounded-full blur-3xl" />

              <div className="relative text-center">
                <GoldMachineVisual machineLevel={machineLevel} isCollecting={collecting} />

                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-1">Pot Value</p>
                  <motion.div key={potValue.toFixed(2)} initial={{ scale: 1.05 }} animate={{ scale: 1 }}
                    className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-display font-bold text-gradient-gold">${potValue.toFixed(2)}</span>
                  </motion.div>
                  <p className="text-sm text-accent mt-2">Weight: {(potValue * 1000).toFixed(0)}mg of gold flakes</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <div className="flex items-center justify-center gap-1 text-accent mb-1">
                      <Zap className="w-4 h-4" /><span className="text-sm font-medium">Generation</span>
                    </div>
                    <p className="text-xl font-bold">{generationRate} mg/hr</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <Clock className="w-4 h-4" /><span className="text-sm font-medium">Daily Max</span>
                    </div>
                    <p className="text-xl font-bold">{generationRate * 24}mg</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Machine Health</span>
                    <span className={machineHealth > 60 ? 'text-primary' : machineHealth > 30 ? 'text-accent' : 'text-destructive'}>{machineHealth}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${machineHealth}%` }}
                      transition={{ duration: 1 }}
                      className={`h-full rounded-full ${machineHealth > 60 ? 'bg-primary' : machineHealth > 30 ? 'bg-accent' : 'bg-destructive'}`} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Button variant="gold" size="lg" onClick={collectFlakes} disabled={potValue < 0.01 || collecting}>
                    {collecting ? <Sparkles className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Collect</>}
                  </Button>
                  <Button size="lg" onClick={cashOutGold} disabled={potValue < 0.01 || cashingOut}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500">
                    {cashingOut ? <Banknote className="w-5 h-5 animate-spin" /> : <><Banknote className="w-5 h-5" /> Cash Out</>}
                  </Button>
                  <Button variant="glass" size="lg" onClick={maintainMachine} disabled={potValue < 1 || machineHealth === 100}>
                    <Wrench className="w-5 h-5" /> Maintain
                  </Button>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="font-display font-semibold text-lg">Upgrade Machine</h3>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <ArrowUp className="w-5 h-5 text-accent" />
                  <div><p className="font-medium">Increase Capacity</p><p className="text-sm text-muted-foreground">+3 mg/hr generation</p></div>
                </div>
                <Button variant="gold" size="sm" onClick={upgradeMachine} disabled={potValue < 5}>$5.00</Button>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default GoldMachine;
