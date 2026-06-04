import { useAuth } from '@/contexts/AuthContext';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { Bell, User } from 'lucide-react';
import { Link } from 'react-router-dom';
export function Header() {
  const { profile } = useAuth();
  const clovers = profile?.clovers ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <CloverIcon className="w-7 h-7 text-primary" />
          <span className="font-display font-bold text-lg">Lucky Golf</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Clovers */}
          <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full">
            <CloverIcon className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">{clovers}</span>
          </div>

          {/* Notifications */}
          <button className="p-2 rounded-full hover:bg-muted transition-colors relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Profile */}
          <Link to="/career" className="p-2 rounded-full hover:bg-muted transition-colors">
            <User className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </header>
  );
}
