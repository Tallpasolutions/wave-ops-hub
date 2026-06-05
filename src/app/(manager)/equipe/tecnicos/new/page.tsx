import { redirect } from 'next/navigation'
import { getCurrentUser, canManageTechnicians } from '@/lib/auth'
import { CreateTechnicianForm } from './_components/CreateTechnicianForm'

export const dynamic = 'force-dynamic'

export default async function TecnicosNewPage({
  searchParams,
}: {
  searchParams: Promise<{ nomeCompleto?: string; from?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || !canManageTechnicians(user)) redirect('/equipe/tecnicos')

  const { nomeCompleto, from } = await searchParams
  return <CreateTechnicianForm defaultNomeCompleto={nomeCompleto} from={from} />
}
