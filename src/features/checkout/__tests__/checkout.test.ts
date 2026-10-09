import { describe, expect, it } from "vitest";
import { readCheckoutReply, safeNextPath } from "../checkoutReply";

describe("checkout reply", () => {
  it("opens the in-app form when Stripe returns a client secret", () => {
    expect(readCheckoutReply({ clientSecret: "cs_test_abc_secret_xyz" })).toEqual({ kind: "embedded", clientSecret: "cs_test_abc_secret_xyz" });
  });
  it("still works with the older function that returns a Stripe page address", () => {
    expect(readCheckoutReply({ url: "https://checkout.stripe.com/c/pay/cs_test_1" })).toEqual({ kind: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
  });
  it("reports an error, and never redirects to a non-https or missing address", () => {
    expect(readCheckoutReply({ error: "Invalid pack" })).toEqual({ kind: "error", message: "Invalid pack" });
    expect(readCheckoutReply({ url: "javascript:alert(1)" }).kind).toBe("error");
    expect(readCheckoutReply({ url: "http://evil.test" }).kind).toBe("error");
    expect(readCheckoutReply(null).kind).toBe("error");
    expect(readCheckoutReply({ clientSecret: "" }).kind).toBe("error");
  });
});

describe("where to go after paying", () => {
  it("accepts in-app paths, with their query", () => {
    expect(safeNextPath("/practice/putting?putt=success")).toBe("/practice/putting?putt=success");
    expect(safeNextPath("/earn")).toBe("/earn");
  });
  it("refuses anything that could leave the app", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "evil", "", null, undefined, "/a\u0000b"]) {
      expect(safeNextPath(bad as string)).toBe("/earn");
    }
    expect(safeNextPath("//evil.test", "/")).toBe("/");
  });
});
