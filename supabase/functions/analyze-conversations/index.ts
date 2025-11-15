import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId } = await req.json();

    // Fetch recent conversations
    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (messagesError) throw messagesError;

    // Fetch existing knowledge
    const { data: existingKnowledge, error: knowledgeError } = await supabase
      .from("user_knowledge")
      .select("*")
      .eq("user_id", userId);

    if (knowledgeError) throw knowledgeError;

    // Prepare conversation for analysis
    const conversationText = messages
      ?.map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const existingKnowledgeText = existingKnowledge
      ?.map((k) => `${k.category} - ${k.key}: ${k.value}`)
      .join("\n");

    // Use AI to extract new knowledge
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an AI that extracts structured personal information from conversations.
Analyze the conversation and identify NEW facts about the user that aren't already in their knowledge base.

Existing Knowledge:
${existingKnowledgeText || "None"}

Return your response as a JSON array of objects with this structure:
[
  {
    "category": "personal" | "preferences" | "schedule" | "contacts" | "goals" | "health" | "other",
    "key": "brief descriptive key",
    "value": "the actual information",
    "confidence": "high" | "medium" | "low"
  }
]

Only include high-confidence facts. Be conservative. Return an empty array if no new information is found.`,
          },
          {
            role: "user",
            content: `Analyze this conversation:\n\n${conversationText}`,
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "[]";

    // Parse the AI response
    let suggestedKnowledge = [];
    try {
      suggestedKnowledge = JSON.parse(aiResponse);
    } catch (e) {
      console.error("Failed to parse AI response:", aiResponse);
      suggestedKnowledge = [];
    }

    return new Response(
      JSON.stringify({ 
        suggestedKnowledge,
        analyzedMessages: messages?.length || 0 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Analyze error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
