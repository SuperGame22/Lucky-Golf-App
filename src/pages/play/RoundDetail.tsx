/**
 * A saved round, read-only: /play/rounds/:id
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Round {
  id: string;
  course_name: string | null;
  holes: number | null;
  scores: number[] | null;
  putts: number[] | null;
  total_score: number | null;
  total_par: number | null;
  score_diff: number | null;
  total_putts: number | null;
  holes_played: number | null;
  completed: boolean | null;
  clovers_earned: number | null;
  created_at: string;
}

const diffLabel = (d: number | null | undefined) => (d == null ? '--' : d > 0 ? `+${d}` : d === 0 ? 'E' : String(d));

export default function RoundDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [round, setRound] = useState<Round | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    if (!user || !id) return;
    let alive = true;
    supabase
      .from('rounds')
      .select('id, course_name, holes, scores, putts, total_score, total_par, score_diff, total_putts, holes_played, completed, clovers_earned, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) { setState('missing'); return; }
        setRound(data as Round);
        setState('ready');
      });
    return () => { alive = false; };
  }, [id, user]);

  const scores = round?.scores ?? [];
  const putts = round?.putts ?? [];

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-bold truncate">{round?.course_name || 'Round'}</h1>
            {round && (
              <p className="text-sm text-muted-foreground">
                {new Date(round.created_at).toLocaleDateString()} · {round.holes_played ?? scores.length} of {round.holes ?? scores.length} holes
                {round.completed ? '' : ' · unfinished'}
              </p>
            )}
          </div>
        </div>

        {state === 'loading' && <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />}
        {state === 'missing' && (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground" data-testid="round-missing">
            This round could not be found.
          </div>
        )}

        {round && (
          <>
            <div className="grid grid-cols-3 gap-3 text-center" data-testid="round-summary">
              <div className="glass-card p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Score</p>
                <p className="text-3xl font-display font-bold">{round.total_score ?? '--'}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">To par</p>
                <p className={`text-3xl font-display font-bold ${(round.score_diff ?? 0) > 0 ? 'text-destructive' : (round.score_diff ?? 0) < 0 ? 'text-primary' : ''}`}>
                  {diffLabel(round.score_diff)}
                </p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Putts</p>
                <p className="text-3xl font-display font-bold">{round.total_putts ?? '--'}</p>
              </div>
            </div>

            {scores.length > 0 && (
              <div className="glass-card p-4 overflow-x-auto">
                <table className="w-full text-sm text-center">
                  <thead>
                    <tr className="text-muted-foreground text-xs">
                      <th className="text-left font-medium py-1">Hole</th>
                      {scores.map((_, i) => <th key={i} className="font-medium px-1">{i + 1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-left text-muted-foreground py-1">Score</td>
                      {scores.map((sc, i) => <td key={i} className="font-bold px-1">{sc ?? '-'}</td>)}
                    </tr>
                    {putts.length > 0 && (
                      <tr>
                        <td className="text-left text-muted-foreground py-1">Putts</td>
                        {scores.map((_, i) => <td key={i} className="px-1">{putts[i] ?? '-'}</td>)}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {(round.clovers_earned ?? 0) > 0 && (
              <p className="text-sm text-primary text-center">+{round.clovers_earned} clovers earned</p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
