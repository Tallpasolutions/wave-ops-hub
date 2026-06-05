export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.warn('[cleanup] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes — teardown ignorado')
    return
  }

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }

  async function del(table: string, filter: string) {
    const res = await fetch(`${url}/rest/v1/${table}?${filter}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const body = await res.text()
      console.warn(`[cleanup] ${table} — ${res.status}: ${body}`)
    }
  }

  async function deleteAuthUsers() {
    const res = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers })
    if (!res.ok) return
    const { users } = await res.json() as { users: Array<{ id: string; email: string }> }
    const testUsers = users.filter((u) => u.email?.endsWith('@test.dev'))
    for (const u of testUsers) {
      await fetch(`${url}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers })
    }
  }

  await deleteAuthUsers()
  await del('technicians', 'nome_completo=like.*E2E*')
  await del('lpus', 'nome=like.LPU%20E2E*')
  await del('uploads', 'file_name=like.*sample*')
  await del('users', 'email=like.*%40test.dev')
  await del('tenants', 'slug=like.e2e-*')

  console.log('[cleanup] Dados de teste E2E removidos.')
}
