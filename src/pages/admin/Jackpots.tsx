/**
 * Admin — Weekly Jackpots
 * /admin/jackpots
 * Requires golfer_profiles.role = 'admin' | 'super_admin'
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, ChevronLeft, Trophy, Users, CheckCircle2, Upload, Link as LinkIcon,
  XCircle, Loader2, Eye, Play, Edit3, Award, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

type JackpotStatus = 'draft' | 'active' | 'closed' | 'cancelled' | 'fulfilled';

interface Jackpot {
  id: string;
  title: string;
  description: string | null;
  prize_name: string;
  prize_value: number | null;
  prize_image_url: string | null;
  status: JackpotStatus;
  starts_at: string;
  ends_at: string;
  winner_user_id: string | null;
  winner_selected_at: string | null;
  created_at: string;
}

interface Entry { id: string; user_id: string; created_at: string; source: string; source_ref: string | null; }

const STATUS_COLORS: Record<JackpotStatus, string> = {
  draft:     'bg-muted text-muted-foreground',
  active:    'bg-green-500/20 text-green-400',
  closed:    'bg-yellow-500/20 text-yellow-400',
  cancelled: 'bg-red-500/20 text-red-400',
  fulfilled: 'bg-blue-500/20 text-blue-400',
};

const BLANK_FORM = {
  title: '', description: '', prize_name: '', prize_value: '',
  prize_image_url: '', starts_at: '', ends_at: '', status: 'draft' as JackpotStatus,
};

export default function AdminJackpots() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [jackpots, setJackpots] = useState<Jackpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Jackpot | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Jackpot | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [winner, setWinner] = useState<any>(null);
  const [selectingWinner, setSelectingWinner] = useState(false);
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `prizes/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('prize-images').upload(path, file, { upsert: true });
    if (error) { toast.error('Upload failed: ' + error.message); setUploading(false); return; }
    const { data } = supabase.storage.from('prize-images').getPublicUrl(path);
    setForm(f => ({ ...f, prize_image_url: data.publicUrl }));
    toast.success('Image uploaded!');
    setUploading(false);
  };

  // Role guard
  const isAdmin = (profile as any)?.role === 'admin' || (profile as any)?.role === 'super_admin';

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('weekly_jackpots')
      .select('*').order('created_at', { ascending: false });
    setJackpots(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadEntries = async (jackpotId: string) => {
    setEntriesLoading(true);
    const { data } = await supabase.from('jackpot_entries')
      .select('*').eq('jackpot_id', jackpotId).order('created_at', { ascending: false });
    setEntries(data ?? []);
    setEntriesLoading(false);
  };

  const openView = (j: Jackpot) => {
    setSelected(j);
    setWinner(null);
    loadEntries(j.id);
  };

  const openEdit = (j: Jackpot) => {
    setEditing(j);
    setForm({
      title: j.title, description: j.description ?? '',
      prize_name: j.prize_name, prize_value: String(j.prize_value ?? ''),
      prize_image_url: j.prize_image_url ?? '',
      starts_at: j.starts_at?.slice(0, 16) ?? '',
      ends_at:   j.ends_at?.slice(0, 16) ?? '',
      status: j.status,
    });
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK_FORM);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title || !form.prize_name || !form.starts_at || !form.ends_at) {
      toast.error('Title, prize name, start, and end are required');
      return;
    }
    setSaving(true);
    const payload = {
      p_jackpot_id: editing?.id ?? null,
      p_title: form.title,
      p_description: form.description || null,
      p_prize_name: form.prize_name,
      p_prize_value: form.prize_value ? parseFloat(form.prize_value) : null,
      p_prize_image: form.prize_image_url || null,
      p_starts_at: new Date(form.starts_at).toISOString(),
      p_ends_at:   new Date(form.ends_at).toISOString(),
      p_status: form.status,
    };
    const { error } = await supabase.rpc('admin_update_jackpot', payload);
    if (error) { toast.error(error.message); } else {
      toast.success(editing ? 'Jackpot updated' : 'Jackpot created');
      setShowForm(false);
      load();
    }
    setSaving(false);
  };

  const setStatus = async (j: Jackpot, status: JackpotStatus) => {
    const { error } = await supabase.rpc('admin_update_jackpot', {
      p_jackpot_id: j.id,
      p_title: j.title,
      p_description: j.description,
      p_prize_name: j.prize_name,
      p_prize_value: j.prize_value,
      p_prize_image: j.prize_image_url,
      p_starts_at: j.starts_at,
      p_ends_at: j.ends_at,
      p_status: status,
    });
    if (error) toast.error(error.message);
    else { toast.success(`Jackpot ${status}`); load(); setSelected(null); }
  };

  const selectWinner = async (jackpotId: string) => {
    setSelectingWinner(true);
    const { data, error } = await supabase.rpc('select_jackpot_winner', { p_jackpot_id: jackpotId });
    setSelectingWinner(false);
    if (error) { toast.error(error.message); return; }
    setWinner(data);
    toast.success('Winner selected!');
    load();
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="font-black text-lg">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-1">Admin role required.</p>
          <Button className="mt-6" onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}><ChevronLeft /></Button>
            <div>
              <h1 className="text-xl font-black">Weekly Jackpots</h1>
              <p className="text-xs text-muted-foreground">Admin panel</p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> New</Button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : jackpots.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-bold">No jackpots yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create the first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jackpots.map(j => (
              <motion.div key={j.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold truncate">{j.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_COLORS[j.status]}`}>
                        {j.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{j.prize_name}{j.prize_value ? ` · $${j.prize_value}` : ''}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(j.starts_at).toLocaleDateString()} → {new Date(j.ends_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openView(j)} title="View entries"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(j)} title="Edit"><Edit3 className="w-4 h-4" /></Button>
                  </div>
                </div>
                {/* Quick actions */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {j.status === 'draft' && (
                    <Button size="sm" variant="outline" className="gap-1 text-green-400 border-green-400/30"
                      onClick={() => setStatus(j, 'active')}><Play className="w-3 h-3" /> Activate</Button>
                  )}
                  {j.status === 'active' && (
                    <Button size="sm" variant="outline" className="gap-1 text-yellow-400 border-yellow-400/30"
                      onClick={() => setStatus(j, 'closed')}><XCircle className="w-3 h-3" /> Close</Button>
                  )}
                  {j.status === 'closed' && !j.winner_user_id && (
                    <Button size="sm" variant="outline" className="gap-1 text-accent border-accent/30"
                      onClick={() => openView(j)}><Award className="w-3 h-3" /> Select Winner</Button>
                  )}
                  {j.status === 'closed' && j.winner_user_id && (
                    <Button size="sm" variant="outline" className="gap-1 text-blue-400 border-blue-400/30"
                      onClick={() => setStatus(j, 'fulfilled')}><CheckCircle2 className="w-3 h-3" /> Mark Fulfilled</Button>
                  )}
                  {(j.status === 'draft' || j.status === 'active') && (
                    <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30"
                      onClick={() => setStatus(j, 'cancelled')}><XCircle className="w-3 h-3" /> Cancel</Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Detail / Entries drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-black text-lg">{selected.title}</h2>
                  <p className="text-sm text-muted-foreground">{selected.prize_name}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><XCircle className="w-5 h-5" /></Button>
              </div>

              {/* Winner */}
              {winner && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
                  <Award className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <p className="font-black">Winner Selected!</p>
                  <p className="text-sm text-muted-foreground mt-1">User: {winner.winner_user_id}</p>
                  <p className="text-xs text-muted-foreground">{winner.total_entries} total entries · {winner.winning_entry_number} winning #</p>
                </div>
              )}

              {selected.winner_user_id && !winner && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
                  <Award className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <p className="font-bold text-sm">Winner already selected</p>
                  <p className="text-xs text-muted-foreground mt-1">{selected.winner_user_id}</p>
                </div>
              )}

              {/* Select winner button */}
              {selected.status === 'closed' && !selected.winner_user_id && !winner && (
                <Button className="w-full gap-2" onClick={() => selectWinner(selected.id)} disabled={selectingWinner}>
                  {selectingWinner ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4" /> Select Random Winner</>}
                </Button>
              )}

              {/* Entries */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Entries ({entries.length})</span>
                </div>
                {entriesLoading ? (
                  <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
                ) : entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No entries yet.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {entries.map(e => (
                      <div key={e.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/50">
                        <span className="font-mono truncate max-w-[180px]">{e.user_id}</span>
                        <span className="text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</span>
                        <span className="text-primary">{e.source}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create / Edit form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowForm(false)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="font-black text-lg">{editing ? 'Edit Jackpot' : 'New Jackpot'}</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><XCircle className="w-5 h-5" /></Button>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'title', label: 'Title *', placeholder: 'Week 23 Jackpot' },
                  { key: 'prize_name', label: 'Prize Name *', placeholder: 'TaylorMade Driver' },
                  { key: 'prize_value', label: 'Prize Value ($)', placeholder: '299.99' },
                  
                  { key: 'description', label: 'Description', placeholder: 'Optional details...' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">{label}</label>
                    <input
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                      placeholder={placeholder}
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                {/* Prize Image — URL or Upload */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Prize Image</label>
                  <div className="flex gap-2 mb-2">
                    <button type="button"
                      onClick={() => setImageMode('url')}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${imageMode === 'url' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                      <LinkIcon className="w-3 h-3" /> URL
                    </button>
                    <button type="button"
                      onClick={() => setImageMode('upload')}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${imageMode === 'upload' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                      <Upload className="w-3 h-3" /> Upload
                    </button>
                  </div>
                  {imageMode === 'url' ? (
                    <input
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                      placeholder="https://example.com/driver.jpg"
                      value={form.prize_image_url}
                      onChange={e => setForm(f => ({ ...f, prize_image_url: e.target.value }))}
                    />
                  ) : (
                    <div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full flex items-center justify-center gap-2 bg-muted border border-dashed border-border rounded-lg px-3 py-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? 'Uploading...' : 'Click to choose image'}
                      </button>
                    </div>
                  )}
                  {form.prize_image_url && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={form.prize_image_url} alt="preview" className="w-12 h-12 object-contain rounded-lg bg-muted border border-border" />
                      <span className="text-xs text-muted-foreground truncate flex-1">{form.prize_image_url.split('/').pop()}</span>
                      <button type="button" onClick={() => setForm(f => ({ ...f, prize_image_url: '' }))}
                        className="text-xs text-destructive hover:underline">Remove</button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {['starts_at', 'ends_at'].map(key => (
                    <div key={key}>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                        {key === 'starts_at' ? 'Starts *' : 'Ends *'}
                      </label>
                      <input type="datetime-local"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                        value={(form as any)[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
                  <select className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                    value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as JackpotStatus }))}>
                    {['draft','active','closed','cancelled','fulfilled'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button className="w-full" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'Save Changes' : 'Create Jackpot')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
