// Unified AI caller. Supports two providers:
//   - "lovable" (default): Lovable AI Gateway with LOVABLE_API_KEY.
//   - "gemini": user-provided Google Gemini API key from app_settings.
//
// Same OpenAI-style request/response shape regardless of provider, so callers
// don't need to know which backend is serving the request.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

export type AIProviderResolved = {
  provider: "lovable" | "gemini";
  model: string;
  geminiKey?: string;
};

/** Resolve which provider/model to use for this user. */
export async function resolveAIProvider(
  userId: string | undefined,
  preferredLovableModel = "google/gemini-2.5-flash",
): Promise<AIProviderResolved> {
  if (!userId) return { provider: "lovable", model: preferredLovableModel };
  const { data } = await admin
    .from("app_settings")
    .select("ai_provider, gemini_api_key, gemini_model")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.ai_provider === "gemini" && data?.gemini_api_key) {
    return {
      provider: "gemini",
      model: data.gemini_model || "gemini-2.5-pro",
      geminiKey: data.gemini_api_key,
    };
  }
  return { provider: "lovable", model: preferredLovableModel };
}

export interface CallAIOptions {
  userId?: string;
  messages: Array<{ role: string; content: any; tool_call_id?: string; tool_calls?: any[] }>;
  /** Preferred Lovable-gateway model (e.g. google/gemini-2.5-flash) if provider=lovable */
  lovableModel?: string;
  /** If true and provider=gemini, enables ~4k thinking budget (gemini-2.5-pro only). */
  reasoning?: boolean;
  tools?: any[];
  toolChoice?: "auto" | "none";
  temperature?: number;
}

export interface CallAIResult {
  ok: boolean;
  status: number;
  /** OpenAI-style raw response body */
  body: any;
  errorText?: string;
  provider: "lovable" | "gemini";
  model: string;
}

export async function callAI(opts: CallAIOptions): Promise<CallAIResult> {
  const resolved = await resolveAIProvider(opts.userId, opts.lovableModel);
  if (resolved.provider === "gemini") {
    return await callGemini(resolved, opts);
  }
  return await callLovable(resolved, opts);
}

async function callLovable(
  r: AIProviderResolved,
  opts: CallAIOptions,
): Promise<CallAIResult> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    return { ok: false, status: 500, body: null, errorText: "LOVABLE_API_KEY is not configured", provider: "lovable", model: r.model };
  }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: r.model,
      messages: opts.messages,
      ...(opts.tools ? { tools: opts.tools, tool_choice: opts.toolChoice ?? "auto" } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    }),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body, errorText: res.ok ? undefined : JSON.stringify(body), provider: "lovable", model: r.model };
}

async function callGemini(
  r: AIProviderResolved,
  opts: CallAIOptions,
): Promise<CallAIResult> {
  // Translate OpenAI -> Gemini
  const { systemInstruction, contents } = openaiToGemini(opts.messages);
  const geminiBody: any = {
    contents,
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: {
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.reasoning && r.model.includes("2.5-pro")
        ? { thinkingConfig: { thinkingBudget: 4096 } }
        : {}),
    },
  };
  if (opts.tools?.length) {
    geminiBody.tools = [{
      functionDeclarations: opts.tools.map((t) => ({
        name: t.function?.name ?? t.name,
        description: t.function?.description ?? t.description,
        parameters: t.function?.parameters ?? t.parameters,
      })),
    }];
    geminiBody.toolConfig = {
      functionCallingConfig: { mode: opts.toolChoice === "none" ? "NONE" : "AUTO" },
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${r.model}:generateContent?key=${r.geminiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  });
  const rawBody = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, status: res.status, body: rawBody, errorText: JSON.stringify(rawBody), provider: "gemini", model: r.model };
  }
  const openaiShape = geminiToOpenAI(rawBody);
  return { ok: true, status: 200, body: openaiShape, provider: "gemini", model: r.model };
}

function openaiToGemini(messages: CallAIOptions["messages"]) {
  let systemInstruction: any = undefined;
  const contents: any[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      systemInstruction = systemInstruction
        ? { parts: [...systemInstruction.parts, { text }] }
        : { parts: [{ text }] };
      continue;
    }
    if (m.role === "tool") {
      contents.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: m.tool_call_id || "tool",
            response: { content: typeof m.content === "string" ? m.content : m.content },
          },
        }],
      });
      continue;
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      contents.push({
        role: "model",
        parts: m.tool_calls.map((tc: any) => ({
          functionCall: {
            name: tc.function?.name ?? tc.name,
            args: tryParse(tc.function?.arguments ?? tc.arguments ?? "{}"),
          },
        })),
      });
      continue;
    }
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text }],
    });
  }
  return { systemInstruction, contents };
}

function geminiToOpenAI(body: any): any {
  const cand = body?.candidates?.[0];
  const parts = cand?.content?.parts ?? [];
  let text = "";
  const toolCalls: any[] = [];
  for (const p of parts) {
    if (p.text) text += p.text;
    if (p.functionCall) {
      toolCalls.push({
        id: `call_${toolCalls.length}_${Date.now()}`,
        type: "function",
        function: {
          name: p.functionCall.name,
          arguments: JSON.stringify(p.functionCall.args ?? {}),
        },
      });
    }
  }
  return {
    choices: [{
      index: 0,
      finish_reason: toolCalls.length ? "tool_calls" : "stop",
      message: {
        role: "assistant",
        content: text || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
    }],
    usage: body?.usageMetadata
      ? {
        prompt_tokens: body.usageMetadata.promptTokenCount,
        completion_tokens: body.usageMetadata.candidatesTokenCount,
        total_tokens: body.usageMetadata.totalTokenCount,
      }
      : undefined,
  };
}

function tryParse(s: string) { try { return JSON.parse(s); } catch { return {}; } }
