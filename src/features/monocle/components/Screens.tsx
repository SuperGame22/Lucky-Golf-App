import { AlertTriangle, ArrowLeft, Camera, ShieldCheck, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { DeviceReport } from "../device/capabilities";
import { blockers } from "../device/capabilities";
import { CAMERA_ERROR_COPY } from "../device/camera";
import type { UiError } from "../hooks/useMonocleController";

export const StartScreen = ({
  device,
  starting,
  signedIn,
  offline,
  onStart,
  onBack,
}: {
  device: DeviceReport | null;
  starting: boolean;
  signedIn: boolean | undefined;
  offline: boolean;
  onStart: () => void;
  onBack: () => void;
}) => {
  const blocked = device ? blockers(device)[0] : null;
  const block = blocked === "insecure" ? CAMERA_ERROR_COPY.insecure : blocked ? CAMERA_ERROR_COPY.unsupported : null;
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-[hsl(145_30%_6%)] to-black px-6 text-center" data-testid="monocle-start">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <img src="/clover-logo.png" alt="" className="h-20 w-20 object-contain" />
      <h1 className="mt-4 font-display text-4xl font-bold text-white">Monocle</h1>
      <p className="mt-2 max-w-xs text-base text-white/75">Point at the flag. Get the yardage and the wedge for it, from 0 to 120 yards.</p>

      {block ? (
        <div className="mt-8 flex max-w-xs items-start gap-3 rounded-2xl bg-accent/15 p-4 text-left text-sm text-white" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="font-bold">{block.title}</p>
            <p className="mt-1 text-white/80">{block.body}</p>
          </div>
        </div>
      ) : (
        <Button variant="gold" size="xl" className="mt-8 h-16 w-full max-w-xs text-lg" onClick={onStart} disabled={starting} data-testid="monocle-start-button">
          <Camera className="!h-6 !w-6" />
          {starting ? "STARTING…" : "START MONOCLE"}
        </Button>
      )}

      <p className="mt-5 flex max-w-xs items-center gap-2 text-xs text-white/60">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        The camera stays on your phone. Nothing is recorded or uploaded.
      </p>
      {offline && (
        <p className="mt-3 flex max-w-xs items-center gap-2 text-xs text-accent">
          <WifiOff className="h-4 w-4 shrink-0" />
          You're offline. Monocle still works; clovers pause.
        </p>
      )}
      {signedIn === false && (
        <p className="mt-3 max-w-xs text-xs text-white/60">
          <Link to="/auth" className="font-semibold text-accent underline underline-offset-2">
            Sign in
          </Link>{" "}
          to collect Lucky Clovers and save your wedge distances.
        </p>
      )}
    </div>
  );
};

export const ErrorScreen = ({ error, onRetry, onBack }: { error: UiError; onRetry: () => void; onBack: () => void }) => (
  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black px-6 text-center" data-testid="monocle-error" role="alert">
    <AlertTriangle className="h-12 w-12 text-accent" />
    <h2 className="mt-4 text-2xl font-bold text-white">{error.title}</h2>
    <p className="mt-2 max-w-xs text-base text-white/75">{error.body}</p>
    {error.code !== "insecure" && error.code !== "unsupported" && (
      <Button variant="gold" size="lg" className="mt-8 w-full max-w-xs" onClick={onRetry}>
        TRY AGAIN
      </Button>
    )}
    <Button variant="ghost" size="lg" className="mt-3 w-full max-w-xs text-white hover:bg-white/10" onClick={onBack}>
      BACK
    </Button>
  </div>
);
