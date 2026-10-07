import { Check, Download, RotateCcw, Smartphone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DEFAULT_WEDGE_CONFIG, SWING_LABELS, SWING_ORDER, SwingType } from "../config/wedges";
import { STICK } from "../config/constants";
import { CALIBRATION_PRESETS } from "../engine/calibration";
import type { DeviceReport } from "../device/capabilities";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import type { MonocleSettingsApi } from "../settings/useMonocleSettings";

export interface CalibrationRequest {
  label: string;
  objectHeightIn: number;
  distanceIn: number;
  distanceFt: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api: MonocleSettingsApi;
  cameraKey: string | null;
  calibrated: boolean;
  calibrationRatio: number;
  device: DeviceReport | null;
  signedIn: boolean | undefined;
  /** Calibration needs the live camera, so it is only offered while Monocle is running. */
  canCalibrate: boolean;
  onStartCalibration: (req: CalibrationRequest) => void;
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{children}</h3>
);

export const SettingsSheet = ({ open, onOpenChange, api, cameraKey, calibrated, calibrationRatio, device, signedIn, canCalibrate, onStartCalibration }: Props) => {
  const { settings } = api;
  const { canInstall, install } = useInstallPrompt();
  const [presetId, setPresetId] = useState(CALIBRATION_PRESETS[0].id);
  const preset = CALIBRATION_PRESETS.find((p) => p.id === presetId) ?? CALIBRATION_PRESETS[0];
  const [distanceFt, setDistanceFt] = useState<string>(String(preset.defaultDistanceFt));

  const stickIn = settings.stickHeightIn;
  const isSeven = stickIn === 84;
  const isEight = stickIn === 96;

  const setShot = (wedgeId: string, swing: SwingType, value: string) => {
    const n = Number(value);
    const wedges = settings.wedgeConfig.wedges.map((w) => {
      if (w.id !== wedgeId) return w;
      const shots = { ...w.shots };
      if (Number.isFinite(n) && n > 0) shots[swing] = Math.min(250, Math.round(n));
      else delete shots[swing];
      return { ...w, shots };
    });
    api.setWedgeConfig({ ...settings.wedgeConfig, wedges });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]" data-testid="monocle-settings">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Monocle settings</SheetTitle>
          <SheetDescription>Saved on this phone{signedIn ? " and to your Lucky account" : ". Sign in to keep them across devices"}.</SheetDescription>
        </SheetHeader>

        <SectionTitle>Flagstick height</SectionTitle>
        <div className="flex items-center gap-2">
          {[
            { label: "7 ft", in: 84, on: isSeven },
            { label: "8 ft", in: 96, on: isEight },
          ].map((o) => (
            <Button key={o.label} variant={o.on ? "default" : "outline"} className="h-12 flex-1 text-base" onClick={() => api.setStickHeight(o.in)}>
              {o.label}
              {o.on && api.stickFromUser && <Check className="h-4 w-4" />}
            </Button>
          ))}
          <div className="flex flex-1 items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={STICK.minHeightIn}
              max={STICK.maxHeightIn}
              value={stickIn}
              onChange={(e) => Number(e.target.value) > 0 && api.setStickHeight(Number(e.target.value))}
              className={cn("h-12 text-center text-base", !isSeven && !isEight && "border-primary")}
              aria-label="Custom flagstick height in inches"
            />
            <span className="text-sm text-muted-foreground">in</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Most courses use 7 ft. Distance scales with this: an 8 ft stick that you've set as 7 ft reads 14% too short.
          {!api.stickFromUser && " Currently assuming 7 ft."}
        </p>

        <SectionTitle>Camera calibration</SectionTitle>
        <div className="rounded-2xl bg-muted/50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {calibrated ? (
              <>
                <Check className="h-4 w-4 text-primary" /> Calibrated (ratio {calibrationRatio.toFixed(3)}). About ±2% extra error.
              </>
            ) : (
              <>Not calibrated. Adds about ±7% extra error to every reading.</>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">One minute, once per phone: measure something of known height from a known distance.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CALIBRATION_PRESETS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={p.id === presetId ? "default" : "outline"}
                onClick={() => {
                  setPresetId(p.id);
                  setDistanceFt(String(p.defaultDistanceFt));
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm">Stand</span>
            <Input type="number" inputMode="decimal" value={distanceFt} onChange={(e) => setDistanceFt(e.target.value)} className="h-11 w-24 text-center" aria-label="Distance in feet" />
            <span className="text-sm">ft away (measure with a tape)</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              variant="gold"
              className="h-12 flex-1"
              disabled={!canCalibrate || !(Number(distanceFt) > 2)}
              onClick={() => {
                const ft = Number(distanceFt);
                onStartCalibration({ label: preset.label.replace(/ \(.*\)/, ""), objectHeightIn: preset.objectHeightIn, distanceIn: ft * 12, distanceFt: ft });
                onOpenChange(false);
              }}
              data-testid="monocle-calibrate-start"
            >
              {canCalibrate ? "Start calibration" : "Start Monocle first"}
            </Button>
            {calibrated && cameraKey && (
              <Button variant="outline" className="h-12" onClick={() => api.clearCalibration(cameraKey)} aria-label="Reset calibration">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <SectionTitle>Wedge distances (yards, carry)</SectionTitle>
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-4 gap-px bg-border text-center text-xs font-bold text-muted-foreground">
            <div className="bg-card p-2" />
            {SWING_ORDER.map((s) => (
              <div key={s} className="bg-card p-2">
                {SWING_LABELS[s].replace(" SWING", "")}
              </div>
            ))}
          </div>
          {settings.wedgeConfig.wedges.map((w) => (
            <div key={w.id} className="grid grid-cols-4 items-center gap-px border-t border-border bg-border">
              <div className="bg-card p-2 text-center text-base font-extrabold">{w.loft}°</div>
              {SWING_ORDER.map((s) => (
                <div key={s} className="bg-card p-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={w.shots[s] ?? ""}
                    onChange={(e) => setShot(w.id, s, e.target.value)}
                    className="h-11 border-0 text-center text-base"
                    aria-label={`${w.loft} degree ${SWING_LABELS[s]} distance`}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Starting values are placeholders. Set yours to get the right club.</p>
          <Button variant="ghost" size="sm" onClick={() => api.setWedgeConfig(DEFAULT_WEDGE_CONFIG)}>
            Reset
          </Button>
        </div>

        <SectionTitle>App</SectionTitle>
        {canInstall ? (
          <Button variant="outline" className="h-12 w-full" onClick={install}>
            <Download className="h-4 w-4" /> Add Lucky Golf to your home screen
          </Button>
        ) : device?.isIOS && !device.isStandalone ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
            On iPhone: tap the Share button, then "Add to Home Screen" to launch Lucky Golf full-screen.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{device?.isStandalone ? "Running as an installed app." : "Install is available from your browser menu."}</p>
        )}
        {api.syncError && <p className="mt-3 text-xs text-accent">{api.syncError}</p>}
      </SheetContent>
    </Sheet>
  );
};
