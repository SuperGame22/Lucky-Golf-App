import { supabase } from "@/integrations/supabase/client";

export interface SpawnedClover {
  id: string;
  kind: "standard" | "rare";
  reward: number;
  expires_at: string;
}

export interface RequestCloverResult {
  spawned: boolean;
  clover?: SpawnedClover;
  reason?: string;
  retry_in_seconds: number;
}

export type CollectError =
  | "not_found"
  | "already_collected"
  | "expired"
  | "too_fast"
  | "daily_cap"
  | "no_wallet"
  | "network"
  | "unauthenticated";

export interface CollectResult {
  success: boolean;
  clovers_awarded?: number;
  new_balance?: number;
  kind?: "standard" | "rare";
  error?: CollectError;
}

/** Ask the server whether a clover should appear. The server owns frequency, caps and rewards. */
export async function requestClover(): Promise<RequestCloverResult> {
  const { data, error } = await supabase.rpc("monocle_request_clover");
  if (error) throw error;
  const r = data as unknown as RequestCloverResult;
  return { ...r, retry_in_seconds: Math.max(10, Number(r.retry_in_seconds) || 45) };
}

export async function collectClover(id: string): Promise<CollectResult> {
  try {
    const { data, error } = await supabase.rpc("monocle_collect_clover", { p_clover_id: id });
    if (error) return { success: false, error: error.code === "42501" ? "unauthenticated" : "network" };
    return data as unknown as CollectResult;
  } catch {
    return { success: false, error: "network" };
  }
}

export const COLLECT_MESSAGES: Partial<Record<CollectError, string>> = {
  already_collected: "ALREADY COLLECTED",
  expired: "TOO SLOW. IT GOT AWAY",
  daily_cap: "DAILY CLOVER LIMIT REACHED",
  network: "OFFLINE. TRY AGAIN",
  too_fast: "TRY AGAIN",
  unauthenticated: "SIGN IN TO COLLECT",
  no_wallet: "WALLET NOT READY. TRY LATER",
};
