import { createContext, useCallback, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WalletState {
  balance: number;        // cash balance (wallets.balance)
  cloverBalance: number;  // clovers (wallets.clover_balance)
  setBalance: (n: number) => void;
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletState | undefined>(undefined);

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [cloverBalance, setCloverBalance] = useState(0);
  const userId = user?.id;

  const refreshWallet = useCallback(async () => {
    if (!userId) { setBalance(0); setCloverBalance(0); return; }
    const { data, error } = await supabase
      .from("wallets")
      .select("balance, clover_balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) { console.error("wallet load:", error.message); return; }
    setBalance(Number(data?.balance ?? 0));
    setCloverBalance(Number(data?.clover_balance ?? 0));
  }, [userId]);

  useEffect(() => { refreshWallet(); }, [refreshWallet]);

  // Cash moves outside this screen (Stripe top-ups, wager buy-ins and payouts): re-read when the app comes back.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refreshWallet(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refreshWallet]);

  return (
    <WalletContext.Provider value={{ balance, cloverBalance, setBalance, refreshWallet }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};
