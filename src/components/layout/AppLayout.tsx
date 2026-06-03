import { Header } from '@/components/layout/Header';
import { BottomNavigation } from '@/shared/components/BottomNavigation';

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased">
      <Header />
      <main className="pb-24">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
};
