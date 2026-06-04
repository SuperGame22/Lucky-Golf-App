import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Target, Dumbbell, Crosshair } from 'lucide-react';

const DRILL_ICONS: Record<string, any> = { putting: Target, distance: Dumbbell, rangefinder: Crosshair };
const DRILL_LABELS: Record<string, string> = { putting: 'Putting Grid', distance: 'Distance Control', rangefinder: 'Rangefinder Sim' };

export default function PracticeSessions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('practice_sessions').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { setSessions(data || []); setLoading(false); });
  }, [user]);

  const thisWeek = sessions.filter(s => new Date().getTime() - new Date(s.created_at).getTime() < 7 * 24 * 60 * 60 * 1000);
  const weekHours = Math.round(thisWeek.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 3600 * 10) / 10;
  const totalMinutes = sessions.reduce((sum, s) => sum + Math.round((s.duration_seconds || 0) / 60), 0);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/practice')}><ArrowLeft className="w-5 h-5" /></Button>
          <div><h1 className="text-2xl font-black uppercase tracking-wider">Sessions</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Your practice history</p></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-4 text-center"><p className="text-2xl font-black text-primary">{sessions.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total</p></div>
          <div className="glass-card p-4 text-center"><p className="text-2xl font-black">{weekHours}h</p><p className="text-[10px] text-muted-foreground uppercase tracking-widest">This Week</p></div>
          <div className="glass-card p-4 text-center"><p className="text-2xl font-black">{totalMinutes}m</p><p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total Time</p></div>
        </div>
        {loading ? <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
          : sessions.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-bold text-muted-foreground">No practice sessions yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Complete a drill to see your history here</p>
              <Button className="mt-4" size="sm" onClick={() => navigate('/practice/putting')}>Start a Drill</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => {
                const Icon = DRILL_ICONS[s.drill_type] || Target;
                return (
                  <div key={s.id} className="glass-card p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5 text-primary" /></div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{DRILL_LABELS[s.drill_type] || s.drill_type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()} - {Math.round((s.duration_seconds || 0) / 60)}m{s.score != null ? ` - Score: ${s.score}` : ''}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </AppLayout>
  );
}
