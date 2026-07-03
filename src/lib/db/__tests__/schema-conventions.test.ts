import { describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

const SRC_DIR = resolve(__dirname, '../../..')

function grepSrc(pattern: string): string[] {
  try {
    const out = execSync(`grep -rn --include='*.ts' --include='*.tsx' "${pattern}" .`, {
      cwd: SRC_DIR,
      encoding: 'utf-8',
    })
    return out.split('\n').filter(Boolean)
  } catch {
    // grep exits 1 when there are no matches
    return []
  }
}

// Regressão da Sprint 10/11: `technicians` não tem coluna `nome` (é `nome_completo`).
// PostgREST falha em silêncio com coluna errada — a query retorna null sem erro,
// derrubando telas inteiras (404 no detalhe de pagamento, fechamento zerado).
// Ver docs/qa/2026-07-02-relatorio-qa-producao.md e regras-de-execucao.md (R2.2, R3.1).
describe('convenções de schema em queries PostgREST', () => {
  it('não referencia technicians(nome) — a coluna é nome_completo', () => {
    const matches = grepSrc('technicians(nome)').filter(
      (line) => !line.includes('nome_completo') && !line.includes('__tests__'),
    )
    expect(matches, `Ocorrências proibidas:\n${matches.join('\n')}`).toEqual([])
  })

  // Convenção mista verificada em 0001_initial_schema.sql:
  // service_visits.tecnico_id (linha 205) × payouts.technician_id (linha 346)
  it('não troca tecnico_id/technician_id entre service_visits e payouts', () => {
    const wrongVisits = grepSrc('service_visits(technician_id')
    const wrongPayouts = grepSrc('payouts(tecnico_id')
    const matches = [...wrongVisits, ...wrongPayouts].filter(
      (line) => !line.includes('__tests__'),
    )
    expect(matches, `Ocorrências proibidas:\n${matches.join('\n')}`).toEqual([])
  })
})
