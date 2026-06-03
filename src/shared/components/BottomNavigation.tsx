import { Link, useLocation } from "react-router-dom";
import { Home, Target, Play, Trophy, Gift } from 'lucide-react';

export const BottomNavigate = () => {
  const location = useLocation();
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Target, label: 'Practice', path: '/practice' },
    { icon: Play, label: 'Play', path: '/play' },
    { icon: Trophy, label: 'Career', path: '/career' },
    { icon: Gift, label: 'Earn', path: '/earn' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-green-900/30 px-6 py-3 flex items-center justify-between z-50">
      {navItems.map((item) => (
        <Link key={item.path} to={item.path} className{`flex flex-col items-center gap-1 ${location.pathname === item.path ? 'text-primary' : 'text-muted-foreground'}`}>
          <item.icon className="w-6 h-6" />
          <span className="text-[10px] font-medium">{item.label]</span>
        </Link>
      )]}
    </nav>
  );
};
