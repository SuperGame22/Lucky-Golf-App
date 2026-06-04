import { createContext, useContext, useState } from "react";

interface WalletState {
  balance: number;
  setBalance: (n: number) => void;
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletState | undefined>(undefined);

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [balance, setBalance] = useState(0);
  // TODO: fetch real balance from Supabase. No-op keeps callers from crashing.
  const refreshWallet = async () => {};
  return (
    <WalletContext.Provider value={{ balance, setBalance, refreshWallet }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};
