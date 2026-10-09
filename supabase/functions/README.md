# Edge functions

| Function | What it does | Called by |
|---|---|---|
| `stripe-webhook`, `create-checkout`, `buy-putt` | Stripe payments (already deployed) | Stripe / the app |
| `shopify-webhook` | A paid website order adds clovers (and marks a used discount) | Shopify |
| `issue-discount` | Turns a player's Spinz discount into a single-use Shopify code | the app |

## Connecting Shopify (once)

1. **Shopify admin > Settings > Apps and sales channels > Develop apps > Create an app** ("Lucky Golf").
2. **Configure Admin API scopes:** `read_orders`, `read_customers`, `write_customers`, `write_price_rules`, `write_discounts`
   (shown as "Discounts" / "Price rules" in the list). Save, then **Install app** and copy the **Admin API access token**
   (shown once).
3. **Webhook:** Settings > Notifications > Webhooks > Create webhook: event **Order payment**, format **JSON**,
   URL `https://vmhlultqlwligbfoqhwf.supabase.co/functions/v1/shopify-webhook`. Copy the **signing secret** Shopify shows
   at the bottom of that page (for webhooks created there it is the "Your webhooks will be signed with ..." value).
4. **Supabase > Edge Functions > Secrets**, add:
   - `SHOPIFY_STORE_DOMAIN` = `yourstore.myshopify.com`
   - `SHOPIFY_ADMIN_TOKEN` = the Admin API access token
   - `SHOPIFY_WEBHOOK_SECRET` = the webhook signing secret
   - (testing only) `SHOPIFY_ACCEPT_TEST_ORDERS` = `1` to let Shopify test orders earn clovers
5. **Deploy** `shopify-webhook` with **Verify JWT turned OFF** (Shopify can't send a Supabase login; the signature is the proof)
   and `issue-discount` with Verify JWT ON (the default).
6. Optional, for the "Use it at checkout" link in the app: set `VITE_SHOPIFY_STORE_URL` (e.g. `https://shop.luckygolf.com`) in Vercel.

Never paste the token or secrets into chat; they only go in Supabase's Secrets page.

## Rules built in
- Clovers: 1 per $4 of the order's items after discounts, before shipping and tax; leftover dollars carry over.
- Only a **verified** email identifies a player. Orders for an email with no verified account are held and paid out when
  that email signs in verified. Turn on **email confirmation** in Supabase Auth so nobody can claim an email they don't own.
- Discounts: one active per player, the newest replaces the old one, valid one month, single use, restricted to the
  player's Shopify customer when it can be found.
- Refunds and cancellations do not take clovers back.
