/** All of the player's saved rounds, newest first: /play/rounds */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Flag, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Row = { id: string; course_name: string | null; total_score: number | null; score_diff: number | null; holes_played: number | null; holes: number | null; completed: boolean | null; created_at: string };

export default function RoundHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from('rounds')
      .select('id, course_name, total_score, score_diff, holes_played, holes, completed, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error('round history:', error.message);
        setRows((data as Row[]) ?? []);
      });
    return () => { alive = false; };
  }, [user]);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold">Scorecard History</h1>
        </div>

        {rows === null ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        ) : rows.length === 0 ? (
          <div className="glass-card p-8 text-center space-y-3">
            <Flag className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No rounds saved yet</p>
            <Button onClick={() => navigate('/play/start')}>Start a Round</Button>
          </div>
        ) : (
          <div className="glass-card divide-y divide-border/50" data-testid="round-history">
            {rows.map((r) => {
              const d = r.score_diff;
              return (
                <button key={r.id} type="button" onClick={() => navigate(`/play/rounds/${r.id}`)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.course_name || 'Round'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()} · {r.holes_played ?? '?'} holes{r.completed ? '' : ' · unfinished'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold">{r.total_score ?? '--'}</p>
                    <p className={`text-xs ${d == null ? '' : d > 0 ? 'text-destructive' : d < 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {d == null ? '' : d > 0 ? `+${d}` : d === 0 ? 'E' : d}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
