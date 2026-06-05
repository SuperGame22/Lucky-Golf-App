import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CloverContextType {
  cloverBalance: number;
  isLoading: boolean;
  addClovers: (amount: number) => Promise<void>;
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

  const addClovers = async (amount: number) => {
    if (amount <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic update
    setCloverBalance(prev => prev + amount);

    const { data, error } = await supabase.rpc('add_clovers', {
      p_user_id: user.id,
      p_amount: amount,
    });

    if (error || !data?.success) {
      // Revert on failure
      setCloverBalance(prev => prev - amount);
      console.error('Failed to add clovers:', error || data?.error);
      return;
    }

    // Sync with confirmed DB value
    setCloverBalance(data.new_balance);
  };

  return (
    <CloverContext.Provider value={{ cloverBalance, isLoading, addClovers, refreshBalance }}>
      {children}
    </CloverContext.Provider>
  );
}

export const useClover = () => {
  const ctx = useContext(CloverContext);
  if (!ctx) throw new Error('useClover must be used within CloverProvider');
  return ctx;
};
