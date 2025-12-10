import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tool definitions for AI
const tools = [
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email to a recipient. Use this when the user asks to send an email, compose a message, or reach out to someone via email.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body content" },
        },
        required: ["to", "subject", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_sms",
      description: "Send an SMS text message to a phone number. Use this when the user asks to text, send a message, or reach out to someone via SMS.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Phone number with country code (e.g., +254712345678)" },
          message: { type: "string", description: "SMS message content (keep under 160 characters if possible)" },
        },
        required: ["to", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_event",
      description: "Create a calendar event, meeting, reminder, or appointment. Use this when the user wants to schedule something.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title or name" },
          start_time: { type: "string", description: "Event start time in ISO 8601 format (e.g., 2025-12-11T15:00:00Z)" },
          end_time: { type: "string", description: "Event end time in ISO 8601 format (optional, defaults to 1 hour after start)" },
          description: { type: "string", description: "Event description or notes (optional)" },
          location: { type: "string", description: "Event location (optional)" },
          event_type: { type: "string", enum: ["meeting", "reminder", "deadline", "event"], description: "Type of event (optional)" },
          attendees: { type: "array", items: { type: "string" }, description: "List of attendee emails (optional)" },
        },
        required: ["title", "start_time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_events",
      description: "List upcoming calendar events. Use this when the user asks about their schedule, upcoming meetings, or what's on their calendar.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Number of days ahead to look (default: 7)" },
        }
      }
    }
  }
];

