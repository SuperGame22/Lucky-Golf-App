/** Fired on window when a new app version is ready; detail.apply() reloads into it. */
export const SW_UPDATE_EVENT = "lg-sw-update";
export type SwUpdateDetail = { apply: () => Promise<void> | void };

let pending: SwUpdateDetail | null = null;

/** Called by the service worker setup. Remembered, because the update can be found before the UI has mounted. */
export function announceUpdate(detail: SwUpdateDetail): void {
  pending = detail;
  window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT, { detail }));
}

/** An update found before the prompt component mounted, if any. */
export function pendingUpdate(): SwUpdateDetail | null {
  return pending;
}
