import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadRecalcContext } from '../recalculate-batch'

// Regressão do vazamento entre tabelas de preço (03/08/2026): as classificações próprias de uma
// LPU alternativa carregam o MESMO tenant_id das do tenant. Sem o filtro `lpu_id IS NULL`, elas
// caíam no mapa do tenant e sobrescreviam a chave (o `new Map` mantém a última linha), fazendo
// a tabela padrão pagar o valor da SEM AUXILIAR: cabeamento R$ 30 em vez de R$ 44 e homologação
// R$ 30 em vez de R$ 35 — para técnicos que nem estavam na LPU alternativa.
//
// O mock aplica os filtros de verdade sobre linhas em memória, então o teste falha se o filtro
// sumir do código, e não apenas se a chamada mudar de forma.

const TENANT = 'tenant-1'
const LPU_PADRAO = 'lpu-padrao'
const LPU_ALT = 'lpu-alt'
const TECH_ALT = 'tech-na-alternativa'

type Row = Record<string, unknown>

type Filter = { op: 'eq' | 'is' | 'not-is-null'; col: string; val?: unknown }

interface Builder extends PromiseLike<{ data: Row[] | null; error: null }> {
  select: (...args: unknown[]) => Builder
  eq: (col: string, val: unknown) => Builder
  is: (col: string, val: unknown) => Builder
  not: (col: string, op: string, val: unknown) => Builder
  maybeSingle: () => Promise<{ data: Row | null; error: null }>
  single: () => Promise<{ data: Row | null; error: null }>
}

function makeSupabase(tables: Record<string, Row[]>): SupabaseClient {
  const from = (table: string): Builder => {
    const filters: Filter[] = []
    const rows = () =>
      (tables[table] ?? []).filter((r) =>
        filters.every((f) => {
          if (f.op === 'eq') return r[f.col] === f.val
          if (f.op === 'is') return r[f.col] === f.val
          return r[f.col] != null
        }),
      )

    const b: Builder = {
      select: () => b,
      eq: (col, val) => {
        filters.push({ op: 'eq', col, val })
        return b
      },
      is: (col, val) => {
        filters.push({ op: 'is', col, val })
        return b
      },
      not: (col) => {
        filters.push({ op: 'not-is-null', col })
        return b
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      single: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve) => Promise.resolve({ data: rows(), error: null }).then(resolve),
    }
    return b
  }

  return { from } as unknown as SupabaseClient
}

function fixture(): Record<string, Row[]> {
  return {
    lpus: [
      {
        id: LPU_PADRAO,
        tenant_id: TENANT,
        ativa: true,
        ponto_adicional_valor: null,
        improdutiva_valor: null,
        feriado_acrescimo_pct: null,
      },
      {
        id: LPU_ALT,
        tenant_id: TENANT,
        ativa: false,
        ponto_adicional_valor: 30,
        improdutiva_valor: 10,
        feriado_acrescimo_pct: 10,
      },
    ],
    lpu_rules: [],
    technicians: [{ id: TECH_ALT, tenant_id: TENANT, lpu_id: LPU_ALT }],
    reasons: [],
    cabeamento_classifications: [
      { tenant_id: TENANT, lpu_id: null, explicacao_key: 'Cabeamento', valor: 44 },
      { tenant_id: TENANT, lpu_id: null, explicacao_key: 'Cabeamento fibra aérea', valor: 120 },
      // linhas da LPU alternativa — mesmo tenant_id, é isso que causava o vazamento
      { tenant_id: TENANT, lpu_id: LPU_ALT, explicacao_key: 'Cabeamento', valor: 30 },
    ],
    homologacao_classifications: [
      { tenant_id: TENANT, lpu_id: null, valor_unetvale: 64.46, valor_repasse: 35 },
      { tenant_id: TENANT, lpu_id: LPU_ALT, valor_unetvale: 64.46, valor_repasse: 30 },
    ],
    tenants: [
      {
        id: TENANT,
        config: {
          finalidades_classificar_explicacao: ['Cabeamento/Segundo Ponto'],
          homologacao_por_explicacao: true,
          feriados: [],
          feriado_acrescimo_pct: 15,
        },
      },
    ],
  }
}

describe('loadRecalcContext — escopo das classificações (ADR-019)', () => {
  it('o mapa do tenant NÃO recebe as classificações da LPU alternativa', async () => {
    const ctx = await loadRecalcContext(TENANT, makeSupabase(fixture()))
    expect(ctx.classifications.get('Cabeamento')).toBe(44)
    expect(ctx.classifications.size).toBe(2)
  })

  it('o repasse de homologação do tenant NÃO recebe o da LPU alternativa', async () => {
    const ctx = await loadRecalcContext(TENANT, makeSupabase(fixture()))
    expect(ctx.homologacao?.valores.get(6446)).toBe(35)
    expect(ctx.homologacao?.valores.size).toBe(1)
  })

  it('a LPU alternativa continua carregando os próprios valores, por técnico', async () => {
    const ctx = await loadRecalcContext(TENANT, makeSupabase(fixture()))
    const alt = ctx.lpuByTecnico.get(TECH_ALT)
    expect(alt?.lpuId).toBe(LPU_ALT)
    expect(alt?.classifications.get('Cabeamento')).toBe(30)
    expect(alt?.homologacao?.valores.get(6446)).toBe(30)
    expect(alt?.valores.pontoAdicional).toBe(30)
  })
})
