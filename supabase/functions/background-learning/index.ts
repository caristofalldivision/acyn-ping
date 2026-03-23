import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function for fuzzy string matching (Levenshtein distance)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  const matrix: number[][] = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

// Find similar knowledge entries to avoid duplicates
function findSimilarKnowledge(item: any, existingKnowledge: any[]) {
  const matches = existingKnowledge
    .filter(k => k.category === item.category && k.is_active)
    .map(k => ({
      knowledge: k,
      similarity: calculateSimilarity(k.key, item.key)
    }))
    .filter(match => match.similarity > 0.7)
    .sort((a, b) => b.similarity - a.similarity);
  
  return matches.length > 0 ? matches[0] : null;
}

// Validate extracted knowledge with AI
async function validateExtractedKnowledge(
  knowledgeItems: any[],
  conversationContext: string,
  existingKnowledge: any[],
  LOVABLE_API_KEY: string
) {
  if (knowledgeItems.length === 0) return knowledgeItems;
  
  const existingKnowledgeText = existingKnowledge
    .map(k => `${k.category} - ${k.key}: ${k.value}`)
    .join('\n');
  
  try {
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
            content: `You are a knowledge validation AI. Review extracted facts for accuracy, consistency, and quality.

Existing Knowledge:
${existingKnowledgeText || "None yet"}

For each proposed fact:
1. Verify it's actually stated or clearly implied in the conversation
2. Check for contradictions with existing knowledge
3. Rate quality: high (clear, specific, verifiable) / medium (somewhat vague) / low (unclear, ambiguous)
4. Adjust confidence and importance if needed
5. Flag contradictions or questionable facts`
          },
          {
            role: "user",
            content: `Conversation:\n${conversationContext.slice(0, 4000)}\n\nProposed Facts:\n${JSON.stringify(knowledgeItems, null, 2)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "validate_knowledge",
              description: "Validate and rate extracted knowledge",
              parameters: {
                type: "object",
                properties: {
                  validated_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "integer", description: "Index of original item" },
                        is_valid: { type: "boolean", description: "Should this be stored?" },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                        importance_score: { type: "integer", minimum: 1, maximum: 10 },
                        quality_note: { type: "string", description: "Why valid/invalid" },
                        contradicts_existing: { type: "boolean" },
                        contradiction_note: { type: "string" }
                      },
                      required: ["index", "is_valid", "confidence", "importance_score"]
                    }
                  }
                },
                required: ["validated_items"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "validate_knowledge" } }
      }),
    });
    
    if (!response.ok) return knowledgeItems;
    
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) return knowledgeItems;
    
    const validation = JSON.parse(toolCall.function.arguments);
    const validated = validation.validated_items || [];
    
    return knowledgeItems
      .map((item, idx) => {
        const result = validated.find((v: any) => v.index === idx);
        if (!result || !result.is_valid) return null;
        
        return {
          ...item,
          confidence: result.confidence,
          importance_score: result.importance_score,
          validation_note: result.quality_note,
          user_approved: result.confidence === "high" && !result.contradicts_existing ? true : null
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error("Validation error:", error);
    return knowledgeItems;
  }
}

// Clean and consolidate similar knowledge entries
async function cleanAndConsolidateKnowledge(userId: string, supabase: any) {
  const { data: knowledge } = await supabase
    .from("learned_knowledge")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);
  
  if (!knowledge || knowledge.length < 2) return { merged: 0 };
  
  const byCategory = knowledge.reduce((acc: any, item: any) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
  
  let mergedCount = 0;
  
  for (const category of Object.keys(byCategory)) {
    const items = byCategory[category];
    const processed = new Set();
    
    for (let i = 0; i < items.length; i++) {
      if (processed.has(items[i].id)) continue;
      
      for (let j = i + 1; j < items.length; j++) {
        if (processed.has(items[j].id)) continue;
        
        const similarity = calculateSimilarity(items[i].key, items[j].key);
        
        if (similarity > 0.85) {
          const keep = items[i].importance_score >= items[j].importance_score ? items[i] : items[j];
          const archive = keep === items[i] ? items[j] : items[i];
          
          await supabase
            .from("learned_knowledge")
            .update({ is_active: false })
            .eq("id", archive.id);
          
          processed.add(archive.id);
          mergedCount++;
          console.log(`Merged duplicate: "${archive.key}" into "${keep.key}"`);
        }
      }
      
      processed.add(items[i].id);
    }
  }
  
  return { merged: mergedCount };
}

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

    const uniqueUserIds = [...new Set(users?.map((u: any) => u.user_id) || [])];
    console.log(`Processing ${uniqueUserIds.length} users for background learning`);

    const results = [];

    for (const userId of uniqueUserIds) {
      try {
        const sessionId = crypto.randomUUID();
        let totalNewKnowledge = 0;
        let totalUpdatedKnowledge = 0;
        let totalMessagesAnalyzed = 0;
        
        await supabase.from("learning_sessions").insert({
          id: sessionId,
          user_id: userId,
          status: "in_progress",
          run_at: new Date().toISOString(),
        });
        
        // Get conversations for this user
        const { data: conversations } = await supabase
          .from("conversations")
          .select("id, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });
        
        if (!conversations || conversations.length === 0) {
          await supabase.from("learning_sessions").update({
            status: "completed",
            analyzed_messages_count: 0,
            new_knowledge_count: 0,
            updated_knowledge_count: 0,
          }).eq("id", sessionId);
          results.push({ userId, success: true, messagesAnalyzed: 0 });
          continue;
        }
        
        // Get existing knowledge
        const { data: existingKnowledge } = await supabase
          .from("learned_knowledge")
          .select("*")
          .eq("user_id", userId);
        
        // Process each conversation
        for (const conv of conversations) {
          // Check scan status for this conversation
          const { data: scanStatus } = await supabase
            .from("conversation_scan_status")
            .select("*")
            .eq("conversation_id", conv.id)
            .maybeSingle();
          
          const { count: currentMessageCount } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id);
          
          // Skip if no new messages since last scan
          if (scanStatus && scanStatus.message_count_at_scan === currentMessageCount) {
            console.log(`Conversation ${conv.id} unchanged, skipping`);
            continue;
          }
          
          // Fetch only new messages since last scan
          let query = supabase
            .from("chat_messages")
            .select("*")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: true });
          
          if (scanStatus?.last_scanned_at) {
            query = query.gt("created_at", scanStatus.last_scanned_at);
          }
          
          const { data: newMessages } = await query;
          
          if (!newMessages || newMessages.length === 0) continue;
          
          totalMessagesAnalyzed += newMessages.length;

          const existingKnowledgeText = existingKnowledge
            ?.map((k) => `${k.category} - ${k.key}: ${k.value}`)
            .join("\n");

          // Prepare conversation for analysis
          const conversationText = newMessages
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

STRICT VALIDATION RULES:
- Only extract facts the user EXPLICITLY stated or confirmed. Never infer unstated preferences or technical details.
- If the user mentioned a device model, firmware version, IP range, or network topology, extract it as "facts" with the specific detail.
- Never assume technical details the user didn't mention (e.g., don't infer they use OSPF just because they mentioned routing).
- Reject any item where the source is ambiguous or could be the AI's own suggestion rather than user-confirmed info.

NETWORKING & IT SPECIFIC EXTRACTION:
When conversations involve networking/IT topics, look for:
- Device inventory: "facts" category - e.g., "user has MikroTik hAP ac3 at main office"
- Network topology: "context" category - e.g., "office has 3 VLANs: management, staff, guest"
- Configuration preferences: "preferences" category - e.g., "prefers CLI over WinBox"
- ISP/service details: "facts" category - e.g., "ISP provides /29 subnet on fiber link"
- Credentials context (NEVER actual passwords): "context" category - e.g., "uses RADIUS for hotspot auth"
- Tools used: "skills" category - e.g., "uses Splynx for billing"

COMMUNICATION STYLE LEARNING:
Also detect user preferences for how they want responses formatted:
- If user says "keep it short", "be brief" → preferences: response_length = brief_by_default
- If user says "don't use em dash", "avoid —" → preferences: punctuation = no_em_dashes
- If user says "explain only when asked" → preferences: detail_level = summarize_unless_asked
- If user corrects style (e.g., "too long", "too formal") → extract as preference

Only extract high-confidence, important information. Be conservative. When in doubt, DO NOT extract.`,
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

              if (!updateError) {
                totalUpdatedKnowledge++;
              }
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
                  source_conversation_id: conv.id,
                  user_approved: item.confidence === "high" ? true : null
                });

              if (!insertError) {
                totalNewKnowledge++;
              }
            }
          }
          
          // Update scan status for this conversation
          await supabase
            .from("conversation_scan_status")
            .upsert({
              conversation_id: conv.id,
              user_id: userId,
              last_scanned_message_id: newMessages[newMessages.length - 1].id,
              last_scanned_at: new Date().toISOString(),
              message_count_at_scan: currentMessageCount
            });
        }
        
        // Update learning session with final totals
        await supabase
          .from("learning_sessions")
          .update({
            status: "completed",
            analyzed_messages_count: totalMessagesAnalyzed,
            new_knowledge_count: totalNewKnowledge,
            updated_knowledge_count: totalUpdatedKnowledge
          })
          .eq("id", sessionId);

        console.log(`User ${userId}: ${totalNewKnowledge} new, ${totalUpdatedKnowledge} updated from ${totalMessagesAnalyzed} messages`);
        
        results.push({ 
          userId, 
          success: true, 
          messagesAnalyzed: totalMessagesAnalyzed,
          newKnowledge: totalNewKnowledge,
          updatedKnowledge: totalUpdatedKnowledge
        });

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
