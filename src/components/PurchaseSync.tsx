import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Rpc = (fn: "claim_my_purchases") => PromiseLike<{ data: { success?: boolean; claimed?: number; clovers?: number } | null }>;

/**
 * Website purchases made before the player had a verified account are held; the first time they
 * are signed in with a verified email, they are paid out. Their Home clover then lights up.
 */
export function PurchaseSync() {
  const { user, refreshProfile } = useAuth();
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!user || done.current === user.id) return;
    done.current = user.id;
    (async () => {
      try {
        const { data } = await (supabase.rpc as unknown as Rpc).call(supabase, "claim_my_purchases");
        if (data?.success && (data.claimed ?? 0) > 0) {
          toast.success(`We added ${data.clovers ?? 0} clover${data.clovers === 1 ? "" : "s"} from your website orders 🍀`);
          await refreshProfile();
        }
      } catch { /* tried again next time the app opens */ }
    })();
  }, [user, refreshProfile]);
  return null;
}
