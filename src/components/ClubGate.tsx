import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { isClubMember } from '@/lib/membership';
import { ArrowLeft, Lock } from 'lucide-react';

/** Shows children to Clover Club and Gold members; everyone else sees a lock. */
export function ClubGate({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();

  if (loading) return null;
  if (!profile || isClubMember(profile.membership_tier)) return <>{children}</>;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/career')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-black uppercase tracking-wider">{title}</h1>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 text-center border-yellow-400/40"
          data-testid="club-locked"
        >
          <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7 text-yellow-400" />
          </div>
          <p className="font-black text-lg">{title}</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {title} is for Clover Club and Gold members.
          </p>
          <Button variant="gold" className="w-full font-black uppercase tracking-wider" onClick={() => navigate('/membership')}>
            Upgrade
          </Button>
        </motion.div>
      </div>
    </AppLayout>
  );
}
