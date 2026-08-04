import { describe, expect, it } from 'vitest'
import { isAlteracaoGarantia, payoutMudou } from '../alteracoes'

// Textos reais colhidos em produção em 03/08/2026 (service_visits_audit do tenant Wave).
// As 4 alterações por garantia e as outras duas famílias, que precisam ser REJEITADAS —
// ficaram fora do escopo por decisão da Wave.
const GARANTIA_572737 =
  '21/07/2026 17:04 - Pagamento alterado devido a abertura da OS de garantia'
const GARANTIA_571722 =
  '23/07/2026 12:38 - Pagamento alterado devido a abertura da OS de garantia'
const OUTRO_TECNICO =
  '23/07/2026 15:46 - Pagamento zerado devido o técnico WAVE - Douglas Ribeiro ter realizado o fechamento desta OS'
const IMPRODUTIVA_INVALIDADA = 'Visita improdutiva invalidada'

describe('isAlteracaoGarantia — casos reais de produção', () => {
  it('OS 572737: 64,46 → 3,96 com o texto da Unetvale', () => {
    expect(isAlteracaoGarantia(GARANTIA_572737, 64.46, 3.96)).toBe(true)
  })

  it('OS 571722: 206,26 → 145,76', () => {
    expect(isAlteracaoGarantia(GARANTIA_571722, 206.26, 145.76)).toBe(true)
  })

  it('OS 573851 e 574908: 232,04 → 171,54', () => {
    expect(isAlteracaoGarantia(GARANTIA_571722, 232.04, 171.54)).toBe(true)
  })

  it('as quatro reduzem exatamente R$ 60,50 — a assinatura numérica', () => {
    const pares: [number, number][] = [
      [64.46, 3.96],
      [206.26, 145.76],
      [232.04, 171.54],
      [232.04, 171.54],
    ]
    for (const [antes, depois] of pares) {
      expect(Math.round((depois - antes) * 100)).toBe(-6050)
    }
  })
})

describe('isAlteracaoGarantia — o que NÃO pode entrar', () => {
  it('"outro técnico fechou a OS" é fora do escopo (ADR-020 já trata)', () => {
    expect(isAlteracaoGarantia(OUTRO_TECNICO, 64.46, 0)).toBe(false)
  })

  it('improdutiva invalidada é fora do escopo', () => {
    expect(isAlteracaoGarantia(IMPRODUTIVA_INVALIDADA, 15.98, 0)).toBe(false)
  })

  it('receita igual não é alteração, mesmo com o texto de garantia', () => {
    expect(isAlteracaoGarantia(GARANTIA_572737, 64.46, 64.46)).toBe(false)
  })

  it('receita desconhecida (null) não conta — mesma convenção do motor de payout', () => {
    expect(isAlteracaoGarantia(GARANTIA_572737, null, 3.96)).toBe(false)
    expect(isAlteracaoGarantia(GARANTIA_572737, 64.46, null)).toBe(false)
  })

  it('sem observação e sem a assinatura → não registra', () => {
    expect(isAlteracaoGarantia(null, 100, 80)).toBe(false)
    expect(isAlteracaoGarantia('', 100, 80)).toBe(false)
  })
})

describe('isAlteracaoGarantia — travas contra falha silenciosa', () => {
  // Se a Unetvale mudar a redação, o texto para de casar. A assinatura de −R$ 60,50 segura.
  it('redação nova, sem o texto conhecido, mas com a redução de R$ 60,50 → registra', () => {
    expect(isAlteracaoGarantia('Valor revisto: OS de garantia aberta', 206.26, 145.76)).toBe(true)
    expect(isAlteracaoGarantia(null, 206.26, 145.76)).toBe(true)
  })

  it('texto conhecido com redução diferente de 60,50 também registra', () => {
    expect(isAlteracaoGarantia(GARANTIA_572737, 300, 100)).toBe(true)
  })

  it('acento e caixa não atrapalham o casamento do texto', () => {
    expect(isAlteracaoGarantia('PAGAMENTO ALTERADO DEVIDO A ABERTURA DA OS DE GARANTIA', 100, 80)).toBe(true)
    expect(isAlteracaoGarantia('pagamento alterado devido à abertura da ÓS de garantia', 100, 80)).toBe(true)
  })
})

// Só o técnico cujos PONTOS mudaram é notificado — receita da Unetvale ele não vê.
describe('payoutMudou', () => {
  const base = {
    visitId: 'v1',
    osNum: 1,
    technicianId: 't1',
    receitaAnterior: 206.26,
    receitaNova: 145.76,
  }

  it('mesmo valor → não notifica (foi o caso dos 4 históricos)', () => {
    expect(payoutMudou({ ...base, payoutAnterior: 100, payoutNovo: 100 })).toBe(false)
  })

  it('valor diferente → notifica', () => {
    expect(payoutMudou({ ...base, payoutAnterior: 100, payoutNovo: 30 })).toBe(true)
  })

  it('centavos são comparados sem drift de float', () => {
    expect(payoutMudou({ ...base, payoutAnterior: 0.1 + 0.2, payoutNovo: 0.3 })).toBe(false)
  })

  it('sair de "sem payout" para um valor conta como mudança', () => {
    expect(payoutMudou({ ...base, payoutAnterior: null, payoutNovo: 30 })).toBe(true)
    expect(payoutMudou({ ...base, payoutAnterior: null, payoutNovo: null })).toBe(false)
  })

  // Registro retroativo do backfill da 0041: nunca passou por finalizarAlteracoes, então
  // payout_novo é nulo. Isso é "não avaliado" — tratar como mudança dava alarme falso ao técnico.
  it('payout_novo nulo é "não avaliado", não mudança', () => {
    expect(payoutMudou({ ...base, payoutAnterior: 100, payoutNovo: null })).toBe(false)
  })
})
