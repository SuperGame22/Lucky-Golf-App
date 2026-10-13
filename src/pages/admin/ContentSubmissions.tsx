/**
 * Admin — Fan content
 * /admin/content
 * Review 3 photos + 1 video per set. Approve = player earns 1 clover. Download to move into the content folder.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Sub { id: string; photo_paths: string[]; video_path: string; terms_version: string; created_at: string; submitted_by: string | null }
interface Urls { photos: string[]; video: string | null }

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc).call(supabase, fn, args);
const BUCKET = 'content-submissions';

export default function AdminContentSubmissions() {
  const navigate = useNavigate();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [urls, setUrls] = useState<Record<string, Urls>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'pending' | 'approved'>('pending');

  const load = useCallback(async () => {
    const { data } = await rpc('admin_list_content_submissions', { p_status: tab });
    const res = data as { success?: boolean; submissions?: Sub[] } | null;
    const list = res?.success ? res.submissions ?? [] : [];
    setSubs(list);
    setLoading(false);
    const next: Record<string, Urls> = {};
    await Promise.all(list.map(async (s) => {
      const sign = async (p: string) => (await supabase.storage.from(BUCKET).createSignedUrl(p, 3600)).data?.signedUrl ?? '';
      next[s.id] = { photos: await Promise.all(s.photo_paths.map(sign)), video: (await sign(s.video_path)) || null };
    }));
    setUrls(next);
  }, [tab]);
  useEffect(() => { setLoading(true); load(); }, [load]);

  const act = async (s: Sub, kind: 'approve' | 'reject') => {
    setBusy(s.id);
    const { data, error } = kind === 'approve'
      ? await rpc('admin_approve_content_submission', { p_id: s.id })
      : await rpc('admin_reject_content_submission', { p_id: s.id, p_reason: reasons[s.id] ?? '' });
    setBusy(null);
    const res = data as { success?: boolean; error?: string } | null;
    if (error || !res?.success) { toast.error(error?.message ?? res?.error ?? 'Failed'); return; }
    toast.success(kind === 'approve' ? 'Approved. Player earned a clover.' : 'Rejected');
    load();
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}><ChevronLeft /></Button>
          <div>
            <h1 className="text-xl font-black">Fan content</h1>
            <p className="text-xs text-muted-foreground">3 photos + 1 video per set. Approve gives the player 1 clover.</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['pending', 'approved'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize ${tab === t ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>{t}</button>
          ))}
        </div>

        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : subs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">Nothing here.</p>
        ) : subs.map((s) => (
          <div key={s.id} className="glass-card p-4 space-y-3" data-testid="content-sub">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{s.submitted_by ?? 'Player'}</span>
              <span>{new Date(s.created_at).toLocaleString()} · terms {s.terms_version}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(urls[s.id]?.photos ?? []).map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Photo ${i + 1}`} className="aspect-square w-full object-cover rounded-lg bg-black/40" /></a>
              ))}
            </div>
            {urls[s.id]?.video && <video src={urls[s.id].video as string} controls preload="metadata" className="w-full rounded-lg bg-black max-h-80" />}
            <div className="flex flex-wrap gap-3 text-xs">
              {(urls[s.id]?.photos ?? []).map((u, i) => <a key={i} href={u} download className="flex items-center gap-1 underline"><Download className="w-3 h-3" />Photo {i + 1}</a>)}
              {urls[s.id]?.video && <a href={urls[s.id].video as string} download className="flex items-center gap-1 underline"><Download className="w-3 h-3" />Video</a>}
            </div>
            {tab === 'pending' && (<>
            <input value={reasons[s.id] ?? ''} onChange={(e) => setReasons((r) => ({ ...r, [s.id]: e.target.value }))} maxLength={300}
              placeholder="Reject reason (optional)" className="w-full h-10 px-3 bg-black/40 border border-border rounded-lg text-sm" />
            <div className="flex gap-3">
              <Button className="flex-1" disabled={busy === s.id} onClick={() => act(s, 'approve')}>Approve +1 clover</Button>
              <Button className="flex-1" variant="outline" disabled={busy === s.id} onClick={() => act(s, 'reject')}>Reject</Button>
            </div>
            </>)}
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
