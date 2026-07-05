import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC_DIR = resolve(__dirname, '../../..')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name === '.next') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const FILES = walk(SRC_DIR)

// Regressão das Sprints 10/11/14: `technicians` NÃO tem coluna `nome` — é `nome_completo`.
// PostgREST falha em silêncio com coluna errada (data: null sem erro), derrubando telas
// inteiras (404 no detalhe de pagamento, fechamento zerado, /visitas/[id] quebrado).
// A versão antiga deste teste procurava a string exata `technicians(nome)` e por isso deixou
// passar `technicians(id, nome)`, `.from('technicians').select('id, nome')` e `.order('nome')`
// — 7 arquivos que só apareceram no QA de 04/07. Este teste cobre embed E query direta.
// `\bnome\b` não casa dentro de `nome_completo`/`nome_normalizado` (o `_` é caractere de palavra).
// Ver docs/qa/2026-07-02-relatorio-qa-producao.md e regras-de-execucao.md (R2.2, R3.1).
describe('convenções de schema: technicians usa nome_completo, nunca nome', () => {
  it('nenhuma referência a `nome` (bare) em queries de technicians', () => {
    const violations: string[] = []

    for (const file of FILES) {
      const lines = readFileSync(file, 'utf-8').split('\n')
      const rel = file.slice(SRC_DIR.length + 1)

      lines.forEach((line, i) => {
        // 1. Embed PostgREST: technicians( ... nome ... )
        if (/technicians\([^)]*\bnome\b/.test(line)) {
          violations.push(`${rel}:${i + 1}: ${line.trim()}`)
        }
      })

      // 2. Query direta: .from('technicians') seguida de .select/.order('...nome...')
      lines.forEach((line, i) => {
        if (!/\.from\((['"])technicians\1\)/.test(line)) return
        for (let j = i; j < Math.min(i + 10, lines.length); j++) {
          if (j > i && /\.from\(/.test(lines[j])) break // outra query começou
          if (/\.(select|order)\((['"])[^)]*\bnome\b[^)]*\2\)/.test(lines[j])) {
            violations.push(`${rel}:${j + 1}: ${lines[j].trim()}`)
          }
        }
      })
    }

    expect(
      violations,
      `technicians.nome inválido (a coluna é nome_completo):\n${violations.join('\n')}`,
    ).toEqual([])
  })

  // Convenção mista verificada em 0001_initial_schema.sql:
  // service_visits.tecnico_id (linha 205) × payouts.technician_id (linha 346)
  it('não troca tecnico_id/technician_id entre service_visits e payouts', () => {
    const violations: string[] = []
    for (const file of FILES) {
      const text = readFileSync(file, 'utf-8')
      const rel = file.slice(SRC_DIR.length + 1)
      if (text.includes('service_visits(technician_id') || text.includes('payouts(tecnico_id')) {
        violations.push(rel)
      }
    }
    expect(violations, `Troca de tecnico_id/technician_id:\n${violations.join('\n')}`).toEqual([])
  })
})
