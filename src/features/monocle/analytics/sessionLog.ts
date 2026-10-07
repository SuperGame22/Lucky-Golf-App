import { supabase } from "@/integrations/supabase/client";
import type { DeviceTier } from "../device/capabilities";
import type { SessionSummary } from "../engine/types";

/**
 * One summary row per Monocle session: counters and device class only. No
 * frames, no images, no location. Failures are ignored; analytics must never
 * get in the way of the rangefinder.
 */
export async function logMonocleSession(
  userId: string,
  s: SessionSummary,
  extra: { tier: DeviceTier; calibrated: boolean; oldPhoneWarning: boolean },
): Promise<void> {
  // Ignore accidental opens.
  if (s.durationMs < 5000 || s.frames < 10) return;
  try {
    await supabase.from("monocle_sessions").insert({
      user_id: userId,
      started_at: new Date(Date.now() - s.durationMs).toISOString(),
      duration_seconds: Math.min(86400, Math.round(s.durationMs / 1000)),
      device_tier: extra.tier,
      camera_width: s.camWidth,
      camera_height: s.camHeight,
      avg_fps: s.avgFps != null ? Math.round(s.avgFps * 10) / 10 : null,
      avg_proc_ms: s.avgProcMs,
      frames: s.frames,
      locks: s.locks,
      brackets: s.brackets,
      calibrated: extra.calibrated,
      old_phone_warning: extra.oldPhoneWarning,
      max_locked_yards: s.maxLockedYards != null ? Math.min(2000, s.maxLockedYards) : null,
    });
  } catch {
    /* offline */
  }
}
