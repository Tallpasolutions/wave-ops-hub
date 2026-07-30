'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckSquare, Square, ThumbsUp, ThumbsDown, Undo2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { categoriaLabel, categoriaBadgeClass } from '@/lib/reasons/categoria'
import {
  approveImprodutiva,
  rejectImprodutiva,
  bulkApproveImprodutivas,
  bulkRejectImprodutivas,
  undoImprodutivaDecision,
} from '../actions'

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

const PENDENTE = 'pendente_classificacao'

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

type LastAction = { payoutId: string; osNum: number; kind: 'aprovada' | 'rejeitada' }

function RowActions({
  row,
  onDone,
}: {
  row: ImprodutivaRow
  onDone: (action: LastAction) => void
}) {
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingReject, setConfirmingReject] = useState(false)
  const [justificativa, setJustificativa] = useState('')

  const isPendente = row.categoria === PENDENTE

  function handleApprove() {
    setBusy(true)
    setError(null)
    startTransition(async () => {
      const res = await approveImprodutiva(row.id)
      setBusy(false)
      if (res.error) setError(res.error)
      else onDone({ payoutId: row.id, osNum: row.osNum, kind: 'aprovada' })
    })
  }

  function handleRejectConfirm() {
    setBusy(true)
    setError(null)
    startTransition(async () => {
      const res = await rejectImprodutiva(row.id, justificativa)
      setBusy(false)
      if (res.error) setError(res.error)
      else onDone({ payoutId: row.id, osNum: row.osNum, kind: 'rejeitada' })
    })
  }

  // Rejeitar é definitivo (payout vai a R$0) — exige confirmação explícita inline,
  // com justificativa opcional gravada em override_motivo (QA 02/07, item M6)
  if (confirmingReject) {
    return (
      <div className="flex items-center justify-end gap-2">
        <input
          type="text"
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          placeholder="Justificativa (opcional)"
          className="w-44 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 text-[11px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--red)]"
          disabled={busy}
        />
        <button
          onClick={handleRejectConfirm}
          disabled={busy}
          className="rounded-lg bg-[rgba(255,84,112,0.18)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--red)] transition-all hover:bg-[rgba(255,84,112,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Rejeitando…' : 'Confirmar R$ 0'}
        </button>
        <button
          onClick={() => {
            setConfirmingReject(false)
            setJustificativa('')
            setError(null)
          }}
          disabled={busy}
          className="rounded-lg px-2 py-1.5 text-[11px] text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          Cancelar
        </button>
        {error && <span className="text-[11px] text-[var(--red)]">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-[11px] text-[var(--red)]">{error}</span>}
      <button
        onClick={handleApprove}
        disabled={busy || isPendente}
        title={
          isPendente
            ? 'Classifique o motivo antes de aprovar'
            : 'Aprovar'
        }
        className="flex items-center gap-1 rounded-lg bg-[rgba(0,255,136,0.10)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--green)] transition-all hover:bg-[rgba(0,255,136,0.18)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ThumbsUp size={12} />
        {busy ? 'Aprovando…' : 'Aprovar'}
      </button>
      <button
        onClick={() => setConfirmingReject(true)}
        disabled={busy}
        title="Rejeitar (o pagamento vai a R$ 0 — pede confirmação)"
        className="flex items-center gap-1 rounded-lg bg-[rgba(255,84,112,0.10)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--red)] transition-all hover:bg-[rgba(255,84,112,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ThumbsDown size={12} />
        Rejeitar
      </button>
    </div>
  )
}

export function ImprodutivasTable({ rows }: { rows: ImprodutivaRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkPending, startBulkTransition] = useTransition()
  const [, startUndoTransition] = useTransition()
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkNotice, setBulkNotice] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<LastAction | null>(null)
  const [undoBusy, setUndoBusy] = useState(false)
  const [undoError, setUndoError] = useState<string | null>(null)
  const [confirmingBulkReject, setConfirmingBulkReject] = useState(false)

  const allIds = rows.map((r) => r.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0

  const selectedRows = rows.filter((r) => selected.has(r.id))
  const selectedAprovaveis = selectedRows.filter((r) => r.categoria !== PENDENTE)
  const selectedPendentes = selectedRows.length - selectedAprovaveis.length
  const totalAprovavel = selectedAprovaveis.reduce((sum, r) => sum + (r.valorCalculado ?? 0), 0)

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDone(action: LastAction) {
    setLastAction(action)
    setUndoError(null)
    router.refresh()
  }

  function handleUndo() {
    if (!lastAction) return
    setUndoBusy(true)
    setUndoError(null)
    startUndoTransition(async () => {
      const res = await undoImprodutivaDecision(lastAction.payoutId)
      setUndoBusy(false)
      if (res.error) setUndoError(res.error)
      else {
        setLastAction(null)
        router.refresh()
      }
    })
  }

  function handleBulkApprove() {
    setBulkError(null)
    setBulkNotice(null)
    startBulkTransition(async () => {
      const res = await bulkApproveImprodutivas(Array.from(selected))
      if (res.error) {
        setBulkError(res.error)
      } else {
        setSelected(new Set())
        setBulkNotice(
          `${res.approved} aprovada${res.approved !== 1 ? 's' : ''}` +
            (res.skippedPendentes > 0
              ? ` · ${res.skippedPendentes} ignorada${res.skippedPendentes !== 1 ? 's' : ''} (motivo pendente)`
              : ''),
        )
        router.refresh()
      }
    })
  }

  function handleBulkReject() {
    setBulkError(null)
    setBulkNotice(null)
    startBulkTransition(async () => {
      const res = await bulkRejectImprodutivas(Array.from(selected))
      if (res.error) {
        setBulkError(res.error)
      } else {
        setSelected(new Set())
        setConfirmingBulkReject(false)
        setBulkNotice(`${res.rejected} rejeitada${res.rejected !== 1 ? 's' : ''} (R$ 0)`)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      {lastAction && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-2.5">
          <span className="text-xs text-[var(--text-2)]">
            OS #{lastAction.osNum} {lastAction.kind}.
          </span>
          <button
            onClick={handleUndo}
            disabled={undoBusy}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Undo2 size={13} />
            {undoBusy ? 'Desfazendo…' : 'Desfazer'}
          </button>
          <button
            onClick={() => setLastAction(null)}
            className="text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
          >
            Dispensar
          </button>
          {undoError && <span className="text-xs text-[var(--red)]">{undoError}</span>}
        </div>
      )}

      {bulkNotice && !someSelected && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-2.5 text-xs text-[var(--green)]">
          {bulkNotice}
        </div>
      )}

      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-2.5">
          <span className="text-xs text-[var(--text-2)]">
            {selected.size} {selected.size === 1 ? 'selecionada' : 'selecionadas'} · aprovar{' '}
            {selectedAprovaveis.length} ({formatCurrency(totalAprovavel)})
            {selectedPendentes > 0 && (
              <span className="text-[var(--red)]">
                {' '}· {selectedPendentes} com motivo pendente {selectedPendentes === 1 ? 'será ignorada' : 'serão ignoradas'}
              </span>
            )}
          </span>
          <button
            onClick={handleBulkApprove}
            disabled={bulkPending || selectedAprovaveis.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[rgba(0,255,136,0.12)] px-3 py-1.5 text-xs font-semibold text-[var(--green)] transition-all hover:bg-[rgba(0,255,136,0.20)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare size={13} />
            {bulkPending
              ? 'Aprovando...'
              : selectedAprovaveis.length === 0
                ? 'Nada aprovável (classifique os motivos)'
                : 'Aprovar selecionadas'}
          </button>
          {confirmingBulkReject ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--red)]">
                Rejeitar {selected.size} → R$ 0?
              </span>
              <button
                onClick={handleBulkReject}
                disabled={bulkPending}
                className="rounded-lg bg-[rgba(255,84,112,0.18)] px-3 py-1.5 text-xs font-semibold text-[var(--red)] transition-all hover:bg-[rgba(255,84,112,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkPending ? 'Rejeitando…' : 'Confirmar'}
              </button>
              <button
                onClick={() => setConfirmingBulkReject(false)}
                disabled={bulkPending}
                className="text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingBulkReject(true)}
              disabled={bulkPending}
              className="flex items-center gap-1.5 rounded-lg bg-[rgba(255,84,112,0.10)] px-3 py-1.5 text-xs font-semibold text-[var(--red)] transition-all hover:bg-[rgba(255,84,112,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ThumbsDown size={13} />
              Rejeitar selecionadas
            </button>
          )}
          {bulkError && <span className="text-xs text-[var(--red)]">{bulkError}</span>}
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
                <td
                  className="w-10 cursor-pointer px-4 py-3"
                  onClick={() => toggleRow(row.id)}
                >
                  <Checkbox
                    checked={selected.has(row.id)}
                    className="pointer-events-none"
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
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${categoriaBadgeClass(
                      row.categoria,
                    )}`}
                  >
                    {categoriaLabel(row.categoria)}
                  </span>
                  {row.categoria === PENDENTE && (
                    <Link
                      href="/motivos?categoria=pendente_classificacao"
                      className="ml-2 text-[10px] text-[var(--cyan)] underline-offset-2 hover:underline"
                    >
                      Classificar →
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-[var(--text)]">
                  {formatCurrency(row.valorCalculado)}
                </td>
                <td className="px-4 py-3">
                  <RowActions row={row} onDone={handleDone} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
