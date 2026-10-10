/**
 * Admin — Course requests
 * /admin/courses
 * Read the scorecard photo, enter the pars (and yardages), approve it into the course finder or reject it.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { buildHoleData, emptyHoles, type HoleInput } from '@/features/courses/requests';

interface Req { id: string; course_name: string; city: string | null; state: string; notes: string | null; photo_path: string; created_at: string; submitted_by: string | null }

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc).call(supabase, fn, args);

export default function AdminCourseRequests() {
  const navigate = useNavigate();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Req | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [n, setN] = useState<9 | 18>(18);
  const [holes, setHoles] = useState<HoleInput[]>(emptyHoles(18));
  const [form, setForm] = useState({ name: '', city: '', state: '' });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await rpc('admin_list_course_requests', { p_status: 'pending' });
    const res = data as { success?: boolean; requests?: Req[] } | null;
    setReqs(res?.success ? res.requests ?? [] : []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openReq = async (r: Req) => {
    setOpen(r);
    setForm({ name: r.course_name, city: r.city ?? '', state: r.state });
    setReason('');
    setN(18);
    setHoles(emptyHoles(18));
    setPhotoUrl(null);
    const { data } = await supabase.storage.from('course-scorecards').createSignedUrl(r.photo_path, 600);
    setPhotoUrl(data?.signedUrl ?? null);
  };

  const chooseN = (v: 9 | 18) => { setN(v); setHoles((h) => (v === 9 ? h.slice(0, 9) : [...h, ...emptyHoles(9)].slice(0, 18))); };
  const setHole = (i: number, k: keyof HoleInput, v: string) => setHoles((h) => h.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const totalPar = holes.reduce((s, h) => s + (Number(h.par) || 0), 0);

  const approve = async () => {
    if (!open) return;
    const built = buildHoleData(holes);
    if ('error' in built) { toast.error(built.error); return; }
    setBusy(true);
    const { data, error } = await rpc('admin_approve_course_request', { p_id: open.id, p_name: form.name, p_city: form.city, p_state: form.state, p_hole_data: built.data });
    setBusy(false);
    const res = data as { success?: boolean; error?: string } | null;
    if (error || !res?.success) { toast.error(error?.message ?? res?.error ?? 'Could not approve'); return; }
    toast.success('Course added. The player earned a clover.');
    setOpen(null);
    load();
  };

  const reject = async () => {
    if (!open) return;
    setBusy(true);
    const { data, error } = await rpc('admin_reject_course_request', { p_id: open.id, p_reason: reason });
    setBusy(false);
    const res = data as { success?: boolean; error?: string } | null;
    if (error || !res?.success) { toast.error(error?.message ?? res?.error ?? 'Could not reject'); return; }
    toast.success('Request rejected');
    setOpen(null);
    load();
  };

  const input = 'w-full h-10 px-3 bg-black/40 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/60';

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}><ChevronLeft /></Button>
          <div>
            <h1 className="text-xl font-black">Course requests</h1>
            <p className="text-xs text-muted-foreground">Scorecards players sent for courses we don't have</p>
          </div>
        </div>

        {loading ? <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          : reqs.length === 0 ? <div className="glass-card p-10 text-center text-sm text-muted-foreground">No requests waiting.</div>
          : reqs.map((r) => (
            <button key={r.id} onClick={() => openReq(r)} className="glass-card p-4 w-full text-left flex items-center justify-between gap-3" data-testid="course-request">
              <div className="min-w-0">
                <p className="font-bold truncate">{r.course_name}</p>
                <p className="text-xs text-muted-foreground">{[r.city, r.state].filter(Boolean).join(', ')} · from {r.submitted_by ?? 'a player'} · {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <span className="text-xs font-bold text-primary shrink-0">Review</span>
            </button>
          ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm overflow-y-auto p-4" onClick={() => setOpen(null)}>
          <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg">Review request</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(null)}><XCircle className="w-5 h-5" /></Button>
            </div>
            {photoUrl
              ? <a href={photoUrl} target="_blank" rel="noreferrer"><img src={photoUrl} alt="Scorecard" className="w-full max-h-96 object-contain rounded-xl bg-black/40" /></a>
              : <div className="h-40 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>}
            {open.notes && <p className="text-xs text-muted-foreground">Note: {open.notes}</p>}

            <div className="flex gap-2">
              <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Course name" />
              <input className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
              <input className={`${input} w-24`} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" />
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant={n === 9 ? 'default' : 'outline'} onClick={() => chooseN(9)}>9 holes</Button>
              <Button size="sm" variant={n === 18 ? 'default' : 'outline'} onClick={() => chooseN(18)}>18 holes</Button>
              <span className="text-xs text-muted-foreground ml-auto">Total par {totalPar || '–'}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {holes.map((h, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-[10px] text-muted-foreground text-center">Hole {i + 1}</p>
                  <input className={`${input} text-center px-1`} inputMode="numeric" placeholder="Par" value={h.par} onChange={(e) => setHole(i, 'par', e.target.value)} data-testid={`par-${i + 1}`} />
                  <input className={`${input} text-center px-1`} inputMode="numeric" placeholder="Yds" value={h.yards} onChange={(e) => setHole(i, 'yards', e.target.value)} />
                </div>
              ))}
            </div>

            <Button className="w-full" disabled={busy} onClick={approve} data-testid="approve-course">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve and add course'}
            </Button>
            <div className="flex gap-2">
              <input className={input} placeholder="Reason if rejecting (shown to the player)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button variant="outline" className="text-destructive border-destructive/30" disabled={busy} onClick={reject}>Reject</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
