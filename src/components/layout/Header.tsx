import { CloverIcon } from '@/components/icons/CloverIcon';
import { CloverLogo } from '@/components/icons/CloverLogo';
import { GoldCoinIcon } from '@/components/icons/GoldCoinIcon';
import { useWallet } from '@/contexts/WalletContext';
import { Bell, User, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
  const { balance, cloverBalance, gold } = useWallet();

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-14 px-3 max-w-lg mx-auto gap-2">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <CloverLogo className="w-8 h-8" />
          <span className="font-display font-bold text-base">Lucky Golf</span>
        </Link>

        {/* Balances + actions */}
        <div className="flex items-center gap-1.5">
          {/* Cash */}
          <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">${balance.toFixed(2)}</span>
          </div>
          {/* Clovers */}
          <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 px-2 py-1 rounded-full">
            <CloverIcon className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">{cloverBalance}</span>
          </div>
          {/* Gold */}
          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
            <GoldCoinIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300">${gold.toFixed(2)}</span>
          </div>
          {/* Notifications */}
          <button className="p-1.5 rounded-full hover:bg-muted transition-colors relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
          </button>
          {/* Profile */}
          <Link to="/career" className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <User className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </header>
  );
}
