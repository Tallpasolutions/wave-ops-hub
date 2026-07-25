import 'server-only'
import webpush from 'web-push'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// Envio de Web Push (VAPID) — ADR-018. Lê as inscrições pelo service role
// (a RLS push_own só libera as do próprio usuário; o envio é cross-user, como
// notify.ts). Best-effort: erros nunca sobem — o chamador não pode quebrar por
// causa de push. Inscrição morta (404/410) é removida na hora.

export type PushPayload = { title: string; body?: string; link?: string }

let configured = false

function ensureVapid(): boolean {
  if (configured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (userIds.length === 0) return
  if (!ensureVapid()) return // sem chaves configuradas → silencioso, cai no realtime

  const admin = createSupabaseAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (!subs || subs.length === 0) return

  const body = JSON.stringify(payload)
  const deadEndpoints: string[] = []

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        )
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          deadEndpoints.push(s.endpoint)
        }
      }
    }),
  )

  if (deadEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
  }
}
