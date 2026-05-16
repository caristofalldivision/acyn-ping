// Pesapal IPN webhook. Public endpoint. Queries Pesapal for transaction status
// using the subscription's owner credentials, then provisions a MikroTik hotspot
// user (queues a device_job) and triggers an SMS receipt.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
}

function genCreds() {
  const u = 'u' + Math.random().toString(36).slice(2, 8)
  const p = Math.random().toString(36).slice(2, 10)
  return { u, p }
}

async function pesapalToken(env: string, key: string, secret: string) {
  const base = env === 'live' ? 'https://pay.pesapal.com/v3' : 'https://cybqa.pesapal.com/pesapalv3'
  const r = await fetch(`${base}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  })
  const j = await r.json()
  return { token: j.token, base }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const url = new URL(req.url)
  const tracking = url.searchParams.get('OrderTrackingId') || url.searchParams.get('orderTrackingId')
  const merchantRef = url.searchParams.get('OrderMerchantReference') || url.searchParams.get('orderMerchantReference')
  const isReturn = url.searchParams.get('return') === '1'

  if (!tracking) {
    return new Response('missing tracking id', { status: 400, headers: corsHeaders })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const subQ = await admin.from('subscriptions').select('*, plans(*)').eq('pesapal_tracking_id', tracking).maybeSingle()
  if (!subQ.data) return new Response('unknown sub', { status: 404, headers: corsHeaders })
  const sub = subQ.data

  const { data: settings } = await admin.from('app_settings').select('*').eq('user_id', sub.user_id).maybeSingle()
  if (!settings) return new Response('no settings', { status: 500, headers: corsHeaders })

  const { token, base } = await pesapalToken(settings.pesapal_env || 'sandbox', settings.pesapal_consumer_key, settings.pesapal_consumer_secret)
  const statusRes = await fetch(`${base}/api/Transactions/GetTransactionStatus?orderTrackingId=${tracking}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const status = await statusRes.json()
  await admin.from('payment_events').insert({
    subscription_id: sub.id, provider: 'pesapal', event_type: 'ipn', raw_payload: status, status: status.payment_status_description,
  })

  const desc = (status.payment_status_description || '').toUpperCase()
  if (desc === 'COMPLETED') {
    const creds = sub.hotspot_username ? { u: sub.hotspot_username, p: sub.hotspot_password } : genCreds()
    const plan = sub.plans
    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + plan.duration_minutes * 60_000)
    await admin.from('subscriptions').update({
      status: 'active',
      hotspot_username: creds.u,
      hotspot_password: creds.p,
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    }).eq('id', sub.id)

    // Queue a device_job to add the hotspot user on the router
    if (sub.device_id) {
      const profile = plan.bandwidth_profile || 'default'
      const script = [
        `/ip hotspot user add name=${creds.u} password=${creds.p} profile=${profile} limit-uptime=${plan.duration_minutes}m comment="topha:${sub.id}"`,
      ].join('\n')
      await admin.from('device_jobs').insert({
        user_id: sub.user_id, device_id: sub.device_id, kind: 'apply_script', script_content: script, status: 'pending',
      })
    }

    // Fire-and-forget SMS receipt
    if (settings.sms_on_payment && settings.talksasa_api_key) {
      const msg = `${settings.business_name || 'Topha'}: Payment received. Wi-Fi user: ${creds.u} pass: ${creds.p} valid ${plan.duration_minutes} min.`
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-user': sub.user_id, 'x-internal-secret': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! },
        body: JSON.stringify({ to: sub.customer_phone, message: msg }),
      }).catch(() => {})
    }
  } else if (desc === 'FAILED' || desc === 'INVALID') {
    await admin.from('subscriptions').update({ status: 'failed' }).eq('id', sub.id)
  }

  if (isReturn) {
    // Browser redirect after payment — show a friendly page
    return new Response(`<html><body style="font-family:sans-serif;background:#0f0f0f;color:#fff;text-align:center;padding:60px"><h1>${desc === 'COMPLETED' ? '✓ Payment received' : 'Payment ' + desc.toLowerCase()}</h1><p>You may close this window.</p></body></html>`, {
      headers: { 'Content-Type': 'text/html', ...corsHeaders },
    })
  }
  return new Response(JSON.stringify({ ok: true, status: desc }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
