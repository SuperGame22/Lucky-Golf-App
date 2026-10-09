/** Helpers for the "Add to Home Screen" card. Pure (the browser bits are passed in) so they can be tested. */

export type InstallMode =
  | 'installed' // already running from the home screen
  | 'prompt' // Chrome / Edge / Android: one tap installs (the browser offered an install prompt)
  | 'ios' // iPhone / iPad: no prompt exists, the player has to use Share > Add to Home Screen
  | 'none'; // nothing useful to show (desktop Safari/Firefox, or the browser has not offered it yet)

export interface InstallEnv {
  /** window.matchMedia('(display-mode: standalone)').matches or navigator.standalone */
  standalone: boolean;
  userAgent: string;
  /** a beforeinstallprompt event was captured */
  hasPromptEvent: boolean;
  /** iPadOS pretends to be a Mac; touch points tell them apart */
  maxTouchPoints?: number;
}

export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1; // iPadOS 13+
}

export function getInstallMode(env: InstallEnv): InstallMode {
  if (env.standalone) return 'installed';
  if (env.hasPromptEvent) return 'prompt';
  if (isIos(env.userAgent, env.maxTouchPoints)) return 'ios';
  return 'none';
}

export const DISMISS_KEY = 'lg_install_dismissed';
/** After "Not now" the card stays away this long. */
export const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

type KV = Pick<Storage, 'getItem' | 'setItem'>;

export function isDismissed(store: KV, now = Date.now()): boolean {
  try {
    const at = Number(store.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && now - at < DISMISS_MS;
  } catch {
    return false;
  }
}

export function dismiss(store: KV, now = Date.now()) {
  try { store.setItem(DISMISS_KEY, String(now)); } catch { /* it just shows again next time */ }
}

export function shouldShowInstallCard(mode: InstallMode, dismissed: boolean): boolean {
  return !dismissed && (mode === 'prompt' || mode === 'ios');
}
