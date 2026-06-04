import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CloverIcon } from "@/components/icons/CloverIcon";
import { CloverLogo } from '@/components/icons/CloverLogo';
import {
  Package,
  Tag,
  ShoppingCart,
  Users,
  TrendingUp,
  LogOut,
  Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin/login");
        return;
      }
      setUser(session.user);
    };

    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const menuItems = [
    {
      title: "Products",
      description: "Manage golf equipment & inventory",
      icon: Package,
      link: "/admin/products",
      color: "text-primary"
    },
    {
      title: "Promotions",
      description: "Create flash sales & multipliers",
      icon: Tag,
      link: "/admin/promotions",
      color: "text-accent"
    },
    {
      title: "Orders",
      description: "View & manage customer orders",
      icon: ShoppingCart,
      link: "/admin/orders",
      color: "text-blue-500"
    },
    {
      title: "Users",
      description: "Manage users & wallets",
      icon: Users,
      link: "/admin/users",
      color: "text-purple-500"
    },
    {
      title: "Analytics",
      description: "Sales reports & insights",
      icon: TrendingUp,
      link: "/admin/analytics",
      color: "text-green-500"
    },
    {
      title: "Settings",
      description: "Spin prices, clover rates & more",
      icon: Settings,
      link: "/admin/settings",
      color: "text-orange-500"
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CloverLogo className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-display font-bold">Lucky Clover Admin</h1>
              <p className="text-xs text-muted-foreground">
                {user?.email || "Administrator"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">View Store</Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-display font-bold mb-2">Dashboard</h2>
          <p className="text-muted-foreground">Manage your Lucky Clover store</p>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                to={item.link}
                className="glass-card p-6 hover:border-primary/50 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-muted/50 group-hover:bg-primary/10 transition-colors">
                    <Icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-lg mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Products</p>
            <p className="text-3xl font-bold">15</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-sm text-muted-foreground mb-1">Active Promotions</p>
            <p className="text-3xl font-bold">1</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-sm text-muted-foreground mb-1">Pending Orders</p>
            <p className="text-3xl font-bold">0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
