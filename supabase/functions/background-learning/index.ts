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

    // Get all active users who have messages
    const { data: users, error: usersError } = await supabase
      .from("chat_messages")
      .select("user_id")
      .order("created_at", { ascending: false });

    if (usersError) throw usersError;

    const uniqueUserIds = [...new Set(users?.map(u => u.user_id) || [])];
    console.log(`Processing ${uniqueUserIds.length} users for background learning`);

    for (const userId of uniqueUserIds) {
      try {
        // Create learning session
        const { data: session, error: sessionError } = await supabase
          .from("learning_sessions")
          .insert({ user_id: userId, status: "in_progress" })
          .select()
          .single();

        if (sessionError) throw sessionError;

        // Get last learning session time
        const { data: lastSession } = await supabase
          .from("learning_sessions")
          .select("run_at")
          .eq("user_id", userId)
          .eq("status", "completed")
          .order("run_at", { ascending: false })
          .limit(1)
          .single();

        // Fetch messages since last learning session
        let query = supabase
          .from("chat_messages")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (lastSession) {
          query = query.gt("created_at", lastSession.run_at);
        }

        const { data: messages, error: messagesError } = await query;

        if (messagesError) throw messagesError;

        if (!messages || messages.length === 0) {
          // No new messages, mark session as completed
          await supabase
            .from("learning_sessions")
            .update({ status: "completed", analyzed_messages_count: 0 })
            .eq("id", session.id);
          continue;
        }

        // Get existing knowledge for this user
        const { data: existingKnowledge } = await supabase
          .from("learned_knowledge")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true);

        const existingKnowledgeText = existingKnowledge
          ?.map((k) => `${k.category} - ${k.key}: ${k.value}`)
          .join("\n");

        // Prepare conversation for analysis
        const conversationText = messages
          ?.map((m) => `${m.role}: ${m.content}`)
          .reverse()
          .join("\n");

        // Use AI to extract knowledge with tool calling
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
                content: `You are a knowledge extraction AI. Extract structured information from conversations.

Existing Knowledge:
${existingKnowledgeText || "None"}

Extract NEW or UPDATED facts. For each fact, provide:
- category: facts, preferences, skills, goals, patterns, or context
- key: brief descriptor
- value: the information
- confidence: high, medium, or low
- importance_score: 1-10 (how important is this)
- is_update: true if updating existing knowledge

Only extract high-confidence, important information. Be conservative.`,
              },
              {
                role: "user",
                content: `Analyze:\n\n${conversationText}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "extract_knowledge",
                  description: "Extract knowledge from conversations",
                  parameters: {
                    type: "object",
                    properties: {
                      knowledge_items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            category: {
                              type: "string",
                              enum: ["facts", "preferences", "skills", "goals", "patterns", "context"]
                            },
                            key: { type: "string" },
                            value: { type: "string" },
                            confidence: {
                              type: "string",
                              enum: ["high", "medium", "low"]
                            },
                            importance_score: {
                              type: "integer",
                              minimum: 1,
                              maximum: 10
                            },
                            is_update: { type: "boolean" },
                            reason: { type: "string" }
                          },
                          required: ["category", "key", "value", "confidence", "importance_score"]
                        }
                      }
                    },
                    required: ["knowledge_items"]
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "extract_knowledge" } }
          }),
        });

        if (!response.ok) {
          throw new Error("AI gateway error");
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        
        let knowledgeItems = [];
        if (toolCall) {
          const args = JSON.parse(toolCall.function.arguments);
          knowledgeItems = args.knowledge_items || [];
        }

        let newCount = 0;
        let updateCount = 0;

        // Process each knowledge item
        for (const item of knowledgeItems) {
          // Check for existing similar knowledge
          const similar = existingKnowledge?.find(
            k => k.key.toLowerCase() === item.key.toLowerCase() && k.category === item.category
          );

          if (similar && item.is_update) {
            // Update existing knowledge
            const { error: historyError } = await supabase
              .from("knowledge_history")
              .insert({
                knowledge_id: similar.id,
                old_value: similar.value,
                new_value: item.value,
                reason: item.reason || "Progressive update from new conversation"
              });

            if (historyError) console.error("History insert error:", historyError);

            const { error: updateError } = await supabase
              .from("learned_knowledge")
              .update({
                value: item.value,
                confidence: item.confidence,
                importance_score: item.importance_score,
                version: similar.version + 1,
                updated_at: new Date().toISOString(),
                user_approved: item.confidence === "high" ? true : null
              })
              .eq("id", similar.id);

            if (!updateError) updateCount++;
          } else if (!similar) {
            // Insert new knowledge
            const { error: insertError } = await supabase
              .from("learned_knowledge")
              .insert({
                user_id: userId,
                category: item.category,
                key: item.key,
                value: item.value,
                confidence: item.confidence,
                importance_score: item.importance_score,
                source_conversation_id: messages[0]?.conversation_id,
                user_approved: item.confidence === "high" ? true : null
              });

            if (!insertError) newCount++;
          }
        }

        // Update learning session
        await supabase
          .from("learning_sessions")
          .update({
            status: "completed",
            analyzed_messages_count: messages.length,
            new_knowledge_count: newCount,
            updated_knowledge_count: updateCount
          })
          .eq("id", session.id);

        console.log(`User ${userId}: ${newCount} new, ${updateCount} updated from ${messages.length} messages`);

      } catch (userError) {
        console.error(`Error processing user ${userId}:`, userError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed_users: uniqueUserIds.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Background learning error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
