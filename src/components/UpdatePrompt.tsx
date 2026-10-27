import { useEffect } from "react";
import { toast } from "sonner";
import { SW_UPDATE_EVENT, pendingUpdate, type SwUpdateDetail } from "@/lib/swUpdate";

/** Shows "New version ready · Reload" when the service worker has downloaded an update. */
export function UpdatePrompt() {
  useEffect(() => {
    const show = ({ apply }: SwUpdateDetail) => {
      toast("A new version of Lucky Golf is ready", {
        id: "sw-update",
        duration: Infinity,
        action: { label: "Reload", onClick: () => { void apply(); } },
      });
    };
    const onUpdate = (e: Event) => show((e as CustomEvent<SwUpdateDetail>).detail);
    const waiting = pendingUpdate();
    if (waiting) show(waiting);
    window.addEventListener(SW_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(SW_UPDATE_EVENT, onUpdate);
  }, []);
  return null;
}
