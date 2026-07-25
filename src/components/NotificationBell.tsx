'use client'
import { useEffect, useState } from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { markNotificationRead, markAllNotificationsRead } from '@/app/notifications/actions'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type NotifItem = {
  id: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

interface Props {
  notifications: NotifItem[]
  userId: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export function NotificationBell({ notifications, userId }: Props) {
  const [open, setOpen] = useState(false)
  // Notificações recebidas ao vivo desde a montagem. Ao navegar/revalidar, o
  // servidor re-busca e as inclui em `notifications`; a mesclagem de-duplica por id.
  const [live, setLive] = useState<NotifItem[]>([])

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase.channel(`notif:${userId}`).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const n = payload.new as {
          id: string
          title: string
          body: string | null
          link: string | null
          read_at: string | null
          created_at: string
        }
        setLive((prev) =>
          prev.some((x) => x.id === n.id)
            ? prev
            : [
                {
                  id: n.id,
                  title: n.title,
                  body: n.body,
                  link: n.link,
                  readAt: n.read_at,
                  createdAt: n.created_at,
                },
                ...prev,
              ],
        )
      },
    )

    // O Realtime precisa do token do usuário para a RLS de `notifications`
    // (notif_own = `user_id = auth.uid()`). Sem `setAuth`, a conexão é anônima,
    // `auth.uid()` é nulo e o Postgres não entrega os eventos — era por isso que a
    // resposta da Wave não chegava ao técnico ao vivo. Setamos ANTES de assinar.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) supabase.realtime.setAuth(data.session.access_token)
      channel.subscribe()
    })

    // Mantém o token atualizado em sessões longas (refresh), para não perder a entrega.
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
    })

    return () => {
      authSub.subscription.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [userId])

  const propIds = new Set(notifications.map((n) => n.id))
  const merged = [...live.filter((l) => !propIds.has(l.id)), ...notifications]
  const unread = merged.filter((n) => !n.readAt).length

  async function handleClick(notif: NotifItem) {
    if (!notif.readAt) {
      await markNotificationRead(notif.id)
    }
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] transition-colors hover:bg-white/5 hover:text-[var(--text)]"
        aria-label="Notificações"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--red)] font-mono text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          {/* Mobile: fixo à viewport (a sineta não fica na borda da tela, então
              ancorar por right-0 jogava o painel para fora à esquerda). sm+: volta
              a ancorar na sineta. */}
          <div className="fixed left-3 right-3 top-16 z-40 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-1)] shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-10 sm:w-80">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <span className="font-display text-[13px] font-semibold text-[var(--text)]">
                Notificações
                {unread > 0 && (
                  <span className="ml-2 rounded-full bg-[var(--red)]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--red)]">
                    {unread}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={async () => {
                      await markAllNotificationsRead()
                      setOpen(false)
                    }}
                    className="rounded p-1 text-[var(--text-3)] transition-colors hover:text-[var(--cyan)]"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded p-1 text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {merged.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell size={24} className="mx-auto mb-2 text-[var(--text-3)]" />
                  <p className="text-[12px] text-[var(--text-3)]">Nenhuma notificação</p>
                </div>
              ) : (
                merged.map((notif) => {
                  const isUnread = !notif.readAt
                  const inner = (
                    <div
                      className={`border-b border-[var(--line)] px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.03] ${
                        isUnread ? 'bg-[var(--cyan)]/[0.03]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          {isUnread && (
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cyan)]" />
                          )}
                          <div className={isUnread ? '' : 'ml-3.5'}>
                            <p className="text-[13px] font-medium text-[var(--text)]">
                              {notif.title}
                            </p>
                            {notif.body && (
                              <p className="mt-0.5 text-[11px] text-[var(--text-3)]">{notif.body}</p>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-[var(--text-3)]">
                          {timeAgo(notif.createdAt)}
                        </span>
                      </div>
                    </div>
                  )

                  return notif.link ? (
                    <Link
                      key={notif.id}
                      href={notif.link}
                      onClick={() => handleClick(notif)}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      key={notif.id}
                      onClick={() => handleClick(notif)}
                      className="w-full text-left"
                    >
                      {inner}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
