import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Trava de isolamento do módulo de Supervisão de Campo (ADR-022).
//
// Estas duas regras são a razão de o módulo poder existir sem risco para o que já roda, e
// nenhuma delas é visível olhando um arquivo por vez. Eram itens de DoD verificados por grep
// à mão — o que falhou na primeira tentativa, acusando os próprios comentários que explicavam
// a regra. Aqui a verificação ignora comentários e roda em toda alteração.

const RAIZ = process.cwd()

const PASTAS_DO_MODULO = [
  join(RAIZ, 'src', 'lib', 'supervisao'),
  join(RAIZ, 'src', 'app', '(manager)', 'supervisoes'),
  join(RAIZ, 'src', 'app', '(technician)', 'minhas-supervisoes'),
]

function arquivosDe(dir: string): string[] {
  const out: string[] = []
  let entradas: string[]
  try {
    entradas = readdirSync(dir)
  } catch {
    return out
  }
  for (const nome of entradas) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) {
      if (nome === '__tests__') continue
      out.push(...arquivosDe(caminho))
    } else if (/\.tsx?$/.test(nome)) {
      out.push(caminho)
    }
  }
  return out
}

// Sem comentários: a regra é sobre o que o código FAZ, não sobre o que ele explica.
function codigoSemComentarios(conteudo: string): string {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const ARQUIVOS = PASTAS_DO_MODULO.flatMap(arquivosDe)

describe('isolamento do módulo de supervisão', () => {
  it('encontra os arquivos do módulo (guarda contra o teste virar no-op)', () => {
    expect(ARQUIVOS.length).toBeGreaterThan(10)
  })

  // O técnico supervisionado não vê a supervisão dele nem é avisado dela. `notifications` é
  // tabela compartilhada — é o único acoplamento do módulo com o que já existe, e portanto o
  // único caminho pelo qual ele poderia vazar para o técnico.
  it('nunca chama notifyTechnician', () => {
    const achados: string[] = []
    for (const arquivo of ARQUIVOS) {
      const codigo = codigoSemComentarios(readFileSync(arquivo, 'utf8'))
      if (/\bnotifyTechnician\s*\(/.test(codigo)) {
        achados.push(arquivo.replace(RAIZ + '/', ''))
      }
    }
    expect(achados).toEqual([])
  })

  // O isolamento é ESTRUTURAL: como o módulo nunca escreve nessas tabelas,
  // consolidar_service_order() nunca é invocada e nenhum dos ~50 pontos que consultam OSs e
  // visitas precisa mudar. Escrever numa delas destruiria essa garantia de uma vez.
  it('nunca escreve em service_visits, service_orders ou payouts', () => {
    const achados: string[] = []
    const escrita = /\.from\(\s*['"](service_visits|service_orders|payouts)['"]\s*\)\s*\.\s*(insert|update|upsert|delete)\b/
    for (const arquivo of ARQUIVOS) {
      const codigo = codigoSemComentarios(readFileSync(arquivo, 'utf8'))
      if (escrita.test(codigo)) achados.push(arquivo.replace(RAIZ + '/', ''))
    }
    expect(achados).toEqual([])
  })

  // Mesmo LER essas tabelas é sinal de que o módulo começou a depender do cálculo. Não é
  // proibido em si, mas tem que ser decisão consciente — e hoje não há nenhuma.
  it('não consulta as tabelas do cálculo', () => {
    const achados: string[] = []
    const leitura = /\.from\(\s*['"](service_visits|service_orders|payouts)['"]\s*\)/
    for (const arquivo of ARQUIVOS) {
      const codigo = codigoSemComentarios(readFileSync(arquivo, 'utf8'))
      if (leitura.test(codigo)) achados.push(arquivo.replace(RAIZ + '/', ''))
    }
    expect(achados).toEqual([])
  })

  // guard.ts é 'server-only' e o barrel também é importado por Client Component: reexportá-lo
  // quebraria o build com um erro que não aponta para a causa.
  it('o barrel não reexporta o guard, que é server-only', () => {
    const barrel = readFileSync(join(RAIZ, 'src', 'lib', 'supervisao', 'index.ts'), 'utf8')
    expect(codigoSemComentarios(barrel)).not.toMatch(/from\s+['"]\.\/guard['"]/)
  })
})
