import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { EditRuleForm } from './_components/EditRuleForm'
import { getTechniciansForRule } from '../../../../actions'
import type { LpuRuleNarrowed } from '@/lib/lpu'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string; ruleId: string }> }

export default async function EditRulePage({ params }: Props) {
  const { id, ruleId } = await params
  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()
  const [{ data: lpu }, { data: rule }, technicians] = await Promise.all([
    supabase.from('lpus').select('id, nome').eq('id', id).single(),
    supabase.from('lpu_rules').select('*').eq('id', ruleId).eq('lpu_id', id).single(),
    getTechniciansForRule(user.tenantId!),
  ])

  if (!lpu || !rule) notFound()

  return (
    <EditRuleForm
      rule={rule as LpuRuleNarrowed}
      lpuId={lpu.id}
      lpuNome={lpu.nome}
      technicians={technicians}
    />
  )
}
