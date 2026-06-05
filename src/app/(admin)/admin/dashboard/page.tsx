import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Users, ArrowRight } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Dashboard Admin' }
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient()

  const [
    { count: activeTenantsCount },
    { count: totalTenantsCount },
    { count: totalUsersCount },
    { data: recentTenants },
  ] = await Promise.all([
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('ativo', true),
    supabase.from('tenants').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase
      .from('tenants')
      .select('id, slug, nome, plano, ativo, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">Visão geral da plataforma</p>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <KpiCard label="Tenants Ativos" value={activeTenantsCount ?? 0} icon={Building2} />
        <KpiCard label="Total de Tenants" value={totalTenantsCount ?? 0} icon={Building2} />
        <KpiCard label="Total de Usuários" value={totalUsersCount ?? 0} icon={Users} />
      </div>

      <Card className="border-[var(--line)] bg-[var(--bg-1)]">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="font-display text-base font-semibold text-[var(--text)]">
            Tenants
          </CardTitle>
          <Link href="/admin/tenants">
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--text-3)] hover:text-[var(--cyan)]"
            >
              Ver todos <ArrowRight size={14} className="ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTenants?.map((tenant) => (
                <TableRow key={tenant.id} className="border-[var(--line)]">
                  <TableCell>
                    <p className="font-medium text-[var(--text)]">{tenant.nome}</p>
                    <p className="font-mono text-xs text-[var(--text-3)]">{tenant.slug}</p>
                  </TableCell>
                  <TableCell className="text-sm text-[var(--text-2)]">{tenant.plano}</TableCell>
                  <TableCell>
                    <StatusBadge ativo={tenant.ativo} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--text-3)]">
                    {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
              {!recentTenants?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-[var(--text-3)]">
                    Nenhum tenant cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <Card className="relative overflow-hidden border-[var(--line)] bg-[var(--bg-1)]">
      <div className="absolute left-0 right-0 top-0 h-[2px] bg-grad opacity-70" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1.4px] text-[var(--text-3)]">
              {label}
            </p>
            <p className="mt-2 font-display text-3xl font-bold tracking-tight text-[var(--text)]">
              {value}
            </p>
          </div>
          <Icon size={20} className="text-[var(--text-3)]" />
        </div>
      </CardContent>
    </Card>
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
