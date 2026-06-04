import { cn } from '@/lib/utils';

// Real brand mark (clover + golfer). Lives in /public/clover-logo.png.
export const CloverLogo = ({ className }: { className?: string }) => (
  <img
    src="/clover-logo.png"
    alt="Lucky Golf"
    draggable={false}
    className={cn('object-contain select-none', className)}
  />
);
