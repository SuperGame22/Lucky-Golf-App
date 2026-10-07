import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { STICK } from "../config/constants";
import type { RecommendationConfig } from "../config/wedges";
import type { CalibrationRecord } from "../engine/calibration";
import {
  loadLocalSettings,
  MonocleSettings,
  resolveSync,
  saveLocalSettings,
  stickFromUser,
  toRemote,
} from "./settingsStore";

export interface MonocleSettingsApi {
  settings: MonocleSettings;
  stickFromUser: boolean;
  setStickHeight: (inches: number) => void;
  setWedgeConfig: (config: RecommendationConfig) => void;
  setCalibration: (cameraKey: string, ratio: number) => void;
  clearCalibration: (cameraKey: string) => void;
  /** Last sync problem, e.g. offline. Settings still work locally. */
  syncError: string | null;
}

/** The signed-in user's id, null when signed out, undefined while loading. */
export function useAuthUserId(): string | null | undefined {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    supabase.auth
      .getUser()
      .then(({ data }) => live && setId(data.user?.id ?? null))
      .catch(() => live && setId(null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setId(session?.user?.id ?? null));
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return id;
}

/**
 * Monocle settings: always available from this device, and synced to the
 * user's Supabase row when they are signed in.
 */
export function useMonocleSettings(userId: string | null | undefined): MonocleSettingsApi {
  const [settings, setSettings] = useState<MonocleSettings>(() => loadLocalSettings());
  const [syncError, setSyncError] = useState<string | null>(null);
  const latest = useRef(settings);
  latest.current = settings;
  const pushTimer = useRef<ReturnType<typeof setTimeout>>();

  const push = useCallback(async (uid: string, s: MonocleSettings) => {
    const { error } = await supabase.from("monocle_settings").upsert(toRemote(uid, s) as never, { onConflict: "user_id" });
    setSyncError(error ? "Couldn't sync settings. Saved on this device." : null);
  }, []);

  // Pull on sign-in; adopt or push depending on which copy is newer.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    (async () => {
      const { data, error } = await supabase.from("monocle_settings").select("*").eq("user_id", userId).maybeSingle();
      if (!live) return;
      if (error) {
        setSyncError("Couldn't load your saved settings. Using this device's copy.");
        return;
      }
      const { next, push: shouldPush } = resolveSync(latest.current, data);
      if (next !== latest.current) {
        setSettings(next);
        saveLocalSettings(next);
      }
      if (shouldPush) await push(userId, next);
      else setSyncError(null);
    })().catch(() => live && setSyncError("Offline. Settings are saved on this device."));
    return () => {
      live = false;
    };
  }, [userId, push]);

  const update = useCallback(
    (patch: Partial<MonocleSettings>) => {
      const next: MonocleSettings = { ...latest.current, ...patch, updatedAt: new Date().toISOString() };
      latest.current = next;
      setSettings(next);
      saveLocalSettings(next);
      if (userId) {
        clearTimeout(pushTimer.current);
        pushTimer.current = setTimeout(() => void push(userId, next).catch(() => setSyncError("Offline. Settings are saved on this device.")), 800);
      }
    },
    [userId, push],
  );

  useEffect(() => () => clearTimeout(pushTimer.current), []);

  return {
    settings,
    stickFromUser: stickFromUser(settings),
    syncError,
    setStickHeight: (inches) =>
      update({
        stickHeightIn: Math.min(STICK.maxHeightIn, Math.max(STICK.minHeightIn, Math.round(inches))),
        stickConfirmed: true,
      }),
    setWedgeConfig: (wedgeConfig) => update({ wedgeConfig }),
    setCalibration: (cameraKey, ratio) =>
      update({ calibrations: { ...latest.current.calibrations, [cameraKey]: { ratio, at: new Date().toISOString() } as CalibrationRecord } }),
    clearCalibration: (cameraKey) => {
      const { [cameraKey]: _drop, ...rest } = latest.current.calibrations;
      update({ calibrations: rest });
    },
  };
}
