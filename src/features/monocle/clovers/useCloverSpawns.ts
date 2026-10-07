import { useCallback, useEffect, useRef, useState } from "react";
import type { Size } from "../engine/geometry";
import { collectClover, COLLECT_MESSAGES, requestClover } from "./cloverApi";
import { layoutExclusions, pickCloverPosition, seededRandom } from "./spawnPosition";

export interface ActiveClover {
  id: string;
  kind: "standard" | "rare";
  reward: number;
  x: number;
  y: number;
  expiresAt: number;
  /** A teaser shown to signed-out users; it cannot be collected. */
  local: boolean;
}

export interface CloverToast {
  key: number;
  text: string;
  tone: "win" | "info" | "warn";
}

interface Options {
  /** Monocle is live: not paused, not in the bracket editor, tab visible. */
  enabled: boolean;
  /** Signed-in user id, null when signed out, undefined while auth loads. */
  userId: string | null | undefined;
  container: Size | null;
  onCollected?: () => void;
}

const jitter = (min: number, max: number) => (min + Math.random() * (max - min)) * 1000;

/**
 * Schedules and collects Lucky Clovers. The server decides whether and when a
 * clover appears (frequency, caps, rare ones, campaign multipliers) and credits
 * the reward; this hook only asks, places the clover clear of the rangefinder,
 * and sends the tap. It never touches camera data.
 */
export function useCloverSpawns({ enabled, userId, container, onCollected }: Options) {
  const [clover, setClover] = useState<ActiveClover | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [toast, setToast] = useState<CloverToast | null>(null);
  const collectingRef = useRef(false);
  const toastKey = useRef(0);
  const containerRef = useRef(container);
  containerRef.current = container;
  const onCollectedRef = useRef(onCollected);
  onCollectedRef.current = onCollected;
  const pollTimer = useRef<ReturnType<typeof setTimeout>>();
  const expireTimer = useRef<ReturnType<typeof setTimeout>>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const localCount = useRef(0);

  const showToast = useCallback((text: string, tone: CloverToast["tone"]) => {
    clearTimeout(toastTimer.current);
    setToast({ key: ++toastKey.current, text, tone });
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const clear = useCallback(() => {
    clearTimeout(expireTimer.current);
    setClover(null);
  }, []);

  const place = useCallback(
    (c: { id: string; kind: "standard" | "rare"; reward: number; expiresAt: number; local: boolean }): ActiveClover | null => {
      const box = containerRef.current;
      if (!box) return null;
      const pos = pickCloverPosition(box, layoutExclusions(box), seededRandom(c.id));
      return pos ? { ...c, ...pos } : null;
    },
    [],
  );

  const show = useCallback(
    (c: ActiveClover) => {
      clearTimeout(expireTimer.current);
      setClover(c);
      expireTimer.current = setTimeout(() => setClover((cur) => (cur?.id === c.id ? null : cur)), Math.max(0, c.expiresAt - Date.now()));
    },
    [],
  );

  // Poll loop.
  useEffect(() => {
    if (!enabled || userId === undefined) {
      clearTimeout(pollTimer.current);
      clear();
      return;
    }
    let live = true;

    const schedule = (ms: number) => {
      clearTimeout(pollTimer.current);
      pollTimer.current = setTimeout(poll, ms);
    };

    const poll = async () => {
      if (!live) return;
      if (document.hidden || collectingRef.current) return schedule(15000);
      if (!userId) {
        const c = place({ id: `local-${++localCount.current}-${Date.now()}`, kind: "standard", reward: 0, expiresAt: Date.now() + 20000, local: true });
        if (c) show(c);
        return schedule(jitter(60, 90));
      }
      try {
        const r = await requestClover();
        if (!live) return;
        if (r.spawned && r.clover) {
          const c = place({
            id: r.clover.id,
            kind: r.clover.kind,
            reward: r.clover.reward,
            expiresAt: new Date(r.clover.expires_at).getTime(),
            local: false,
          });
          if (c) show(c);
        }
        schedule(r.retry_in_seconds * 1000 + jitter(0, 5));
      } catch {
        // Offline or the migration isn't deployed yet: the rangefinder carries on without clovers.
        schedule(jitter(90, 120));
      }
    };

    schedule(userId ? jitter(10, 20) : jitter(20, 35));
    return () => {
      live = false;
      clearTimeout(pollTimer.current);
      clear();
    };
  }, [enabled, userId, place, show, clear]);

  useEffect(
    () => () => {
      clearTimeout(pollTimer.current);
      clearTimeout(expireTimer.current);
      clearTimeout(toastTimer.current);
    },
    [],
  );

  const collect = useCallback(async () => {
    const c = clover;
    if (!c || collectingRef.current) return;
    if (c.local) {
      clear();
      showToast("SIGN IN TO COLLECT CLOVERS", "info");
      return;
    }
    collectingRef.current = true;
    setCollecting(true);
    try {
      const r = await collectClover(c.id);
      if (r.success) {
        clear();
        showToast(`${r.kind === "rare" ? "RARE " : ""}LUCKY CLOVER +${r.clovers_awarded ?? c.reward}`, "win");
        onCollectedRef.current?.();
      } else {
        const err = r.error ?? "network";
        showToast(COLLECT_MESSAGES[err] ?? "COULDN'T COLLECT", "warn");
        // Gone for good: stop showing it. A network blip leaves it up to retry until it expires.
        if (err !== "network" && err !== "too_fast") clear();
      }
    } finally {
      collectingRef.current = false;
      setCollecting(false);
    }
  }, [clover, clear, showToast]);

  return { clover, collecting, toast, collect };
}
