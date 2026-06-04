import { cn } from '@/lib/utils';

export const CloverIcon = ({ className }: { className?: string }) => (
  <img
    src="/clover-logo.png"
    alt="Clover"
    draggable={false}
    className={cn('object-contain select-none w-5 h-5', className)}
  />
);
