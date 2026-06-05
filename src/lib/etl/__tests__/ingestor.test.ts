import { describe, it, expect, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { run } from '../ingestor'
import type { SupabaseClient } from '@supabase/supabase-js'

type SheetRow = Record<string, unknown>

function makeXlsxBuffer(rows: SheetRow[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer)
}

const BASE_ROW: SheetRow = {
  Data: '2026-04-01',
  Inicio: '2026-04-01',
  OS: 12345,
  Finalidade: 'Instalação',
  'Tipo de atendimento': 'Externo',
  Cidade: 'São Paulo',
  Sucesso: 'Sim',
  Valor: 120,
  Técnico: 'WAVE - João Silva',
}

// Creates a fluent mock that resolves to `resolveValue` at any point in the chain.
// Every method returns the same proxy so chaining is infinitely deep without explicit wiring.
function makeFluentMock(resolveValue: unknown) {
  const proxy: Record<string, unknown> = {}
  const chainFn = vi.fn().mockReturnValue(proxy)
  const terminalFn = vi.fn().mockResolvedValue(resolveValue)

  proxy.select = chainFn
  proxy.eq = chainFn
  proxy.is = chainFn
  proxy.gte = chainFn
  proxy.lte = chainFn
  proxy.update = chainFn
  proxy.insert = chainFn
  proxy.upsert = chainFn
  proxy.single = terminalFn
  proxy.maybeSingle = terminalFn

  // Also thenable (for awaited chains without .single()/.maybeSingle())
  proxy.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveValue).then(resolve)

  return proxy
}

// Builds a from() mock that dispatches per table.
function makeMockFrom({
  technicians = [] as unknown[],
  reasons = [] as unknown[],
  existingVisits = [] as unknown[],
  newReasonData = null as unknown,
} = {}) {
  return vi.fn().mockImplementation((table: string) => {
    switch (table) {
      case 'technicians':
        return makeFluentMock({ data: technicians, error: null })
      case 'reasons':
        if (newReasonData) {
          return makeReasonsWithInsert(reasons, newReasonData)
        }
        return makeFluentMock({ data: reasons, error: null })
      case 'service_visits':
        return makeServiceVisitsMock(existingVisits)
      case 'uploads':
        return makeFluentMock({ data: null, error: null })
      default:
        return makeFluentMock({ data: null, error: null })
    }
  })
}

// service_visits mock for the batch-select + insert/update pattern.
// The ingestor loads all visits for the period via .select().eq().gte().lte()
// (awaited directly, no .single()), then does batched .insert() and .update().eq().
function makeServiceVisitsMock(existingVisits: unknown[]) {
  const mock: Record<string, unknown> = {}

  // All chaining methods return mock so .select().eq().gte().lte() chains freely.
  const chainFn = vi.fn().mockReturnValue(mock)
  mock.select = chainFn
  mock.eq = chainFn
  mock.is = chainFn
  mock.gte = chainFn
  mock.lte = chainFn

  // Thenable: the batch SELECT resolves to { data: existingVisits, error: null }.
  mock.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: existingVisits, error: null }).then(resolve)

  // update chain: .update(data).eq(id) resolves cleanly.
  const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
  mock.update = vi.fn().mockReturnValue({ eq: updateEq })

  // insert is thenable.
  mock.insert = vi.fn().mockReturnValue({
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
  })

  return mock
}

function makeReasonsWithInsert(existingReasons: unknown[], newReasonData: unknown) {
  const mock: Record<string, unknown> = {}

  // select chain for loading existing reasons
  const selectChain = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: existingReasons, error: null }).then(resolve),
    eq: vi.fn(),
  }
  selectChain.eq.mockReturnValue(selectChain)

  // insert chain for auto-creating new reason
  const single = vi.fn().mockResolvedValue({ data: newReasonData, error: null })
  const insertSelect = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })

  mock.select = vi.fn().mockReturnValue(selectChain)
  mock.insert = insert

  return mock
}

describe('ingestor.run', () => {
  it('retorna success com 1 linha inserida', async () => {
    const buf = makeXlsxBuffer([BASE_ROW])
    const supabase = { from: makeMockFrom() } as unknown as SupabaseClient
    const result = await run('upload-1', buf, 'tenant-1', 'user-1', supabase)

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.counts.inseridas).toBe(1)
      expect(result.counts.atualizadas).toBe(0)
      expect(result.counts.ignoradas).toBe(0)
    }
  })

  it('atualiza linha quando content_hash diferente', async () => {
    const buf = makeXlsxBuffer([BASE_ROW])
    // The existing visit must have all fields used by visitKey so the key matches the row.
    const supabase = {
      from: makeMockFrom({
        existingVisits: [
          {
            id: 'v-1',
            content_hash: 'old-hash',
            os_num: 12345,
            data_execucao: '2026-04-01T00:00:00.000Z',
            tecnico_id: null,
            tecnico_raw: 'WAVE - João Silva',
          },
        ],
      }),
    } as unknown as SupabaseClient
    const result = await run('upload-1', buf, 'tenant-1', 'user-1', supabase)

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.counts.atualizadas).toBe(1)
    }
  })

  it('técnico sem match → warnings.unmatchedTechnicians preenchido', async () => {
    const buf = makeXlsxBuffer([BASE_ROW])
    const supabase = { from: makeMockFrom({ technicians: [] }) } as unknown as SupabaseClient
    const result = await run('upload-1', buf, 'tenant-1', 'user-1', supabase)

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.warnings.unmatchedTechnicians).toContain('WAVE - João Silva')
    }
  })

  it('motivo novo → auto-criado e warnings.newReasons preenchido', async () => {
    const rowWithFailure = { ...BASE_ROW, Sucesso: 'Não - Motivo Novo' }
    const buf = makeXlsxBuffer([rowWithFailure])
    const supabase = {
      from: makeMockFrom({
        reasons: [],
        newReasonData: { id: 'new-r', motivo_original: 'Não - Motivo Novo' },
      }),
    } as unknown as SupabaseClient
    const result = await run('upload-1', buf, 'tenant-1', 'user-1', supabase)

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.warnings.newReasons).toContain('Não - Motivo Novo')
    }
  })

  it('retorna failed quando planilha está vazia', async () => {
    const ws = XLSX.utils.json_to_sheet([])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer)

    const supabase = {
      from: makeMockFrom(),
    } as unknown as SupabaseClient

    await expect(run('upload-1', buf, 'tenant-1', 'user-1', supabase)).resolves.toMatchObject({ status: 'failed' })
  })
})
