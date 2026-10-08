import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Crown, Check, X, Loader2, AlertCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// The wager_* functions aren't in the generated Supabase types, so call them through a narrow signature.
type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc).call(supabase, fn, args);

interface Standing { user_id: string; total: number; pars_won: number; holes_scored: number }
export interface WagerStatus {
  success?: boolean;
  state: "not_started" | "playing" | "awaiting" | "review" | "paid" | "refunded";
  mode: "winner-takes-all" | "king-of-pars";
  pars: number[];
  pot: number;
  buy_in: number;
  players: number;
  partners_needed: number;
  is_host: boolean;
  host_id: string;
  standings?: { complete: boolean; players: Standing[]; winners: string[] };
  confirmations: { user_id: string; agrees: boolean }[];
  names: Record<string, string>;
  scores: Record<string, Record<string, number>>;
}

const POLL_MS = 3000;
const PROPOSE_RETRY_MS = 2500;
const PROPOSE_TRIES = 16;
const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "")}`;

/**
 * The end of a Lucky Wager. The database works out the winner from the scores everyone saved;
 * the host asks for the result, the partners confirm it, and the pot is paid once a majority
 * agree (2 players: the partner; 3: one partner; 4: two partners). Disputes or silence go to
 * review, where an admin pays the result out or refunds every buy-in.
 */
export function WagerResults({
  competitionId, myId, myScores, onNewWager, onBack,
}: {
  competitionId: string;
  myId: string;
  /** My own hole scores from this device, re-sent once in case a save was missed. */
  myScores?: number[];
  onNewWager: () => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<WagerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [proposeGaveUp, setProposeGaveUp] = useState(false);
  const resent = useRef(false);
  const tries = useRef(0);

  const load = useCallback(async () => {
    const { data } = await rpc("wager_status", { p_competition_id: competitionId });
    const s = data as WagerStatus | null;
    if (s?.success) setStatus(s);
    return s;
  }, [competitionId]);

  // Keep the screen current until the wager is settled one way or the other.
  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (!status || (status.state !== "paid" && status.state !== "refunded")) load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load, status?.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once, send my scores again from this device (a no-op if they all saved the first time).
  useEffect(() => {
    if (resent.current || !myScores?.length || status?.state !== "playing") return;
    resent.current = true;
    (async () => {
      for (let i = 0; i < myScores.length; i++) {
        if (typeof myScores[i] === "number") await rpc("wager_submit_score", { p_competition_id: competitionId, p_hole: i + 1, p_score: myScores[i] });
      }
    })();
  }, [status?.state, myScores, competitionId]);

  // The host asks for the result as soon as everyone's scores are in (retrying while the last ones arrive).
  useEffect(() => {
    if (!status?.is_host || status.state !== "playing" || proposeGaveUp) return;
    const t = setTimeout(async () => {
      tries.current += 1;
      const { data } = await rpc("wager_propose_result", { p_competition_id: competitionId });
      const r = data as { success?: boolean } | null;
      if (r?.success) load();
      else if (tries.current >= PROPOSE_TRIES) setProposeGaveUp(true);
      else load();
    }, tries.current === 0 ? 400 : PROPOSE_RETRY_MS);
    return () => clearTimeout(t);
  }, [status?.is_host, status?.state, status, proposeGaveUp, competitionId, load]);

  const confirm = async (agrees: boolean) => {
    setBusy(true);
    setProblem(null);
    const { data, error } = await rpc("wager_confirm_result", { p_competition_id: competitionId, p_agrees: agrees });
    const r = data as { success?: boolean; error?: string } | null;
    if (error || !r?.success) setProblem(error?.message || r?.error || "Could not save your answer");
    await load();
    setBusy(false);
  };

  const flag = async () => {
    setBusy(true);
    await rpc("wager_send_to_review", { p_competition_id: competitionId });
    await load();
    setBusy(false);
  };

  if (!status) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const st = status.standings;
  const winners = st?.winners ?? [];
  const nameOf = (id: string) => status.names[id] ?? "Player";
  const rows = [...(st?.players ?? [])].sort((a, b) =>
    status.mode === "winner-takes-all" ? a.total - b.total : b.pars_won - a.pars_won);
  const share = winners.length ? status.pot / winners.length : status.pot;
  const myConfirmation = status.confirmations.find((c) => c.user_id === myId);
  const yes = status.confirmations.filter((c) => c.agrees && c.user_id !== status.host_id).length;
  const iWon = winners.includes(myId);
  const mode = status.mode === "winner-takes-all" ? "WINNER TAKES ALL" : "KING OF THE PARS";

  let banner: { title: string; body: string; tone: "ok" | "wait" | "warn" };
  switch (status.state) {
    case "paid":
      banner = {
        title: winners.length > 1 ? `${winners.map(nameOf).join(" & ")} split the pot` : `${nameOf(winners[0])} wins!`,
        body: iWon ? `+${money(share)} added to your cash balance` : `Final. ${money(status.pot)} paid out.`,
        tone: "ok",
      };
      break;
    case "refunded":
      banner = { title: "Wager refunded", body: `Your ${money(status.buy_in)} buy-in is back in your cash balance.`, tone: "warn" };
      break;
    case "review":
      banner = { title: "Under review", body: "The result is being checked. An admin will either pay it out or refund every buy-in. Your money is held safely until then.", tone: "warn" };
      break;
    case "awaiting":
      banner = status.is_host
        ? { title: "Waiting for your partners", body: `${yes} of ${status.partners_needed} partner${status.partners_needed > 1 ? "s" : ""} confirmed. The pot is paid when ${status.partners_needed} confirm.`, tone: "wait" }
        : myConfirmation
          ? { title: "Thanks — your answer is in", body: "Waiting for the others. The pot pays out as soon as enough partners agree.", tone: "wait" }
          : { title: "Is this result right?", body: `${winners.length > 1 ? winners.map(nameOf).join(" & ") + " tie" : nameOf(winners[0]) + " wins"} on the scores below. Confirm to pay out, or say it is wrong to send it to review.`, tone: "wait" };
      break;
    default:
      banner = status.is_host
        ? { title: proposeGaveUp ? "Some scores are missing" : "Collecting everyone's scores…", body: proposeGaveUp ? "Not every player's scores arrived. You can send this wager to review." : "Hang tight while the last scores come in.", tone: proposeGaveUp ? "warn" : "wait" }
        : { title: "Saving scores…", body: "The host will finish the wager as soon as everyone's scores are in.", tone: "wait" };
  }

  const finished = status.state === "paid" || status.state === "refunded";
  const needsAnswer = status.state === "awaiting" && !status.is_host && !myConfirmation;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6" data-testid="wager-results">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
        {status.state === "review" || status.state === "refunded" || proposeGaveUp
          ? <ShieldAlert className="w-14 h-14 text-amber-400 mx-auto mb-3" />
          : <Trophy className="w-14 h-14 text-yellow-500 mx-auto mb-3" />}
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">{mode}</p>
        <h1 className="text-2xl font-black uppercase tracking-wide mb-1" data-testid="wager-banner-title">{banner.title}</h1>
        <p className={`text-sm ${banner.tone === "ok" ? "text-emerald-400 font-bold" : "text-muted-foreground"}`} data-testid="wager-banner-body">{banner.body}</p>
      </motion.div>

      {needsAnswer && (
        <div className="flex gap-3">
          <Button className="flex-1 font-black uppercase tracking-wider" disabled={busy} onClick={() => confirm(true)} data-testid="wager-confirm-yes">
            <Check className="w-4 h-4 mr-1" /> Yes, confirm
          </Button>
          <Button variant="outline" className="flex-1 font-black uppercase tracking-wider" disabled={busy} onClick={() => confirm(false)} data-testid="wager-confirm-no">
            <X className="w-4 h-4 mr-1" /> That's wrong
          </Button>
        </div>
      )}
      {problem && <p className="text-sm text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{problem}</p>}

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((p, i) => {
            const isWinner = winners.includes(p.user_id);
            return (
              <div key={p.user_id} className={`glass-card p-4 flex items-center justify-between ${isWinner ? "border-primary/50 bg-primary/5" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black w-8 text-muted-foreground">#{i + 1}</span>
                  <div>
                    <p className="font-bold flex items-center gap-2">
                      {nameOf(p.user_id)} {p.user_id === myId && "(You)"}
                      {isWinner && <Crown className="w-4 h-4 text-yellow-500" />}
                    </p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                      {status.mode === "winner-takes-all" ? `Total: ${p.total}` : `Pars: ${p.pars_won}/${status.pars.length}`}
                    </p>
                  </div>
                </div>
                {finished && status.state === "paid" && (
                  <span className={`font-black text-lg ${isWinner ? "text-green-400" : "text-red-400"}`}>
                    {isWinner ? `+${money(share)}` : `-${money(status.buy_in)}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Hole-by-Hole</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider text-muted-foreground">Hole</th>
                  {rows.map((p) => (
                    <th key={p.user_id} className="py-2 px-2 font-bold uppercase tracking-wider text-muted-foreground text-center">{nameOf(p.user_id).split(" ")[0]}</th>
                  ))}
                  <th className="py-2 pl-2 font-bold uppercase tracking-wider text-muted-foreground text-center">Par</th>
                </tr>
              </thead>
              <tbody>
                {status.pars.map((par, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-bold">{i + 1}</td>
                    {rows.map((p) => (
                      <td key={p.user_id} className="py-2 px-2 text-center font-bold">{status.scores[p.user_id]?.[String(i + 1)] ?? "-"}</td>
                    ))}
                    <td className="py-2 pl-2 text-center text-muted-foreground">{par}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!finished && status.state !== "review" && (status.state === "awaiting" || proposeGaveUp) && (
        <button className="block mx-auto text-xs text-muted-foreground underline" disabled={busy} onClick={flag} data-testid="wager-flag">
          Something is wrong — send to review
        </button>
      )}

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 font-black uppercase tracking-wider" onClick={onNewWager}>New Wager</Button>
        <Button className="flex-1 font-black uppercase tracking-wider" onClick={onBack}>Back to Play</Button>
      </div>
    </div>
  );
}
