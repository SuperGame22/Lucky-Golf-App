// Shopify -> Lucky Golf: when an order is paid on the website, add it to the player's spend
// (clovers + the lit leaves on Home). Also marks a spin-won discount code as used.
//
// Set up in Shopify admin: Settings > Notifications > Webhooks (or the custom app's webhooks):
//   Event "Order payment" (orders/paid), format JSON, URL
//   https://<project>.supabase.co/functions/v1/shopify-webhook
// Secrets (Supabase > Edge Functions > Secrets): SHOPIFY_WEBHOOK_SECRET (the signing secret Shopify shows).
// Deploy with "Verify JWT" OFF: Shopify cannot send a Supabase login, the signature is the proof.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DISCOUNT_PREFIX, parsePaidOrder, verifyShopifyHmac } from "../_shared/shopify.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  const secret = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") ?? "";
  if (!(await verifyShopifyHmac(raw, req.headers.get("x-shopify-hmac-sha256"), secret))) {
    return new Response("Invalid signature", { status: 401 });
  }

  if (req.headers.get("x-shopify-topic") !== "orders/paid") {
    return new Response(JSON.stringify({ ignored: true }), { status: 200 });
  }

  let order;
  try {
    order = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const parsed = parsePaidOrder(order, { acceptTest: Deno.env.get("SHOPIFY_ACCEPT_TEST_ORDERS") === "1" });
  if (!parsed.ok) {
    // Not an error for Shopify (it would retry): just nothing to credit.
    console.log("shopify-webhook skipped:", parsed.reason);
    return new Response(JSON.stringify({ skipped: parsed.reason }), { status: 200 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { error } = await supabase.rpc("record_site_purchase", {
    p_email: parsed.email,
    p_ref: parsed.ref,
    p_dollars: parsed.dollars,
    p_source: "shopify",
  });
  if (error) {
    console.error("record_site_purchase failed:", error);
    return new Response("Failed to record purchase", { status: 500 }); // Shopify will retry
  }

  for (const code of parsed.discountCodes.filter((c) => c.toUpperCase().startsWith(DISCOUNT_PREFIX))) {
    const { error: usedErr } = await supabase.rpc("mark_discount_used", { p_code: code.toUpperCase() });
    if (usedErr) console.error("mark_discount_used failed:", usedErr);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
