/**
 * Start New Round - Course search & selection
 * Courses come from the `courses` table (OpenStreetMap; yardages are estimates).
 */

import { MAX_COURSES, rankCourses } from '@/features/courses/courseList';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Play, ArrowLeft, Check, Search, LocateFixed, Loader2 } from 'lucide-react';
import type { SelectedCourse } from '@/pages/Scorecard';

type CourseRow = SelectedCourse & { par: number | null };

const COLUMNS = 'id, name, city, state, holes, par, hole_data';

// Strip characters that would break the PostgREST or() filter.
const clean = (q: string) => q.replace(/[,()%*\\]/g, ' ').trim();

export default function StartRound() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CourseRow | null>(null);
  const [moreMatches, setMoreMatches] = useState(false);

  useEffect(() => {
    if (nearMe) return;
    const q = clean(query);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('courses')
        .select(COLUMNS)
        .or(`name.ilike.%${q}%,city.ilike.%${q}%`)
        .order('name')
        .limit(25);
      setLoading(false);
      if (error) setError('Could not load courses. Try again.');
      else {
        setError(null);
        const rows = rankCourses((data ?? []) as unknown as CourseRow[], q);
        setMoreMatches(rows.length > MAX_COURSES);
        setResults(rows.slice(0, MAX_COURSES));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, nearMe]);

  const findNearMe = () => {
    if (!navigator.geolocation) {
      setError('Location is not available on this device.');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lon } = coords;
        const d = 0.25; // ~17 miles
        const { data, error } = await supabase
          .from('courses')
          .select(`${COLUMNS}, lat, lon`)
          .gte('lat', lat - d).lte('lat', lat + d)
          .gte('lon', lon - d).lte('lon', lon + d)
          .limit(200);
        setLoading(false);
        if (error) {
          setError('Could not load courses. Try again.');
          return;
        }
        const rows = ((data ?? []) as unknown as (CourseRow & { lat: number; lon: number })[])
          .map((c) => ({ c, dist: Math.hypot(c.lat - lat, (c.lon - lon) * Math.cos((lat * Math.PI) / 180)) }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, MAX_COURSES)
          .map((x) => x.c);
        setNearMe(true);
        setMoreMatches(false);
        setQuery('');
        setResults(rows);
        if (rows.length === 0) setError('No courses found within about 17 miles.');
      },
      () => {
        setLoading(false);
        setError('Location permission denied. Search by name or city instead.');
      },
      { timeout: 10000 },
    );
  };

  const teeOff = () =>
    navigate('/play/scorecard', {
      state: selected ? { course: selected } : undefined,
    });

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/play')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">New Round</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Select course</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setNearMe(false);
                setQuery(e.target.value);
              }}
              placeholder="Search by course name or city"
              className="pl-9"
              data-testid="course-search"
            />
          </div>
          <Button variant="outline" className="w-full" onClick={findNearMe} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LocateFixed className="w-4 h-4 mr-2" />}
            Courses near me
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-2">
          {results.map((c) => {
            const isSel = selected?.id === c.id;
            return (
              <motion.div
                key={c.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(c)}
                className={`glass-card p-4 cursor-pointer transition-all ${
                  isSel ? '!border-primary !bg-primary/10 ring-2 ring-primary' : 'hover:!border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className={`w-5 h-5 ${isSel ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-bold text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[c.city, c.state].filter(Boolean).join(', ')}
                        {c.holes ? ` · ${c.holes} holes` : ''}
                        {c.par ? ` · Par ${c.par}` : ''}
                      </p>
                    </div>
                  </div>
                  {isSel && <Check className="w-5 h-5 text-primary" />}
                </div>
              </motion.div>
            );
          })}
          {moreMatches && (
            <p className="text-xs text-muted-foreground text-center" data-testid="more-courses-hint">
              Showing the top {MAX_COURSES} — keep typing to narrow it down.
            </p>
          )}
          {nearMe && results.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">The {results.length} closest to you.</p>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Search by name or city, or tap Courses near me.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Button
            className="w-full h-14 text-lg font-black uppercase tracking-wider"
            size="lg"
            disabled={!selected}
            onClick={teeOff}
            data-testid="start-round-btn"
          >
            <Play className="w-5 h-5 mr-2" /> Tee Off
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/play/scorecard')}>
            Skip, play a practice round
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Yardages are approximate. Course data © OpenStreetMap contributors.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
