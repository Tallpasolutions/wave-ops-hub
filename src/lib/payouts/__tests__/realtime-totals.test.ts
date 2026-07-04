import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeRealtimeClosingTotals } from '../realtime-totals'

// Mock fluente: qualquer método intermediário devolve o próprio proxy e o
// encadeamento é "thenable", resolvendo {data, error} quando aguardado (é o que
// fetchAllPages faz após .range()).
function makePayoutsMock(rows: unknown[]) {
  const proxy: Record<string, unknown> = {}
  const chain = vi.fn().mockReturnValue(proxy)
  proxy.select = chain
  proxy.eq = chain
  proxy.gte = chain
  proxy.lt = chain
  proxy.order = chain
  proxy.range = chain
  proxy.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve)
  return proxy
}

function makeSupabase(rows: unknown[]) {
  return { from: vi.fn().mockReturnValue(makePayoutsMock(rows)) } as unknown as SupabaseClient
}

describe('computeRealtimeClosingTotals', () => {
  it('soma valor efetivo (override tem prioridade) e conta todas as visitas', async () => {
    const supabase = makeSupabase([
      { status: 'pending', valor_calculado: '100.00', valor_override: null },
      { status: 'approved', valor_calculado: '50.00', valor_override: '80.00' },
      { status: 'paid', valor_calculado: '20.00', valor_override: null },
    ])

    const totals = await computeRealtimeClosingTotals(supabase, 'tenant-1', '2026-05')

    // 100 + 80 (override) + 20 = 200
    expect(totals.totalAPagar).toBe(200)
    expect(totals.totalVisitas).toBe(3)
  })

  it('exclui status bloqueantes do total mas os conta em visitas', async () => {
    const supabase = makeSupabase([
      { status: 'pending', valor_calculado: '100.00', valor_override: null },
      { status: 'no_rule_match', valor_calculado: null, valor_override: null },
      { status: 'pending_classification', valor_calculado: null, valor_override: null },
      { status: 'conflict', valor_calculado: null, valor_override: null },
    ])

    const totals = await computeRealtimeClosingTotals(supabase, 'tenant-1', '2026-05')

    expect(totals.totalAPagar).toBe(100)
    expect(totals.totalVisitas).toBe(4)
  })

  it('retorna zerado quando não há payouts no período', async () => {
    const supabase = makeSupabase([])
    const totals = await computeRealtimeClosingTotals(supabase, 'tenant-1', '2026-05')
    expect(totals).toEqual({ totalAPagar: 0, totalVisitas: 0 })
  })
})
