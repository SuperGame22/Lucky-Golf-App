/**
 * Admin — Spinz prizes to fulfil
 * /admin/prizes
 * Physical prizes need shipping; Clover Club months need the tier switched on. Mark each one done.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Prize {
  id: number; user_id: string; kind: 'prize' | 'membership'; label: string; created_at: string;
  fulfilled_at: string | null; fulfillment_note: string | null; display_name: string | null; email: string | null; membership_tier: string | null;
}

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc).call(supabase, fn, args);

export default function AdminPrizes() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [rows, setRows] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await rpc('admin_spin_prizes', { p_status: tab });
    const res = data as { success?: boolean; prizes?: Prize[]; error?: string } | null;
    if (error || !res?.success) toast.error(error?.message ?? res?.error ?? 'Could not load prizes');
    setRows(res?.success ? res.prizes ?? [] : []);
    setLoading(false);
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const done = async (p: Prize, activate: boolean) => {
    setBusy(p.id);
    if (activate) {
      const { data, error } = await rpc('admin_set_membership_tier', { p_user: p.user_id, p_tier: 'clover' });
      const res = data as { success?: boolean; error?: string } | null;
      if (error || !res?.success) { setBusy(null); toast.error(error?.message ?? res?.error ?? 'Could not set the tier'); return; }
    }
    const note = notes[p.id] || (activate ? 'Clover Club activated' : '');
    const { data, error } = await rpc('admin_fulfill_spin_prize', { p_id: p.id, p_note: note });
    setBusy(null);
    const res = data as { success?: boolean; error?: string } | null;
    if (error || !res?.success) { toast.error(error?.message ?? res?.error ?? 'Failed'); return; }
    toast.success('Marked done');
    load();
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate('/admin/dashboard')}><ChevronLeft /></Button>
          <div>
            <h1 className="text-xl font-black">Spinz prizes</h1>
            <p className="text-xs text-muted-foreground">Ship physical prizes and switch on Clover Club months, then mark them done.</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['open', 'done'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize ${tab === t ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>
              {t === 'open' ? 'To do' : 'Done'}
            </button>
          ))}
        </div>

        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">Nothing here.</p>
        ) : rows.map((p) => (
          <div key={p.id} className="glass-card p-4 space-y-2" data-testid="spin-prize">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">{p.label}</p>
                <p className="text-xs text-muted-foreground truncate">{p.display_name ?? 'Player'} · {p.email ?? 'no email'} · tier {p.membership_tier ?? 'free'}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</span>
            </div>
            {p.fulfilled_at ? (
              <p className="text-xs text-primary">Done {new Date(p.fulfilled_at).toLocaleDateString()}{p.fulfillment_note ? ` · ${p.fulfillment_note}` : ''}</p>
            ) : (
              <>
                <input value={notes[p.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))} maxLength={300}
                  placeholder={p.kind === 'prize' ? 'Note (e.g. tracking number)' : 'Note (optional)'}
                  aria-label="Note" className="w-full h-10 px-3 bg-black/40 border border-border rounded-lg text-base" />
                <div className="flex gap-2">
                  {p.kind === 'membership' && (
                    <Button className="flex-1" disabled={busy === p.id} onClick={() => done(p, true)}>Activate Clover Club & mark done</Button>
                  )}
                  <Button className="flex-1" variant={p.kind === 'membership' ? 'outline' : 'default'} disabled={busy === p.id} onClick={() => done(p, false)}>
                    Mark done
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
