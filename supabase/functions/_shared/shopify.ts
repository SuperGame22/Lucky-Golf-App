// Pure helpers for the Shopify functions. No Deno-only APIs, so they are unit-tested with vitest.

const enc = new TextEncoder();

const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

/** Shopify signs each webhook: base64(HMAC-SHA256(secret, raw body)) in X-Shopify-Hmac-Sha256. */
export async function verifyShopifyHmac(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = toBase64(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(rawBody))));
  if (expected.length !== header.length) return false;
  let diff = 0; // constant-time compare
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

export interface ShopifyOrder {
  id?: number | string;
  email?: string | null;
  contact_email?: string | null;
  customer?: { email?: string | null } | null;
  test?: boolean;
  cancelled_at?: string | null;
  financial_status?: string | null;
  current_subtotal_price?: string | number | null;
  subtotal_price?: string | number | null;
  discount_codes?: { code?: string }[];
}

export type ParsedOrder =
  | { ok: true; ref: string; email: string; dollars: number; discountCodes: string[] }
  | { ok: false; reason: string };

/**
 * What a paid order is worth for clovers: the items after discounts, before shipping and tax
 * (current_subtotal_price, which also reflects refunds edited into the order).
 */
export function parsePaidOrder(order: ShopifyOrder, opts: { acceptTest?: boolean } = {}): ParsedOrder {
  if (!order || order.id === undefined || order.id === null) return { ok: false, reason: "no order id" };
  if (order.test && !opts.acceptTest) return { ok: false, reason: "test order" };
  if (order.cancelled_at) return { ok: false, reason: "cancelled" };
  if (order.financial_status && !["paid", "partially_refunded", "partially_paid"].includes(order.financial_status)) {
    return { ok: false, reason: `not paid (${order.financial_status})` };
  }
  const email = (order.email ?? order.contact_email ?? order.customer?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, reason: "no email" };
  const dollars = Number(order.current_subtotal_price ?? order.subtotal_price);
  if (!Number.isFinite(dollars) || dollars <= 0) return { ok: false, reason: "no amount" };
  const discountCodes = (order.discount_codes ?? []).map((d) => String(d.code ?? "").trim()).filter(Boolean);
  return { ok: true, ref: `shopify:${order.id}`, email, dollars: Math.round(dollars * 100) / 100, discountCodes };
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L to avoid misreading
export const DISCOUNT_PREFIX = "LG-";

/** A code like LG-7KQ2M9XA. `random` is injectable for tests. */
export function makeDiscountCode(random: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return DISCOUNT_PREFIX + s;
}

/** Body for Shopify's POST price_rules.json: a single-use percentage off the whole order, for one customer if known. */
export function buildPriceRule(opts: { percent: number; title: string; startsAt: Date; endsAt: Date; customerId?: number | null }) {
  if (!Number.isInteger(opts.percent) || opts.percent < 1 || opts.percent > 100) throw new Error("bad percent");
  const rule: Record<string, unknown> = {
    title: opts.title,
    target_type: "line_item",
    target_selection: "all",
    allocation_method: "across",
    value_type: "percentage",
    value: `-${opts.percent}.0`,
    usage_limit: 1,
    once_per_customer: true,
    starts_at: opts.startsAt.toISOString(),
    ends_at: opts.endsAt.toISOString(),
    customer_selection: "all",
  };
  if (opts.customerId) {
    rule.customer_selection = "prerequisite";
    rule.prerequisite_customer_ids = [opts.customerId];
  }
  return { price_rule: rule };
}

// ── Admin API access without a permanent token ──
// Shopify no longer creates "legacy custom apps" with a never-expiring token. Apps made in the Dev Dashboard
// swap their Client ID + Client secret for a token that lasts 24 hours (client credentials grant).

export interface TokenSource {
  /** A permanent token from an older custom app, if there is one. */
  staticToken?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean; status: number; json: () => Promise<unknown>;
}>;

/**
 * Returns a function that gives a valid Admin API token: the static one if configured, otherwise a token
 * fetched with the client credentials and reused until a few minutes before it expires.
 * Returns null from the factory when nothing is configured.
 */
export function makeTokenGetter(
  domain: string,
  src: TokenSource,
  fetchImpl: FetchLike,
  now: () => number = Date.now,
): (() => Promise<string>) | null {
  if (src.staticToken) {
    const t = src.staticToken;
    return async () => t;
  }
  if (!src.clientId || !src.clientSecret) return null;
  let cached: { token: string; expiresAt: number } | null = null;
  return async () => {
    if (cached && now() < cached.expiresAt - 5 * 60 * 1000) return cached.token;
    const res = await fetchImpl(`https://${domain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: src.clientId, client_secret: src.clientSecret, grant_type: "client_credentials" }),
    });
    if (!res.ok) throw new Error(`Shopify token request failed (${res.status})`);
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error("Shopify did not return a token");
    cached = { token: body.access_token, expiresAt: now() + (body.expires_in ?? 86399) * 1000 };
    return cached.token;
  };
}
