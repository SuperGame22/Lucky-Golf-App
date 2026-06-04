/**
 * Distance Control Drill
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Target, Zap, RotateCcw } from 'lucide-react';

const DRILLS = [
  { target: 50, club: 'Sand Wedge', tolerance: 5 },
  { target: 100, club: 'Pitching Wedge', tolerance: 8 },
  { target: 150, club: '7 Iron', tolerance: 10 },
  { target: 200, club: '5 Iron', tolerance: 12 },
];

export default function DistanceControl() {
  const navigate = useNavigate();
  const [currentDrill, setCurrentDrill] = useState(0);
  const [results, setResults] = useState<{ target: number; actual: number; diff: number }[]>([]);

  const drill = DRILLS[currentDrill];

  const simulateShot = () => {
    const variance = (Math.random() - 0.5) * drill.tolerance * 4;
    const actual = Math.round(drill.target + variance);
    const diff = Math.abs(actual - drill.target);
    setResults(prev => [...prev, { target: drill.target, actual, diff }]);
    if (currentDrill < DRILLS.length - 1) setCurrentDrill(prev => prev + 1);
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/practice')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Distance Control</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Hit the target distance</p>
          </div>
        </div>

        <div className="glass-card p-6 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Target Distance</p>
          <p className="text-6xl font-black text-primary">{drill.target}</p>
          <p className="text-lg text-muted-foreground">yards</p>
          <p className="text-sm font-bold mt-2 uppercase tracking-wider">{drill.club}</p>
          <p className="text-xs text-muted-foreground">Tolerance: ±{drill.tolerance} yds</p>
        </div>

        <Button className="w-full h-14 text-lg font-black uppercase tracking-wider" onClick={simulateShot}>
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
                    <span className={`text-sm font-black ${r.diff <= DRILLS[i]?.tolerance ? 'text-green-400' : 'text-red-400'}`}>
                      {r.diff <= DRILLS[i]?.tolerance ? 'HIT' : 'MISS'} ({r.diff > 0 ? '+' : ''}{r.actual - r.target})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {results.length >= DRILLS.length && (
          <Button variant="outline" className="w-full font-bold uppercase tracking-wider" onClick={() => { setResults([]); setCurrentDrill(0); }}>
            <RotateCcw className="w-4 h-4 mr-2" /> Restart Drill
          </Button>
        )}
      </div>
    </AppLayout>
  );
}
