import { describe, expect, it } from "vitest";
import { buildPriceRule, makeDiscountCode, parsePaidOrder, verifyShopifyHmac } from "../shopify";

const sign = async (body: string, secret: string) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return btoa(String.fromCharCode(...sig));
};

describe("shopify webhook signature", () => {
  it("accepts the right signature and rejects anything else", async () => {
    const body = JSON.stringify({ id: 1, total: "10.00" });
    const good = await sign(body, "s3cret");
    expect(await verifyShopifyHmac(body, good, "s3cret")).toBe(true);
    expect(await verifyShopifyHmac(body + " ", good, "s3cret")).toBe(false); // body changed
    expect(await verifyShopifyHmac(body, good, "other")).toBe(false); // wrong secret
    expect(await verifyShopifyHmac(body, good.slice(0, -2) + "AA", "s3cret")).toBe(false); // wrong signature
    expect(await verifyShopifyHmac(body, null, "s3cret")).toBe(false);
    expect(await verifyShopifyHmac(body, good, "")).toBe(false);
  });
});

describe("paid order parsing", () => {
  const base = { id: 5012345678, email: "Dan@Example.com", financial_status: "paid", current_subtotal_price: "47.50", discount_codes: [{ code: "LG-ABC12345" }] };
  it("takes the order, lower-cased email, and the items total after discounts (no shipping or tax)", () => {
    expect(parsePaidOrder({ ...base, subtotal_price: "50.00" })).toEqual({ ok: true, ref: "shopify:5012345678", email: "dan@example.com", dollars: 47.5, discountCodes: ["LG-ABC12345"] });
  });
  it("falls back to subtotal_price and to the customer's email", () => {
    const r = parsePaidOrder({ id: 9, customer: { email: "x@y.com" }, subtotal_price: "12.349", financial_status: "paid" });
    expect(r).toMatchObject({ ok: true, email: "x@y.com", dollars: 12.35 });
  });
  it("skips orders that should not earn clovers", () => {
    expect(parsePaidOrder({ ...base, test: true })).toEqual({ ok: false, reason: "test order" });
    expect(parsePaidOrder({ ...base, test: true }, { acceptTest: true })).toMatchObject({ ok: true });
    expect(parsePaidOrder({ ...base, cancelled_at: "2026-10-01" })).toEqual({ ok: false, reason: "cancelled" });
    expect(parsePaidOrder({ ...base, financial_status: "pending" })).toMatchObject({ ok: false });
    expect(parsePaidOrder({ ...base, email: "" })).toEqual({ ok: false, reason: "no email" });
    expect(parsePaidOrder({ ...base, current_subtotal_price: "0.00", subtotal_price: "0.00" })).toEqual({ ok: false, reason: "no amount" });
    expect(parsePaidOrder({ email: "a@b.com" })).toEqual({ ok: false, reason: "no order id" });
  });
});

describe("discount codes", () => {
  it("makes readable single-use codes", () => {
    const code = makeDiscountCode();
    expect(code).toMatch(/^LG-[A-HJKMNP-Z2-9]{8}$/);
    let n = 0;
    expect(makeDiscountCode(() => (n++ % 31) / 31)).toMatch(/^LG-/);
  });
  it("builds a one-use percentage rule that ends with the discount, restricted to the customer when known", () => {
    const r = buildPriceRule({ percent: 15, title: "t", startsAt: new Date("2026-10-09T00:00:00Z"), endsAt: new Date("2026-11-09T00:00:00Z"), customerId: 77 }).price_rule;
    expect(r).toMatchObject({ value: "-15.0", value_type: "percentage", usage_limit: 1, once_per_customer: true, customer_selection: "prerequisite", prerequisite_customer_ids: [77], ends_at: "2026-11-09T00:00:00.000Z" });
    const open = buildPriceRule({ percent: 10, title: "t", startsAt: new Date(), endsAt: new Date() }).price_rule;
    expect(open.customer_selection).toBe("all");
    expect(open.prerequisite_customer_ids).toBeUndefined();
    expect(() => buildPriceRule({ percent: 0, title: "t", startsAt: new Date(), endsAt: new Date() })).toThrow();
    expect(() => buildPriceRule({ percent: 150, title: "t", startsAt: new Date(), endsAt: new Date() })).toThrow();
  });
});
