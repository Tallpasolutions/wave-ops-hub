import { describe, expect, it } from 'vitest'
import { hasMojibake, repairMojibake } from '../encoding'

// Corpus real: strings observadas em produção no QA de 02/07/2026 e seus originais.
// A cadeia provada é Latin-1/CP1252 decodificado como Mac Roman.
const CORPUS: Array<[mojibake: string, original: string]> = [
  ['InstalaÁ„o - Fibra - PF', 'Instalação - Fibra - PF'],
  ['MudanÁa EndereÁo Fibra', 'Mudança Endereço Fibra'],
  ['Suporte CondomÌnio', 'Suporte Condomínio'],
  ['ManutenÁ„o Infra', 'Manutenção Infra'],
  ['N„o - Sem Tempo', 'Não - Sem Tempo'],
  ['N„o - EndereÁo n„o encontrado', 'Não - Endereço não encontrado'],
  ['N„o - Fibra rompida - Sou tÈcnico de rede interna.', 'Não - Fibra rompida - Sou técnico de rede interna.'],
  ['N„o - Cliente n„o quis o atendimento pois sua conex„o est· ok', 'Não - Cliente não quis o atendimento pois sua conexão está ok'],
  ['N„o - Em LigaÁ„o Com O Cliente quer reagendar', 'Não - Em Ligação Com O Cliente quer reagendar'],
]

describe('repairMojibake', () => {
  it.each(CORPUS)('repara %s', (mojibake, original) => {
    expect(repairMojibake(mojibake)).toBe(original)
  })

  it('não toca texto limpo sem indicador', () => {
    expect(repairMojibake('Suporte Fibra')).toBe('Suporte Fibra')
    expect(repairMojibake('Retirada')).toBe('Retirada')
    expect(repairMojibake('WAVE - Eduardo Ribeiro de Souza')).toBe('WAVE - Eduardo Ribeiro de Souza')
  })

  it('não toca PT legítimo com acento (sem indicador de mojibake)', () => {
    expect(repairMojibake('Água potável')).toBe('Água potável')
    expect(repairMojibake('José da Silva')).toBe('José da Silva')
    expect(repairMojibake('Instalação - Fibra - PF')).toBe('Instalação - Fibra - PF')
  })

  it('devolve a original se o reparo produziria caracteres de controle', () => {
    // 'è' minúsculo é byte 0x8F em Mac Roman → controle em Latin-1: irreparável
    const lowered = 'n„o - sou tècnico'
    expect(repairMojibake(lowered)).toBe(lowered)
  })

  it('devolve a original se houver char fora da tabela Mac Roman', () => {
    const weird = 'n„o - teste 中'
    expect(repairMojibake(weird)).toBe(weird)
  })
})

describe('hasMojibake', () => {
  it('detecta os indicadores do corpus', () => {
    for (const [mojibake] of CORPUS) expect(hasMojibake(mojibake)).toBe(true)
  })

  it('não dispara em texto limpo', () => {
    expect(hasMojibake('Instalação - Fibra - PF')).toBe(false)
    expect(hasMojibake('Época de chuva')).toBe(false)
  })
})
