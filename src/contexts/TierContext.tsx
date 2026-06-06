import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Tier = 'free' | 'clover' | 'gold';
export const TIER_RANK: Record<Tier, number> = { free: 0, clover: 1, gold: 2 };
export const TIER_LABEL: Record<Tier, string> = { free: 'General', clover: 'Clover Club', gold: 'Gold Club' };

interface TierState { tier: Tier; setTier: (t: Tier) => void; }
const TierContext = createContext<TierState | undefined>(undefined);

export function TierProvider({ children }: { children: ReactNode }) {
  const [tier, setTierState] = useState<Tier>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('lg_tier') : null;
    return (saved === 'clover' || saved === 'gold' || saved === 'free') ? saved : 'free';
  });
  useEffect(() => { try { localStorage.setItem('lg_tier', tier); } catch { /* ignore */ } }, [tier]);
  return <TierContext.Provider value={{ tier, setTier: setTierState }}>{children}</TierContext.Provider>;
}

export const useTier = () => {
  const ctx = useContext(TierContext);
  if (!ctx) throw new Error('useTier must be used within TierProvider');
  return ctx;
};
