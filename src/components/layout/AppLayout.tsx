import { Header } from '@/components/layout/Header';
import { BottomNavigation } from '@/shared/components/BottomNavigation';

export const AppLayout = ({ children, hideHeader }: { children: React.ReactNode; hideHeader?: boolean }) => {
  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased clover-bg-pattern">
      {!hideHeader && <Header />}
      <main className="pb-24">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
};
