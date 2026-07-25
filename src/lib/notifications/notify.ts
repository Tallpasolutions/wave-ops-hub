import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push/send'

// Notificações que cruzam usuários (técnico → gestores e vice-versa) usam o
// service role: o RLS de notifications restringe por usuário, então o insert
// cross-user precisa do admin client (server-only). As gravações de domínio
// continuam pelo client autenticado (RLS aplicado).
//
// Ponto único de notificação (CLAUDE.md §6): além do insert em notifications
// (sineta/realtime, ADR-017), dispara Web Push para o app fechado (ADR-018).
// O push é best-effort e nunca quebra o fluxo.

type Notif = { type: string; title: string; body?: string; link?: string }

async function pushSafely(userIds: string[], n: Notif): Promise<void> {
  try {
    await sendPushToUsers(userIds, { title: n.title, body: n.body, link: n.link })
  } catch {
    // push é secundário — falha aqui não afeta a notificação persistida
  }
}

export async function notifyManagers(tenantId: string, n: Notif): Promise<void> {
  const admin = createSupabaseAdminClient()
  // Gestores do tenant + o operador Tallpa (tallpa_owner, sem tenant_id) — este último
  // supervisiona a operação e também precisa ver as notificações do tenant.
  const [{ data: managers }, { data: owners }] = await Promise.all([
    admin
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('role', ['tenant_owner', 'tenant_manager']),
    admin.from('users').select('id').eq('role', 'tallpa_owner'),
  ])
  const userIds = [
    ...new Set([
      ...(managers ?? []).map((u) => u.id as string),
      ...(owners ?? []).map((u) => u.id as string),
    ]),
  ]
  const rows = userIds.map((uid) => ({
    tenant_id: tenantId,
    user_id: uid,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
  }))
  if (rows.length > 0) {
    await admin.from('notifications').insert(rows)
    await pushSafely(userIds, n)
  }
}

// Resolve o users.id do técnico (users.technician_id → technicians.id) e notifica.
export async function notifyTechnician(
  tenantId: string,
  technicianId: string,
  n: Notif,
): Promise<void> {
  const admin = createSupabaseAdminClient()
  const { data: u } = await admin
    .from('users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('technician_id', technicianId)
    .maybeSingle()
  if (!u) return
  await admin.from('notifications').insert({
    tenant_id: tenantId,
    user_id: u.id as string,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
  })
  await pushSafely([u.id as string], n)
}
