import { supabase } from '@/integrations/supabase/client';

type RpcResult = { data: unknown; error: { message: string } | null };

/** Calls a database function by name (for functions the generated client types do not know about). */
export const callRpc = (fn: string, args?: Record<string, unknown>): PromiseLike<RpcResult> =>
  (supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>).call(supabase, fn, args);
