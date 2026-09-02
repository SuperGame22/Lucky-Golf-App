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
      <div className="flex items-center justify-between h-14 px-2 xs:px-3 max-w-lg mx-auto gap-1.5">
        <Link to="/" className="flex items-center gap-1.5 shrink-0">
          <CloverLogo className="w-7 h-7 xs:w-8 xs:h-8" />
          <span className="hidden min-[400px]:inline font-display font-bold text-sm xs:text-base whitespace-nowrap">Lucky Golf</span>
        </Link>

        <div className="flex items-center gap-1 min-[400px]:gap-1.5 min-w-0">
          <Link to="/wallet/add-cash" className="flex items-center gap-0.5 min-[400px]:gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1.5 min-[400px]:px-2 py-1 rounded-full shrink-0">
            <Wallet className="w-3 h-3 min-[400px]:w-3.5 min-[400px]:h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] min-[400px]:text-xs font-semibold text-emerald-300 whitespace-nowrap leading-none tabular-nums">${balance.toFixed(2)}</span>
          </Link>
          <div className="flex items-center gap-0.5 min-[400px]:gap-1 bg-primary/10 border border-primary/20 px-1.5 min-[400px]:px-2 py-1 rounded-full shrink-0">
            <CloverIcon className="w-3 h-3 min-[400px]:w-3.5 min-[400px]:h-3.5 text-primary shrink-0" />
            <span className="text-[10px] min-[400px]:text-xs font-semibold text-primary whitespace-nowrap leading-none tabular-nums">{cloverBalance}</span>
          </div>
          <div className="flex items-center gap-0.5 min-[400px]:gap-1 bg-amber-500/10 border border-amber-500/20 px-1.5 min-[400px]:px-2 py-1 rounded-full shrink-0">
            <GoldCoinIcon className="w-3 h-3 min-[400px]:w-3.5 min-[400px]:h-3.5 text-amber-400 shrink-0" />
            <span className="text-[10px] min-[400px]:text-xs font-semibold text-amber-300 whitespace-nowrap leading-none tabular-nums">${gold.toFixed(2)}</span>
          </div>
          <button className="p-1 min-[400px]:p-1.5 rounded-full hover:bg-muted transition-colors relative shrink-0" onClick={() => navigate('/chat')}>
            <Bell className="w-4 h-4 min-[400px]:w-5 min-[400px]:h-5 text-muted-foreground" />
          </button>
          <Link to="/career" className="p-1 min-[400px]:p-1.5 rounded-full hover:bg-muted transition-colors shrink-0">
            <User className="w-4 h-4 min-[400px]:w-5 min-[400px]:h-5 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </header>
  );
}
