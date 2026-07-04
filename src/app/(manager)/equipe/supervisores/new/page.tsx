import { redirect } from 'next/navigation'
import { getCurrentUser, canManageUsers } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CreateSupervisorForm } from './_components/CreateSupervisorForm'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Novo Supervisor' }

export default async function SupervisorNewPage() {
  const user = await getCurrentUser()
  if (!user || !canManageUsers(user)) redirect('/equipe/supervisores')

  const supabase = await createSupabaseServerClient()

  const [{ data: technicians }, { data: supervisorUsers }] = await Promise.all([
    supabase
      .from('technicians')
      .select('id, nome')
      .eq('tenant_id', user.tenantId!)
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('users')
      .select('technician_id')
      .eq('tenant_id', user.tenantId!)
      .eq('role', 'tenant_supervisor'),
  ])

  const alreadySupervisorIds = new Set((supervisorUsers ?? []).map((u) => u.technician_id))
  const available = (technicians ?? []).filter((t) => !alreadySupervisorIds.has(t.id))

  return (
    <CreateSupervisorForm
      techniciansAvailable={available}
      techniciansAll={technicians ?? []}
    />
  )
}
