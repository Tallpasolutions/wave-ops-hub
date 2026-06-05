import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AdminShell } from './_components/AdminShell'

export const metadata: Metadata = {
  title: { template: '%s | Wave Ops Hub', default: 'Admin' },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user || user.role !== 'tallpa_owner') {
    redirect('/login')
  }

  return (
    <AdminShell nomeCompleto={user.nomeCompleto} email={user.email}>
      {children}
    </AdminShell>
  )
}
