import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Mail, User, Hash, Calendar, Bell } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Meu Perfil' }
import { EditProfileForm } from './_components/EditProfileForm'
import { ChangePasswordForm } from './_components/ChangePasswordForm'
import { markAllNotificationsRead } from '@/app/notifications/actions'

function maskCpf(cpf: string | null): string {
  if (!cpf) return '—'
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `***.***.***-${digits.slice(9)}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  return `${Math.floor(hrs / 24)}d atrás`
}

export default async function ProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createSupabaseServerClient()

  const [techRes, notifRes] = await Promise.all([
    user.technicianId
      ? supabase
          .from('technicians')
          .select('nome_completo, email, cpf, celular, codigo_unetvale, data_admissao, observacoes')
          .eq('id', user.technicianId)
          .single()
      : Promise.resolve({ data: null }),

    supabase
      .from('notifications')
      .select('id, title, body, link, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const tech = techRes.data as {
    nome_completo: string
    email: string
    cpf: string | null
    celular: string | null
    codigo_unetvale: string | null
    data_admissao: string | null
    observacoes: string | null
  } | null

  const notifications = (notifRes.data ?? []) as {
    id: string
    title: string
    body: string | null
    link: string | null
    read_at: string | null
    created_at: string
  }[]

  const nome = tech?.nome_completo ?? user.nomeCompleto
  const initials = nome
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()

  const unread = notifications.filter((n) => !n.read_at).length

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-5">
      {/* Avatar + nome */}
      <div className="flex flex-col items-center gap-3 pb-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--cyan)]/20 font-display text-2xl font-bold text-[var(--cyan)]">
          {initials}
        </div>
        <div className="text-center">
          <h1 className="font-display text-xl font-bold text-[var(--text)]">{nome}</h1>
          <span className="mt-1 inline-block rounded-full bg-[var(--cyan)]/15 px-3 py-0.5 text-xs font-semibold text-[var(--cyan)]">
            Técnico
          </span>
        </div>
      </div>

      {/* Dados somente leitura */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] divide-y divide-[var(--line)]">
        <ProfileRow icon={Mail} label="E-mail" value={tech?.email ?? user.email} />
        <ProfileRow icon={User} label="CPF" value={maskCpf(tech?.cpf ?? null)} />
        <ProfileRow icon={Hash} label="Código Unetvale" value={tech?.codigo_unetvale ?? '—'} />
        <ProfileRow
          icon={Calendar}
          label="Data de Admissão"
          value={formatDate(tech?.data_admissao ?? null)}
        />
      </div>

      {/* Editar dados editáveis */}
      <section>
        <p className="mb-3 font-display text-[14px] font-semibold text-[var(--text)]">
          Editar informações
        </p>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <EditProfileForm celular={tech?.celular ?? null} observacoes={tech?.observacoes ?? null} />
        </div>
      </section>

      {/* Alterar senha */}
      <section>
        <p className="mb-3 font-display text-[14px] font-semibold text-[var(--text)]">
          Alterar senha
        </p>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <ChangePasswordForm />
        </div>
      </section>

      {/* Notificações */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={15} className="text-[var(--text-2)]" />
            <p className="font-display text-[14px] font-semibold text-[var(--text)]">
              Notificações
            </p>
            {unread > 0 && (
              <span className="rounded-full bg-[var(--red)]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--red)]">
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="text-[11px] font-semibold text-[var(--cyan)] hover:opacity-80"
              >
                Marcar todas como lidas
              </button>
            </form>
          )}
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] divide-y divide-[var(--line)]">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={24} className="mx-auto mb-2 text-[var(--text-3)]" />
              <p className="text-[12px] text-[var(--text-3)]">Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 ${!n.read_at ? 'bg-[var(--cyan)]/[0.03]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {!n.read_at && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cyan)]" />
                    )}
                    <div className={!n.read_at ? '' : 'ml-3.5'}>
                      <p className="text-[13px] font-medium text-[var(--text)]">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 text-[11px] text-[var(--text-3)]">{n.body}</p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--text-3)]">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <Icon size={15} className="shrink-0 text-[var(--text-3)]" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-[var(--text)]">{value}</p>
      </div>
    </div>
  )
}
