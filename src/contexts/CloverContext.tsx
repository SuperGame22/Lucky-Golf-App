/**
 * CloverContext — real Supabase-backed clover balance
 * Reads from golfer_profiles.clovers via AuthContext profile.
 * Clovers are only ever granted by the server (rounds, Spinz, purchases, raffle); this just reads them.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CloverContextType {
  cloverBalance: number;
  refreshBalance: () => Promise<void>;
}

const CloverContext = createContext<CloverContextType | null>(null);

export function CloverProvider({ children, initialBalance = 0 }: { children: ReactNode; initialBalance?: number }) {
  const { user, profile } = useAuth();
  const [cloverBalance, setCloverBalance] = useState(initialBalance);

  // Sync from profile whenever it changes
  useEffect(() => {
    if (profile?.clovers !== undefined) {
      setCloverBalance(profile.clovers);
    }
  }, [profile?.clovers]);

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
    <CloverContext.Provider value={{ cloverBalance, refreshBalance }}>
      {children}
    </CloverContext.Provider>
  );
}

export const useClovers = () => {
  const ctx = useContext(CloverContext);
  if (!ctx) throw new Error('useClovers must be used within CloverProvider');
  return ctx;
};
