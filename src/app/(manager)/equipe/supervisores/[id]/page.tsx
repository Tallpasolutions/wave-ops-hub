import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser, canManageUsers } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { addTechnicianToSupervisor, removeTechnicianFromSupervisor } from '../actions'

export const metadata: Metadata = { title: 'Gerenciar Supervisor' }
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function SupervisorDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const [{ data: supervisor }, { data: team }, { data: allTechnicians }] = await Promise.all([
    supabase
      .from('users')
      .select('id, nome_completo, email, ativo, technician_id')
      .eq('id', id)
      .eq('tenant_id', user.tenantId!)
      .eq('role', 'tenant_supervisor')
      .single(),
    supabase
      .from('supervisor_technicians')
      .select('technician_id, technicians(id, nome)')
      .eq('supervisor_id', id),
    supabase
      .from('technicians')
      .select('id, nome')
      .eq('tenant_id', user.tenantId!)
      .eq('ativo', true)
      .order('nome'),
  ])

  if (!supervisor) notFound()

  const teamIds = new Set((team ?? []).map((t) => t.technician_id))
  const available = (allTechnicians ?? []).filter(
    (t) => !teamIds.has(t.id) && t.id !== supervisor.technician_id,
  )
  const canManage = canManageUsers(user)

  async function addToTeam(fd: FormData) {
    'use server'
    const techId = fd.get('technicianId') as string
    if (techId) await addTechnicianToSupervisor(id, techId)
  }

  return (
    <div className="p-4 lg:p-8">
      <Link
        href="/equipe/supervisores"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft size={14} />
        Supervisores
      </Link>

      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">{supervisor.nome_completo}</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">{supervisor.email}</p>
      </div>

      <div className="flex max-w-2xl flex-col gap-8">
        <section>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Equipe supervisionada ({team?.length ?? 0} técnico{(team?.length ?? 1) !== 1 ? 's' : ''})
          </p>

          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-1)]">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--line)] hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">Técnico</TableHead>
                  {canManage && (
                    <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]"></TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(team ?? []).map((row) => {
                  const tech = (Array.isArray(row.technicians) ? row.technicians[0] : row.technicians) as { id: string; nome: string } | null
                  if (!tech) return null
                  const removeAction = removeTechnicianFromSupervisor.bind(null, id, tech.id)
                  return (
                    <TableRow key={tech.id} className="border-[var(--line)]">
                      <TableCell className="text-sm text-[var(--text)]">{tech.nome}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <form action={removeAction}>
                            <button
                              type="submit"
                              className="text-xs text-[var(--red)] transition-colors hover:text-[var(--red)]/80"
                            >
                              Remover
                            </button>
                          </form>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
                {!(team?.length) && (
                  <TableRow>
                    <TableCell
                      colSpan={canManage ? 2 : 1}
                      className="py-6 text-center text-sm text-[var(--text-3)]"
                    >
                      Nenhum técnico na equipe ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {canManage && available.length > 0 && (
          <section>
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Adicionar técnico à equipe
            </p>
            <form action={addToTeam} className="flex items-center gap-3">
              <select
                name="technicianId"
                required
                className="h-10 flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--cyan)]"
              >
                <option value="">Selecione um técnico</option>
                {available.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
              <Button type="submit" size="sm">Adicionar</Button>
            </form>
          </section>
        )}
      </div>
    </div>
  )
}
