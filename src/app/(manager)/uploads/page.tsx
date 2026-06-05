import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Uploads' }
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { UploadStatus } from '@/db/schema'

export const dynamic = 'force-dynamic'

type UploadRow = {
  id: string
  file_name: string
  status: UploadStatus
  periodo_inicio: string | null
  periodo_fim: string | null
  total_linhas: number
  inseridas: number
  erros: number
  uploaded_at: string
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function StatusBadge({ status }: { status: UploadStatus }) {
  const config: Record<UploadStatus, { label: string; className: string }> = {
    pending: {
      label: 'Pendente',
      className: 'bg-[rgba(255,184,0,0.12)] text-[#ffb800]',
    },
    processing: {
      label: 'Processando',
      className: 'bg-[rgba(30,107,255,0.12)] text-[var(--blue)]',
    },
    success: {
      label: 'Concluído',
      className: 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]',
    },
    failed: {
      label: 'Erro',
      className: 'bg-[rgba(255,84,112,0.13)] text-[var(--red)]',
    },
    duplicate: {
      label: 'Duplicado',
      className: 'bg-white/5 text-[var(--text-3)]',
    },
  }
  const { label, className } = config[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  )
}

export default async function UploadsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()
  const { data: uploads } = await supabase
    .from('uploads')
    .select('id, file_name, status, periodo_inicio, periodo_fim, total_linhas, inseridas, erros, uploaded_at')
    .eq('tenant_id', user.tenantId!)
    .order('uploaded_at', { ascending: false })

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">Uploads</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            Histórico de planilhas enviadas
          </p>
        </div>
        <Link href="/uploads/new">
          <Button size="sm">
            <Plus size={16} className="mr-2" />
            Novo Upload
          </Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-1)]">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--line)] hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Arquivo
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Período
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Status
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Linhas / Ins / Erros
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                Data
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(uploads as UploadRow[] | null)?.map((u) => (
              <TableRow
                key={u.id}
                className="cursor-pointer border-[var(--line)] transition-colors hover:bg-white/3"
              >
                <TableCell>
                  <Link href={`/uploads/${u.id}`} className="block">
                    <p className="font-medium text-[var(--text)]">{u.file_name}</p>
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-[var(--text-2)]">
                  <Link href={`/uploads/${u.id}`} className="block">
                    {u.periodo_inicio
                      ? `${formatDate(u.periodo_inicio)} – ${formatDate(u.periodo_fim)}`
                      : '—'}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/uploads/${u.id}`} className="block">
                    <StatusBadge status={u.status as UploadStatus} />
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-[var(--text-2)]">
                  <Link href={`/uploads/${u.id}`} className="block">
                    {u.total_linhas} / {u.inseridas} / {u.erros}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-[var(--text-3)]">
                  <Link href={`/uploads/${u.id}`} className="block">
                    {formatDate(u.uploaded_at)}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {!uploads?.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-[var(--text-3)]">
                  Nenhum upload ainda.{' '}
                  <Link href="/uploads/new" className="text-[var(--cyan)] hover:underline">
                    Envie a primeira planilha
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
