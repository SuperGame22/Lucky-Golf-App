/**
 * CloverContext — real Supabase-backed clover balance
 * Reads from golfer_profiles.clovers via AuthContext profile.
 * addClovers calls the add_clovers RPC and syncs back.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CloverContextType {
  cloverBalance: number;
  addClovers: (amount: number, reason?: string) => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const CloverContext = createContext<CloverContextType | null>(null);

export function CloverProvider({ children, initialBalance = 0 }: { children: ReactNode; initialBalance?: number }) {
  const { user, profile, refreshProfile } = useAuth();
  const [cloverBalance, setCloverBalance] = useState(initialBalance);

  // Sync from profile whenever it changes
  useEffect(() => {
    if (profile?.clovers !== undefined) {
      setCloverBalance(profile.clovers);
    }
  }, [profile?.clovers]);

  const addClovers = async (amount: number, reason = 'app') => {
    if (!user) return;

    // Optimistic update
    setCloverBalance(prev => prev + amount);

    const { data, error } = await supabase.rpc('add_clovers', {
      p_user_id: user.id,
      p_amount: amount,
    });

    if (error) {
      console.error('add_clovers RPC error:', error);
      // Revert optimistic update
      setCloverBalance(prev => prev - amount);
      return;
    }

    // Sync authoritative balance from DB
    if (data?.new_balance !== undefined) {
      setCloverBalance(data.new_balance);
    }

    // Also refresh auth profile so other components see the update
    await refreshProfile();
  };

  const refreshBalance = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('golfer_profiles')
      .select('clovers')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data?.clovers !== undefined) {
      setCloverBalance(data.clovers);
    }
  };

  return (
    <CloverContext.Provider value={{ cloverBalance, addClovers, refreshBalance }}>
      {children}
    </CloverContext.Provider>
  );
}

export const useClovers = () => {
  const ctx = useContext(CloverContext);
  if (!ctx) throw new Error('useClovers must be used within CloverProvider');
  return ctx;
};
