'use client'
import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getVisitsByReason } from '../actions'
import type { VisitByReasonRow } from '../actions'

type Props = {
  reasonId: string
  reasonLabel: string
}

function formatBRL(value: number | null): string {
  if (value === null || isNaN(value)) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Aguardando',
  pending: 'Pendente',
  approved: 'Aprovado',
  paid: 'Pago',
  override: 'Override',
  no_rule_match: 'Sem regra',
  pending_classification: 'Motivo pendente',
  conflict: 'Conflito',
}

export function OsListSheet({ reasonId, reasonLabel }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [visits, setVisits] = useState<VisitByReasonRow[]>([])
  const [period, setPeriod] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const data = await getVisitsByReason(reasonId, period || undefined)
      setVisits(data)
    })
  }, [reasonId, period])

  function handleClose() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('sheet')
    const qs = params.toString()
    router.push(qs ? `/motivos?${qs}` : '/motivos')
  }

  return (
    <Sheet open onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-full overflow-y-auto border-[var(--line)] bg-[var(--bg-1)] sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-[var(--text)]">{reasonLabel}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 mb-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)]"
          />
        </div>

        {isPending ? (
          <p className="text-sm text-[var(--text-3)]">Carregando...</p>
        ) : visits.length === 0 ? (
          <p className="text-sm text-[var(--text-3)]">
            Nenhuma visita encontrada para este motivo{period ? ' no período selecionado' : ''}.
          </p>
        ) : (
          <div className="space-y-2">
            {visits.map((v) => (
              <Link
                key={v.id}
                href={`/visitas/${v.id}`}
                className="block rounded-lg border border-[var(--line)] px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-[var(--text)]">
                    OS {v.osNum}
                  </span>
                  <span className="text-xs text-[var(--text-3)]">
                    {new Date(v.dataExecucao).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-[var(--text-2)]">
                    {v.tecnicoNome ?? 'Sem técnico'}
                  </span>
                  <span className="text-xs text-[var(--text-2)]">
                    {v.payoutStatus ? STATUS_LABELS[v.payoutStatus] ?? v.payoutStatus : '—'} ·{' '}
                    {formatBRL(v.valorCalculado)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
