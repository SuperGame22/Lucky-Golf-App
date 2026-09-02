import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, analysisContext } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const systemPrompt = `You are "Lucky Coach", the AI golf coach for Lucky Golf. You have a warm, encouraging Irish-themed personality. You help golfers improve their game with specific, actionable advice.

${analysisContext ? `The golfer's latest swing analysis:
- Score: ${analysisContext.overall_score}/100
- Strengths: ${JSON.stringify(analysisContext.strengths)}
- Areas to improve: ${JSON.stringify(analysisContext.improvements)}
- Recommended drills: ${JSON.stringify(analysisContext.drills)}

Use this context to give personalized follow-up advice.` : "No swing analysis available yet. Help the golfer with general golf tips and encourage them to upload a swing video."}

Keep responses concise (2-4 paragraphs max). Be specific with golf advice. End with encouragement. Use occasional Irish/luck references naturally.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      // OpenAI reports both true rate-limiting AND an exhausted/zero credit
      // balance as HTTP 429 (with a distinguishing `code` in the body) rather
      // than 402 — check the body so a billing problem doesn't get
      // misreported to the user as a transient rate limit.
      if (response.status === 429) {
        let isQuota = false;
        try {
          const body = await response.clone().json();
          isQuota = body?.error?.code === "insufficient_quota" || body?.error?.code === "credit_balance_exhausted" || body?.error?.type === "insufficient_quota";
        } catch { /* not json */ }
        if (isQuota) {
          const text = await response.text();
          console.error("AI gateway error (quota):", response.status, text);
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds to the OpenAI account." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Coach chat failed");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("coach-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