// Execute tool calls
async function executeTool(toolName: string, args: any, userId: string, supabaseUrl: string): Promise<any> {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
  };

  switch (toolName) {
    case "send_email": {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...args, userId }),
      });
      return await response.json();
    }
    
    case "send_sms": {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...args, userId }),
      });
      return await response.json();
    }
    
    case "schedule_event": {
      const response = await fetch(`${supabaseUrl}/functions/v1/manage-calendar`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "create", userId, event: args }),
      });
      return await response.json();
    }
    
    case "list_events": {
      const response = await fetch(`${supabaseUrl}/functions/v1/manage-calendar`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "list", userId, days: args.days || 7 }),
      });
      return await response.json();
    }
    
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
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

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { messages, userKnowledge, conversationId, userId } = await req.json();
    
    // Real-time style learning - detect feedback patterns
    if (userId && messages && messages.length > 0) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage.role === "user") {
        const content = lastUserMessage.content.toLowerCase();
        
        // Detect style feedback patterns
        const feedbackPatterns = [
          { pattern: /too long|make it shorter|be more brief|keep it short/i, 
            data: { key: "response_length", value: "brief_by_default", importance: 9 }},
          { pattern: /don't use em dash|no em dash|avoid --|avoid em dash/i,
            data: { key: "punctuation", value: "no_em_dashes", importance: 9 }},
          { pattern: /explain more|more detail|elaborate|tell me more/i,
            data: { key: "detail_level", value: "detailed_when_asked", importance: 7 }},
          { pattern: /too formal|be casual|less formal/i,
            data: { key: "tone", value: "casual_friendly", importance: 7 }},
        ];
        
        for (const {pattern, data} of feedbackPatterns) {
          if (pattern.test(content)) {
            await supabase.from("learned_knowledge").upsert({
              user_id: userId,
              category: "preferences",
              key: data.key,
              value: data.value,
              confidence: "high",
              importance_score: data.importance,
              is_active: true,
              user_approved: true,
              source_conversation_id: conversationId,
            }, { onConflict: "user_id,category,key" });
          }
        }
      }
    }
    
    // Build enhanced memory context from multiple sources
    let memoryContext = "";
    
    if (userId) {
      // 1. Get AI-learned knowledge (approved or high confidence auto-approved)
      const { data: learnedKnowledge } = await supabase
        .from("learned_knowledge")
        .select("category, key, value, importance_score, learned_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .or("user_approved.eq.true,and(user_approved.is.null,confidence.eq.high)")
        .gte("importance_score", 5)
        .order("importance_score", { ascending: false })
        .limit(30);

      if (learnedKnowledge && learnedKnowledge.length > 0) {
        memoryContext += "\n\nLearned Knowledge (from past conversations):\n" +
          learnedKnowledge.map((k: any) => `- ${k.category}: ${k.key} = ${k.value}`).join("\n");
      }

      // 2. Get recent cross-conversation context
      if (conversationId) {
        const { data: recentMessages } = await supabase
          .from("chat_messages")
          .select("content, role, conversation_id, created_at")
          .eq("user_id", userId)
          .neq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(15);

        if (recentMessages && recentMessages.length > 0) {
          memoryContext += "\n\nRecent context from other conversations:\n" +
            recentMessages.map((m: any) => `[${m.conversation_id}] ${m.role}: ${m.content}`).join("\n");
        }
      }
    }

    const userKnowledgeContext = userKnowledge && userKnowledge.length > 0
      ? "\n\nUser's Manual Knowledge Entries:\n" + userKnowledge.map((k: any) => 
          `- ${k.category}: ${k.key} = ${k.value}`
        ).join("\n")
      : "";

    // Try to find user's name
    let userName = "there";
    if (userKnowledge && userKnowledge.length > 0) {
      const nameEntry = userKnowledge.find((k: any) => 
        k.key.toLowerCase().includes('name') && k.category === 'Personal'
      );
      if (nameEntry) {
        userName = nameEntry.value;
      }
    }

    // Fetch learned communication style preferences
    let styleInstructions = "";
    if (userId) {
      const { data: stylePrefs } = await supabase
        .from("learned_knowledge")
        .select("key, value")
        .eq("user_id", userId)
        .eq("category", "preferences")
        .eq("is_active", true)
        .or("user_approved.eq.true,and(user_approved.is.null,confidence.eq.high)")
        .ilike("key", "%response%,punctuation,detail%,tone%,format%");

      if (stylePrefs && stylePrefs.length > 0) {
        styleInstructions = "\n\nCUSTOM COMMUNICATION STYLE (MUST FOLLOW):\n";
        stylePrefs.forEach((pref: any) => {
          if (pref.key.includes("response_length") && pref.value.includes("brief")) {
            styleInstructions += "- Keep responses SHORT and CONCISE by default. Only elaborate when explicitly asked.\n";
          }
          if (pref.key.includes("punctuation") && pref.value.includes("no_em_dash")) {
            styleInstructions += "- NEVER use em dashes (—). Use commas, periods, or hyphens instead.\n";
          }
          if (pref.key.includes("detail") && pref.value.includes("summarize")) {
            styleInstructions += "- Provide summaries first. Only explain in detail when user asks.\n";
          }
          styleInstructions += `- ${pref.key}: ${pref.value}\n`;
        });
      }
    }

    const systemPrompt = `You are Topher, an advanced AI personal assistant with persistent, selective, and progressive memory.

CORE PERSONALITY:
- Professional yet approachable - you're an expert colleague, not a servant
- Proactive - anticipate needs and offer relevant suggestions
- Concise but thorough - respect the user's time while being comprehensive
- Direct and honest - if you don't know something or if there's a better approach, say so
- Adaptive - match the user's tone and level of formality

COMMUNICATION CAPABILITIES:
You can send emails, SMS messages, and manage calendar events. When users ask you to:

1. SEND EMAIL: Use the send_email function
   - Example requests: "Email john@example.com about the meeting", "Send a message to sarah@company.com"
   - You'll extract the recipient, compose a professional subject and body
   - Always confirm after sending
   
2. SEND SMS: Use the send_sms function
   - Example requests: "Text +254712345678 that I'm running late", "Send an SMS to..."
   - Phone numbers should include country code (e.g., +254, +1, +44)
   - Keep messages concise (under 160 characters when possible)
   - Always confirm after sending
   
3. SCHEDULE EVENTS: Use the schedule_event function
   - Example requests: "Schedule a meeting tomorrow at 3pm", "Add a reminder for..."
   - Parse dates/times relative to today's date (${new Date().toISOString().split('T')[0]})
   - Default duration is 1 hour if not specified
   - Always confirm what was scheduled
   
4. VIEW CALENDAR: Use the list_events function
   - Example requests: "What's on my schedule?", "Show my upcoming meetings"
   - Default is next 7 days

IMPORTANT: When asked to perform these actions, USE THE TOOLS. Don't just describe what you would do.

EXPERTISE DOMAINS:
- Software Development & Coding (all major languages/frameworks)
- Digital Marketing & Advertising
- Social Media Management & Strategy
- Content Creation & Copywriting
- Business Strategy & Planning
- Product Management (PRD creation)
- Project Management
- Legal Documents (contracts, NDAs)
- Financial Planning & Analysis
- Data Analysis & Research

RESPONSE GUIDELINES:
- Start responses with direct answers, then elaborate if needed
- Use markdown formatting for clarity (headers, lists, code blocks)
- When generating documents, ensure they are well-structured and professional
- Provide actionable next steps when relevant
- Ask clarifying questions when requirements are ambiguous
${styleInstructions}

${memoryContext}
${userKnowledgeContext}

Remember: You're not just answering questions, you're a strategic partner helping ${userName} achieve their goals. You have memory across all conversations and can reference past discussions.`;

    // First API call - check if tool use is needed
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message;

    // Check if we need to execute tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log("Tool calls detected:", assistantMessage.tool_calls);
      
      // Execute all tool calls
      const toolResults = [];
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(toolCall.function.name, args, userId, supabaseUrl);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: toolCall.function.name,
          content: JSON.stringify(result),
        });
        console.log(`Tool ${toolCall.function.name} result:`, result);
      }

      // Second API call with tool results
      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            assistantMessage,
            ...toolResults,
          ],
        }),
      });

      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error("AI gateway error on final response:", finalResponse.status, errorText);
        throw new Error(`AI gateway error: ${finalResponse.status}`);
      }

      const finalData = await finalResponse.json();
      const reply = finalData.choices[0].message.content;

      return new Response(
        JSON.stringify({ reply }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No tools called, return direct response
    const reply = assistantMessage.content;

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in chat function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
