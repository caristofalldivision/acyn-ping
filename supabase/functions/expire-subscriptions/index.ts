// Runs hourly via pg_cron. Marks subscriptions expired, removes MikroTik
// hotspot users via device_jobs, and SMS-warns 24h before expiry.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 3600_000)

  // Warn near-expiry
  const { data: warn } = await admin.from('subscriptions')
    .select('*, plans(name)')
    .eq('status', 'active')
    .is('warned_at', null)
    .lte('expires_at', in24h.toISOString())
    .gt('expires_at', now.toISOString())
  for (const s of warn || []) {
    await sms(admin, s.user_id, s.customer_phone, `Your ${s.plans?.name || 'plan'} expires soon. Renew at any time.`)
    await admin.from('subscriptions').update({ warned_at: now.toISOString() }).eq('id', s.id)
  }

  // Expire
  const { data: exp } = await admin.from('subscriptions')
    .select('*')
    .eq('status', 'active')
    .lte('expires_at', now.toISOString())
  for (const s of exp || []) {
    await admin.from('subscriptions').update({ status: 'expired' }).eq('id', s.id)
    if (s.device_id && s.hotspot_username) {
      await admin.from('device_jobs').insert({
        user_id: s.user_id, device_id: s.device_id, kind: 'apply_script',
        script_content: `/ip hotspot user remove [find name=${s.hotspot_username}]`,
        status: 'pending',
      })
    }
    await sms(admin, s.user_id, s.customer_phone, 'Your Wi-Fi plan has expired. Reply to renew.')
  }

  return new Response(JSON.stringify({ warned: warn?.length || 0, expired: exp?.length || 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

async function sms(admin: any, userId: string, phone: string, msg: string) {
  const { data: s } = await admin.from('app_settings').select('talksasa_api_key,sms_on_expiry,sms_on_expiry_warn').eq('user_id', userId).maybeSingle()
  if (!s?.talksasa_api_key) return
  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-user': userId, 'x-internal-secret': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! },
    body: JSON.stringify({ to: phone, message: msg }),
  }).catch(() => {})
}
