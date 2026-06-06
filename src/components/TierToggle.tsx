import { useTier, TIER_LABEL, type Tier } from '@/contexts/TierContext';

const ORDER: Tier[] = ['free', 'clover', 'gold'];

export function TierToggle({ className = '' }: { className?: string }) {
  const { tier, setTier } = useTier();
  return (
    <div className={`inline-flex items-center gap-0.5 p-0.5 bg-muted/50 border border-border/50 rounded-full text-[10px] font-semibold ${className}`}>
      {ORDER.map(t => (
        <button
          key={t}
          onClick={() => setTier(t)}
          className={`px-2.5 py-1 rounded-full transition-all ${tier === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {TIER_LABEL[t]}
        </button>
      ))}
    </div>
  );
}
