// Public endpoint hit by the MikroTik captive portal page (login.html).
// Input: { device_id, plan_id, phone }
// Looks up the device owner's Pesapal credentials and initiates checkout.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  try {
    const { device_id, plan_id, phone, email } = await req.json()
    if (!device_id || !plan_id || !phone) return json({ error: 'device_id, plan_id, phone required' }, 400)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: device } = await admin.from('devices').select('user_id').eq('id', device_id).maybeSingle()
    if (!device) return json({ error: 'unknown device' }, 404)
    const { data: settings } = await admin.from('app_settings').select('*').eq('user_id', device.user_id).maybeSingle()
    if (!settings?.pesapal_consumer_key) return json({ error: 'operator has not configured Pesapal' }, 503)
    const { data: plan } = await admin.from('plans').select('*').eq('id', plan_id).eq('user_id', device.user_id).maybeSingle()
    if (!plan) return json({ error: 'plan not found' }, 404)

    const merchantRef = 'PING-' + crypto.randomUUID().slice(0, 8)
    const { data: sub, error } = await admin.from('subscriptions').insert({
      user_id: device.user_id, device_id, plan_id, customer_phone: phone, customer_email: email || null,
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
        billing_address: { phone_number: phone, email_address: email || `${phone}@ping.local` },
      }),
    }).then((r) => r.json())
    if (!order.redirect_url) {
      await admin.from('subscriptions').update({ status: 'failed' }).eq('id', sub.id)
      return json({ error: 'pesapal rejected order', details: order }, 502)
    }
    await admin.from('subscriptions').update({ pesapal_tracking_id: order.order_tracking_id }).eq('id', sub.id)
    return json({ redirect_url: order.redirect_url, subscription_id: sub.id })
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
