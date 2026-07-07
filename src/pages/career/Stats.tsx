/**
 * Career Stats - Enhanced Statistics Dashboard
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BarChart3, TrendingUp, Target, Percent } from 'lucide-react';

const STATS = [
  { label: 'Fairways Hit', value: '—', trend: '—', icon: Target },
  { label: 'GIR', value: '—', trend: '—', icon: BarChart3 },
  { label: 'Putts/Round', value: '—', trend: '—', icon: TrendingUp },
  { label: 'Scrambling', value: '—', trend: '—', icon: Percent },
  { label: 'Driving Avg', value: '—', trend: '—', icon: Target },
  { label: 'Scoring Avg', value: '—', trend: '—', icon: BarChart3 },
];

export default function CareerStats() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/career')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Enhanced Stats</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Deep performance metrics</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {STATS.map((stat, i) => {
            const Icon = stat.icon;
            const isPositive = stat.trend.startsWith('+') || stat.trend.startsWith('-');
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass-card p-4"
              >
                <Icon className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-black">{stat.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className={`text-xs font-bold mt-1 ${stat.trend.includes('+') || stat.trend.startsWith('-') && parseFloat(stat.trend) < 0 ? 'text-green-400' : 'text-green-400'}`}>
                  {stat.trend}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
