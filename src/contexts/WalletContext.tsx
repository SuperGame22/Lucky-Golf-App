import { createContext, useCallback, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WalletState {
  balance: number;        // cash balance (wallets.balance)
  cloverBalance: number;  // clovers (wallets.clover_balance)
  gold: number;           // reserved; no data source yet
  setBalance: (n: number) => void;
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletState | undefined>(undefined);

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [cloverBalance, setCloverBalance] = useState(0);
  const [gold] = useState(0);

  const userId = user?.id;
  const refreshWallet = useCallback(async () => {
    if (!userId) { setBalance(0); setCloverBalance(0); return; }
    const { data } = await supabase
      .from("wallets")
      .select("balance, clover_balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setBalance(Number(data.balance ?? 0));
      setCloverBalance(Number(data.clover_balance ?? 0));
    }
  }, [userId]);

  useEffect(() => { refreshWallet(); }, [refreshWallet]);

  return (
    <WalletContext.Provider value={{ balance, cloverBalance, gold, setBalance, refreshWallet }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};
