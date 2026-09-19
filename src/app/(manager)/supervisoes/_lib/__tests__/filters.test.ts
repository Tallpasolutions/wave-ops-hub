import { describe, expect, it } from 'vitest'
import { parseFiltros, temFiltroAtivo, urlComFiltro, STATUS_VALIDOS } from '../filters'

describe('parseFiltros', () => {
  it('sem parâmetros, nenhum filtro ativo', () => {
    const f = parseFiltros({})
    expect(f).toEqual({ status: null, tecnicoId: null, supervisorId: null, de: null, ate: null })
    expect(temFiltroAtivo(f)).toBe(false)
  })

  it('lê os quatro status válidos', () => {
    for (const s of STATUS_VALIDOS) {
      expect(parseFiltros({ status: s }).status).toBe(s)
    }
  })

  // A URL é editável e chega por link antigo: filtro inválido é ignorado, não vira erro.
  it('status inválido é ignorado em vez de quebrar', () => {
    expect(parseFiltros({ status: 'inventado' }).status).toBeNull()
    expect(parseFiltros({ status: '' }).status).toBeNull()
  })

  it('aceita data no formato ISO e recusa o resto', () => {
    expect(parseFiltros({ de: '2026-09-01' }).de).toBe('2026-09-01')
    expect(parseFiltros({ de: '01/09/2026' }).de).toBeNull()
    expect(parseFiltros({ de: 'ontem' }).de).toBeNull()
  })

  // Sem isto o gestor veria "nenhuma supervisão" e acharia que não há dado.
  it('intervalo invertido é descartado, não devolve lista vazia', () => {
    const f = parseFiltros({ de: '2026-09-30', ate: '2026-09-01' })
    expect(f.de).toBeNull()
    expect(f.ate).toBeNull()
  })

  it('intervalo válido passa, inclusive com as duas pontas iguais', () => {
    const f = parseFiltros({ de: '2026-09-10', ate: '2026-09-10' })
    expect(f.de).toBe('2026-09-10')
    expect(f.ate).toBe('2026-09-10')
  })

  it('parâmetro repetido usa o primeiro valor', () => {
    expect(parseFiltros({ status: ['agendada', 'concluida'] }).status).toBe('agendada')
  })

  it('combina filtros independentes', () => {
    const f = parseFiltros({ status: 'concluida', tecnico: 'abc', supervisor: 'def' })
    expect(f.status).toBe('concluida')
    expect(f.tecnicoId).toBe('abc')
    expect(f.supervisorId).toBe('def')
    expect(temFiltroAtivo(f)).toBe(true)
  })
})

describe('urlComFiltro', () => {
  const vazio = parseFiltros({})

  it('sem filtro nenhum, volta para a URL limpa', () => {
    expect(urlComFiltro(vazio, 'status', null)).toBe('/supervisoes')
  })

  it('aplica um filtro', () => {
    expect(urlComFiltro(vazio, 'status', 'agendada')).toBe('/supervisoes?status=agendada')
  })

  // É isto que permite combinar filtros sem que um limpe o outro.
  it('trocar um filtro PRESERVA os outros', () => {
    const atual = parseFiltros({ status: 'agendada', tecnico: 'abc' })
    const url = urlComFiltro(atual, 'status', 'concluida')
    expect(url).toContain('status=concluida')
    expect(url).toContain('tecnico=abc')
  })

  it('limpar um filtro mantém os demais', () => {
    const atual = parseFiltros({ status: 'agendada', tecnico: 'abc' })
    const url = urlComFiltro(atual, 'status', null)
    expect(url).not.toContain('status=')
    expect(url).toContain('tecnico=abc')
  })

  it('preserva o intervalo de datas ao trocar o status', () => {
    const atual = parseFiltros({ de: '2026-09-01', ate: '2026-09-30' })
    const url = urlComFiltro(atual, 'status', 'concluida')
    expect(url).toContain('de=2026-09-01')
    expect(url).toContain('ate=2026-09-30')
  })
})
