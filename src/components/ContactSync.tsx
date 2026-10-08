import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { clearPendingContact, readPendingContact } from "@/features/invites/invites";

type Rpc = (fn: "set_my_phone", args: { p_phone: string; p_consent: boolean }) => PromiseLike<{ data: { success?: boolean; error?: string } | null }>;

/**
 * A mobile number typed on the signup form is saved here once the new player is actually signed
 * in (right after signup there may be no session yet, e.g. while an email still needs confirming).
 */
export function ContactSync() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const pending = readPendingContact(localStorage);
    if (!pending) return;
    (async () => {
      try {
        const { data } = await (supabase.rpc as unknown as Rpc).call(supabase, "set_my_phone", { p_phone: pending.phone, p_consent: pending.consent });
        // Saved, or refused for a reason retrying will not fix: either way stop keeping it.
        if (data?.success || data?.error) clearPendingContact(localStorage);
      } catch { /* try again next time the app opens */ }
    })();
  }, [user]);
  return null;
}
