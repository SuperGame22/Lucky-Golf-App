import { cn } from '@/lib/utils';

export const CloverIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={cn("w-5 h-5", className)}>
    <path d="M12 2C10.3 2 9 3.3 9 5c0 .8.3 1.5.8 2C8.5 6.4 7 5.5 5.5 5.5 3.6 5.5 2 7.1 2 9c0 1.9 1.4 3.4 3.2 3.5C4.5 13.1 4 13.9 4 15c0 2 1.6 3.7 3.6 3.8.4 2.1 2.3 3.7 4.4 3.7s4-1.6 4.4-3.7C18.4 18.7 20 17 20 15c0-1.1-.5-1.9-1.2-2.5C20.6 12.4 22 10.9 22 9c0-1.9-1.6-3.5-3.5-3.5-1.5 0-3 .9-4.3 1.5.5-.5.8-1.2.8-2C15 3.3 13.7 2 12 2z"/>
  </svg>
);