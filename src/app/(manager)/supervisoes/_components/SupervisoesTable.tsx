import Link from 'next/link'
import { Camera } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { notaLabel, parecerLabel } from '@/lib/labels/supervisao'
import { StatusBadge } from './StatusBadge'

export type SupervisaoRow = {
  id: string
  status: string
  data_agendada: string
  nota: string | null
  parecer_final: string | null
  os_num_referencia: number | null
  cluster: string | null
  tecnico: string
  supervisor: string
  fotos: number
}

// "AAAA-MM-DD" → "19/09/2026". Sem `new Date(s)`: o construtor interpreta a string como UTC e
// volta um dia em America/Sao_Paulo.
function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function SupervisoesTable({ linhas }: { linhas: SupervisaoRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Data</TableHead>
            <TableHead>Técnico</TableHead>
            <TableHead>Supervisor</TableHead>
            <TableHead className="w-[110px]">Situação</TableHead>
            <TableHead className="w-[90px]">Nota</TableHead>
            <TableHead className="w-[130px]">Parecer</TableHead>
            <TableHead className="w-[70px] text-center">Fotos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((s) => (
            <TableRow key={s.id} className="cursor-pointer">
              <TableCell>
                <Link href={`/supervisoes/${s.id}`} className="block font-mono text-sm">
                  {dataBR(s.data_agendada)}
                </Link>
              </TableCell>

              <TableCell>
                <Link href={`/supervisoes/${s.id}`} className="block">
                  <span className="font-medium text-[var(--text)]">{s.tecnico}</span>
                  {(s.os_num_referencia || s.cluster) && (
                    <span className="block text-xs text-[var(--text-3)]">
                      {s.cluster}
                      {s.cluster && s.os_num_referencia ? ' · ' : ''}
                      {s.os_num_referencia ? `OS ${s.os_num_referencia}` : ''}
                    </span>
                  )}
                </Link>
              </TableCell>

              <TableCell className="text-sm text-[var(--text-2)]">{s.supervisor}</TableCell>

              <TableCell>
                <StatusBadge status={s.status} />
              </TableCell>

              <TableCell>
                {/* Nota nula é "sem item avaliável", não zero — mostrar 0 nos dois casos
                    apagaria a diferença. */}
                <span className="font-mono text-sm text-[var(--text)]">
                  {notaLabel(s.nota)}
                </span>
              </TableCell>

              <TableCell>
                {s.parecer_final ? (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${parecerLabel(s.parecer_final).cls}`}
                  >
                    {parecerLabel(s.parecer_final).curto}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--text-3)]">—</span>
                )}
              </TableCell>

              <TableCell className="text-center">
                {s.fotos > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--text-2)]">
                    <Camera size={12} />
                    {s.fotos}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--text-3)]">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
