/**
 * Practice Sessions History — Empty state (no mock data)
 */

import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Target } from 'lucide-react';

export default function PracticeSessions() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/practice')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Sessions</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Your practice history</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-black text-primary">0</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-black">0h</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">This Week</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-black text-muted-foreground">&mdash;</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Improve</p>
          </div>
        </div>

        <div className="glass-card p-8 text-center">
          <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-bold text-muted-foreground">No practice sessions yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Complete a drill to see your history here</p>
          <Button className="mt-4" size="sm" onClick={() => navigate('/practice/putting')}>
            Start a Drill
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
