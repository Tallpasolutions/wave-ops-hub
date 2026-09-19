import { describe, expect, it } from 'vitest'
import { buildSnapshot, podeAgendar, type ItemDoTemplate } from '../snapshot'

const CTX = {
  tenantId: 'tenant-1',
  supervisaoId: 'sup-1',
  supervisorUserId: 'user-1',
}

const item = (over: Partial<ItemDoTemplate> = {}): ItemDoTemplate => ({
  id: 'item-1',
  codigo: 'EPI-01',
  titulo: 'Capacete com jugular',
  descricao: 'Verificar jugular presa',
  categoria: 'Posse de EPI',
  peso: '1',
  tipo_resposta: 'posse_epi',
  foto_obrigatoria: true,
  ...over,
})

describe('buildSnapshot', () => {
  it('copia o conteúdo do item, não apenas a referência', () => {
    const [linha] = buildSnapshot([item()], CTX)
    expect(linha.item_titulo).toBe('Capacete com jugular')
    expect(linha.item_descricao).toBe('Verificar jugular presa')
    expect(linha.item_categoria).toBe('Posse de EPI')
    expect(linha.item_tipo_resposta).toBe('posse_epi')
    expect(linha.item_foto_obrigatoria).toBe(true)
    expect(linha.item_peso).toBe(1)
    // O vínculo fica só para rastro — a nota não depende dele.
    expect(linha.item_id).toBe('item-1')
  })

  // A promessa feita ao gestor em três telas depende disto.
  it('a cópia não muda quando o template muda depois', () => {
    const original = item({ titulo: 'Título antigo', peso: '2' })
    const [linha] = buildSnapshot([original], CTX)

    original.titulo = 'Título novo'
    original.peso = '99'
    original.foto_obrigatoria = false

    expect(linha.item_titulo).toBe('Título antigo')
    expect(linha.item_peso).toBe(2)
    expect(linha.item_foto_obrigatoria).toBe(true)
  })

  // A ordem do template tem buracos e empates depois de edições; dentro da supervisão ela
  // precisa ser densa e única, porque é a chave estável da UI e do índice único.
  it('reatribui a ordem de 1 a N, ignorando a do template', () => {
    const linhas = buildSnapshot(
      [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })],
      CTX,
    )
    expect(linhas.map((l) => l.ordem)).toEqual([1, 2, 3])
  })

  it('preserva a ordem recebida — quem ordena é a consulta', () => {
    const linhas = buildSnapshot([item({ id: 'z' }), item({ id: 'a' })], CTX)
    expect(linhas.map((l) => l.item_id)).toEqual(['z', 'a'])
  })

  it('peso vem como número, mesmo que o banco devolva string', () => {
    const [linha] = buildSnapshot([item({ peso: '2.50' })], CTX)
    expect(linha.item_peso).toBe(2.5)
    expect(typeof linha.item_peso).toBe('number')
  })

  it('campos opcionais nulos continuam nulos, não viram string vazia', () => {
    const [linha] = buildSnapshot(
      [item({ codigo: null, descricao: null, categoria: null })],
      CTX,
    )
    expect(linha.item_codigo).toBeNull()
    expect(linha.item_descricao).toBeNull()
    expect(linha.item_categoria).toBeNull()
  })

  it('carimba tenant, supervisão e supervisor em toda linha', () => {
    const linhas = buildSnapshot([item({ id: 'a' }), item({ id: 'b' })], CTX)
    for (const l of linhas) {
      expect(l.tenant_id).toBe('tenant-1')
      expect(l.supervisao_id).toBe('sup-1')
      // Desnormalizado de propósito: é por ele que a RLS filtra, sem join.
      expect(l.supervisor_user_id).toBe('user-1')
    }
  })

  it('lista vazia devolve lista vazia', () => {
    expect(buildSnapshot([], CTX)).toEqual([])
  })

  it('não muta a entrada', () => {
    const itens = [item()]
    const antes = JSON.parse(JSON.stringify(itens))
    buildSnapshot(itens, CTX)
    expect(itens).toEqual(antes)
  })
})

describe('podeAgendar', () => {
  // Sem item não há nota, e o supervisor abriria uma tela vazia sem saber o que fazer.
  it('exige pelo menos um item ativo', () => {
    expect(podeAgendar([])).toBe(false)
    expect(podeAgendar([item()])).toBe(true)
  })
})
