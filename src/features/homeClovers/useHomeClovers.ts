import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { buildRevealPlan } from './reveal';

interface HomeCloverRow {
  success?: boolean;
  clovers: number;
  total: number;
  pending: number;
  week_count: number;
  // Spend leaves (older databases don't send these; the reveal then treats everything as whole clovers).
  cents?: number;
  pending_leaves?: number;
  rest_leaves?: number;
  spend_pending_clovers?: number;
}

// These two functions aren't in the generated Supabase types, so call them through a narrow signature.
type Rpc = (fn: 'get_home_clovers' | 'ack_home_clovers', args?: { p_seen_total: number; p_seen_cents?: number }) => PromiseLike<{ data: HomeCloverRow | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc).call(supabase, fn, args);

export interface HomeCloverView {
  /** False until the server has answered, so the new balance is never flashed before the reveal. */
  ready: boolean;
  count: number;
  /** "+N this week", or null when the server can't say (the page falls back to its old placeholder). */
  week: number | null;
  /** Leaves lit on the clover, 0-4. */
  lit: number;
  /** Goes up by one each time a clover completes. */
  pulse: number;
}

/**
 * Drives the Home clover card. Clovers earned since the Home page last showed them are held
 * back and revealed when the page is viewed: the leaves light one at a time and the count
 * and weekly count go up by one every four leaves. The server remembers what has been shown
 * (get_home_clovers / ack_home_clovers), so leaving mid-reveal replays it on the next visit.
 */
export function useHomeClovers(): HomeCloverView {
  const { user, profile } = useAuth();
  const [view, setView] = useState<HomeCloverView>({ ready: false, count: 0, week: null, lit: 0, pulse: 0 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runId = useRef(0);
  const playing = useRef(false);
  const profileClovers = useRef(0);
  const lastTotal = useRef<number | null>(null);
  profileClovers.current = profile?.clovers ?? 0;

  const stop = useCallback(() => {
    runId.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    playing.current = false;
  }, []);

  const run = useCallback(async () => {
    if (playing.current) return;
    const my = ++runId.current;
    let data: HomeCloverRow | null = null;
    try {
      ({ data } = await rpc('get_home_clovers'));
    } catch { /* handled below */ }
    if (my !== runId.current) return;
    lastTotal.current = data?.total ?? null;

    if (!data?.success) {
      // Database function not there yet: show the real balance, no reveal.
      setView((v) => ({ ...v, ready: true, count: profileClovers.current, week: null, lit: 0 }));
      return;
    }

    const plan = buildRevealPlan({
      clovers: data.clovers,
      weekCount: data.week_count,
      pending: data.pending,
      pendingLeaves: data.pending_leaves ?? 0,
      restLeaves: data.rest_leaves ?? 0,
      spendPendingClovers: data.spend_pending_clovers ?? 0,
    });
    setView((v) => ({ ...v, ready: true, count: plan.startCount, week: plan.startWeek, lit: plan.startLit }));

    const finish = async () => {
      let row: HomeCloverRow | null = null;
      try {
        ({ data: row } = await rpc('ack_home_clovers', { p_seen_total: data!.total, p_seen_cents: data!.cents }));
      } catch { /* the reveal simply plays again next visit */ }
      if (my !== runId.current) return;
      playing.current = false;
      setView((v) => ({
        ...v,
        lit: row?.success ? row.rest_leaves ?? plan.endLit : plan.endLit,
        count: row?.success ? row.clovers : data!.clovers,
        week: row?.success ? row.week_count : plan.startWeek + Math.max(0, plan.steps.filter((x) => x.pulse).length),
      }));
    };

    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const hasNews = data.pending > 0 || (data.pending_leaves ?? 0) > 0;
    if (plan.steps.length === 0 || reduceMotion) {
      if (hasNews) { playing.current = true; await finish(); }
      return;
    }

    playing.current = true;
    let at = 0;
    plan.steps.forEach((step) => {
      at += step.delayMs;
      timers.current.push(setTimeout(() => {
        setView((v) => ({ ...v, lit: step.lit, count: step.count, week: step.week, pulse: step.pulse ? v.pulse + 1 : v.pulse }));
      }, at));
    });
    timers.current.push(setTimeout(finish, at + 50));
  }, []);

  useEffect(() => {
    if (!user) return;
    run();
    return stop;
  }, [user, run, stop]);

  // Clovers that arrive while the page is open (or after coming back to the tab) reveal too.
  useEffect(() => {
    if (!user) return;
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, run]);

  const total = profile?.total_clovers;
  useEffect(() => {
    if (user && total !== undefined && total !== lastTotal.current) run();
  }, [user, total, run]);

  return view;
}
