import { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { BottomNavigation } from '@/shared/components/BottomNavigation';

export const AppLayout = ({ children, hideHeader }: { children: ReactNode; hideHeader?: boolean }) => {
  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased overflow-x-hidden">
      {!hideHeader && <Header />}
      <main className="pb-24">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
};
