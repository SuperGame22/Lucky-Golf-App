import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFor, getCaller, isMemberTier, json } from "../_shared/member.ts";

// Limits on what a caller can send (keeps the OpenAI bill bounded).
const MAX_MESSAGES = 20;
const MAX_CHARS_PER_MESSAGE = 2000;
const DAILY_QUESTIONS = 40;

type ChatMessage = { role: "user" | "assistant"; content: string };

/** Only plain user/assistant text survives; the system prompt is always ours. */
function cleanMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is { role: string; content: unknown } => !!m && typeof m === "object" && "role" in m)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
    .map((m) => ({ role: m.role as ChatMessage["role"], content: (m.content as string).slice(0, MAX_CHARS_PER_MESSAGE) }))
    .slice(-MAX_MESSAGES);
}

const short = (v: unknown) => JSON.stringify(v ?? null).slice(0, 600);

serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  try {
    // Coach Ace is a Clover Club / Gold feature: signed-in members only.
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Please sign in to chat with Coach Ace." }, 401, cors);
    if (!isMemberTier(caller.tier)) return json({ error: "Coach Ace is for Clover Club and Gold members." }, 403, cors);

    const body = await req.json().catch(() => ({}));
    const messages = cleanMessages(body?.messages);
    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return json({ error: "Ask Coach Ace a question." }, 400, cors);
    }
    const a = body?.analysisContext;

    // Daily allowance per player (coach_chat_take in the member_perks migration). If that function isn't
    // there yet, carry on rather than lock members out.
    const { data: allowed, error: limitErr } = await caller.db.rpc("coach_chat_take", { p_limit: DAILY_QUESTIONS });
    if (limitErr) console.warn("coach-chat: daily limit not checked:", limitErr.message);
    else if (allowed === false) {
      return json({ error: `That's ${DAILY_QUESTIONS} questions today. Coach Ace will be back tomorrow!` }, 429, cors);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("coach-chat: OPENAI_API_KEY is not configured");
      return json({ error: "Coach Ace is not available right now." }, 503, cors);
    }

    const systemPrompt = `You are "Lucky Coach", the AI golf coach for Lucky Golf. You have a warm, encouraging Irish-themed personality. You help golfers improve their game with specific, actionable advice.

${a ? `The golfer's latest swing analysis:
- Score: ${Number(a.overall_score) || "n/a"}/100
- Strengths: ${short(a.strengths)}
- Areas to improve: ${short(a.improvements)}
- Recommended drills: ${short(a.drills)}

Use this context to give personalized follow-up advice.` : "No swing analysis available yet. Help the golfer with general golf tips and encourage them to upload a swing video."}

Keep responses concise (2-4 paragraphs max). Be specific with golf advice. End with encouragement. Use occasional Irish/luck references naturally. Only discuss golf; politely decline anything else.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 700,
        user: caller.userId,
        stream: true,
      }),
    });

    if (!response.ok) {
      // OpenAI reports both rate limits and an empty credit balance as 429; the body tells them apart.
      const text = await response.text();
      console.error("coach-chat OpenAI error:", response.status, text);
      if (response.status === 429 || response.status === 402) {
        const isQuota = /insufficient_quota|credit_balance_exhausted/.test(text) || response.status === 402;
        return isQuota
          ? json({ error: "Coach Ace is resting right now. Please try again later." }, 402, cors)
          : json({ error: "Coach Ace is busy. Please try again shortly." }, 429, cors);
      }
      return json({ error: "Coach Ace is not available right now." }, 502, cors);
    }

    return new Response(response.body, { headers: { ...cors, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("coach-chat error:", e);
    return json({ error: "Coach Ace is not available right now." }, 500, cors);
  }
});
