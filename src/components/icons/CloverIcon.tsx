import { cn } from '@/lib/utils';

// Clean 4-leaf clover. NOTE: approximation of the brand logo — the detailed
// golfer-in-clover artwork needs the real asset (repo image files are placeholders).
export const CloverIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={cn('w-5 h-5', className)} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 49 C 45 40 33 40 33 31 C 33 24 41 22 46 27 C 48 29 50 32 50 32 C 50 32 52 29 54 27 C 59 22 67 24 67 31 C 67 40 55 40 50 49 Z" />
    <g transform="rotate(90 50 50)"><path d="M50 49 C 45 40 33 40 33 31 C 33 24 41 22 46 27 C 48 29 50 32 50 32 C 50 32 52 29 54 27 C 59 22 67 24 67 31 C 67 40 55 40 50 49 Z" /></g>
    <g transform="rotate(180 50 50)"><path d="M50 49 C 45 40 33 40 33 31 C 33 24 41 22 46 27 C 48 29 50 32 50 32 C 50 32 52 29 54 27 C 59 22 67 24 67 31 C 67 40 55 40 50 49 Z" /></g>
    <g transform="rotate(270 50 50)"><path d="M50 49 C 45 40 33 40 33 31 C 33 24 41 22 46 27 C 48 29 50 32 50 32 C 50 32 52 29 54 27 C 59 22 67 24 67 31 C 67 40 55 40 50 49 Z" /></g>
    <path d="M50 50 C 53 61 57 68 63 74" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);
