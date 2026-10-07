import { describe, expect, it } from "vitest";
import { assessCamera, classifyTier, OLD_PHONE_NOTICE } from "../device/capabilities";

const modern = { lowEnd: false };

describe("older phone warning", () => {
  it("uses the exact wording from the brief", () => {
    expect(OLD_PHONE_NOTICE).toBe(
      "Your camera may not be accurate enough for reliable distance measurements. For best results, use a newer smartphone.",
    );
  });

  it("stays quiet for a healthy modern phone", () => {
    expect(assessCamera({ width: 1920, height: 1080, fps: 30 }, modern, 14).warn).toBe(false);
    expect(assessCamera({ width: 1080, height: 1920, fps: null }, modern, null).warn).toBe(false);
  });

  it("warns, with reasons, for a low-resolution camera", () => {
    const r = assessCamera({ width: 640, height: 480, fps: 30 }, modern);
    expect(r.warn).toBe(true);
    expect(r.reasons[0]).toMatch(/resolution/);
  });

  it("warns for a slow frame rate, a low-end device, or slow measured processing", () => {
    expect(assessCamera({ width: 1920, height: 1080, fps: 12 }, modern).warn).toBe(true);
    expect(assessCamera({ width: 1920, height: 1080, fps: 30 }, { lowEnd: true }).warn).toBe(true);
    expect(assessCamera({ width: 1920, height: 1080, fps: 30 }, modern, 95).warn).toBe(true);
  });

  it("does not warn off a one-off slow benchmark: only measured frame time counts", () => {
    // A 72 ms start-up benchmark on a busy page used to trigger this on a fast machine.
    expect(classifyTier({ lowEnd: false }, 72)).toBe("low");
    expect(assessCamera({ width: 1920, height: 1080, fps: 30 }, { lowEnd: false }, 24).warn).toBe(false);
  });
});

describe("device tier", () => {
  it("is low for old hardware, high for fast, ok otherwise", () => {
    expect(classifyTier({ lowEnd: true }, 10)).toBe("low");
    expect(classifyTier({ lowEnd: false }, 10)).toBe("high");
    expect(classifyTier({ lowEnd: false }, 30)).toBe("ok");
    expect(classifyTier({ lowEnd: false }, 80)).toBe("low");
  });
});
