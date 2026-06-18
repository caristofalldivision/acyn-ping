// Tests a user-supplied Gemini API key by making a 1-token completion.
// Returns { ok, model, error?, latency_ms }.

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { apiKey, model } = await req.json();
    if (!apiKey || typeof apiKey !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "apiKey required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const m = (typeof model === "string" && model) || "gemini-2.5-flash";
    const t0 = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    });
    const latency_ms = Date.now() - t0;
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      return new Response(JSON.stringify({
        ok: false,
        model: m,
        latency_ms,
        status: r.status,
        error: body?.error?.message || `Provider returned HTTP ${r.status}`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, model: m, latency_ms }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message || "internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
