# Fix AI, Hotspot Wizard E2E, and Go Agent

## A. AI not responding (root cause + fix)

**Why it's broken**
- `chat/index.ts` uses `google/gemini-2.5-pro` as primary with a ~900-line system prompt. Pro is rate-limited and slow; only HTTP 429 triggers fallback. Timeouts and 5xx bubble up as a generic toast and the user sees nothing.
- Edge logs show zero recent successful calls to `chat`.

**Fix**
1. Primary model → `google/gemini-2.5-flash`, fallback → `google/gemini-2.5-flash-lite`. Pro only when the user message contains "deep"/"plan in detail".
2. Trim the system prompt: gate the topology, RADIUS, and captive-portal example blocks so they only inject when the user message mentions those keywords (~60% fewer tokens).
3. Resilient `callGateway`: retry once on 5xx/timeout, fall back to Flash-Lite on second failure, and return a real assistant reply ("I hit a temporary limit — try again") instead of throwing a 500.
4. Log model + latency per call.

## B. Hotspot Wizard end-to-end

**Issues**
1. `requires_confirm` badge is decorative — all steps run after one click.
2. `/system backup save` is async; agent proceeds before the `.backup` file exists.
3. Preflight `read` output is never checked — wrong interface still corrupts config.
4. Device row stays `offline` even mid-wizard.

**Fix**
1. **Per-step gating**: new `POST /device-jobs/step-ack` endpoint. When the agent finishes a write step it writes `[awaiting-ack:step-id]` to the log and polls a `step_acks` row. UI shows Confirm/Abort buttons in `JobLog` when it sees that marker. A "Run all without prompting" toggle preserves the current one-click flow.
2. **Backup wait**: after `/system backup save`, agent runs `:delay 3s` then `/file print where name~"<backup>.backup"` and aborts if missing.
3. **Preflight enforcement**: agent parses preflight output; if the interface is missing or the gateway IP collides, abort before any write (no rollback needed).
4. **device_status ping**: agent posts `online:true, routeros_version, model` on successful connect and `online:false` on disconnect.

## C. Go agent reliability

**Bugs**
1. **REST translator is broken** — for `/ip address add address=… interface=…`, `parts[1]` is `"address"` not `"add"`, so verb stays POST, path is wrong, and `add` ends up in the body. Every multi-segment add/set/print/remove over REST is malformed today.
2. No connection retry — one transient SSH timeout kills the job.
3. `CredentialEncrypted` field name is misleading (it holds plaintext).
4. No SIGTERM handling in `runLoop`.
5. Distribution friction: README says "go build it yourself".

**Fix**
1. Rewrite REST translator: walk tokens, find the first action token (`add`/`set`/`print`/`remove`), use everything before it as the path and everything after as `key=value` body.
2. Wrap `connectDevice` in 3-attempt exponential backoff (1s/3s/9s).
3. Rename Go field `CredentialEncrypted` → `Password` (JSON tag stays `credential_encrypted`).
4. `signal.Notify` for SIGINT/SIGTERM; exit cleanly mid-poll.
5. Add `agent/Makefile` with `build-linux|darwin|windows` cross-compile targets and update `agent/README.md` with a one-line install snippet.

## D. Verification

- `supabase--curl_edge_functions` POST `/chat` with a tiny message → expect reply + latency log.
- `supabase--curl_edge_functions` POST `/wizard-hotspot` with sample params → confirm plan JSON shape unchanged.
- `supabase--curl_edge_functions` GET `/device-jobs/pending` without headers → expect 401.
- `go vet ./...` in `/agent` (static check only).

## Files touched

| File | Change |
|---|---|
| `supabase/functions/chat/index.ts` | Model swap, prompt trimming, resilient fallback, latency logging |
| `supabase/functions/device-jobs/index.ts` | New `/step-ack` endpoint + `step_acks` table |
| `supabase/migrations/<new>.sql` | `step_acks` table + RLS |
| `agent/main.go` | REST translator rewrite, retries, backup-wait, preflight gate, device_status, SIGTERM, field rename, step-ack polling |
| `agent/Makefile` (new) | Cross-compile targets |
| `agent/README.md` | One-line install + per-step confirm docs |
| `src/components/HotspotWizard.tsx` | "Step-by-step" toggle |
| `src/components/JobLog.tsx` | Confirm/Abort buttons when log shows `[awaiting-ack]` |

## Out of scope
- Encrypting `credential_encrypted` at rest (separate task).
- Hosting prebuilt agent binaries (placeholder URL only).
- Rewriting the chat tool-call loop.
