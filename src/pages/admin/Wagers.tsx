import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc).call(supabase, fn, args);

interface ReviewWager {
  competition_id: string;
  state: string;
  mode: string;
  pot: number;
  buy_in: number;
  host_id: string;
  created_at: string;
  proposed_at: string | null;
  players: { user_id: string; name: string | null; paid: boolean }[];
  confirmations: { user_id: string; agrees: boolean }[];
  standings: { complete: boolean; players: { user_id: string; total: number; pars_won: number; holes_scored: number }[]; winners: string[] } | null;
}

const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "")}`;

/** Wagers that need an admin: disputed, never confirmed, or stuck. Pay the result the scores give, or refund everyone. */
export default function AdminWagers() {
  const [wagers, setWagers] = useState<ReviewWager[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await rpc("admin_wager_review_list");
    const r = data as { success?: boolean; error?: string; wagers?: ReviewWager[] } | null;
    if (err || !r?.success) { setError(err?.message || r?.error || "Could not load wagers"); return; }
    setError(null);
    setWagers(r.wagers ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string, action: "pay" | "refund") => {
    const w = wagers?.find((x) => x.competition_id === id);
    const what = action === "pay" ? "pay the pot to the winner the scores give" : `refund ${money(w?.buy_in ?? 0)} to every paying player`;
    if (!window.confirm(`Are you sure you want to ${what}? This cannot be undone.`)) return;
    setBusyId(id);
    const { data, error: err } = await rpc("admin_resolve_wager", { p_competition_id: id, p_action: action });
    const r = data as { success?: boolean; error?: string } | null;
    if (err || !r?.success) setError(err?.message || r?.error || "Could not resolve");
    await load();
    setBusyId(null);
  };

  const nameOf = (w: ReviewWager, id: string) => w.players.find((p) => p.user_id === id)?.name || "Player";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/admin/dashboard"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-2xl font-display font-bold">Wagers to review</h1>
            <p className="text-sm text-muted-foreground">Disputed, never confirmed, or stuck. Pay what the scores say, or refund every buy-in.</p>
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {wagers === null && !error && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
        {wagers?.length === 0 && <p className="text-muted-foreground" data-testid="no-wagers">Nothing needs a decision.</p>}
        {wagers?.map((w) => (
          <div key={w.competition_id} className="glass-card p-5 space-y-3" data-testid="review-wager">
            <div className="flex items-center justify-between">
              <p className="font-bold">{w.mode === "winner-takes-all" ? "Winner Takes All" : "King of the Pars"} · {money(w.pot)} pot ({money(w.buy_in)} each)</p>
              <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-300">{w.state}</span>
            </div>
            <p className="text-xs text-muted-foreground">Host: {nameOf(w, w.host_id)} · started {new Date(w.created_at).toLocaleString()}</p>
            <div className="text-sm space-y-1">
              {w.players.map((p) => {
                const s = w.standings?.players.find((x) => x.user_id === p.user_id);
                const c = w.confirmations.find((x) => x.user_id === p.user_id);
                return (
                  <p key={p.user_id}>
                    {p.name || "Player"}{p.user_id === w.host_id ? " (host)" : ""} — {s ? `${s.holes_scored}/9 holes, total ${s.total}, pars ${s.pars_won}` : "no scores"}
                    {c ? (c.agrees ? " · confirmed" : " · DISPUTED") : ""}
                  </p>
                );
              })}
            </div>
            <p className="text-sm">
              Result by the scores: {w.standings?.complete ? w.standings.winners.map((id) => nameOf(w, id)).join(" & ") : "incomplete — only a refund is possible"}
            </p>
            <div className="flex gap-3">
              <Button disabled={busyId === w.competition_id || !w.standings?.complete} onClick={() => resolve(w.competition_id, "pay")}>Pay the result</Button>
              <Button variant="outline" disabled={busyId === w.competition_id} onClick={() => resolve(w.competition_id, "refund")}>Refund everyone</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
