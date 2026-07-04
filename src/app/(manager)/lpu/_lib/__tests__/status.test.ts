import { describe, expect, it } from 'vitest'
import { lpuStatus, LPU_STATUS_LABEL } from '../status'

describe('lpuStatus (S5)', () => {
  it('ativa=true → ativa (ignora vigencia_fim)', () => {
    expect(lpuStatus(true, null)).toBe('ativa')
    expect(lpuStatus(true, '2026-06-01')).toBe('ativa')
  })

  it('não-ativa com vigencia_fim → encerrada (não "rascunho")', () => {
    expect(lpuStatus(false, '2026-06-01')).toBe('encerrada')
  })

  it('não-ativa sem vigencia_fim → rascunho', () => {
    expect(lpuStatus(false, null)).toBe('rascunho')
  })

  it('rótulos definidos para os 3 estados', () => {
    expect(LPU_STATUS_LABEL.ativa).toBe('Ativa')
    expect(LPU_STATUS_LABEL.encerrada).toBe('Encerrada')
    expect(LPU_STATUS_LABEL.rascunho).toBe('Rascunho')
  })
})
