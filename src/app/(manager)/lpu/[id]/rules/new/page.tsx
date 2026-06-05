import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CreateRuleForm } from './_components/CreateRuleForm'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function NewRulePage({ params }: Props) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()
  const { data: lpu } = await supabase
    .from('lpus')
    .select('id, nome')
    .eq('id', id)
    .single()

  if (!lpu) notFound()

  return <CreateRuleForm lpuId={lpu.id} lpuNome={lpu.nome} />
}
