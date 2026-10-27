import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "../ErrorBoundary";

describe("isChunkLoadError", () => {
  it("spots a missing page file after a deploy", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/Raffle-abc.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError("nope")).toBe(false);
  });
});
