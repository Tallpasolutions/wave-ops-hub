import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Usuários' }
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toggleUserAtivo, sendPasswordReset } from './actions'
import type { AppRole } from '@/lib/auth/types'

export const dynamic = 'force-dynamic'

type UserRow = {
  id: string
  email: string
  nome_completo: string
  role: string
  ativo: boolean
  ultimo_acesso: string | null
  tenants: { nome: string; slug: string } | null
}

export default async function UsersPage() {
  const supabase = await createSupabaseServerClient()
  const { data: users } = await supabase
    .from('users')
    .select('id, email, nome_completo, role, ativo, ultimo_acesso, tenants(nome, slug)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">Usuários</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            {users?.length ?? 0} usuário{users?.length !== 1 ? 's' : ''} cadastrado
            {users?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/admin/users/new">
          <Button size="sm">
            <Plus size={16} className="mr-2" />
            Novo Usuário
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] overflow-hidden">
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
                Tenant
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Status
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Último acesso
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users as UserRow[] | null)?.map((user) => {
              const toggleAction = toggleUserAtivo.bind(null, user.id, !user.ativo)
              const resetAction = sendPasswordReset.bind(null, user.email)
              return (
                <TableRow key={user.id} className="border-[var(--line)]">
                  <TableCell>
                    <p className="font-medium text-[var(--text)]">{user.nome_completo}</p>
                    <p className="text-xs text-[var(--text-3)]">{user.email}</p>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={user.role as AppRole} />
                  </TableCell>
                  <TableCell className="text-sm text-[var(--text-2)]">
                    {user.tenants ? (
                      <span>
                        {user.tenants.nome}
                        <span className="ml-1 font-mono text-xs text-[var(--text-3)]">
                          ({user.tenants.slug})
                        </span>
                      </span>
                    ) : (
                      <span className="text-[var(--text-3)]">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge ativo={user.ativo} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--text-3)]">
                    {user.ultimo_acesso
                      ? new Date(user.ultimo_acesso).toLocaleDateString('pt-BR')
                      : '—'}
                  </TableCell>
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
                            user.ativo
                              ? 'text-[var(--red)] hover:text-[var(--red)]/80'
                              : 'text-[var(--green)] hover:text-[var(--green)]/80'
                          }`}
                        >
                          {user.ativo ? 'Suspender' : 'Reativar'}
                        </button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {!users?.length && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-[var(--text-3)]">
                  Nenhum usuário cadastrado ainda.{' '}
                  <Link href="/admin/users/new" className="text-[var(--cyan)] hover:underline">
                    Criar o primeiro
                  </Link>
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
  const config: Record<AppRole, { label: string; className: string }> = {
    tallpa_owner: {
      label: 'Admin Tallpa',
      className: 'bg-[rgba(0,212,255,0.12)] text-[var(--cyan)]',
    },
    tenant_owner: {
      label: 'Proprietário',
      className: 'bg-[rgba(30,107,255,0.12)] text-[var(--blue)]',
    },
    tenant_manager: {
      label: 'Gerente',
      className: 'bg-white/5 text-[var(--text-2)]',
    },
    tenant_technician: {
      label: 'Técnico',
      className: 'bg-white/5 text-[var(--text-3)]',
    },
  }
  const { label, className } = config[role] ?? config.tenant_manager
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
