import { Info } from "lucide-react";
import { OLD_PHONE_NOTICE } from "../device/capabilities";

/** Informational only: Monocle keeps working on older phones. */
export const OldPhoneNotice = ({ reasons, showReasons, onDismiss }: { reasons: string[]; showReasons: boolean; onDismiss: () => void }) => (
  <div
    className="absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+56px)] z-30 flex items-start gap-3 rounded-2xl bg-black/85 p-3 text-sm text-white ring-1 ring-accent/60 backdrop-blur"
    role="status"
    data-testid="monocle-old-phone"
  >
    <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
    <div className="flex-1">
      <p>{OLD_PHONE_NOTICE}</p>
      {showReasons && <p className="mt-1 text-xs text-white/60">{reasons.join("; ")}</p>}
    </div>
    <button type="button" onClick={onDismiss} className="rounded-lg px-2 py-1 text-xs font-bold text-accent">
      OK
    </button>
  </div>
);
