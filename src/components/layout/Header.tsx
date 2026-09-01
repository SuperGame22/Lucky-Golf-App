import { CloverIcon } from '@/components/icons/CloverIcon';
import { CloverLogo } from '@/components/icons/CloverLogo';
import { GoldCoinIcon } from '@/components/icons/GoldCoinIcon';
import { useWallet } from '@/contexts/WalletContext';
import { useClovers } from '@/contexts/CloverContext';
import { Bell, User, Wallet } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export function Header() {
  const { balance, gold } = useWallet();
  const { cloverBalance } = useClovers();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-14 px-3 max-w-lg mx-auto gap-2">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <CloverLogo className="w-8 h-8" />
          <span className="font-display font-bold text-base">Lucky Golf</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Link to="/wallet/add-cash" className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">${balance.toFixed(2)}</span>
          </Link>
          <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 px-2 py-1 rounded-full">
            <CloverIcon className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">{cloverBalance}</span>
          </div>
          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
            <GoldCoinIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300">${gold.toFixed(2)}</span>
          </div>
          <button className="p-1.5 rounded-full hover:bg-muted transition-colors relative" onClick={() => navigate('/chat')}>
            <Bell className="w-5 h-5 text-muted-foreground" />
          </button>
          <Link to="/career" className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <User className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </header>
  );
}
