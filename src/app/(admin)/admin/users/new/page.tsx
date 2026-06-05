import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CreateUserForm } from './_components/CreateUserForm'

export default async function UserNewPage() {
  const supabase = await createSupabaseServerClient()
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, nome')
    .eq('ativo', true)
    .order('nome')

  return <CreateUserForm tenants={tenants ?? []} />
}
