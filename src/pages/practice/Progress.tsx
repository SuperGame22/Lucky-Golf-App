/**
 * Progress Tracking - Practice improvement over time
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Award, Zap, Target } from 'lucide-react';

const PROGRESS_DATA = [65, 68, 72, 70, 75, 78, 82, 80, 85, 88, 85, 90];
const SKILLS = [
  { name: 'Putting', level: 78, change: +5 },
  { name: 'Driving', level: 65, change: +3 },
  { name: 'Iron Play', level: 72, change: +8 },
  { name: 'Short Game', level: 85, change: +2 },
  { name: 'Course Management', level: 60, change: +10 },
];

export default function PracticeProgress() {
  const navigate = useNavigate();
  const max = Math.max(...PROGRESS_DATA);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/practice')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Progress</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Your improvement journey</p>
          </div>
        </div>

        {/* Chart */}
        <div className="glass-card p-5">
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4">Performance Trend (12 weeks)</p>
          <div className="flex items-end gap-1 h-40">
            {PROGRESS_DATA.map((v, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${(v / max) * 100}%` }}
                transition={{ delay: i * 0.05 }}
                className="flex-1 bg-primary/80 rounded-t-md hover:bg-primary transition-colors cursor-pointer relative group"
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">{v}%</span>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-muted-foreground">
            <span>12w ago</span><span>Now</span>
          </div>
        </div>

        {/* Skills */}
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Skill Breakdown</p>
          <div className="space-y-3">
            {SKILLS.map((skill, i) => (
              <div key={skill.name} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{skill.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-xs font-bold">+{skill.change}%</span>
                    <span className="font-black">{skill.level}%</span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${skill.level}%` }} transition={{ delay: i * 0.1 }}
                    className="bg-primary h-2 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-yellow-500" />
            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Next Milestone</p>
          </div>
          <p className="font-bold">90% Overall Accuracy</p>
          <p className="text-xs text-muted-foreground">2% away · Keep it up!</p>
        </div>
      </div>
    </AppLayout>
  );
}
