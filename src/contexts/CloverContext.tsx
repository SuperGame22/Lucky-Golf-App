import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CloverContextType {
  cloverBalance: number;
  isLoading: boolean;
  triggerSpend: (amount: number) => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const CloverContext = createContext<CloverContextType | null>(null);

export function CloverProvider({ children, initialBalance = 0 }: { children: ReactNode; initialBalance?: number }) {
  const [cloverBalance, setCloverBalance] = useState(initialBalance);
  const [isLoading, setIsLoading] = useState(false);

  const refreshBalance = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('golfer_profiles')
      .select('clovers')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data?.clovers != null) setCloverBalance(data.clovers);
  };

  useEffect(() => {
    refreshBalance();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => refreshBalance());
    return () => subscription.unsubscribe();
  }, []);

  const triggerSpend = async (amount: number) => {
    if (amount <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.rpc('award_clovers', { p_user_id: user.id, p_amount: amount });
    await refreshBalance();
  };

  return (
    <CloverContext.Provider value={{ cloverBalance, isLoading, triggerSpend, refreshBalance }}>
      {children}
    </CloverContext.Provider>
  );
}

export const useClover = () => {
  const ctx = useContext(CloverContext);
  if (!ctx) throw new Error('useClover must be used within CloverProvider');
  return ctx;
};
