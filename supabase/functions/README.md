# Edge functions

| Function | What it does | Called by |
|---|---|---|
| `stripe-webhook`, `create-checkout`, `buy-putt` | Stripe payments (already deployed) | Stripe / the app |
| `shopify-webhook` | A paid website order adds clovers (and marks a used discount) | Shopify |
| `issue-discount` | Turns a player's Spinz discount into a single-use Shopify code | the app |

## Connecting Shopify (once)

Shopify no longer creates old-style custom apps with a permanent token, so the app is made in the **Dev Dashboard**:

1. **Shopify admin > Settings > Apps > Develop apps** opens the Dev Dashboard. **Create app**, name it "Lucky Golf Backend".
2. In its first **version**: turn **Embed app in Shopify admin** off, and set the scopes
   `read_orders`, `read_customers`, `write_customers`, `write_price_rules`, `write_discounts`. **Release** the version.
3. **Install** the app on the Lucky Golf store (Dev Dashboard > the app > Home > Install app).
4. **Settings** in the Dev Dashboard shows the **Client ID** and **Client secret** (the app swaps them for a 24-hour token by itself).
5. **Webhook:** Shopify admin > Settings > Notifications > Webhooks > Create webhook: event **Order payment**, format **JSON**,
   URL `https://vmhlultqlwligbfoqhwf.supabase.co/functions/v1/shopify-webhook`. Copy the **signing secret** Shopify shows
   at the bottom of that page.
6. **Supabase > Edge Functions > Secrets**, add:
   - `SHOPIFY_STORE_DOMAIN` = `yourstore.myshopify.com`
   - `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` = from step 4
   - `SHOPIFY_WEBHOOK_SECRET` = the webhook signing secret
   - (testing only) `SHOPIFY_ACCEPT_TEST_ORDERS` = `1` to let Shopify test orders earn clovers
   - (an older custom app only) `SHOPIFY_ADMIN_TOKEN` = its permanent token, used instead of the client ID/secret
7. **Deploy** `shopify-webhook` with **Verify JWT turned OFF** (Shopify can't send a Supabase login; the signature is the proof)
   and `issue-discount` with Verify JWT ON (the default).
8. Optional, for the "Use it at checkout" link in the app: set `VITE_SHOPIFY_STORE_URL` (e.g. `https://shop.luckygolf.com`) in Vercel.

Never paste the token or secrets into chat; they only go in Supabase's Secrets page.

## Rules built in
- Clovers: 1 per $4 of the order's items after discounts, before shipping and tax; leftover dollars carry over.
- Only a **verified** email identifies a player. Orders for an email with no verified account are held and paid out when
  that email signs in verified. Turn on **email confirmation** in Supabase Auth so nobody can claim an email they don't own.
- Discounts: one active per player, the newest replaces the old one, valid one month, single use, restricted to the
  player's Shopify customer when it can be found.
- Refunds and cancellations do not take clovers back.
