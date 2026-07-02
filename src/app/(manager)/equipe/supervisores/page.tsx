import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getCurrentUser, canManageUsers } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata: Metadata = { title: 'Supervisores' }
export const dynamic = 'force-dynamic'

export default async function SupervisoresPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()

  const { data: supervisors } = await supabase
    .from('users')
    .select('id, email, nome_completo, ativo, ultimo_acesso, technician_id')
    .eq('tenant_id', user.tenantId!)
    .eq('role', 'tenant_supervisor')
    .order('nome_completo')

  const supervisorIds = (supervisors ?? []).map((s) => s.id)
  const { data: teamCounts } = supervisorIds.length
    ? await supabase
        .from('supervisor_technicians')
        .select('supervisor_id')
        .in('supervisor_id', supervisorIds)
    : { data: [] }

  const countBySupervisor = (teamCounts ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.supervisor_id] = (acc[row.supervisor_id] ?? 0) + 1
    return acc
  }, {})

  const canCreate = canManageUsers(user)

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">Supervisores</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            {supervisors?.length ?? 0} supervisor{(supervisors?.length ?? 0) !== 1 ? 'es' : ''} cadastrado{(supervisors?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Link href="/equipe/supervisores/new">
            <Button size="sm">
              <Plus size={16} className="mr-2" />
              Novo Supervisor
            </Button>
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-1)]">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--line)] hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">Supervisor</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">Equipe</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">Status</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">Último acesso</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(supervisors ?? []).map((s) => (
              <TableRow key={s.id} className="border-[var(--line)]">
                <TableCell>
                  <p className="font-medium text-[var(--text)]">{s.nome_completo}</p>
                  <p className="text-xs text-[var(--text-3)]">{s.email}</p>
                </TableCell>
                <TableCell className="text-sm text-[var(--text-2)]">
                  {countBySupervisor[s.id] ?? 0} técnico{(countBySupervisor[s.id] ?? 0) !== 1 ? 's' : ''}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      s.ativo
                        ? 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]'
                        : 'bg-[rgba(255,84,112,0.13)] text-[var(--red)]'
                    }`}
                  >
                    {s.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs text-[var(--text-3)]">
                  {s.ultimo_acesso
                    ? new Date(s.ultimo_acesso).toLocaleDateString('pt-BR')
                    : '—'}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/equipe/supervisores/${s.id}`}
                    className="text-xs text-[var(--cyan)] transition-colors hover:text-[var(--cyan)]/80"
                  >
                    Gerenciar
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {!(supervisors?.length) && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-[var(--text-3)]">
                  Nenhum supervisor cadastrado.{' '}
                  {canCreate && (
                    <Link href="/equipe/supervisores/new" className="text-[var(--cyan)] hover:underline">
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
