import { STICK } from "../config/constants";
import { DEFAULT_WEDGE_CONFIG, normalizeWedgeConfig, RecommendationConfig } from "../config/wedges";
import type { CalibrationMap } from "../engine/calibration";

export interface MonocleSettings {
  stickHeightIn: number;
  /** The user has chosen the stick height (rather than us assuming 7 ft). */
  stickConfirmed: boolean;
  wedgeConfig: RecommendationConfig;
  calibrations: CalibrationMap;
  /** ISO time of the last local change; decides who wins when syncing. */
  updatedAt: string;
}

export const SETTINGS_KEY = "lucky.monocle.settings.v1";

export const DEFAULT_SETTINGS: MonocleSettings = {
  stickHeightIn: STICK.defaultHeightIn,
  stickConfirmed: false,
  wedgeConfig: DEFAULT_WEDGE_CONFIG,
  calibrations: {},
  updatedAt: new Date(0).toISOString(),
};

export const stickFromUser = (s: MonocleSettings) => s.stickConfirmed || s.stickHeightIn !== STICK.defaultHeightIn;

export function sanitize(raw: unknown): MonocleSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<MonocleSettings>;
  const h = Number(r.stickHeightIn);
  const calibrations: CalibrationMap = {};
  if (r.calibrations && typeof r.calibrations === "object") {
    for (const [k, v] of Object.entries(r.calibrations)) {
      if (v && typeof v.ratio === "number" && v.ratio > 0 && typeof v.at === "string") calibrations[k] = { ratio: v.ratio, at: v.at };
    }
  }
  return {
    stickHeightIn: Number.isFinite(h) ? Math.min(STICK.maxHeightIn, Math.max(STICK.minHeightIn, h)) : STICK.defaultHeightIn,
    stickConfirmed: !!r.stickConfirmed,
    wedgeConfig: normalizeWedgeConfig(r.wedgeConfig),
    calibrations,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : DEFAULT_SETTINGS.updatedAt,
  };
}

export function loadLocalSettings(): MonocleSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveLocalSettings(s: MonocleSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* private mode or storage disabled: settings just won't persist */
  }
}

export interface RemoteRow {
  stick_height_in: number;
  wedge_config: unknown;
  calibrations: unknown;
  updated_at: string;
}

export function fromRemote(row: RemoteRow, local: MonocleSettings): MonocleSettings {
  return sanitize({
    stickHeightIn: Number(row.stick_height_in),
    stickConfirmed: local.stickConfirmed || Number(row.stick_height_in) !== STICK.defaultHeightIn,
    wedgeConfig: row.wedge_config ?? undefined,
    // Calibrations are per camera, so keep this phone's own and add any others from the account.
    calibrations: { ...(row.calibrations as CalibrationMap), ...local.calibrations },
    updatedAt: row.updated_at,
  });
}

export function toRemote(userId: string, s: MonocleSettings) {
  const customWedges = JSON.stringify(s.wedgeConfig) !== JSON.stringify(DEFAULT_WEDGE_CONFIG);
  return {
    user_id: userId,
    stick_height_in: s.stickHeightIn,
    wedge_config: customWedges ? (s.wedgeConfig as unknown as Record<string, unknown>) : null,
    calibrations: s.calibrations as unknown as Record<string, unknown>,
  };
}

/** Decide whether to adopt the account's copy or push this device's copy. */
export function resolveSync(local: MonocleSettings, remote: RemoteRow | null): { next: MonocleSettings; push: boolean } {
  if (!remote) {
    const changed = local.updatedAt !== DEFAULT_SETTINGS.updatedAt;
    return { next: local, push: changed };
  }
  if (new Date(remote.updated_at).getTime() >= new Date(local.updatedAt).getTime()) {
    return { next: fromRemote(remote, local), push: false };
  }
  return { next: local, push: true };
}
