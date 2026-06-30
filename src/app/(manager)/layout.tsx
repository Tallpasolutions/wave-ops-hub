import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'
import { resolveTenantFromSlug } from '@/lib/tenant'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ManagerShell } from './_components/ManagerShell'
import { NotificationBell } from '@/components/NotificationBell'
import type { NotifItem } from '@/components/NotificationBell'
import { GlobalPeriodSelector } from './_components/GlobalPeriodSelector'

export const metadata: Metadata = {
  title: { template: '%s | Wave Ops Hub', default: 'Painel do Gestor' },
}

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect('/login')

  if (!['tallpa_owner', 'tenant_owner', 'tenant_manager'].includes(user.role)) {
    redirect('/login')
  }

  const headerStore = await headers()
  const subdomain = headerStore.get('x-subdomain')

  if (subdomain && subdomain !== 'admin') {
    const tenant = await resolveTenantFromSlug(subdomain)
    if (!tenant) notFound()
  }

  const supabase = await createSupabaseServerClient()

  const [tenantRes, notifRes, improdutivasRes] = await Promise.all([
    user.tenantId
      ? supabase.from('tenants').select('nome').eq('id', user.tenantId).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('notifications')
      .select('id, title, body, link, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    user.tenantId
      ? supabase
          .from('payouts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', user.tenantId)
          .is('improdutiva_aprovada', null)
          .not('reason_id', 'is', null)
      : Promise.resolve({ count: 0 }),
  ])

  const tenantNome = (tenantRes.data as { nome?: string } | null)?.nome ?? 'Manager'
  const notifications: NotifItem[] = ((notifRes.data ?? []) as {
    id: string
    title: string
    body: string | null
    link: string | null
    read_at: string | null
    created_at: string
  }[]).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.read_at,
    createdAt: n.created_at,
  }))

  const improdutivasPendentes = improdutivasRes.count ?? 0

  return (
    <ManagerShell
      nomeCompleto={user.nomeCompleto}
      email={user.email}
      tenantNome={tenantNome}
      improdutivasPendentes={improdutivasPendentes}
      topbar={
        <>
          <Suspense fallback={<div className="flex-1" />}>
            <GlobalPeriodSelector />
          </Suspense>
          <NotificationBell notifications={notifications} />
        </>
      }
    >
      {children}
    </ManagerShell>
  )
}
