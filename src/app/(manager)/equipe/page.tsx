import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getCurrentUser, canManageUsers } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Equipe' }
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toggleUserAtivo, sendPasswordResetManager } from './actions'
import type { AppRole } from '@/lib/auth/types'

export const dynamic = 'force-dynamic'

type UserRow = {
  id: string
  email: string
  nome_completo: string
  role: string
  ativo: boolean
  ultimo_acesso: string | null
}

export default async function EquipePage() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()
  const { data: users } = await supabase
    .from('users')
    .select('id, email, nome_completo, role, ativo, ultimo_acesso')
    .eq('tenant_id', user.tenantId!)
    .in('role', ['tenant_owner', 'tenant_manager'])
    .order('created_at', { ascending: false })

  const canCreate = canManageUsers(user)

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">Equipe</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            {users?.length ?? 0} usuário{users?.length !== 1 ? 's' : ''} no tenant
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/equipe/supervisores"
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] transition-colors hover:border-[var(--cyan)] hover:text-[var(--cyan)]"
          >
            Supervisores
          </Link>
          {canCreate && (
            <Link href="/equipe/new">
              <Button size="sm">
                <Plus size={16} className="mr-2" />
                Novo Usuário
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-1)]">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--line)] hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Usuário
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Cargo
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Status
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Último acesso
              </TableHead>
              {canCreate && (
                <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                  Ações
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users as UserRow[] | null)?.map((u) => {
              const toggleAction = toggleUserAtivo.bind(null, u.id, !u.ativo)
              const resetAction = sendPasswordResetManager.bind(null, u.email)
              return (
                <TableRow key={u.id} className="border-[var(--line)]">
                  <TableCell>
                    <p className="font-medium text-[var(--text)]">{u.nome_completo}</p>
                    <p className="text-xs text-[var(--text-3)]">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={u.role as AppRole} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge ativo={u.ativo} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--text-3)]">
                    {u.ultimo_acesso
                      ? new Date(u.ultimo_acesso).toLocaleDateString('pt-BR')
                      : '—'}
                  </TableCell>
                  {canCreate && (
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <form action={resetAction}>
                          <button
                            type="submit"
                            className="text-xs text-[var(--cyan)] transition-colors hover:text-[var(--cyan)]/80"
                          >
                            Reset senha
                          </button>
                        </form>
                        <form action={toggleAction}>
                          <button
                            type="submit"
                            className={`text-xs font-medium transition-colors ${
                              u.ativo
                                ? 'text-[var(--red)] hover:text-[var(--red)]/80'
                                : 'text-[var(--green)] hover:text-[var(--green)]/80'
                            }`}
                          >
                            {u.ativo ? 'Suspender' : 'Reativar'}
                          </button>
                        </form>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {!users?.length && (
              <TableRow>
                <TableCell
                  colSpan={canCreate ? 5 : 4}
                  className="py-8 text-center text-sm text-[var(--text-3)]"
                >
                  Nenhum usuário cadastrado ainda.{' '}
                  {canCreate && (
                    <Link href="/equipe/new" className="text-[var(--cyan)] hover:underline">
                      Criar o primeiro
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: AppRole }) {
  const config: Partial<Record<AppRole, { label: string; className: string }>> = {
    tenant_owner: {
      label: 'Proprietário',
      className: 'bg-[rgba(30,107,255,0.12)] text-[var(--blue)]',
    },
    tenant_manager: {
      label: 'Gerente',
      className: 'bg-white/5 text-[var(--text-2)]',
    },
  }
  const { label, className } = config[role] ?? { label: role, className: 'bg-white/5 text-[var(--text-3)]' }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  )
}

function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        ativo
          ? 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]'
          : 'bg-[rgba(255,84,112,0.13)] text-[var(--red)]'
      }`}
    >
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}
