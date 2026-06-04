/**
 * Foursome Finder — Create/Join groups with invite codes
 * Connected to Supabase foursome_posts table + Realtime
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  createFoursomePost,
  joinFoursome,
  getOpenFoursomes,
  generateInviteCode,
} from '@/services/realtimeService';
import {
  Users,
  MapPin,
  Clock,
  ArrowLeft,
  UserPlus,
  Check,
  Copy,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Hash,
} from 'lucide-react';

type View = 'browse' | 'create' | 'join';

export default function FoursomeFinder() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [view, setView] = useState<View>('browse');
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Join form
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  // Create form
  const [newPost, setNewPost] = useState({
    title: '',
    course_name: '',
    tee_time: '',
    skill_level: 'intermediate',
    max_players: 4,
    description: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    const { data } = await getOpenFoursomes();
    setGroups(data);
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!inviteCode.trim()) { setError('Enter an invite code'); return; }
    setJoinLoading(true);
    setError(null);
    const { data, error: err } = await joinFoursome(inviteCode.trim());
    if (err) setError(err);
    else { setSuccess(`Joined foursome at ${(data as any)?.course_name || 'the course'}!`); setInviteCode(''); loadGroups(); }
    setJoinLoading(false);
  };

  const handleCreate = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!newPost.title.trim() || !newPost.course_name.trim()) {
      setError('Title and course are required');
      return;
    }
    setCreateLoading(true);
    setError(null);
    const { data, error: err } = await createFoursomePost(newPost);
    if (err) setError(err);
    else {
      setCreatedCode((data as any)?.invite_code || null);
      setSuccess('Foursome created!');
      loadGroups();
    }
    setCreateLoading(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setSuccess('Code copied!');
    setTimeout(() => setSuccess(null), 2000);
  };

  // ── BROWSE VIEW ──
  if (view === 'browse') {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/play')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-black uppercase tracking-wider">Foursome Finder</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                {user ? `Playing as ${profile?.display_name || user.email}` : 'Sign in to join groups'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button className="flex-1 font-black uppercase tracking-wider text-xs" onClick={() => {
              if (!user) { navigate('/auth'); return; }
              setView('create');
              setError(null); setSuccess(null); setCreatedCode(null);
            }}>
              <Plus className="w-4 h-4 mr-1" /> Create
            </Button>
            <Button variant="outline" className="flex-1 font-black uppercase tracking-wider text-xs" onClick={() => {
              if (!user) { navigate('/auth'); return; }
              setView('join');
              setError(null); setSuccess(null);
            }}>
              <Hash className="w-4 h-4 mr-1" /> Join by Code
            </Button>
          </div>

          {/* Feedback */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-xs text-green-400">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Groups List */}
          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No open foursomes yet</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to create one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g: any, i: number) => (
                <motion.div key={g.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="glass-card p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-black text-sm">{g.title || 'Open Round'}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {g.skill_level || 'All levels'}
                      </p>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                      g.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'
                    }`}>{g.spots_available} spot{g.spots_available !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-3 h-3 text-primary" />
                      <span>{g.course_name || 'TBD'}</span>
                    </div>
                    {g.tee_time && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{g.tee_time}</span>
                      </div>
                    )}
                  </div>
                  {g.invite_code && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-muted/50 border border-border rounded px-2 py-1 tracking-widest">
                        {g.invite_code}
                      </span>
                      <button onClick={() => copyCode(g.invite_code)} className="text-muted-foreground hover:text-primary transition-colors">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // ── JOIN VIEW ──
  if (view === 'join') {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setView('browse'); setError(null); }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider">Join Foursome</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Enter your invite code</p>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500" /><p className="text-xs text-red-400">{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                <Check className="w-4 h-4 text-green-500" /><p className="text-xs text-green-400">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass-card p-6 text-center">
            <Hash className="w-10 h-10 text-primary mx-auto mb-4" />
            <input
              type="text"
              placeholder="XXXXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
              data-testid="invite-code-input"
              className="w-full h-14 text-center text-2xl font-mono font-black tracking-[0.4em] bg-black/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 uppercase"
            />
          </div>

          <Button className="w-full h-12 font-black uppercase tracking-wider" disabled={joinLoading || inviteCode.length < 6}
            onClick={handleJoin} data-testid="join-foursome-btn">
            {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4 mr-2" /> Join Foursome</>}
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ── CREATE VIEW ──
  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setView('browse'); setError(null); setCreatedCode(null); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Create Foursome</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Set up your group</p>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500" /><p className="text-xs text-red-400">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {createdCode ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 text-center space-y-4">
            <Check className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-black uppercase tracking-wider">Foursome Created!</h2>
            <p className="text-xs text-muted-foreground">Share this code with your playing partners:</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-mono font-black tracking-[0.3em] text-primary" data-testid="created-invite-code">
                {createdCode}
              </span>
              <button onClick={() => copyCode(createdCode)} className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
                <Copy className="w-5 h-5 text-primary" />
              </button>
            </div>
            <Button className="w-full font-black uppercase tracking-wider mt-4" onClick={() => { setView('browse'); setCreatedCode(null); }}>
              Done
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">Title</label>
              <input type="text" placeholder="Saturday Morning Round" value={newPost.title}
                onChange={(e) => setNewPost(p => ({ ...p, title: e.target.value }))}
                className="w-full h-11 bg-black/40 border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">Course</label>
              <input type="text" placeholder="Pebble Beach Golf Links" value={newPost.course_name}
                onChange={(e) => setNewPost(p => ({ ...p, course_name: e.target.value }))}
                className="w-full h-11 bg-black/40 border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">Tee Time</label>
              <input type="text" placeholder="Tomorrow 8:30 AM" value={newPost.tee_time}
                onChange={(e) => setNewPost(p => ({ ...p, tee_time: e.target.value }))}
                className="w-full h-11 bg-black/40 border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">Skill Level</label>
                <select value={newPost.skill_level} onChange={(e) => setNewPost(p => ({ ...p, skill_level: e.target.value }))}
                  className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">Max Players</label>
                <select value={newPost.max_players} onChange={(e) => setNewPost(p => ({ ...p, max_players: Number(e.target.value) }))}
                  className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60">
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
            </div>

            <Button className="w-full h-12 font-black uppercase tracking-wider" disabled={createLoading}
              onClick={handleCreate} data-testid="create-foursome-btn">
              {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Create & Get Code</>}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
