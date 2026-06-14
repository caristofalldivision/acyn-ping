// Initiates a Pesapal v3 checkout. Uses the caller's own Pesapal credentials
// stored in app_settings. Returns redirect_url + tracking_id.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function pesapalToken(env: string, key: string, secret: string) {
  const base = env === 'live' ? 'https://pay.pesapal.com/v3' : 'https://cybqa.pesapal.com/pesapalv3'
  const r = await fetch(`${base}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  })
  const j = await r.json()
  if (!j.token) throw new Error('pesapal auth failed: ' + JSON.stringify(j))
  return { token: j.token as string, base }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ error: 'unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    )
    const { data: claims } = await supabase.auth.getClaims(auth.replace('Bearer ', ''))
    if (!claims?.claims) return json({ error: 'unauthorized' }, 401)
    const userId = claims.claims.sub

    const body = await req.json()
    const { plan_id, customer_phone, customer_email, device_id, callback_url } = body
    if (!plan_id || !customer_phone) return json({ error: 'plan_id and customer_phone required' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: settings } = await admin.from('app_settings').select('*').eq('user_id', userId).maybeSingle()
    if (!settings?.pesapal_consumer_key || !settings?.pesapal_consumer_secret || !settings?.pesapal_ipn_id) {
      return json({ error: 'Pesapal not configured. Set keys in Settings → Providers.' }, 400)
    }
    const { data: plan } = await admin.from('plans').select('*').eq('id', plan_id).maybeSingle()
    if (!plan) return json({ error: 'plan not found' }, 404)

    const { token, base } = await pesapalToken(
      settings.pesapal_env || 'sandbox',
      settings.pesapal_consumer_key,
      settings.pesapal_consumer_secret,
    )

    const merchantRef = 'PING-' + crypto.randomUUID().slice(0, 8)
    const sub = await admin.from('subscriptions').insert({
      user_id: userId,
      device_id: device_id || null,
      plan_id,
      customer_phone,
      customer_email: customer_email || null,
      amount_kes: plan.price_kes,
      pesapal_merchant_ref: merchantRef,
      status: 'pending',
    }).select().single()
    if (sub.error) throw sub.error

    const orderRes = await fetch(`${base}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: merchantRef,
        currency: 'KES',
        amount: plan.price_kes,
        description: `${settings.business_name || 'Ping'} - ${plan.name}`,
        callback_url: callback_url || settings.pesapal_callback_url || `${Deno.env.get('SUPABASE_URL')}/functions/v1/pesapal-ipn?return=1`,
        notification_id: settings.pesapal_ipn_id,
        billing_address: {
          phone_number: customer_phone,
          email_address: customer_email || `${customer_phone}@ping.local`,
        },
      }),
    })
    const order = await orderRes.json()
    if (!order.redirect_url) {
      await admin.from('subscriptions').update({ status: 'failed' }).eq('id', sub.data.id)
      return json({ error: 'pesapal rejected order', details: order }, 502)
    }
    await admin.from('subscriptions').update({ pesapal_tracking_id: order.order_tracking_id }).eq('id', sub.data.id)

    return json({ redirect_url: order.redirect_url, tracking_id: order.order_tracking_id, subscription_id: sub.data.id })
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
