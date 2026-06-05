import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: { template: '%s | Wave Ops Hub', default: 'Portal do Técnico' },
}
import { signOut } from '@/lib/auth/logout'
import { resolveTenantFromSlug } from '@/lib/tenant'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { TenantLogo } from '@/components/ui/TenantLogo'
import { NotificationBell } from '@/components/NotificationBell'
import type { NotifItem } from '@/components/NotificationBell'
import { LogOut } from 'lucide-react'
import { TechBottomNav } from './_components/TechBottomNav'

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect('/login')
  if (user.role !== 'tenant_technician') redirect('/login')

  const headerStore = await headers()
  const subdomain = headerStore.get('x-subdomain')

  if (subdomain) {
    const tenant = await resolveTenantFromSlug(subdomain)
    if (!tenant) notFound()
  }

  const supabase = await createSupabaseServerClient()

  const [tenantRes, notifRes] = await Promise.all([
    user.tenantId
      ? supabase.from('tenants').select('nome').eq('id', user.tenantId).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('notifications')
      .select('id, title, body, link, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const tenantNome = (tenantRes.data as { nome?: string } | null)?.nome ?? ''
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

  const initials = user.nomeCompleto
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--line)] bg-[var(--bg-1)] px-4">
        <div className="flex items-center gap-2.5">
          <TenantLogo variant="mark" className="h-8 w-8 rounded-lg text-base" />
          {tenantNome && (
            <span className="font-display text-xs font-bold uppercase tracking-widest text-[var(--text)]">
              {tenantNome}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell notifications={notifications} />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--cyan)]/20 text-xs font-bold text-[var(--cyan)]">
            {initials}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-3)] transition-colors hover:bg-white/5 hover:text-[var(--text)]"
            >
              <LogOut size={13} />
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 pb-16">{children}</main>

      <TechBottomNav />
    </div>
  )
}
