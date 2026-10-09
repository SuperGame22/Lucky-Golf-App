/**
 * Admin — Weekly Raffle prize queue
 * /admin/raffle
 * Queue prizes for the coming weeks (one at a time or pasted as rows). Each week is drawn automatically
 * Sunday 8 pm Eastern; a week that ended without a prize can be drawn here once a prize is added.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertTriangle, Trophy, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CSV_HEADER, describePrize, easternDate, parsePrizeCsv, upcomingWeeks, type PrizeItem } from '@/features/raffle/raffle';

interface Row {
  id: string; prize_name: string | null; prize_credit: number | null; prize_spins: number | null; prize_products: string | null;
  description: string | null; starts_at: string; ends_at: string; status: string; drawn_at: string | null;
  winner_user_id: string | null; draw_ticket: number | null; draw_total: number | null;
}

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc).call(supabase, fn, args);

const PLACEHOLDER = 'Prize to be announced';
const blank = { prize_name: '', prize_credit: '', prize_spins: '', prize_products: '', description: '' };

export default function AdminRaffle() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // week_start being edited
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [paste, setPaste] = useState('');
  const [drawing, setDrawing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('weekly_jackpots').select('*').neq('status', 'cancelled').order('starts_at', { ascending: false }).limit(60);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const byWeek = useMemo(() => new Map(rows.map((r) => [easternDate(new Date(r.starts_at)), r])), [rows]);
  const weeks = useMemo(() => upcomingWeeks(new Date(), 13), []);
  const waiting = rows.filter((r) => !r.drawn_at && new Date(r.ends_at) <= new Date());
  const past = rows.filter((r) => r.drawn_at).slice(0, 8);

  const queue = async (items: PrizeItem[]) => {
    const { data, error } = await rpc('admin_queue_raffle_prizes', { p_items: items });
    const res = data as { success: boolean; saved?: number; errors?: { week_start: string; error: string }[]; error?: string } | null;
    if (error || !res?.success) { toast.error(error?.message ?? res?.error ?? 'Could not save'); return false; }
    if (res.errors?.length) toast.error(res.errors.map((e) => `${e.week_start}: ${e.error}`).join('\n'));
    if (res.saved) toast.success(`${res.saved} week${res.saved === 1 ? '' : 's'} saved`);
    await load();
    return true;
  };

  const startEdit = (week: string) => {
    const r = byWeek.get(week);
    setEditing(week);
    setForm(r && r.prize_name !== PLACEHOLDER ? {
      prize_name: r.prize_name ?? '', prize_credit: r.prize_credit ? String(r.prize_credit) : '', prize_spins: r.prize_spins ? String(r.prize_spins) : '',
      prize_products: r.prize_products ?? '', description: r.description ?? '',
    } : blank);
  };

  const saveOne = async () => {
    if (!editing) return;
    setSaving(true);
    const ok = await queue([{
      week_start: editing, prize_name: form.prize_name,
      prize_credit: Number(form.prize_credit) || 0, prize_spins: Number(form.prize_spins) || 0,
      prize_products: form.prize_products || undefined, description: form.description || undefined,
    }]);
    setSaving(false);
    if (ok) setEditing(null);
  };

  const parsed = useMemo(() => parsePrizeCsv(paste), [paste]);
  const uploadFile = async (f: File | undefined) => { if (f) setPaste(await f.text()); };
  const saveBulk = async () => {
    setSaving(true);
    const ok = await queue(parsed.items);
    setSaving(false);
    if (ok) setPaste('');
  };

  const drawNow = async (id: string) => {
    setDrawing(id);
    const { data, error } = await rpc('select_jackpot_winner', { p_jackpot_id: id });
    setDrawing(null);
    const res = data as { success: boolean; error?: string } | null;
    if (error || !res?.success) toast.error(error?.message ?? res?.error ?? 'Could not draw');
    else toast.success('Winner drawn');
    load();
  };

  const input = 'w-full h-10 px-3 bg-black/40 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/60';
  const fmtDay = (week: string) => new Date(`${week}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}><ChevronLeft /></Button>
          <div>
            <h1 className="text-xl font-black">Weekly Raffle</h1>
            <p className="text-xs text-muted-foreground">Drawn automatically every Sunday at 8 pm Eastern</p>
          </div>
        </div>

        {waiting.length > 0 && (
          <div className="glass-card p-4 border-yellow-500/40 space-y-2" data-testid="raffle-waiting">
            <p className="text-sm font-bold flex items-center gap-2 text-yellow-400"><AlertTriangle className="w-4 h-4" /> Waiting to be drawn</p>
            {waiting.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{fmtDay(easternDate(new Date(r.starts_at)))}: {r.prize_name === PLACEHOLDER ? 'no prize queued' : r.prize_name}</span>
                {r.prize_name === PLACEHOLDER
                  ? <Button size="sm" variant="outline" onClick={() => startEdit(easternDate(new Date(r.starts_at)))}>Add prize</Button>
                  : <Button size="sm" disabled={drawing === r.id} onClick={() => drawNow(r.id)}>{drawing === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Draw now'}</Button>}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Prize queue (next 13 weeks)</p>
          {loading ? <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : weeks.map((w) => {
            const r = byWeek.get(w);
            const hasPrize = r && r.prize_name && r.prize_name !== PLACEHOLDER;
            return (
              <div key={w} className="glass-card p-4" data-testid={`raffle-week-${w}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Week of Sun {fmtDay(w)}</p>
                    {hasPrize ? (
                      <>
                        <p className="font-bold truncate">{r!.prize_name}</p>
                        <p className="text-xs text-muted-foreground">{describePrize(r!) || 'Manual prize'}</p>
                      </>
                    ) : (
                      <p className="text-sm text-yellow-400 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> No prize queued</p>
                    )}
                  </div>
                  {!r?.drawn_at && <Button size="sm" variant="outline" onClick={() => startEdit(w)}>{hasPrize ? 'Edit' : 'Add'}</Button>}
                </div>
                {editing === w && (
                  <div className="mt-4 space-y-2">
                    <input className={input} placeholder="Prize name (shown to players)" value={form.prize_name} onChange={(e) => setForm({ ...form, prize_name: e.target.value })} data-testid="raffle-name" />
                    <div className="flex gap-2">
                      <input className={input} inputMode="decimal" placeholder="Credit $" value={form.prize_credit} onChange={(e) => setForm({ ...form, prize_credit: e.target.value })} />
                      <input className={input} inputMode="numeric" placeholder="Spinz" value={form.prize_spins} onChange={(e) => setForm({ ...form, prize_spins: e.target.value })} />
                    </div>
                    <input className={input} placeholder="Free products (you send these)" value={form.prize_products} onChange={(e) => setForm({ ...form, prize_products: e.target.value })} />
                    <input className={input} placeholder="Short description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    <div className="flex gap-2 pt-1">
                      <Button className="flex-1" disabled={saving || !form.prize_name.trim()} onClick={saveOne} data-testid="raffle-save">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
                      <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="glass-card p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Upload many weeks at once</p>
          <p className="text-xs text-muted-foreground">One row per week. Week start must be a Sunday. Credit is dollars, Spinz a whole number, products free text.</p>
          <code className="block text-[11px] bg-black/40 rounded-lg p-2 overflow-x-auto whitespace-pre">{CSV_HEADER}{'\n'}2026-11-08,Pro shop bundle,25,5,Lucky Golf hat,Great week</code>
          <textarea className="w-full min-h-[110px] p-3 bg-black/40 border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/60"
            placeholder="Paste rows here" value={paste} onChange={(e) => setPaste(e.target.value)} data-testid="raffle-paste" />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer text-primary">
              <Upload className="w-4 h-4" /> Choose a .csv file
              <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0])} />
            </label>
            {paste.trim() && <span className="text-xs text-muted-foreground">{parsed.items.length} ready{parsed.errors.length ? `, ${parsed.errors.length} with problems` : ''}</span>}
          </div>
          {parsed.errors.length > 0 && <ul className="text-xs text-red-400 space-y-0.5">{parsed.errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul>}
          <Button className="w-full" disabled={saving || parsed.items.length === 0} onClick={saveBulk} data-testid="raffle-bulk-save">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Queue ${parsed.items.length || ''} week${parsed.items.length === 1 ? '' : 's'}`}
          </Button>
        </div>

        {past.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Recent draws</p>
            {past.map((r) => (
              <div key={r.id} className="glass-card p-3 text-sm flex items-start gap-3">
                <Trophy className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold truncate">{r.prize_name}</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {r.winner_user_id ? `Winner ${r.winner_user_id}` : 'No entries, no winner'} · ticket {r.draw_ticket ?? '–'} of {r.draw_total ?? 0}
                    {r.prize_products && r.status === 'closed' ? ' · products to send' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
