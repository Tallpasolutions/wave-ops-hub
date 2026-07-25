'use server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Persiste/remove a inscrição de Web Push do técnico — ADR-018.
// Usa o client autenticado: a RLS push_own garante que o user_id é o próprio
// (não dá para gravar em nome de outro). O envio (server-only) lê pelo service role.

const subSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
})

export async function savePushSubscription(sub: {
  endpoint: string
  p256dh: string
  auth: string
}): Promise<{ ok: boolean }> {
  const parsed = subSchema.safeParse(sub)
  if (!parsed.success) return { ok: false }

  const user = await getCurrentUser()
  if (!user) return { ok: false }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      tenant_id: user.tenantId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )
  return { ok: !error }
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
  return { ok: !error }
}
