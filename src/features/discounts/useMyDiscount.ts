import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MyDiscount {
  percent: number;
  expiresAt: string;
  /** The Shopify code, once it has been issued. */
  code: string | null;
}

type Rpc = (fn: 'get_my_discount') => PromiseLike<{ data: { success?: boolean; active?: boolean; percent?: number; expires_at?: string; code?: string | null; needs_code?: boolean } | null }>;
type Invoke = (fn: 'issue-discount') => PromiseLike<{ data: { configured?: boolean; code?: string } | null; error: unknown }>;

/**
 * The player's current Spinz discount (one at a time, a month). When it has no Shopify code yet
 * this asks the issue-discount function for one. `shopConnected` stays false until the store is
 * connected, so the app can keep showing what it showed before.
 */
export function useMyDiscount() {
  const { user } = useAuth();
  const [discount, setDiscount] = useState<MyDiscount | null>(null);
  const [shopConnected, setShopConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return null;
    try {
      const { data } = await (supabase.rpc as unknown as Rpc).call(supabase, 'get_my_discount');
      if (!data?.success || !data.active || !data.percent || !data.expires_at) {
        setDiscount(null);
        setLoaded(true);
        return null;
      }
      let code = data.code ?? null;
      if (!code && data.needs_code) {
        try {
          const { data: issued } = await (supabase.functions.invoke as unknown as Invoke).call(supabase.functions, 'issue-discount');
          setShopConnected(!!issued?.configured);
          code = issued?.code ?? null;
        } catch { /* no code yet; try again next time */ }
      } else if (code) {
        setShopConnected(true);
      }
      const d = { percent: data.percent, expiresAt: data.expires_at, code };
      setDiscount(d);
      setLoaded(true);
      return d;
    } catch {
      setLoaded(true);
      return null;
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { discount, shopConnected, loaded, refresh };
}

/** "Use it at checkout" link: opens the store with the code already applied (needs VITE_SHOPIFY_STORE_URL). */
export function checkoutLink(code: string): string | null {
  const base = (import.meta.env.VITE_SHOPIFY_STORE_URL as string | undefined)?.replace(/\/+$/, '');
  return base ? `${base}/discount/${encodeURIComponent(code)}` : null;
}
