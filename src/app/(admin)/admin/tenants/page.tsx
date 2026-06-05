import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Tenants' }
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toggleTenantAtivo } from './actions'

export const dynamic = 'force-dynamic'

export default async function TenantsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, nome, plano, ativo, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">Tenants</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            {tenants?.length ?? 0} tenant{tenants?.length !== 1 ? 's' : ''} cadastrado
            {tenants?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/admin/tenants/new">
          <Button size="sm">
            <Plus size={16} className="mr-2" />
            Novo Tenant
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--line)] hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Tenant
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Plano
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Status
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Criado em
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants?.map((tenant) => {
              const toggleAction = toggleTenantAtivo.bind(null, tenant.id, !tenant.ativo)
              return (
                <TableRow key={tenant.id} className="border-[var(--line)]">
                  <TableCell>
                    <p className="font-medium text-[var(--text)]">{tenant.nome}</p>
                    <p className="font-mono text-xs text-[var(--text-3)]">{tenant.slug}</p>
                  </TableCell>
                  <TableCell>
                    <PlanoBadge plano={tenant.plano} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge ativo={tenant.ativo} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--text-3)]">
                    {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <form action={toggleAction}>
                      <button
                        type="submit"
                        className={`text-xs font-medium transition-colors ${
                          tenant.ativo
                            ? 'text-[var(--red)] hover:text-[var(--red)]/80'
                            : 'text-[var(--green)] hover:text-[var(--green)]/80'
                        }`}
                      >
                        {tenant.ativo ? 'Suspender' : 'Reativar'}
                      </button>
                    </form>
                  </TableCell>
                </TableRow>
              )
            })}
            {!tenants?.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-[var(--text-3)]">
                  Nenhum tenant cadastrado ainda.{' '}
                  <Link href="/admin/tenants/new" className="text-[var(--cyan)] hover:underline">
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

function PlanoBadge({ plano }: { plano: string }) {
  const styles: Record<string, string> = {
    starter: 'bg-white/5 text-[var(--text-3)]',
    standard: 'bg-[rgba(0,212,255,0.12)] text-[var(--cyan)]',
    premium: 'bg-[var(--grad-soft)] text-[var(--cyan)]',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[plano] ?? 'bg-white/5 text-[var(--text-3)]'}`}
    >
      {plano}
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
