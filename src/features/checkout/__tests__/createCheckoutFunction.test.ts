import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The function is deployed by pasting it into Supabase, so these checks guard its shape.
const src = readFileSync(resolve(__dirname, "../../../../supabase/functions/create-checkout/index.ts"), "utf8");

describe("create-checkout function (embedded-capable)", () => {
  it("creates every checkout through the one helper, so embedded mode covers putts, packs, cash and clovers", () => {
    expect(src.match(/stripe\.checkout\.sessions\.create\(/g)).toHaveLength(2); // hosted + embedded branch inside the helper
    expect(src.match(/await createSession\(/g)).toHaveLength(3);
    expect(src.match(/JSON\.stringify\(payload\(session\)\)/g)).toHaveLength(3);
    expect(src).not.toMatch(/JSON\.stringify\(\{ url: session\.url \}\)/);
  });

  it("only switches to the in-app form when the app asks, and still returns the old address otherwise", () => {
    expect(src).toContain("const embedded = body.embedded === true;");
    expect(src).toContain("embedded ? { clientSecret: session.client_secret } : { url: session.url }");
    expect(src).toMatch(/if \(!embedded\) return stripe\.checkout\.sessions\.create\(params\)/);
  });

  it("uses a return page (not success/cancel urls) for the embedded form, and keeps where the player lands", () => {
    expect(src).toContain('ui_mode: "embedded"');
    expect(src).toContain("/pay/return?session_id={CHECKOUT_SESSION_ID}&next=");
    expect(src).toContain("const { success_url, cancel_url, ...rest } = params;");
  });

  it("leaves the prices, packs, metadata and saved-card setting exactly as they were", () => {
    expect(src).toContain("1: { clovers: 20, price: 4.99 }");
    expect(src).toContain("1: { putts: 5, price: 4 }");
    expect(src).toContain("const CASH_AMOUNTS = [10, 25, 50, 100];");
    expect(src).toContain('payment_intent_data: { setup_future_usage: "off_session" }');
    for (const t of ["purchase_type: body.mode", 'purchase_type: "cash_topup"', 'purchase_type: "clover_pack"']) expect(src).toContain(t);
    expect(src).toContain("Math.floor(price / 4)");
  });
});
