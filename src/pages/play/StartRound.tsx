/**
 * Start New Round - Course & Tee Selection
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { MapPin, Play, Users, Clock, ArrowLeft, Check } from 'lucide-react';

const COURSES = [
  { id: '1', name: 'Pebble Beach Golf Links', city: 'Pebble Beach, CA', holes: 18, rating: 4.9 },
  { id: '2', name: 'Augusta National Golf Club', city: 'Augusta, GA', holes: 18, rating: 5.0 },
  { id: '3', name: 'TPC Sawgrass', city: 'Ponte Vedra Beach, FL', holes: 18, rating: 4.7 },
  { id: '4', name: 'Torrey Pines Golf Course', city: 'San Diego, CA', holes: 18, rating: 4.6 },
];

const TEE_OPTIONS = [
  { name: 'Championship', color: 'bg-black', distance: '7,200 yds' },
  { name: 'Blue', color: 'bg-blue-500', distance: '6,700 yds' },
  { name: 'White', color: 'bg-white border border-border', distance: '6,200 yds' },
  { name: 'Forward', color: 'bg-red-500', distance: '5,400 yds' },
];

export default function StartRound() {
  const navigate = useNavigate();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedTee, setSelectedTee] = useState(2);
  const [holes, setHoles] = useState<9 | 18>(18);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/play')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">New Round</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Select course & tees</p>
          </div>
        </div>

        {/* Course Selection */}
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Select Course</p>
          <div className="space-y-2">
            {COURSES.map(c => (
              <motion.div
                key={c.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCourse(c.id)}
                className={`glass-card p-4 cursor-pointer transition-all ${
                  selectedCourse === c.id ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className={`w-5 h-5 ${selectedCourse === c.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-bold text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.city}</p>
                    </div>
                  </div>
                  {selectedCourse === c.id && <Check className="w-5 h-5 text-primary" />}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Tee Selection */}
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Tees</p>
          <div className="grid grid-cols-2 gap-2">
            {TEE_OPTIONS.map((tee, i) => (
              <button
                key={tee.name}
                onClick={() => setSelectedTee(i)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedTee === i ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-4 h-4 rounded-full ${tee.color}`} />
                  <span className="font-bold text-sm">{tee.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{tee.distance}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Holes */}
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">Holes</p>
          <div className="flex gap-3">
            {([9, 18] as const).map(h => (
              <button
                key={h}
                onClick={() => setHoles(h)}
                className={`flex-1 p-4 rounded-xl border text-center font-black text-lg transition-all ${
                  holes === h ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                }`}
              >
                {h} Holes
              </button>
            ))}
          </div>
        </div>

        <Button
          className="w-full h-14 text-lg font-black uppercase tracking-wider"
          size="lg"
          disabled={!selectedCourse}
          onClick={() => navigate('/play/scorecard')}
          data-testid="start-round-btn"
        >
          <Play className="w-5 h-5 mr-2" /> Tee Off
        </Button>
      </div>
    </AppLayout>
  );
}
