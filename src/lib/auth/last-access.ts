import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// Último acesso = `auth.users.last_sign_in_at`, que o Supabase Auth atualiza sozinho a cada
// login. A coluna `public.users.ultimo_acesso` existe desde a migration 0001 mas nunca foi
// escrita (M9 do QA de 02/07) — em vez de criar um write path, lemos direto da fonte de verdade.
//
// `auth.admin.listUsers` é a via suportada (o schema `auth` não é exposto via PostgREST). Ela é
// global e paginada; filtramos pelos ids pedidos ao montar o mapa. O perPage máximo do GoTrue é
// 1000, então paginamos defensivamente para não cortar em bases maiores.

const PER_PAGE = 1000

export async function getLastAccessMap(
  userIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  if (userIds.length === 0) return map

  const wanted = new Set(userIds)
  const admin = createSupabaseAdminClient()

  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) {
      // PostgREST/GoTrue falham silenciosos no resto do app; aqui degradamos para "—"
      // (mapa parcial) em vez de derrubar a página inteira de Equipe.
      console.error('getLastAccessMap: listUsers falhou', error)
      break
    }

    for (const u of data.users) {
      if (wanted.has(u.id)) map.set(u.id, u.last_sign_in_at ?? null)
    }

    if (data.users.length < PER_PAGE) break
  }

  return map
}

export function formatLastAccess(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
