import { describe, expect, it } from 'vitest'
import { calcularNota, isChecklistCompleto, type ItemAvaliado } from '../score'

// A decisão de domínio testada aqui (ADR-022): 'nao_se_aplica' fica FORA do numerador e do
// denominador, e denominador zero devolve `null`, não `0`. São coisas diferentes na tela:
// null = "não havia o que avaliar" (mostra "—"); 0 = "avaliado e reprovado em tudo".

const item = (resposta: ItemAvaliado['resposta'], peso = 1): ItemAvaliado => ({ peso, resposta })

describe('calcularNota', () => {
  it('todos conformes → 100', () => {
    const r = calcularNota(Array.from({ length: 5 }, () => item('conforme')))
    expect(r.nota).toBe(100)
    expect(r.conformes).toBe(5)
    expect(r.pesoAvaliado).toBe(5)
  })

  it('todos não conformes → 0, e NÃO null', () => {
    const r = calcularNota(Array.from({ length: 5 }, () => item('nao_conforme')))
    expect(r.nota).toBe(0)
    expect(r.naoConformes).toBe(5)
  })

  it('metade conforme → 50', () => {
    const r = calcularNota([
      item('conforme'),
      item('conforme'),
      item('nao_conforme'),
      item('nao_conforme'),
    ])
    expect(r.nota).toBe(50)
  })

  it('"não se aplica" sai dos dois lados: 1 conforme + 1 NA → 100', () => {
    const r = calcularNota([item('conforme'), item('nao_se_aplica')])
    expect(r.nota).toBe(100)
    expect(r.naoSeAplica).toBe(1)
    // O NA não engordou o denominador — se engordasse, a nota seria 50.
    expect(r.pesoAvaliado).toBe(1)
  })

  it('todos "não se aplica" → null (sem nota), nunca 0', () => {
    const r = calcularNota([item('nao_se_aplica'), item('nao_se_aplica')])
    expect(r.nota).toBeNull()
    expect(r.naoSeAplica).toBe(2)
    expect(r.pesoAvaliado).toBe(0)
  })

  it('lista vazia → null e contadores zerados', () => {
    const r = calcularNota([])
    expect(r).toEqual({
      nota: null,
      conformes: 0,
      naoConformes: 0,
      necessitamTroca: 0,
      naoSeAplica: 0,
      pendentes: 0,
      pesoAvaliado: 0,
    })
  })

  it('peso 3 conforme + peso 1 não conforme → 75', () => {
    const r = calcularNota([item('conforme', 3), item('nao_conforme', 1)])
    expect(r.nota).toBe(75)
    expect(r.pesoAvaliado).toBe(4)
  })

  it('pesos fracionários somam sem drift', () => {
    const r = calcularNota([item('conforme', 0.5), item('nao_conforme', 1.5)])
    expect(r.nota).toBe(25)
    expect(r.pesoAvaliado).toBe(2)
  })

  it('2 de 3 → 66.67 (arredonda em 2 casas, sem dízima)', () => {
    const r = calcularNota([item('conforme'), item('conforme'), item('nao_conforme')])
    expect(r.nota).toBe(66.67)
  })

  it('1 de 3 → 33.33', () => {
    const r = calcularNota([item('conforme'), item('nao_conforme'), item('nao_conforme')])
    expect(r.nota).toBe(33.33)
  })

  it('item pendente não entra no cálculo, mas é contado', () => {
    const r = calcularNota([item('conforme'), item(null)])
    expect(r.nota).toBe(100)
    expect(r.pendentes).toBe(1)
    expect(r.pesoAvaliado).toBe(1)
  })

  // 'necessita_troca' vem da ficha de EPI: equipamento existe, mas está gasto. É falha na
  // nota — o equipamento gasto não protege — e ao mesmo tempo precisa ser distinguível de
  // "não possui", que pede outra ação do gestor.
  it('"necessário trocar" conta como falha, igual a não conforme', () => {
    const comTroca = calcularNota([item('conforme'), item('necessita_troca')])
    const comNaoConforme = calcularNota([item('conforme'), item('nao_conforme')])
    expect(comTroca.nota).toBe(50)
    expect(comTroca.nota).toBe(comNaoConforme.nota)
    expect(comTroca.pesoAvaliado).toBe(2)
  })

  it('"necessário trocar" é contado à parte de "não conforme"', () => {
    const r = calcularNota([item('necessita_troca'), item('nao_conforme')])
    expect(r.necessitamTroca).toBe(1)
    expect(r.naoConformes).toBe(1)
    expect(r.nota).toBe(0)
  })

  it('só "necessário trocar" → nota 0, não null', () => {
    const r = calcularNota([item('necessita_troca'), item('necessita_troca')])
    expect(r.nota).toBe(0)
  })

  it('"necessário trocar" respeita o peso', () => {
    const r = calcularNota([item('conforme', 3), item('necessita_troca', 1)])
    expect(r.nota).toBe(75)
  })

  it('não muta a entrada', () => {
    const itens: ItemAvaliado[] = [item('conforme', 2), item('nao_conforme')]
    const antes = JSON.parse(JSON.stringify(itens))
    calcularNota(itens)
    expect(itens).toEqual(antes)
  })

  it('mistura completa: contadores batem com o total', () => {
    const itens = [
      item('conforme'),
      item('conforme'),
      item('nao_conforme'),
      item('necessita_troca'),
      item('nao_se_aplica'),
      item(null),
    ]
    const r = calcularNota(itens)
    expect(
      r.conformes + r.naoConformes + r.necessitamTroca + r.naoSeAplica + r.pendentes,
    ).toBe(itens.length)
    expect(r.nota).toBe(50) // 2 conformes de 4 avaliados
  })
})

describe('isChecklistCompleto', () => {
  it('com item pendente → false', () => {
    expect(isChecklistCompleto([item('conforme'), item(null)])).toBe(false)
  })

  it('sem pendente → true, e "não se aplica" conta como respondido', () => {
    expect(isChecklistCompleto([item('conforme'), item('nao_se_aplica')])).toBe(true)
  })

  it('lista vazia → true (vacuamente); agendar sem itens é barrado na action', () => {
    expect(isChecklistCompleto([])).toBe(true)
  })
})
