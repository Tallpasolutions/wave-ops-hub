'use client'
import { useActionState, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { updateLpuRule, deactivateLpuRule, duplicateLpuRule } from '../../../../../actions'
import type { LpuRuleNarrowed } from '@/lib/lpu'

// ── Types ────────────────────────────────────────────────────────────────────

const VALID_CONDITION_KEYS = [
  'finalidade',
  'tipoAtendimento',
  'sucesso',
  'cidade',
  'condominio',
  'dropUsado',
  'faixaDrop',
  'conectoresUsados',
  'garantia',
  'subterraneaAereo',
  'valorRecebidoUnetvale',
  'tecnicoId',
] as const

type ConditionKey = (typeof VALID_CONDITION_KEYS)[number]
type FieldType = 'text' | 'select' | 'boolean' | 'number' | 'range' | 'technician'

const FIELD_CONFIG: Record<ConditionKey, { type: FieldType; options?: string[]; label: string }> = {
  finalidade: { type: 'text', label: 'Finalidade' },
  tipoAtendimento: { type: 'select', options: ['Externo', 'Interno'], label: 'Tipo de Atendimento' },
  sucesso: { type: 'text', label: 'Sucesso' },
  cidade: { type: 'text', label: 'Cidade' },
  condominio: { type: 'boolean', label: 'Condomínio' },
  dropUsado: { type: 'range', label: 'Drop Usado (m)' },
  faixaDrop: { type: 'text', label: 'Faixa Drop' },
  conectoresUsados: { type: 'number', label: 'Conectores Usados' },
  garantia: { type: 'boolean', label: 'Garantia' },
  subterraneaAereo: { type: 'text', label: 'Subterrânea/Aéreo' },
  valorRecebidoUnetvale: { type: 'range', label: 'Valor Recebido Unetvale (R$)' },
  tecnicoId: { type: 'technician', label: 'Técnico' },
}

type ConditionRow = {
  id: string
  fieldKey: ConditionKey
  textValue: string
  boolValue: string
  rangeMin: string
  rangeMax: string
}

type PayoutState =
  | { type: 'fixed'; value: string }
  | { type: 'formula'; base: string; field: string; ratePerUnit: string }
  | { type: 'percentage_of_revenue'; percentage: string }

// ── Helpers ──────────────────────────────────────────────────────────────────

function newRow(fieldKey: ConditionKey = 'finalidade'): ConditionRow {
  return { id: Math.random().toString(36).slice(2), fieldKey, textValue: '', boolValue: 'true', rangeMin: '', rangeMax: '' }
}

function buildConditions(rows: ConditionRow[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const row of rows) {
    const config = FIELD_CONFIG[row.fieldKey]
    if (config.type === 'boolean') {
      result[row.fieldKey] = row.boolValue === 'true'
    } else if (config.type === 'number') {
      if (row.textValue) result[row.fieldKey] = Number(row.textValue)
    } else if (config.type === 'range') {
      const r: { min?: number; max?: number } = {}
      if (row.rangeMin) r.min = Number(row.rangeMin)
      if (row.rangeMax) r.max = Number(row.rangeMax)
      if (Object.keys(r).length) result[row.fieldKey] = r
    } else {
      if (row.textValue) result[row.fieldKey] = row.textValue
    }
  }
  return result
}

function buildPayout(p: PayoutState): Record<string, unknown> {
  if (p.type === 'fixed') return { type: 'fixed', value: Number(p.value) || 0 }
  if (p.type === 'formula') {
    return {
      type: 'formula',
      base: Number(p.base) || 0,
      additional: { field: p.field || 'dropUsado', ratePerUnit: Number(p.ratePerUnit) || 0 },
    }
  }
  return { type: 'percentage_of_revenue', percentage: Number(p.percentage) || 0 }
}

function conditionsToRows(conditions: Record<string, unknown>): ConditionRow[] {
  const entries = Object.entries(conditions)
  if (entries.length === 0) return [newRow()]
  return entries.map(([key, value]) => {
    const fieldKey = key as ConditionKey
    const config = FIELD_CONFIG[fieldKey]
    const row: ConditionRow = { id: Math.random().toString(36).slice(2), fieldKey, textValue: '', boolValue: 'true', rangeMin: '', rangeMax: '' }
    if (!config) return row
    if (config.type === 'boolean') {
      row.boolValue = String(value)
    } else if (config.type === 'range' && typeof value === 'object' && value !== null) {
      const r = value as { min?: number; max?: number }
      row.rangeMin = r.min !== undefined ? String(r.min) : ''
      row.rangeMax = r.max !== undefined ? String(r.max) : ''
    } else {
      row.textValue = String(value ?? '')
    }
    return row
  })
}

function payoutToState(payout: Record<string, unknown>): PayoutState {
  if (payout.type === 'fixed') return { type: 'fixed', value: String(payout.value ?? '') }
  if (payout.type === 'formula') {
    const additional = payout.additional as { field: string; ratePerUnit: number } | undefined
    return {
      type: 'formula',
      base: String(payout.base ?? ''),
      field: additional?.field ?? 'dropUsado',
      ratePerUnit: String(additional?.ratePerUnit ?? ''),
    }
  }
  return { type: 'percentage_of_revenue', percentage: String((payout as { percentage?: number }).percentage ?? '') }
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  rule: LpuRuleNarrowed
  lpuId: string
  lpuNome: string
  technicians?: { id: string; nome_completo: string }[]
}

export function EditRuleForm({ rule, lpuId, lpuNome, technicians = [] }: Props) {
  const boundAction = updateLpuRule.bind(null, rule.id, lpuId)
  const [state, formAction, isPending] = useActionState(boundAction, { error: null as string | null })

  const [rows, setRows] = useState<ConditionRow[]>(() =>
    conditionsToRows(rule.conditions as Record<string, unknown>),
  )
  const [payout, setPayout] = useState<PayoutState>(() =>
    payoutToState(rule.payout as Record<string, unknown>),
  )
  const [manualPriority, setManualPriority] = useState(true)
  const [priorityValue, setPriorityValue] = useState(String(rule.prioridade))

  const conditionsJson = JSON.stringify(buildConditions(rows))
  const payoutJson = JSON.stringify(buildPayout(payout))

  function updateRow(id: string, patch: Partial<ConditionRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <Link
          href={`/lpu/${lpuId}`}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          {lpuNome}
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--text)]">Editar Regra</h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">{rule.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <form action={duplicateLpuRule.bind(null, rule.id, lpuId)}>
              <button
                type="submit"
                className="text-xs font-medium text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
              >
                Duplicar
              </button>
            </form>
            {rule.ativa && (
              <form action={deactivateLpuRule.bind(null, rule.id, lpuId)}>
                <button
                  type="submit"
                  className="rounded-lg border border-[rgba(255,84,112,0.3)] px-3 py-1.5 text-xs font-medium text-[var(--red)] transition-colors hover:bg-[rgba(255,84,112,0.08)]"
                >
                  Desativar regra
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <form action={formAction} className="flex max-w-2xl flex-col gap-6">
        <input type="hidden" name="conditions" value={conditionsJson} />
        <input type="hidden" name="payout" value={payoutJson} />

        {/* Conditions */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Condições
          </p>

          <div className="flex flex-col gap-3">
            {rows.map((row) => {
              const config = FIELD_CONFIG[row.fieldKey]
              return (
                <div key={row.id} className="flex items-start gap-2">
                  <select
                    value={row.fieldKey}
                    onChange={(e) =>
                      updateRow(row.id, {
                        fieldKey: e.target.value as ConditionKey,
                        textValue: '',
                        boolValue: 'true',
                        rangeMin: '',
                        rangeMax: '',
                      })
                    }
                    className="h-9 flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--cyan)]"
                  >
                    {VALID_CONDITION_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {FIELD_CONFIG[k].label}
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-1 items-center gap-1">
                    {config.type === 'text' && (
                      <Input
                        value={row.textValue}
                        onChange={(e) => updateRow(row.id, { textValue: e.target.value })}
                        placeholder="Valor exato..."
                        className="h-9 text-xs"
                      />
                    )}
                    {config.type === 'number' && (
                      <Input
                        type="number"
                        value={row.textValue}
                        onChange={(e) => updateRow(row.id, { textValue: e.target.value })}
                        placeholder="0"
                        className="h-9 text-xs"
                      />
                    )}
                    {config.type === 'select' && (
                      <select
                        value={row.textValue}
                        onChange={(e) => updateRow(row.id, { textValue: e.target.value })}
                        className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--cyan)]"
                      >
                        {config.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                    {config.type === 'boolean' && (
                      <select
                        value={row.boolValue}
                        onChange={(e) => updateRow(row.id, { boolValue: e.target.value })}
                        className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--cyan)]"
                      >
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    )}
                    {config.type === 'technician' && (
                      <select
                        value={row.textValue}
                        onChange={(e) => updateRow(row.id, { textValue: e.target.value })}
                        className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--cyan)]"
                      >
                        <option value="">Selecione um técnico</option>
                        {technicians.map((t) => (
                          <option key={t.id} value={t.id}>{t.nome_completo}</option>
                        ))}
                      </select>
                    )}
                    {config.type === 'range' && (
                      <>
                        <Input
                          type="number"
                          value={row.rangeMin}
                          onChange={(e) => updateRow(row.id, { rangeMin: e.target.value })}
                          placeholder="Mín"
                          className="h-9 text-xs"
                        />
                        <span className="shrink-0 text-xs text-[var(--text-3)]">–</span>
                        <Input
                          type="number"
                          value={row.rangeMax}
                          onChange={(e) => updateRow(row.id, { rangeMax: e.target.value })}
                          placeholder="Máx"
                          className="h-9 text-xs"
                        />
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                    disabled={rows.length === 1}
                    className="mt-1.5 shrink-0 text-[var(--text-3)] transition-colors hover:text-[var(--red)] disabled:opacity-30"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, newRow()])}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--cyan)] transition-colors hover:text-[var(--cyan)]/80"
          >
            <Plus size={12} />
            Adicionar condição
          </button>
        </section>

        {/* Payout */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Payout
          </p>

          <div className="mb-4 flex gap-2">
            {(['fixed', 'formula', 'percentage_of_revenue'] as const).map((t) => {
              const labels = {
                fixed: 'Valor fixo',
                formula: 'Fórmula',
                percentage_of_revenue: '% da receita',
              }
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    if (t === 'fixed') setPayout({ type: 'fixed', value: '' })
                    else if (t === 'formula')
                      setPayout({ type: 'formula', base: '', field: 'dropUsado', ratePerUnit: '' })
                    else setPayout({ type: 'percentage_of_revenue', percentage: '' })
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    payout.type === t
                      ? 'border-[var(--cyan)] bg-[rgba(30,230,220,0.08)] text-[var(--cyan)]'
                      : 'border-[var(--line)] text-[var(--text-3)] hover:border-[var(--text-3)]'
                  }`}
                >
                  {labels[t]}
                </button>
              )
            })}
          </div>

          {payout.type === 'fixed' && (
            <div className="flex flex-col gap-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
                Valor (R$) <span className="text-[var(--red)]">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={payout.value}
                onChange={(e) => setPayout({ type: 'fixed', value: e.target.value })}
                placeholder="80.00"
              />
            </div>
          )}

          {payout.type === 'formula' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
                  Base (R$) <span className="text-[var(--red)]">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payout.base}
                  onChange={(e) => setPayout({ ...payout, base: e.target.value })}
                  placeholder="50.00"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
                    Campo adicional
                  </Label>
                  <select
                    value={payout.field}
                    onChange={(e) => setPayout({ ...payout, field: e.target.value })}
                    className="h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--cyan)]"
                  >
                    <option value="dropUsado">Drop Usado (m)</option>
                    <option value="conectoresUsados">Conectores Usados</option>
                    <option value="valorRecebidoUnetvale">Valor Recebido Unetvale</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
                    Taxa por unidade
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payout.ratePerUnit}
                    onChange={(e) => setPayout({ ...payout, ratePerUnit: e.target.value })}
                    placeholder="0.30"
                  />
                </div>
              </div>
              <p className="text-xs text-[var(--text-3)]">
                Fórmula: Base + ({payout.field || 'campo'} × taxa)
              </p>
            </div>
          )}

          {payout.type === 'percentage_of_revenue' && (
            <div className="flex flex-col gap-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
                Percentual (%) <span className="text-[var(--red)]">*</span>
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={payout.percentage}
                onChange={(e) =>
                  setPayout({ type: 'percentage_of_revenue', percentage: e.target.value })
                }
                placeholder="60"
              />
              <p className="text-xs text-[var(--text-3)]">
                Do valor recebido pela Wave da Unetvale
              </p>
            </div>
          )}
        </section>

        {/* Config */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Configurações
          </p>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="description"
                className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
              >
                Descrição <span className="text-[var(--red)]">*</span>
              </Label>
              <Input
                id="description"
                name="description"
                type="text"
                defaultValue={rule.description}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
                Prioridade
              </Label>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={!manualPriority}
                    onChange={() => setManualPriority(false)}
                    className="accent-[var(--cyan)]"
                  />
                  <span className="text-sm text-[var(--text)]">
                    Automática (nº de condições × 100)
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={manualPriority}
                    onChange={() => setManualPriority(true)}
                    className="accent-[var(--cyan)]"
                  />
                  <span className="text-sm text-[var(--text)]">Manual</span>
                </label>
              </div>
              {manualPriority ? (
                <Input
                  name="prioridade"
                  type="number"
                  min="1"
                  value={priorityValue}
                  onChange={(e) => setPriorityValue(e.target.value)}
                  placeholder="Ex: 300"
                />
              ) : (
                <input type="hidden" name="prioridade" value="" />
              )}
            </div>
          </div>
        </section>

        {state.error && (
          <p className="rounded-lg bg-[rgba(255,84,112,0.1)] px-3 py-2.5 text-sm text-[var(--red)]">
            {state.error}
          </p>
        )}

        {state.success && (
          <p className="rounded-lg bg-[rgba(46,230,168,0.1)] px-3 py-2.5 text-sm text-[var(--green)]">
            Regra atualizada com sucesso.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? 'Salvando…' : 'Salvar Alterações'}
          </Button>
          <Link href={`/lpu/${lpuId}`}>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
