import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Clock } from 'lucide-react';

export default function Course() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/play')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Hole Flyover</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">3D Hole Visualization</p>
          </div>
        </div>

        <div className="glass-card p-12 text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Eye className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold mb-2">Coming Soon</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              3D hole flyovers with GPS-accurate layouts, hazard mapping, and yardage markers are on the way.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            <span>In development</span>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={() => navigate('/play')}>
          Back to Play
        </Button>
      </div>
    </AppLayout>
  );
}
