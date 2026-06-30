'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare, Square, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { approveImprodutiva, rejectImprodutiva, bulkApproveImprodutivas } from '../actions'

export type ImprodutivaRow = {
  id: string
  osNum: number
  dataExecucao: string
  tecnicoId: string | null
  tecnicoNome: string | null
  motivo: string
  categoria: string
  valorCalculado: number | null
}

const CATEGORIA_LABELS: Record<string, string> = {
  falha_tecnico: 'Falha Técnico',
  falha_cliente: 'Falha Cliente',
  forca_maior: 'Força Maior',
  falha_sistema: 'Falha Sistema',
  pendente_classificacao: 'Pendente',
}

const CATEGORIA_CLASSES: Record<string, string> = {
  falha_tecnico: 'bg-[rgba(255,184,0,0.12)] text-[#ffb800]',
  falha_cliente: 'bg-[rgba(30,107,255,0.12)] text-[var(--blue)]',
  forca_maior: 'bg-[rgba(160,100,255,0.12)] text-[#a064ff]',
  falha_sistema: 'bg-[rgba(255,200,0,0.10)] text-[#ffc800]',
  pendente_classificacao: 'bg-[rgba(255,84,112,0.13)] text-[var(--red)]',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatCurrency(value: number | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

type ActionState = 'idle' | 'loading' | 'error'

function RowActions({ rowId, onDone }: { rowId: string; onDone: () => void }) {
  const [, startTransition] = useTransition()
  const [approveState, setApproveState] = useState<ActionState>('idle')
  const [rejectState, setRejectState] = useState<ActionState>('idle')

  function handleApprove() {
    setApproveState('loading')
    startTransition(async () => {
      const res = await approveImprodutiva(rowId)
      if (res.error) {
        setApproveState('error')
      } else {
        setApproveState('idle')
        onDone()
      }
    })
  }

  function handleReject() {
    setRejectState('loading')
    startTransition(async () => {
      const res = await rejectImprodutiva(rowId)
      if (res.error) {
        setRejectState('error')
      } else {
        setRejectState('idle')
        onDone()
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={handleApprove}
        disabled={approveState === 'loading' || rejectState === 'loading'}
        title={approveState === 'error' ? 'Erro ao aprovar. Tente novamente.' : 'Aprovar'}
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
          approveState === 'error'
            ? 'bg-[rgba(255,84,112,0.15)] text-[var(--red)]'
            : 'bg-[rgba(0,255,136,0.10)] text-[var(--green)] hover:bg-[rgba(0,255,136,0.18)]'
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <ThumbsUp size={12} />
        {approveState === 'loading' ? 'Aprovando...' : 'Aprovar'}
      </button>
      <button
        onClick={handleReject}
        disabled={approveState === 'loading' || rejectState === 'loading'}
        title={rejectState === 'error' ? 'Erro ao rejeitar. Tente novamente.' : 'Rejeitar (R$0)'}
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
          rejectState === 'error'
            ? 'bg-[rgba(255,184,0,0.15)] text-[#ffb800]'
            : 'bg-[rgba(255,84,112,0.10)] text-[var(--red)] hover:bg-[rgba(255,84,112,0.18)]'
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <ThumbsDown size={12} />
        {rejectState === 'loading' ? 'Rejeitando...' : 'Rejeitar'}
      </button>
    </div>
  )
}

export function ImprodutivasTable({ rows }: { rows: ImprodutivaRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkPending, startBulkTransition] = useTransition()
  const [bulkError, setBulkError] = useState<string | null>(null)

  const allIds = rows.map((r) => r.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleBulkApprove() {
    setBulkError(null)
    startBulkTransition(async () => {
      const res = await bulkApproveImprodutivas(Array.from(selected))
      if (res.error) {
        setBulkError(res.error)
      } else {
        setSelected(new Set())
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      {someSelected && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-2.5">
          <span className="text-xs text-[var(--text-2)]">
            {selected.size} {selected.size === 1 ? 'selecionada' : 'selecionadas'}
          </span>
          <button
            onClick={handleBulkApprove}
            disabled={bulkPending}
            className="flex items-center gap-1.5 rounded-lg bg-[rgba(0,255,136,0.12)] px-3 py-1.5 text-xs font-semibold text-[var(--green)] transition-all hover:bg-[rgba(0,255,136,0.20)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare size={13} />
            {bulkPending ? 'Aprovando...' : 'Aprovar selecionadas'}
          </button>
          {bulkError && (
            <span className="text-xs text-[var(--red)]">{bulkError}</span>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--line)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--bg-1)]">
              <th className="w-10 px-4 py-3 text-left">
                <button
                  onClick={toggleAll}
                  className="text-[var(--text-3)] hover:text-[var(--text)]"
                  title={allSelected ? 'Desmarcar todas' : 'Marcar todas'}
                >
                  {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                OS#
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                Técnico
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                Data
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                Motivo
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                Categoria
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                Valor
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="bg-[var(--bg)]">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-[var(--line)] last:border-0 transition-colors hover:bg-white/[0.02] ${
                  selected.has(row.id) ? 'bg-white/[0.03]' : ''
                }`}
              >
                <td className="w-10 px-4 py-3">
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={() => toggleRow(row.id)}
                    aria-label={`Selecionar OS ${row.osNum}`}
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--text)]">
                  #{row.osNum}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-2)]">
                  {row.tecnicoNome ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-2)]">
                  {formatDate(row.dataExecucao)}
                </td>
                <td className="max-w-[200px] px-4 py-3">
                  <span className="block truncate text-xs text-[var(--text)]" title={row.motivo}>
                    {row.motivo}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      CATEGORIA_CLASSES[row.categoria] ?? 'bg-white/5 text-[var(--text-3)]'
                    }`}
                  >
                    {CATEGORIA_LABELS[row.categoria] ?? row.categoria}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-[var(--text)]">
                  {formatCurrency(row.valorCalculado)}
                </td>
                <td className="px-4 py-3">
                  <RowActions rowId={row.id} onDone={() => router.refresh()} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
