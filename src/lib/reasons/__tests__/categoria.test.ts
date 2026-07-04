import { describe, expect, it } from 'vitest'
import {
  CATEGORIA_LABEL,
  CATEGORIA_BADGE_CLASS,
  CATEGORIA_CLASSIFICAVEL_OPTIONS,
  categoriaLabel,
  categoriaBadgeClass,
} from '../categoria'
import type { ReasonCategoria } from '@/db/schema'

const TODAS: ReasonCategoria[] = [
  'falha_tecnico',
  'falha_cliente',
  'forca_maior',
  'falha_sistema',
  'pendente_classificacao',
]

describe('taxonomia de categoria', () => {
  it('cada categoria tem rótulo e badge', () => {
    for (const c of TODAS) {
      expect(CATEGORIA_LABEL[c]).toBeTruthy()
      expect(CATEGORIA_BADGE_CLASS[c]).toBeTruthy()
    }
  })

  it('rótulo único: "Falha do Cliente" (não "Falha Cliente")', () => {
    expect(CATEGORIA_LABEL.falha_cliente).toBe('Falha do Cliente')
    expect(CATEGORIA_LABEL.falha_tecnico).toBe('Falha do Técnico')
    expect(CATEGORIA_LABEL.falha_sistema).toBe('Falha do Sistema')
  })

  it('categoriaLabel devolve o valor bruto quando desconhecido', () => {
    expect(categoriaLabel('falha_cliente')).toBe('Falha do Cliente')
    expect(categoriaLabel('inexistente')).toBe('inexistente')
  })

  it('categoriaBadgeClass tem fallback neutro', () => {
    expect(categoriaBadgeClass('inexistente')).toContain('text-[var(--text-3)]')
  })

  it('opções classificáveis excluem "pendente" e reusam o rótulo canônico', () => {
    const values = CATEGORIA_CLASSIFICAVEL_OPTIONS.map((o) => o.value)
    expect(values).not.toContain('pendente_classificacao')
    expect(values).toHaveLength(4)
    for (const opt of CATEGORIA_CLASSIFICAVEL_OPTIONS) {
      expect(opt.label).toBe(CATEGORIA_LABEL[opt.value])
    }
  })
})
