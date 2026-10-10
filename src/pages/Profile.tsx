import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Settings, Trophy, ChevronRight, Crown, LogOut } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CloverIcon } from "@/components/icons/CloverIcon";
import { GoldCoinIcon } from "@/components/icons/GoldCoinIcon";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const TIER_LABEL: Record<string, string> = { free: "Lucky Member", clover: "Clover Member", gold: "Gold Member" };

const menu = [
  { icon: Crown, label: "Membership", to: "/membership" },
  { icon: Trophy, label: "Scorecard History", to: "/play/scorecard" },
  { icon: Settings, label: "Edit Profile", to: "/profile/edit" },
];

const Profile = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tier, setTier] = useState<string>("free");
  const [potMg, setPotMg] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const db = supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: Record<string, unknown> | null }> } } } };
      const [{ data: gp }, { data: gm }] = await Promise.all([
        db.from("golfer_profiles").select("membership_tier").eq("user_id", user.id).maybeSingle(),
        db.from("gold_machines").select("pot_mg").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setTier(String(gp?.membership_tier ?? "free"));
      setPotMg(Number(gm?.pot_mg ?? 0));
    })();
    return () => { cancelled = true; };
  }, [user]);

  const clovers = profile?.clovers ?? 0;
  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  return (
    <AppLayout>
      <div className="px-4 py-6 max-w-md mx-auto space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-background" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-display font-bold truncate">{profile?.display_name || "Lucky Player"}</h1>
            {profile?.username && <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>}
            <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium">
              <CloverIcon className="w-3.5 h-3.5" />{TIER_LABEL[tier] ?? "Lucky Member"}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><CloverIcon className="w-5 h-5 text-primary" /><span>Clovers</span></div>
            <p className="text-3xl font-display font-bold text-primary mt-1">{clovers.toLocaleString()}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><GoldCoinIcon className="w-5 h-5 text-accent" /><span>Gold Pot</span></div>
            <p className="text-3xl font-display font-bold text-accent mt-1">${(potMg / 1000).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{Math.round(potMg).toLocaleString()}mg collected</p>
          </motion.div>
        </div>

        <div className="glass-card divide-y divide-border/50">
          {menu.map(({ icon: Icon, label, to }) => (
            <Link key={to} to={to} className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors">
              <Icon className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1 text-sm">{label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
        </div>

        {tier !== "gold" && (
          <Link to="/membership"><Button variant="gold" className="w-full">Upgrade</Button></Link>
        )}
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />Sign Out
        </Button>
      </div>
    </AppLayout>
  );
};

export default Profile;
