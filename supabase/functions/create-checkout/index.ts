import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Server-side pack definitions — never trust price/clovers from the client.
const PACKS: Record<number, { clovers: number; price: number }> = {
  1: { clovers: 20, price: 4.99 },
  2: { clovers: 55, price: 9.99 },  // 50 + 5 bonus
  3: { clovers: 140, price: 19.99 }, // 120 + 20 bonus
  4: { clovers: 375, price: 39.99 }, // 300 + 75 bonus
};

// Putting packs: putts + bonus clovers (1 clover per $4 spent, rounded down).
const PUTT_PACKS: Record<number, { putts: number; price: number }> = {
  1: { putts: 5, price: 4 },
  2: { putts: 10, price: 7 },
  3: { putts: 15, price: 10 },
  4: { putts: 30, price: 18 },
};

// Preset cash top-up amounts (USD). Server-side allowlist — never trust an
// arbitrary amount from the client for a real-money charge.
const CASH_AMOUNTS = [10, 25, 50, 100];

async function getOrCreateCustomer(stripe: Stripe, userId: string, email: string | undefined) {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: existing } = await admin
    .from("stripe_customers")
    .select("customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.customer_id) return existing.customer_id as string;
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });
  await admin.from("stripe_customers").upsert({ user_id: userId, customer_id: customer.id });
  return customer.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) throw new Error("Not authenticated");
    const userId = userData.user.id;

    const body = await req.json();
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });
    const origin = req.headers.get("origin") || "https://your-app.vercel.app";

    // Embedded checkout: the app shows Stripe's payment form inside its own page (/pay) instead of
    // sending the player to Stripe's site. Only used when the app asks for it ({ embedded: true });
    // otherwise everything works exactly as before (hosted page, url returned).
    const embedded = body.embedded === true;
    const createSession = (params: Stripe.Checkout.SessionCreateParams) => {
      if (!embedded) return stripe.checkout.sessions.create(params);
      // Where the player lands afterwards: the same page the hosted flow used for success.
      const next = params.success_url ? (() => { const u = new URL(params.success_url!); return u.pathname + u.search; })() : "/earn";
      // deno-lint-ignore no-unused-vars
      const { success_url, cancel_url, ...rest } = params;
      return stripe.checkout.sessions.create({
        ...rest,
        ui_mode: "embedded",
        return_url: `${origin}/pay/return?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(next)}`,
      });
    };
    const payload = (session: Stripe.Checkout.Session) =>
      embedded ? { clientSecret: session.client_secret } : { url: session.url };

    if (body.mode === "putt" || body.mode === "putt_pack") {
      // $1 single putt, or a Putting Pack. Card is saved for one-click rebuys.
      let putts = 1;
      let price = 1;
      let name = "1 Putt";
      if (body.mode === "putt_pack") {
        const pp = PUTT_PACKS[body.packId];
        if (!pp) throw new Error("Invalid pack");
        putts = pp.putts;
        price = pp.price;
        name = `${pp.putts} Putts`;
      }
      const bonusClovers = body.mode === "putt_pack" ? Math.floor(price / 4) : 0;
      const customerId = await getOrCreateCustomer(stripe, userId, userData.user.email ?? undefined);

      const session = await createSession({
        mode: "payment",
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        }],
        payment_intent_data: { setup_future_usage: "off_session" },
        metadata: {
          purchase_type: body.mode,
          user_id: userId,
          putts: String(putts),
          bonus_clovers: String(bonusClovers),
        },
        success_url: body.mode === "putt"
          ? `${origin}/practice/putting?putt=success`
          : `${origin}/earn/putting-packs?purchase=success`,
        cancel_url: body.mode === "putt"
          ? `${origin}/practice/putting?putt=cancelled`
          : `${origin}/earn/putting-packs?purchase=cancelled`,
      });

      return new Response(JSON.stringify(payload(session)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.mode === "cash") {
      const amount = CASH_AMOUNTS.includes(body.amountUsd) ? body.amountUsd : null;
      if (!amount) throw new Error("Invalid amount");

      const session = await createSession({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: `Add $${amount} cash` },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        metadata: {
          purchase_type: "cash_topup",
          user_id: userId,
          amount_usd: String(amount),
        },
        success_url: `${origin}/earn?topup=success`,
        cancel_url: `${origin}/earn?topup=cancelled`,
      });

      return new Response(JSON.stringify(payload(session)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: clover pack purchase (unchanged behavior)
    const pack = PACKS[body.packId];
    if (!pack) throw new Error("Invalid pack");

    const session = await createSession({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `${pack.clovers} Clovers` },
          unit_amount: Math.round(pack.price * 100),
        },
        quantity: 1,
      }],
      metadata: {
        purchase_type: "clover_pack",
        user_id: userId,
        pack_id: String(body.packId),
        clovers: String(pack.clovers),
      },
      success_url: `${origin}/earn?purchase=success`,
      cancel_url: `${origin}/earn/packs?purchase=cancelled`,
    });

    return new Response(JSON.stringify(payload(session)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-checkout error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
