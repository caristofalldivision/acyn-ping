# Plan: Own Gemini Key + Smarter Router AI + Fix False "Agent Offline"

Three independent pieces. None of them touch the working pairing, installer, captive portal, hotspot wizard, or agent transport.

---

## 1. Bring-your-own Gemini API key (replaces Lovable AI for chat)

**Storage.** Add three columns to `app_settings` (per-user, already RLS-scoped):
- `ai_provider text default 'lovable'` — `'lovable' | 'gemini'`
- `gemini_api_key text` — user's key from aistudio.google.com
- `gemini_model text default 'gemini-2.5-pro'` — `gemini-2.5-pro` | `gemini-2.5-flash` | `gemini-3-pro-preview`

**UI.** In `ProviderSettings.tsx`, add a new "AI Model" section:
- Provider radio (Lovable default / My Gemini key)
- Key input (password) + model dropdown + "Test key" button (calls a new lightweight `ai-test-key` edge function that does a 1-token completion against Google's API and returns ok/error).
- Help link to `aistudio.google.com/apikey`.

**Backend.** Add `supabase/functions/_shared/ai-call.ts` — a single helper `callAI({ userId, messages, model, temperature, tools, json })` that:
1. Loads `app_settings` for `userId`.
2. If `ai_provider='gemini'` and key present → POST to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...`, mapping the OpenAI-style messages/tools to Gemini's `contents`/`tools`/`generationConfig` shape (and back).
3. Otherwise → existing Lovable Gateway path (`ai.gateway.lovable.dev`, `LOVABLE_API_KEY`).
4. Returns a normalised `{ content, tool_calls, usage }` so callers don't change.

Refactor `chat/index.ts`, `background-learning/index.ts`, `analyze-conversations/index.ts` to use `callAI`. Nothing else changes — same prompts, same tools, same streaming envelope. Streaming for `chat` uses Gemini's `:streamGenerateContent?alt=sse` when provider is gemini.

**Failure behaviour.** If user's Gemini key 401/429s, surface the exact provider error in chat (toast + assistant message) instead of silently falling back, so the user knows to fix billing.

---

## 2. Higher-accuracy router configuration (RAG + reasoning + self-check)

Goal: scripts that run first time on MikroTik with no back-and-forth.

**a. Device-aware context.** Before each chat turn that mentions a device or config, `chat/index.ts` now pulls:
- `devices` row for any device_id referenced (model, `routeros_version`, last known interfaces) — currently ignored.
- `saved_scripts` snippets the user has previously approved (top 5 by recency, filtered to vendor=mikrotik).
- `user_knowledge` + `learned_knowledge` (already pulled) — keep, but rank by keyword overlap with the new message instead of dumping all rows.

These are injected as a compact `<device_facts>` / `<known_good_snippets>` block in the system prompt.

**b. Reasoning model + thinking budget.** When provider is Gemini and the message looks like a config task (regex on words like `mikrotik|pppoe|hotspot|firewall|nat|bridge|vlan|script`), use `gemini-2.5-pro` with `generationConfig.thinkingConfig.thinkingBudget=4096`. For chit-chat, keep `gemini-2.5-flash`. Same toggle for Lovable path.

**c. Structured RouterOS validator.** New `supabase/functions/_shared/ros-lint.ts` — pure-TS lint pass:
- Reject `/system reset-configuration`, `/system backup`, lines with unescaped `"` / `$`, lines >4096 chars, commands not starting with `/` or `:`.
- Warn on dangerous patterns (`/ip address remove`, `disable ether1`, etc.) used without a `:do {} on-error={}` wrapper.
- Returns `{ ok, errors[], warnings[], normalized }`.

The chat tool that emits a script (`generate_mikrotik_script` or equivalent) now runs `ros-lint` before returning. On errors, the function re-prompts the model up to 2x with the lint errors appended — fully internal, user never sees the broken attempt.

**d. Self-check loop on the agent side.** In `agent/main.go` `apply_script` handler: after the SSH/REST `import` finishes, parse the output for `failure:`/`syntax error`/`expected command name` lines; if found, mark job `failed` with the specific line number and a hint, instead of "success" with hidden errors. (Backup/reset are still not touched — the user runs those manually as we set up last round.)

**e. RAG retrieval.** Replace the current "dump all knowledge rows" with a simple but effective scorer: tokenise the user message, score each knowledge/saved-script row by token overlap + recency, keep top N under a 6 KB budget. No embeddings needed yet — keeps it cheap and works with BYO key.

---

## 3. Fix "agent online but system says offline"

**Root cause** (confirmed in `device-jobs/index.ts` line 51 and the warning check at line ~155): when the agent polls `/pending` over HTTP, `authAgent` sets `status` to `"registered"` (only `device-agent-bridge` WebSocket sets `"online"`). But the offline warning and the UI badge both compare against `"online"` strictly, so an HTTP-polling agent is *always* flagged offline even while it's actively polling every 5 s.

**Fix.**
1. `device-jobs/index.ts` `authAgent`: set `status = "online"` on every successful poll (regardless of previous value, except `pending`).
2. `device-jobs/index.ts` job-enqueue warning: treat agent as online if `status in ('online','registered')` **and** `last_seen_at` within `pollInterval * 3 ≈ 20 s` (was 60 s — too lax, also missed the status mismatch).
3. `DeviceVault.tsx` status badge: same rule (`online` || (`registered` && last_seen < 20s)) → green; otherwise amber.
4. Add a tiny `/heartbeat` POST in `device-jobs` and call it from the agent every 10 s even when there are no jobs (it's already polling `/pending` every 5 s, so this is mostly belt-and-braces and gives us a clean `last_seen_at` if pending ever 304s).
5. On agent shutdown (SIGTERM/SIGINT), send a final `status=offline` so the badge flips immediately instead of waiting 20 s.

No changes to `device-agent-bridge`, pairing, secrets, or the bundled binaries' install flow — but the agent binary itself does get rebuilt and re-bundled under `public/agent/bin/` along with a refreshed `SHA256SUMS`.

---

## Files touched

- `src/components/ProviderSettings.tsx` — AI provider section
- `src/components/DeviceVault.tsx` — relaxed online check
- `supabase/migrations/<new>.sql` — 3 columns on `app_settings`
- `supabase/functions/_shared/ai-call.ts` *(new)*
- `supabase/functions/_shared/ros-lint.ts` *(new)*
- `supabase/functions/ai-test-key/index.ts` *(new)*
- `supabase/functions/chat/index.ts` — use `callAI`, device-aware RAG, reasoning toggle, lint+retry
- `supabase/functions/background-learning/index.ts` — use `callAI`
- `supabase/functions/analyze-conversations/index.ts` — use `callAI`
- `supabase/functions/device-jobs/index.ts` — status=online on poll, 20 s threshold, `/heartbeat`
- `agent/main.go` — heartbeat ticker, shutdown offline, parse RouterOS output for errors
- `public/agent/bin/*` + `SHA256SUMS` — rebuild
- `supabase/config.toml` — register `ai-test-key`

## Explicitly NOT touched

Pairing, installer scripts, captive portal, hotspot wizard, Pesapal, SMS, TalkSasa, billing, agent SSH transport, bundled login.html.
