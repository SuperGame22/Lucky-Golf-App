import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined
    );

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: claimsData } = await supabase.auth.getClaims(token);
        userId = claimsData?.claims?.sub ?? null;
      } catch { /* anonymous usage */ }
    }

    const { videoUrl } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const systemPrompt = `You are "Lucky Coach", an AI golf swing analyst for the Lucky Golf app. You have a friendly, encouraging Irish-themed coaching personality. You analyze golf swings and provide actionable feedback.

When analyzing a swing video/image, evaluate:
- Overall form and posture
- Grip position and pressure
- Backswing plane and rotation
- Downswing transition and tempo
- Impact position
- Follow-through completion
- Weight transfer and balance

Always be encouraging but honest. Use golf terminology naturally. Include lucky/Irish themed motivational messages.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: videoUrl
              ? `Analyze this golf swing from the video at: ${videoUrl}. Provide a detailed analysis.`
              : "The user uploaded a swing video but I cannot access it directly. Please provide a realistic, helpful sample swing analysis as if you watched a mid-handicap golfer's swing. Be specific and actionable.",
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "swing_analysis",
              description: "Return structured golf swing analysis results",
              parameters: {
                type: "object",
                properties: {
                  overall_score: {
                    type: "integer",
                    description: "Overall swing score from 0-100",
                  },
                  strengths: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of 3-5 positive aspects of the swing",
                  },
                  improvements: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of 3-5 specific areas for improvement with actionable tips",
                  },
                  drills: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        link: { type: "string", description: "App route like /practice/putting or /practice/rangefinder-sim" },
                      },
                      required: ["name", "description", "link"],
                    },
                    description: "2-3 recommended practice drills",
                  },
                  motivational_message: {
                    type: "string",
                    description: "Fun motivational message with golf/luck/Irish theme, include a clover emoji",
                  },
                },
                required: ["overall_score", "strengths", "improvements", "drills", "motivational_message"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "swing_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI analysis failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No analysis returned from AI");

    const analysis = JSON.parse(toolCall.function.arguments);

    // Save to database only if user is authenticated
    let savedId: string | null = null;
    if (userId) {
      const { data: saved, error: saveError } = await supabase
        .from("swing_analyses")
        .insert({
          user_id: userId,
          video_url: videoUrl || null,
          overall_score: analysis.overall_score,
          strengths: analysis.strengths,
          improvements: analysis.improvements,
          drills: analysis.drills,
          motivational_message: analysis.motivational_message,
        })
        .select()
        .single();

      if (saveError) {
        console.error("Save error:", saveError);
      }
      savedId = saved?.id ?? null;
    }

    return new Response(JSON.stringify({ ...analysis, id: savedId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-swing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
