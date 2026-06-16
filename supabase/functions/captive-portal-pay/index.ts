// Public endpoint hit by the MikroTik captive portal page (login.html).
//
// Routes (all share this single function path, distinguished by URL suffix):
//   GET  /captive-portal-pay/plans?device_id=...         -> list active plans
//   GET  /captive-portal-pay/status?subscription_id=...  -> { status, username, password }
//   POST /captive-portal-pay/pay                         -> { device_id, plan_id, phone } -> { subscription_id, redirect_url }
//   POST /captive-portal-pay                             -> same as /pay (back-compat)
//
// Initiates a Pesapal STK push using the device owner's stored credentials.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

async function pesapalToken(env: string, key: string, secret: string) {
  const base = env === 'live' ? 'https://pay.pesapal.com/v3' : 'https://cybqa.pesapal.com/pesapalv3'
  const r = await fetch(`${base}/api/Auth/RequestToken`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  })
  const j = await r.json(); return { token: j.token, base }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const url = new URL(req.url)
  const suffix = url.pathname.replace(/^.*\/captive-portal-pay/, '') || '/'
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    // ---- GET /plans ----
    if (req.method === 'GET' && suffix === '/plans') {
      const device_id = url.searchParams.get('device_id')
      if (!device_id) return json({ error: 'device_id required' }, 400)
      const { data: device } = await admin.from('devices').select('user_id').eq('id', device_id).maybeSingle()
      if (!device) return json({ plans: [] })
      const { data: plans } = await admin.from('plans')
        .select('id, name, price_kes, duration_minutes, bandwidth_profile')
        .eq('user_id', device.user_id).eq('is_active', true).order('price_kes', { ascending: true })
      return json({ plans: plans || [] })
    }

    // ---- GET /status ----
    if (req.method === 'GET' && suffix === '/status') {
      const sid = url.searchParams.get('subscription_id')
      if (!sid) return json({ error: 'subscription_id required' }, 400)
      const { data: sub } = await admin.from('subscriptions')
        .select('status, hotspot_username, hotspot_password').eq('id', sid).maybeSingle()
      if (!sub) return json({ error: 'unknown subscription' }, 404)
      return json({ status: sub.status, username: sub.hotspot_username, password: sub.hotspot_password })
    }

    // ---- POST /pay (default) ----
    if (req.method === 'POST') {
      const { device_id, plan_id, phone, email } = await req.json()
      if (!device_id || !plan_id || !phone) return json({ error: 'device_id, plan_id, phone required' }, 400)
      const { data: device } = await admin.from('devices').select('user_id').eq('id', device_id).maybeSingle()
      if (!device) return json({ error: 'unknown device' }, 404)
      const { data: settings } = await admin.from('app_settings').select('*').eq('user_id', device.user_id).maybeSingle()
      if (!settings?.pesapal_consumer_key) return json({ error: 'operator has not configured Pesapal' }, 503)
      const { data: plan } = await admin.from('plans').select('*').eq('id', plan_id).eq('user_id', device.user_id).maybeSingle()
      if (!plan) return json({ error: 'plan not found' }, 404)

      // Normalize phone to 2547XXXXXXXX for Pesapal billing
      let normPhone = String(phone).replace(/\s|-/g, '')
      if (normPhone.startsWith('07')) normPhone = '254' + normPhone.slice(1)

      const merchantRef = 'PING-' + crypto.randomUUID().slice(0, 8)
      const { data: sub, error } = await admin.from('subscriptions').insert({
        user_id: device.user_id, device_id, plan_id, customer_phone: normPhone, customer_email: email || null,
        amount_kes: plan.price_kes, pesapal_merchant_ref: merchantRef, status: 'pending',
      }).select().single()
      if (error) throw error

      const { token, base } = await pesapalToken(settings.pesapal_env || 'sandbox', settings.pesapal_consumer_key, settings.pesapal_consumer_secret)
      const order = await fetch(`${base}/api/Transactions/SubmitOrderRequest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: merchantRef, currency: 'KES', amount: plan.price_kes,
          description: `${settings.business_name || 'WiFi'} - ${plan.name}`,
          callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/pesapal-ipn?return=1`,
          notification_id: settings.pesapal_ipn_id,
          billing_address: { phone_number: normPhone, email_address: email || `${normPhone}@ping.local` },
        }),
      }).then((r) => r.json())
      if (!order.redirect_url) {
        await admin.from('subscriptions').update({ status: 'failed' }).eq('id', sub.id)
        return json({ error: 'pesapal rejected order', details: order }, 502)
      }
      await admin.from('subscriptions').update({ pesapal_tracking_id: order.order_tracking_id }).eq('id', sub.id)
      return json({ redirect_url: order.redirect_url, subscription_id: sub.id })
    }

    return json({ error: 'not found' }, 404)
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
