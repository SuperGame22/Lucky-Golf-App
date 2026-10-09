import { describe, expect, it } from "vitest";
import { DISMISS_MS, dismiss, getInstallMode, isDismissed, isIos, shouldShowInstallCard } from "../install";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const base = { standalone: false, hasPromptEvent: false, maxTouchPoints: 0 };

describe("which install help to show", () => {
  it("nothing once it is already on the home screen", () => {
    expect(getInstallMode({ ...base, userAgent: IPHONE, standalone: true })).toBe("installed");
    expect(getInstallMode({ ...base, userAgent: ANDROID, standalone: true, hasPromptEvent: true })).toBe("installed");
  });
  it("one-tap install when the browser offered it", () => {
    expect(getInstallMode({ ...base, userAgent: ANDROID, hasPromptEvent: true })).toBe("prompt");
  });
  it("step-by-step help on iPhone and iPad (including iPadOS posing as a Mac)", () => {
    expect(getInstallMode({ ...base, userAgent: IPHONE })).toBe("ios");
    expect(getInstallMode({ ...base, userAgent: MAC, maxTouchPoints: 5 })).toBe("ios");
    expect(isIos(MAC, 0)).toBe(false);
  });
  it("nothing where there is nothing to offer", () => {
    expect(getInstallMode({ ...base, userAgent: MAC })).toBe("none");
    expect(getInstallMode({ ...base, userAgent: ANDROID })).toBe("none");
  });
});

describe("the card", () => {
  it("shows only when there is something to do and it was not waved away", () => {
    expect(shouldShowInstallCard("prompt", false)).toBe(true);
    expect(shouldShowInstallCard("ios", false)).toBe(true);
    expect(shouldShowInstallCard("ios", true)).toBe(false);
    expect(shouldShowInstallCard("installed", false)).toBe(false);
    expect(shouldShowInstallCard("none", false)).toBe(false);
  });
  it("stays away for two weeks after 'Not now'", () => {
    const data: Record<string, string> = {};
    const store = { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
    expect(isDismissed(store, 1000)).toBe(false);
    dismiss(store, 1000);
    expect(isDismissed(store, 1000 + DISMISS_MS - 1)).toBe(true);
    expect(isDismissed(store, 1000 + DISMISS_MS + 1)).toBe(false);
    data["lg_install_dismissed"] = "junk";
    expect(isDismissed(store, 5)).toBe(false);
  });
  it("copes with storage being unavailable", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(isDismissed(broken)).toBe(false);
    expect(() => dismiss(broken)).not.toThrow();
  });
});
