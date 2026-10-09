import type { NavigateFunction } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { readCheckoutReply } from './checkoutReply';

/** Stripe's publishable key (safe to ship in the app). Without it checkout opens Stripe's own page, as before. */
export const stripePublishableKey = (): string | null => {
  const k = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined)?.trim();
  return k && /^pk_(test|live)_/.test(k) ? k : null;
};

/**
 * Start paying for something. With a publishable key set, the payment form opens inside the app
 * (/pay); otherwise (or if the function has not been updated) it falls back to Stripe's own page.
 */
export async function startCheckout(body: Record<string, unknown>, navigate: NavigateFunction, title = 'Secure checkout') {
  const embedded = !!stripePublishableKey();
  const { data, error } = await supabase.functions.invoke('create-checkout', { body: embedded ? { ...body, embedded: true } : body });
  if (error) throw error;
  const reply = readCheckoutReply(data);
  if (reply.kind === 'embedded') {
    navigate('/pay', { state: { clientSecret: reply.clientSecret, title } });
    return;
  }
  if (reply.kind === 'redirect') {
    window.location.href = reply.url;
    return;
  }
  throw new Error(reply.message);
}
