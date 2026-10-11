import { describe, expect, it } from "vitest";
import { missingConfig } from "../config";

describe("missingConfig", () => {
  it("is empty when both settings are present", () => {
    expect(missingConfig({ VITE_SUPABASE_URL: "https://x.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "key" })).toEqual([]);
  });
  it("names what is missing, blank or not text", () => {
    expect(missingConfig({})).toEqual(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
    expect(missingConfig({ VITE_SUPABASE_URL: "  ", VITE_SUPABASE_PUBLISHABLE_KEY: undefined })).toEqual(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
    expect(missingConfig({ VITE_SUPABASE_URL: "https://x.supabase.co" })).toEqual(["VITE_SUPABASE_PUBLISHABLE_KEY"]);
  });
});
