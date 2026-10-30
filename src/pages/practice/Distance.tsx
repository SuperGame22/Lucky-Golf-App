import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { DISTANCE_DRILLS as DRILLS, addShot, countHits, currentDrillIndex, type ShotResult } from '@/features/practice/distance';
import { elapsedSeconds } from '@/features/putting/round';
import { ArrowLeft, Target, Zap, RotateCcw } from 'lucide-react';

export default function DistanceControl() {
  const navigate = useNavigate();
  const [results, setResults] = useState<ShotResult[]>([]);
  const startedAt = useRef(Date.now());
  const logged = useRef(false);

  const currentDrill = currentDrillIndex(results);
  const drill = DRILLS[currentDrill];
  const done = results.length >= DRILLS.length;

  // Log the finished set once (a quick double-tap can't log it twice).
  useEffect(() => {
    if (!done || logged.current) return;
    logged.current = true;
    const hits = countHits(results);
    const duration = elapsedSeconds(startedAt.current, Date.now());
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('practice_sessions')
        .insert({ user_id: user.id, drill_type: 'distance', duration_seconds: duration, score: hits, holes_completed: DRILLS.length })
        .then(() => undefined, () => undefined);
    });
  }, [done, results]);

  const simulateShot = () => {
    const variance = (Math.random() - 0.5) * drill.tolerance * 4;
    const actual = Math.round(drill.target + variance);
    setResults((prev) => addShot(prev, actual));
  };

  const restart = () => {
    setResults([]);
    startedAt.current = Date.now();
    logged.current = false;
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/practice')}><ArrowLeft className="w-5 h-5" /></Button>
          <div><h1 className="text-2xl font-black uppercase tracking-wider">Distance Control</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Hit the target distance</p></div>
        </div>
        <div className="glass-card p-6 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Target Distance</p>
          <p className="text-6xl font-black text-primary">{drill.target}</p>
          <p className="text-lg text-muted-foreground">yards</p>
          <p className="text-sm font-bold mt-2 uppercase tracking-wider">{drill.club}</p>
          <p className="text-xs text-muted-foreground">Tolerance: plus/minus {drill.tolerance} yds</p>
        </div>
        <Button className="w-full h-14 text-lg font-black uppercase tracking-wider" onClick={simulateShot} disabled={results.length >= DRILLS.length}>
          <Zap className="w-5 h-5 mr-2" /> Hit Shot
        </Button>
        {results.length > 0 && (
          <div className="glass-card p-4">
            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Results</p>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <span className="text-sm font-bold">Shot {i + 1}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">{r.actual} yds</span>
                    <span className={`text-sm font-black ${r.diff <= (DRILLS[i]?.tolerance ?? 10) ? 'text-green-400' : 'text-red-400'}`}>
                      {r.diff <= (DRILLS[i]?.tolerance ?? 10) ? 'HIT' : 'MISS'} ({r.actual - r.target > 0 ? '+' : ''}{r.actual - r.target})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {results.length >= DRILLS.length && (
          <Button variant="outline" className="w-full font-bold uppercase tracking-wider" onClick={restart}>
            <RotateCcw className="w-4 h-4 mr-2" /> Restart Drill
          </Button>
        )}
      </div>
    </AppLayout>
  );
}
