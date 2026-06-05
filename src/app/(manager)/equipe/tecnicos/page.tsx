import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getCurrentUser, canManageTechnicians } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Técnicos' }
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toggleTechnicianAtivo } from './actions'

type TechnicianRow = {
  id: string
  nome_completo: string
  email: string
  cpf: string | null
  celular: string | null
  codigo_unetvale: string | null
  ativo: boolean
}

function maskCpf(cpf: string | null): string {
  if (!cpf) return '—'
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `${digits.slice(0, 3)}.***.***.${digits.slice(9)}`
}

export default async function TecnicosPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()
  const { data: technicians } = await supabase
    .from('technicians')
    .select('id, nome_completo, email, cpf, celular, codigo_unetvale, ativo')
    .eq('tenant_id', user.tenantId!)
    .order('nome_completo', { ascending: true })

  const canManage = canManageTechnicians(user)

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">Técnicos</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            {technicians?.length ?? 0} técnico{technicians?.length !== 1 ? 's' : ''} cadastrado
            {technicians?.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <Link href="/equipe/tecnicos/new">
            <Button size="sm">
              <Plus size={16} className="mr-2" />
              Novo Técnico
            </Button>
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-1)]">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--line)] hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Técnico
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                CPF
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Celular
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Cód. Unetvale
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Status
              </TableHead>
              {canManage && (
                <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                  Ações
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(technicians as TechnicianRow[] | null)?.map((t) => {
              const toggleAction = toggleTechnicianAtivo.bind(null, t.id, !t.ativo)
              return (
                <TableRow key={t.id} className="border-[var(--line)]">
                  <TableCell>
                    <p className="font-medium text-[var(--text)]">{t.nome_completo}</p>
                    <p className="text-xs text-[var(--text-3)]">{t.email}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--text-2)]">
                    {maskCpf(t.cpf)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--text-2)]">
                    {t.celular ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--text-2)]">
                    {t.codigo_unetvale ?? '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge ativo={t.ativo} />
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <form action={toggleAction}>
                        <button
                          type="submit"
                          className={`text-xs font-medium transition-colors ${
                            t.ativo
                              ? 'text-[var(--red)] hover:text-[var(--red)]/80'
                              : 'text-[var(--green)] hover:text-[var(--green)]/80'
                          }`}
                        >
                          {t.ativo ? 'Suspender' : 'Reativar'}
                        </button>
                      </form>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {!technicians?.length && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="py-8 text-center text-sm text-[var(--text-3)]"
                >
                  Nenhum técnico cadastrado ainda.{' '}
                  {canManage && (
                    <Link
                      href="/equipe/tecnicos/new"
                      className="text-[var(--cyan)] hover:underline"
                    >
                      Cadastrar o primeiro
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
