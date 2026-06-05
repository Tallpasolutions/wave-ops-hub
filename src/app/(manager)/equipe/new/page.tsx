import { redirect } from 'next/navigation'
import { getCurrentUser, canManageUsers } from '@/lib/auth'
import { CreateManagerUserForm } from './_components/CreateManagerUserForm'

export const dynamic = 'force-dynamic'

export default async function EquipeNewPage() {
  const user = await getCurrentUser()
  if (!user || !canManageUsers(user)) redirect('/equipe')

  return <CreateManagerUserForm />
}
