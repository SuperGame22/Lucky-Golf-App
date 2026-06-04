/**
 * Personal Caddie - AI Shot Recommendations (Gold Tier)
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  Wind,
  Target,
  ArrowLeft,
  Zap,
  TrendingUp,
  Flag,
  MapPin,
} from 'lucide-react';

const RECOMMENDATIONS = [
  { club: '7 Iron', distance: '155 yds', confidence: 92, wind: 'Crosswind 8mph R', tip: 'Aim 5 yards left to compensate for wind. Smooth tempo.' },
  { club: '8 Iron', distance: '142 yds', confidence: 78, wind: 'Crosswind 8mph R', tip: 'Safer play. Less affected by wind but might come up short.' },
  { club: '6 Iron', distance: '168 yds', confidence: 65, wind: 'Crosswind 8mph R', tip: 'Aggressive. Only if you need to carry the back bunker.' },
];

export default function PersonalCaddie() {
  const navigate = useNavigate();
  const [selectedClub, setSelectedClub] = useState(0);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/play')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Personal Caddie</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">AI-Powered Shot Analysis</p>
          </div>
        </div>

        {/* Tier Badge */}
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-yellow-500">Gold Tier Feature</span>
        </div>

        {/* Current Situation */}
        <div className="glass-card p-5">
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Current Lie</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <Flag className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-xl font-black">156</p>
              <p className="text-[10px] text-muted-foreground uppercase">To Pin</p>
            </div>
            <div className="text-center">
              <Wind className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <p className="text-xl font-black">8</p>
              <p className="text-[10px] text-muted-foreground uppercase">Wind MPH</p>
            </div>
            <div className="text-center">
              <MapPin className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <p className="text-xl font-black">FW</p>
              <p className="text-[10px] text-muted-foreground uppercase">Lie</p>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Caddie Recommends</p>
          <div className="space-y-3">
            {RECOMMENDATIONS.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setSelectedClub(i)}
                className={`glass-card p-4 cursor-pointer transition-all ${
                  selectedClub === i ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      i === 0 ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <Target className={`w-5 h-5 ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-black text-lg">{rec.club}</p>
                      <p className="text-xs text-muted-foreground">{rec.distance}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <TrendingUp className={`w-3 h-3 ${rec.confidence >= 90 ? 'text-green-400' : rec.confidence >= 75 ? 'text-yellow-400' : 'text-orange-400'}`} />
                      <span className={`font-black ${rec.confidence >= 90 ? 'text-green-400' : rec.confidence >= 75 ? 'text-yellow-400' : 'text-orange-400'}`}>
                        {rec.confidence}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Confidence</p>
                  </div>
                </div>
                {selectedClub === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-3 pt-3 border-t border-border"
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">{rec.tip}</p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        <Button className="w-full h-12 font-black uppercase tracking-wider" onClick={() => navigate('/play')}>
          Back to Round
        </Button>
      </div>
    </AppLayout>
  );
}
