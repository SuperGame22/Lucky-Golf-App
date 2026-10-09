// Pure checkout helpers (no app imports) so they can be tested on their own.

export type CheckoutReply =
  | { kind: 'embedded'; clientSecret: string }
  | { kind: 'redirect'; url: string }
  | { kind: 'error'; message: string };

/** What the create-checkout function sent back. An older function that ignores `embedded` still returns a url, which works. */
export function readCheckoutReply(data: unknown): CheckoutReply {
  const d = (data ?? {}) as { clientSecret?: unknown; url?: unknown; error?: unknown };
  if (typeof d.clientSecret === 'string' && d.clientSecret) return { kind: 'embedded', clientSecret: d.clientSecret };
  if (typeof d.url === 'string' && /^https:\/\//.test(d.url)) return { kind: 'redirect', url: d.url };
  return { kind: 'error', message: typeof d.error === 'string' ? d.error : 'No checkout was returned' };
}

/** Only ever go to a page inside the app after paying (never to another site). */
export function safeNextPath(raw: string | null | undefined, fallback = '/earn'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || [...raw].some((c) => c.charCodeAt(0) < 32)) return fallback;
  return raw;
}

