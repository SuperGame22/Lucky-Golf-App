// Turns a player's active Spinz discount into a single-use Shopify discount code.
// Called by the app (signed-in player). Returns { configured: false } until the Shopify secrets
// are set, so the app keeps working before Shopify is connected.
// Secrets: SHOPIFY_STORE_DOMAIN (e.g. luckygolf.myshopify.com), and either SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET
// (an app made in the Shopify Dev Dashboard; tokens are fetched automatically) or SHOPIFY_ADMIN_TOKEN (an older
// custom app's permanent token). The app needs write_price_rules / write_discounts and read/write customers.
// Optional: SHOPIFY_API_VERSION.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPriceRule, makeDiscountCode, makeTokenGetter } from "../_shared/shopify.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: "Not authenticated" }, 401);

  const domain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
  const getToken = domain
    ? makeTokenGetter(domain, {
      staticToken: Deno.env.get("SHOPIFY_ADMIN_TOKEN"),
      clientId: Deno.env.get("SHOPIFY_CLIENT_ID"),
      clientSecret: Deno.env.get("SHOPIFY_CLIENT_SECRET"),
    }, fetch)
    : null;
  if (!domain || !getToken) return json({ configured: false });
  let token: string;
  try { token = await getToken(); } catch (e) { return json({ configured: true, error: e instanceof Error ? e.message : "Shopify sign-in failed" }, 502); }
  const api = `https://${domain}/admin/api/${Deno.env.get("SHOPIFY_API_VERSION") ?? "2024-10"}`;
  const shopify = async (path: string, init?: RequestInit) => {
    const r = await fetch(`${api}${path}`, {
      ...init,
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, body: text ? JSON.parse(text) : null };
  };

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // The player's current discount (the database enforces one active, one month).
  const { data: active } = await admin
    .from("player_discounts")
    .select("id, percent, expires_at, shopify_code")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  // Tidy up codes for discounts that were replaced / expired (best effort).
  const { data: stale } = await admin
    .from("player_discounts")
    .select("id, shopify_rule_id")
    .eq("user_id", user.id)
    .neq("status", "active")
    .not("shopify_rule_id", "is", null);
  for (const s of stale ?? []) {
    const del = await shopify(`/price_rules/${s.shopify_rule_id}.json`, { method: "DELETE" });
    if (del.ok || del.status === 404) await admin.from("player_discounts").update({ shopify_rule_id: null }).eq("id", s.id);
  }

  if (!active) return json({ configured: true, active: false });
  if (active.shopify_code) {
    return json({ configured: true, active: true, code: active.shopify_code, percent: active.percent, expires_at: active.expires_at });
  }

  // Find (or create) the Shopify customer so the code only works for this player.
  let customerId: number | null = null;
  const found = await shopify(`/customers/search.json?query=${encodeURIComponent(`email:${user.email}`)}`);
  customerId = found.ok ? (found.body?.customers?.[0]?.id ?? null) : null;
  if (!customerId && user.email) {
    const created = await shopify(`/customers.json`, { method: "POST", body: JSON.stringify({ customer: { email: user.email } }) });
    customerId = created.ok ? (created.body?.customer?.id ?? null) : null;
  }

  const code = makeDiscountCode();
  const rule = await shopify(`/price_rules.json`, {
    method: "POST",
    body: JSON.stringify(buildPriceRule({
      percent: active.percent,
      title: `Lucky Golf ${active.percent}% (${user.id.slice(0, 8)})`,
      startsAt: new Date(),
      endsAt: new Date(active.expires_at),
      customerId,
    })),
  });
  if (!rule.ok) {
    console.error("price rule failed:", rule.status, JSON.stringify(rule.body));
    return json({ configured: true, error: "Could not create the discount" }, 502);
  }
  const ruleId = String(rule.body.price_rule.id);
  const dc = await shopify(`/price_rules/${ruleId}/discount_codes.json`, {
    method: "POST",
    body: JSON.stringify({ discount_code: { code } }),
  });
  if (!dc.ok) {
    await shopify(`/price_rules/${ruleId}.json`, { method: "DELETE" });
    console.error("discount code failed:", dc.status, JSON.stringify(dc.body));
    return json({ configured: true, error: "Could not create the discount code" }, 502);
  }

  const { data: saved, error: saveErr } = await admin.rpc("set_discount_code", { p_discount_id: active.id, p_code: code, p_rule_id: ruleId });
  if (saveErr || !saved?.success) {
    // Lost a race or the discount just changed: do not leave a live code behind.
    await shopify(`/price_rules/${ruleId}.json`, { method: "DELETE" });
    return json({ configured: true, error: "Discount changed, try again" }, 409);
  }
  return json({ configured: true, active: true, code, percent: active.percent, expires_at: active.expires_at });
});
