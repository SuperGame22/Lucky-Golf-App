// Shared by the AI functions: who is calling, and are they a paying (Clover Club / Gold) member.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Caller = { userId: string; tier: string; db: SupabaseClient };

/** Signed-in user from the Authorization header, or null. */
export async function getCaller(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  const { data: prof } = await supabase
    .from("golfer_profiles")
    .select("membership_tier")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return { userId: data.user.id, tier: (prof?.membership_tier as string | null) ?? "free", db: supabase };
}

export const isMemberTier = (tier: string) => tier === "clover" || tier === "gold";

/** CORS: the app's own origins when ALLOWED_ORIGINS is set (comma-separated), otherwise any origin. */
export function corsFor(req: Request): Record<string, string> {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") ?? "";
  const allow = allowed.length === 0 ? "*" : allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

export const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
