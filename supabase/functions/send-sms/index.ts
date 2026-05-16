// SMS via TalkSasa (default) using per-user API key from app_settings.
// Falls back to Africa's Talking globals if present.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-user, x-internal-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Resolve user: internal call (service-role header) or JWT
    let userId: string | null = null
    const internalUser = req.headers.get('x-internal-user')
    const internalSecret = req.headers.get('x-internal-secret')
    if (internalUser && internalSecret === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      userId = internalUser
    } else {
      const auth = req.headers.get('Authorization')
      if (!auth) return json({ error: 'unauthorized' }, 401)
      const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: auth } },
      })
      const { data } = await supa.auth.getClaims(auth.replace('Bearer ', ''))
      if (!data?.claims) return json({ error: 'unauthorized' }, 401)
      userId = data.claims.sub
    }

    const { to, message } = await req.json()
    if (!to || !message) return json({ error: 'to + message required' }, 400)
    const formatted = to.startsWith('+') ? to : (to.startsWith('254') ? '+' + to : (to.startsWith('0') ? '+254' + to.slice(1) : '+' + to))

    const { data: s } = await admin.from('app_settings').select('*').eq('user_id', userId).maybeSingle()

    const { data: log } = await admin.from('message_logs').insert({
      user_id: userId, message_type: 'sms', recipient: formatted, body: message, status: 'pending',
    }).select().single()

    // Provider: TalkSasa preferred
    if (s?.talksasa_api_key) {
      const res = await fetch('https://bulksms.talksasa.com/api/v3/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${s.talksasa_api_key}` },
        body: JSON.stringify({
          recipient: formatted.replace('+', ''),
          sender_id: s.talksasa_sender_id || 'TalkSasa',
          type: 'plain',
          message,
        }),
      })
      const body = await res.json().catch(() => ({}))
      const ok = res.ok && (body.status === 'success' || body.code === 'ok' || res.status === 200)
      if (log) await admin.from('message_logs').update({
        status: ok ? 'sent' : 'failed',
        sent_at: ok ? new Date().toISOString() : null,
        error_message: ok ? null : JSON.stringify(body).slice(0, 500),
      }).eq('id', log.id)
      return json({ success: ok, provider: 'talksasa', details: body }, ok ? 200 : 502)
    }

    // Fallback: Africa's Talking
    const atKey = Deno.env.get('AT_API_KEY'); const atUser = Deno.env.get('AT_USERNAME')
    if (atKey && atUser) {
      const isSandbox = atUser.toLowerCase() === 'sandbox'
      const url = isSandbox ? 'https://api.sandbox.africastalking.com/version1/messaging' : 'https://api.africastalking.com/version1/messaging'
      const fd = new URLSearchParams({ username: atUser, to: formatted, message })
      const senderId = Deno.env.get('AT_SENDER_ID'); if (senderId) fd.set('from', senderId)
      const r = await fetch(url, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', apiKey: atKey }, body: fd.toString() })
      const j = await r.json()
      const ok = j?.SMSMessageData?.Recipients?.[0]?.statusCode === 101 || j?.SMSMessageData?.Recipients?.[0]?.status === 'Success'
      if (log) await admin.from('message_logs').update({
        status: ok ? 'sent' : 'failed', sent_at: ok ? new Date().toISOString() : null,
        error_message: ok ? null : JSON.stringify(j).slice(0, 500),
      }).eq('id', log.id)
      return json({ success: ok, provider: 'africastalking', details: j }, ok ? 200 : 502)
    }

    if (log) await admin.from('message_logs').update({ status: 'failed', error_message: 'no SMS provider configured' }).eq('id', log.id)
    return json({ error: 'No SMS provider configured. Add TalkSasa API key in Settings → Providers.' }, 400)
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
