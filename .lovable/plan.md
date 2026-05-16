
# Plan: Topha v1 — Real install URLs + payments + SMS + captive portal end-to-end

## What's broken today

1. **Install URLs are fake.** `agent/README.md` tells users to `curl https://topha.lovable.app/agent/install.sh | sh` — but there is no `public/agent/install.sh`, and the Lovable SPA host can't serve dynamic binaries. Same for the PowerShell version. Also: your real domain is `topha.acyn.world`, not `topha.lovable.app`.
2. **No payment provider wired.** No Pesapal (or any) integration exists. No subscription, expiry, or "paid → activate hotspot user" loop.
3. **No SMS provider wired.** `send-sms` edge function exists but doesn't target TalkSasa, and there's no trigger on payment/expiry.
4. **Captive portal builder produces HTML only** — there's no end-to-end "push to MikroTik hotspot directory + activate" path.

## Fix plan

### A. Real agent install pipeline

- Add **`public/agent/install.sh`** and **`public/agent/install.ps1`** as static files. They'll be served at `https://topha.acyn.world/agent/install.sh`. The README and Device Vault UI both get updated to use the custom domain.
- The scripts detect OS/arch and download the prebuilt binary from a **GitHub Releases** URL (set as a const at the top of each script so you can swap to self-hosted if needed).
- Add **`agent/.github/workflows/release.yml`** that runs `make all` on tag push and uploads `dist/*` to the GH release. (One-time: you push a tag, binaries appear, install scripts work.)
- Add an in-app **"Copy install command"** button in `DeviceVault.tsx` that copies the right command pre-filled with the pairing code: `curl -fsSL https://topha.acyn.world/agent/install.sh | sh -s -- ABC123`.

### B. Pesapal payments (default) — M-Pesa STK + cards

- New edge function **`pesapal-checkout`**: takes `{plan_id, phone, email}`, hits Pesapal v3 API (`/Transactions/SubmitOrderRequest`), returns redirect URL + tracking ID.
- New edge function **`pesapal-ipn`**: public webhook Pesapal calls when payment status changes. Validates, updates `subscriptions` row, on `COMPLETED` calls internal `activate-hotspot-user` (creates MikroTik hotspot user via existing agent job) and triggers SMS receipt.
- New tables:
  - `plans` (id, name, price_kes, duration_days, bandwidth_profile, is_active)
  - `subscriptions` (id, user_id?, customer_phone, customer_email, plan_id, device_id, hotspot_username, hotspot_password, status, pesapal_tracking_id, started_at, expires_at)
  - `payment_events` (id, subscription_id, provider, raw_payload, status, created_at)
- Daily pg_cron job **`expire-subscriptions`** → marks expired, removes MikroTik hotspot user, sends SMS warning at T-24h and T-0.
- Secrets to add: `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, `PESAPAL_IPN_ID` (you'll register the IPN URL in Pesapal dashboard and paste the ID back).
- UI: **`src/components/Billing.tsx`** — plan picker, phone input, "Pay with M-Pesa", subscription list with status + expiry.

### C. TalkSasa SMS (default)

- Rewrite **`send-sms`** edge function to call TalkSasa API (`https://bulksms.talksasa.com/api/v3/sms/send`) with `Authorization: Bearer <TALKSASA_API_KEY>`, sender ID configurable.
- Auto-trigger SMS on: payment success (receipt + Wi-Fi credentials), 24h before expiry (warn), expiry (offer renewal link).
- Secrets to add: `TALKSASA_API_KEY`, `TALKSASA_SENDER_ID`.
- Settings panel: let user override sender ID and toggle which events SMS fires for.

### D. Captive portal end-to-end deploy

- Extend **`CaptivePortalBuilder.tsx`** with a **"Deploy to router"** action that:
  1. Bundles the generated `login.html`, `alogin.html`, `logout.html`, `rlogin.html`, CSS, images into a job payload.
  2. Creates a `device_jobs` row with kind `deploy_portal` and the payload as `script_content` (base64 tarball).
- Extend **`agent/main.go`** with a `deploy_portal` handler: uploads each file via SFTP to `/hotspot/` (SSH) or via REST `/file` (RouterOS v7), then runs `/ip hotspot profile set [find name=hsprof1] html-directory=hotspot` and restarts the hotspot service.
- Add **"Hotspot users"** tab in DeviceVault that lists MikroTik hotspot users (read via agent) and lets you manually add/disable — backing the same flow Pesapal uses.

### E. Verification (must pass before I claim done)

1. `curl -I https://topha.acyn.world/agent/install.sh` → 200.
2. `supabase--curl_edge_functions pesapal-checkout` with test payload → returns Pesapal redirect URL.
3. Pesapal sandbox IPN → row in `subscriptions` flips to `active`, `device_jobs` gets an `apply_script` row that adds the hotspot user.
4. TalkSasa test send → 200, message visible in TalkSasa dashboard.
5. Captive portal deploy job → agent log shows files uploaded, MikroTik `/ip hotspot profile print` shows new html-directory.
6. End-to-end on a real MikroTik: scan QR → portal → pay via M-Pesa STK → SMS receipt → internet works → 24h later SMS warns → at expiry SMS arrives + user disabled.

## Technical details

**Files created**
- `public/agent/install.sh`, `public/agent/install.ps1`
- `agent/.github/workflows/release.yml`
- `supabase/functions/pesapal-checkout/index.ts`
- `supabase/functions/pesapal-ipn/index.ts`
- `supabase/functions/activate-hotspot-user/index.ts`
- `supabase/functions/expire-subscriptions/index.ts` (pg_cron target)
- `src/components/Billing.tsx`, `src/components/HotspotUsers.tsx`
- migration: `plans`, `subscriptions`, `payment_events` + RLS + cron job

**Files edited**
- `agent/README.md` (real URLs)
- `agent/main.go` (`deploy_portal` handler, SFTP upload)
- `supabase/functions/send-sms/index.ts` (TalkSasa)
- `src/components/DeviceVault.tsx` ("Copy install command", Hotspot Users tab link)
- `src/components/CaptivePortalBuilder.tsx` ("Deploy to router" button)
- `src/pages/Index.tsx` (new Billing route/tab)
- `supabase/config.toml` (expose new functions)

**Out of scope (ping me to add)**
- Card/Airtel routes for Pesapal (works automatically since Pesapal handles them, but no separate UI)
- SMS provider fallback (Africa's Talking as backup if TalkSasa down)
- Multi-tenant ISP billing / per-ISP Pesapal subaccounts
- Auto-renewal cards (Pesapal recurring tokens)

## Order of execution
1. Migration (plans/subscriptions/payment_events) — needs your approval
2. Secrets prompt (Pesapal x3, TalkSasa x2)
3. Edge functions + SMS rewrite + install scripts + README
4. Agent `deploy_portal` handler + GH Actions
5. UI (Billing, Hotspot Users, install command copy, portal deploy button)
6. Run verification checklist E1–E5 (E6 requires real hardware — I'll give you the runbook)

Reply **"go"** to start, or tell me what to change first.
