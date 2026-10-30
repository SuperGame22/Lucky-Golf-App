/**
 * Spots errors that mean a backend piece the app calls hasn't been set up on the live project yet,
 * for example a table or database function whose migration hasn't run, or a missing storage bucket.
 * Screens use this to show a friendly "coming soon" state instead of a raw error.
 *
 * Seen live: PostgREST PGRST205 (table not in schema cache), PGRST202 (function not found),
 * Postgres 42P01 / 42883 (undefined table / function), Storage NoSuchBucket / "Bucket not found".
 */
const CODES = new Set(['PGRST205', 'PGRST202', '42P01', '42883', 'NoSuchBucket']);

export function isNotSetUp(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; error?: unknown; message?: unknown; statusCode?: unknown };
  if (typeof e.code === 'string' && CODES.has(e.code)) return true;
  const msg = `${typeof e.error === 'string' ? e.error : ''} ${typeof e.message === 'string' ? e.message : ''}`.toLowerCase();
  return (
    msg.includes('bucket not found') ||
    /could not find the (table|function)/.test(msg) ||
    /(relation|function) .* does not exist/.test(msg)
  );
}
