import { cn } from '@/lib/utils';

export const GoldCoinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={cn("w-5 h-5", className)}>
    <circle cx="12" cy="12" r="10" />
    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">$</text>
  </svg>
);