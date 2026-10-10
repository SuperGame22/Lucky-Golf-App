/** A readable message from anything that was thrown. */
export function errMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err && 'message' in err && typeof (err as { message: unknown }).message === 'string' && (err as { message: string }).message) {
    return (err as { message: string }).message;
  }
  return fallback;
}
