import { BASE as LUCKY_GOLF_STORE } from '@/data/shopCategories';

/**
 * "Use it at checkout" link: opens the store with the code already applied (Shopify's /discount/<code>).
 * Uses VITE_SHOPIFY_STORE_URL when it's set, otherwise the Lucky Golf store the Shop tab already links to.
 */
export function checkoutLink(code: string, storeUrl: string | undefined = import.meta.env.VITE_SHOPIFY_STORE_URL as string | undefined): string {
  const base = (storeUrl?.trim() || LUCKY_GOLF_STORE).replace(/\/+$/, '');
  return `${base}/discount/${encodeURIComponent(code)}`;
}
