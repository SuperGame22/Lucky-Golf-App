import { Link, useLocation } from "react-router-dom";
import { Home, Crosshair, Play, Trophy, Coins } from "lucide-react";
import { FULL_SCREEN_ROUTES } from "@/shared/fullScreenRoutes";

export const BottomNavigation = () => {
  const location = useLocation();
  if (FULL_SCREEN_ROUTES.includes(location.pathname)) return null;
  const navItems = [
    { icon: Home,     label: "Home",     path: "/" },
    { icon: Crosshair, label: "Practice", path: "/practice" },
    { icon: Play,     label: "Play",     path: "/play" },
    { icon: Trophy,   label: "Career",   path: "/career" },
    { icon: Coins,     label: "Earn",     path: "/earn" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-green-900/30 px-6 py-3 flex items-center justify-between z-50">
      {navItems.map((item) => {
        const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-1 ${active ? "text-primary" : "text-muted-foreground"}`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNavigation;
