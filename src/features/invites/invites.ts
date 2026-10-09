/**
 * Wager invite links and phone numbers. Pure helpers (storage is passed in) so they can be tested.
 *
 * An invite is a link the host texts from their own phone: https://<app>/join/ABC123?from=<host id>.
 * Someone who opens it without an account is taken to sign up (with their mobile number), then
 * straight into the wager.
 */

const CODE_RE = /^[A-Z0-9]{6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const INVITE_KEY = 'lg_pending_invite';
export const CONTACT_KEY = 'lg_pending_contact';
/** An invite not used within this long is ignored. */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PendingInvite { code: string; from: string | null; at: number }
export interface PendingContact { phone: string; consent: boolean }
export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** "abc-123" -> "ABC123"; null when it is not a 6-character code. */
export function parseInviteCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return CODE_RE.test(code) ? code : null;
}

/**
 * The address invite links point at: VITE_PUBLIC_APP_URL when set (the permanent domain), otherwise
 * wherever the app is open right now. Trailing slashes are dropped.
 */
export function publicBaseUrl(configured: string | undefined, origin: string): string {
  const c = (configured ?? '').trim();
  return (/^https?:\/\//i.test(c) ? c : origin).replace(/\/+$/, '');
}

export function buildInviteLink(origin: string, code: string, fromUserId: string): string {
  const c = parseInviteCode(code);
  if (!c) throw new Error('Invalid invite code');
  const base = `${origin.replace(/\/+$/, '')}/join/${c}`;
  return UUID_RE.test(fromUserId) ? `${base}?from=${fromUserId}` : base;
}

export function inviteMessage(link: string, buyInDollars: number | null): string {
  const stake = buyInDollars && buyInDollars > 0 ? ` ($${buyInDollars} buy-in)` : '';
  return `Join my Lucky Wager on Lucky Golf${stake}: ${link}`;
}

/** A text-message link that opens the sender's own messaging app with the invite filled in. */
export function smsHref(message: string): string {
  return `sms:?&body=${encodeURIComponent(message)}`;
}

/** US mobile number -> "+1XXXXXXXXXX", or null if it does not look like one. */
export function normalizeUsPhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return null;
  if (ten[0] === '0' || ten[0] === '1') return null; // no US area code starts with 0 or 1
  return `+1${ten}`;
}

export function savePendingInvite(store: KV, code: string, from: string | null, now = Date.now()): boolean {
  const c = parseInviteCode(code);
  if (!c) return false;
  const invite: PendingInvite = { code: c, from: from && UUID_RE.test(from) ? from : null, at: now };
  try { store.setItem(INVITE_KEY, JSON.stringify(invite)); return true; } catch { return false; }
}

export function readPendingInvite(store: KV, now = Date.now()): PendingInvite | null {
  try {
    const raw = store.getItem(INVITE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as PendingInvite;
    if (!parseInviteCode(v.code) || typeof v.at !== 'number' || now - v.at > INVITE_TTL_MS) {
      store.removeItem(INVITE_KEY);
      return null;
    }
    return { code: v.code, from: v.from && UUID_RE.test(v.from) ? v.from : null, at: v.at };
  } catch {
    return null;
  }
}

export function clearPendingInvite(store: KV) {
  try { store.removeItem(INVITE_KEY); } catch { /* nothing to clear */ }
}

/** The number typed at signup waits here until the new player is signed in and it can be saved. */
export function savePendingContact(store: KV, contact: PendingContact) {
  try { store.setItem(CONTACT_KEY, JSON.stringify(contact)); } catch { /* the player can add it later */ }
}
export function readPendingContact(store: KV): PendingContact | null {
  try {
    const raw = store.getItem(CONTACT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as PendingContact;
    return typeof v.phone === 'string' && typeof v.consent === 'boolean' ? v : null;
  } catch {
    return null;
  }
}
export function clearPendingContact(store: KV) {
  try { store.removeItem(CONTACT_KEY); } catch { /* nothing to clear */ }
}

/** Where to go after signing in: straight to the wager if an invite is waiting. */
export function afterAuthPath(store: KV, now = Date.now()): string {
  return readPendingInvite(store, now) ? '/play/wagers' : '/';
}
