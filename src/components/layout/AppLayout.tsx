import { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { BottomNavigation } from '@/shared/components/BottomNavigation';

export const AppLayout = ({ children, hideHeader }: { children: ReactNode; hideHeader?: boolean }) => {
  return (
    <div className="min-h-screen bg-background text-white font-sans antialiased overflow-x-hidden relative">
      {/* Faint clover wallpaper behind everything */}
      <div
        className="absolute inset-0 bg-celtic-knot opacity-[0.06] pointer-events-none"
        style={{ backgroundSize: '120px 120px' }}
      />
      <div className="relative z-10">
        {!hideHeader && <Header />}
        <main className="pb-[calc(6rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
};
