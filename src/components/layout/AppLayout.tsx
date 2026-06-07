import { Header } from '@/components/layout/Header';
import { BottomNavigation } from '@/shared/components/BottomNavigation';

export const AppLayout = ({ children, hideHeader }: { children: React.ReactNode; hideHeader?: boolean }) => {
  return (
    <div className="relative min-h-screen bg-black text-white font-sans antialiased">
      {/* Same clover wallpaper as sign-in screen */}
      <div
        className="fixed inset-0 bg-celtic-knot pointer-events-none z-0 opacity-[0.04]"
        style={{ backgroundSize: '120px 120px' }}
      />
      {!hideHeader && <Header />}
      <main className="relative z-10 pb-24">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
};
