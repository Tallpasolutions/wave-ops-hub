import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PAYOUT_STATUS, payoutStatusLabel } from '../payout-status'
import { campoLabel } from '../campos'

// Regressão de idioma: a interface da Wave é em português, sem termo técnico em inglês nem
// identificador de banco vazando. Já foi corrigido antes e voltou, porque cada tela tinha seu
// próprio mapa de rótulos com fallback silencioso. Este teste é a trava.

const APP = join(process.cwd(), 'src', 'app')

// Rotas de produto. `(dev)` fica de fora: é tela de diagnóstico local (CLAUDE.md §6).
const GRUPOS_DE_PRODUTO = ['(manager)', '(technician)', '(admin)', '(public)']

function arquivosTsx(dir: string): string[] {
  const out: string[] = []
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) {
      out.push(...arquivosTsx(caminho))
    } else if (nome.endsWith('.tsx') && !nome.includes('.test.')) {
      out.push(caminho)
    }
  }
  return out
}

function arquivosDeProduto(): string[] {
  return GRUPOS_DE_PRODUTO.flatMap((g) => {
    const dir = join(APP, g)
    try {
      return statSync(dir).isDirectory() ? arquivosTsx(dir) : []
    } catch {
      return []
    }
  })
}

// Só o que o usuário LÊ: texto entre tags e valores de props de rótulo. Evita casar nomes de
// variável, import, className e rota — que continuam em inglês por convenção da stack.
function textosVisiveis(conteudo: string): string[] {
  const textos: string[] = []
  for (const m of conteudo.matchAll(/>\s*([A-Za-zÀ-ÿ][^<>{}\n]{2,})\s*</g)) {
    // `Record<string, X>` e afins também produzem um par > … < — descarta o que é código.
    if (/\bas\b|=>|\(\s*\)|\w\(/.test(m[1])) continue
    textos.push(m[1])
  }
  for (const m of conteudo.matchAll(
    /\b(?:label|title|placeholder|heading|descricao|description)=["']([^"']+)["']/g,
  )) {
    textos.push(m[1])
  }
  return textos
}

// Termos que nunca devem aparecer para o usuário. "LPU" e "OS" ficam: são vocabulário da Wave.
const PROIBIDOS = [
  'payout',
  'override',
  'pending',
  'approved',
  'no_rule_match',
  'pending_review',
  'pending_classification',
  'pending_calculation',
  'closing',
  'batch',
  'rule match',
]

describe('interface em português', () => {
  const arquivos = arquivosDeProduto()

  it('encontra os arquivos de tela (guarda contra o teste virar no-op)', () => {
    expect(arquivos.length).toBeGreaterThan(20)
  })

  it('nenhum termo técnico em inglês em texto visível', () => {
    const achados: string[] = []
    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, 'utf8')
      for (const texto of textosVisiveis(conteudo)) {
        const t = texto.toLowerCase()
        for (const proibido of PROIBIDOS) {
          if (t.includes(proibido)) {
            achados.push(`${arquivo.replace(process.cwd() + '/', '')}: "${texto.trim()}"`)
          }
        }
      }
    }
    expect(achados).toEqual([])
  })

  it('nenhum bloco de código/JSON exposto nas telas de produto', () => {
    const achados = arquivos.filter((a) => {
      const c = readFileSync(a, 'utf8')
      // JSON.stringify em comparação (diff de auditoria) é lógica, não exibição.
      return /<pre[\s>]/.test(c) || /\{JSON\.stringify\([^)]*\)\}/.test(c)
    })
    expect(achados.map((a) => a.replace(process.cwd() + '/', ''))).toEqual([])
  })

  it('mapas de rótulo de status não são redeclarados nas telas', () => {
    const achados = arquivos.filter((a) => {
      const c = readFileSync(a, 'utf8')
      return /pending_review\s*:/.test(c) || /STATUS_LABELS\s*[:=]/.test(c)
    })
    expect(achados.map((a) => a.replace(process.cwd() + '/', ''))).toEqual([])
  })
})

describe('rótulos de status', () => {
  it('todo status do schema tem rótulo em português', () => {
    for (const [status, label] of Object.entries(PAYOUT_STATUS)) {
      expect(label.curto, status).toMatch(/^[A-ZÀ-Ý]/)
      expect(label.detalhado, status).toMatch(/^[A-ZÀ-Ý]/)
      expect(label.curto.toLowerCase(), status).not.toContain('override')
      expect(label.curto, status).not.toContain('_')
    }
  })

  it('status desconhecido não vaza o identificador técnico', () => {
    expect(payoutStatusLabel('algo_que_nao_existe').curto).toBe('Desconhecido')
  })

  it('override aparece como ajuste manual', () => {
    expect(PAYOUT_STATUS.override.curto).toBe('Ajuste manual')
  })
})

describe('rótulos de campo', () => {
  it('campo conhecido usa o rótulo da Wave', () => {
    expect(campoLabel('subterraneo_aereo')).toBe('Rede')
    expect(campoLabel('valor_recebido_unetvale')).toBe('Valor recebido')
  })

  it('campo novo é humanizado em vez de mostrar o nome da coluna', () => {
    expect(campoLabel('ponto_adicional_valor')).toBe('Ponto adicional valor')
    expect(campoLabel('qualquer_coisa_nova')).not.toContain('_')
  })
})
