/** Build-time settings the app cannot run without. Returns the names of any that are empty. */
export const REQUIRED_CONFIG = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

export function missingConfig(env: Record<string, unknown>): string[] {
  return REQUIRED_CONFIG.filter((k) => typeof env[k] !== "string" || !(env[k] as string).trim());
}
