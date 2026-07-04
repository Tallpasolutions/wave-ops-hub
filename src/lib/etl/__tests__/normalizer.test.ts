import { describe, it, expect } from 'vitest'
import { normalize, isFinalidadeInfra } from '../normalizer'
import type { RawRow } from '../schemas'

const BASE_RAW: RawRow = {
  Data: new Date('2026-04-01'),
  Inicio: new Date('2026-04-01'),
  OS: 12345,
  Finalidade: 'Instalação',
  TipoAtendimento: 'Externo',
  Cidade: 'São Paulo',
  Sucesso: 'Sim',
  Valor: 120,
  Tecnico: 'João Silva',
}

const BASE_ARGS = {
  tenantId: 'tenant-1',
  uploadId: 'upload-1',
  tecnicoId: 'tech-1',
  reasonId: null,
  contentHash: 'abc123',
}

// ADR-008: finalidades de infra são marcadas fora_escopo (excluídas de payout e KPIs)
describe('isFinalidadeInfra', () => {
  const infra = new Set(['projeto infra', 'manutenção infra', 'massiva'])

  it('detecta finalidade de infra (case/trim-insensitive)', () => {
    expect(isFinalidadeInfra('Projeto Infra', infra)).toBe(true)
    expect(isFinalidadeInfra('  PROJETO INFRA ', infra)).toBe(true)
    expect(isFinalidadeInfra('Massiva', infra)).toBe(true)
  })

  it('não marca finalidades operacionais', () => {
    expect(isFinalidadeInfra('Instalação - Fibra - PF', infra)).toBe(false)
    expect(isFinalidadeInfra('Suporte Fibra', infra)).toBe(false)
    expect(isFinalidadeInfra(null, infra)).toBe(false)
  })

  it('conjunto vazio não marca nada (default)', () => {
    expect(isFinalidadeInfra('Projeto Infra', new Set())).toBe(false)
  })
})

describe('normalize', () => {
  it('mapeia campos básicos corretamente', () => {
    const result = normalize(BASE_RAW, BASE_ARGS.tenantId, BASE_ARGS.uploadId, BASE_ARGS.tecnicoId, BASE_ARGS.reasonId, BASE_ARGS.contentHash)
    expect(result.tenantId).toBe('tenant-1')
    expect(result.foraEscopo).toBe(false)
  })

  it('marca foraEscopo quando a finalidade é de infra', () => {
    const result = normalize(
      { ...BASE_RAW, Finalidade: 'Projeto Infra' },
      BASE_ARGS.tenantId, BASE_ARGS.uploadId, BASE_ARGS.tecnicoId, BASE_ARGS.reasonId, BASE_ARGS.contentHash,
      new Set(['projeto infra']),
    )
    expect(result.foraEscopo).toBe(true)
    expect(result.osNum).toBe(12345)
    expect(result.dataExecucao).toEqual(new Date('2026-04-01'))
    expect(result.tecnicoId).toBe('tech-1')
    expect(result.tecnicoRaw).toBe('João Silva')
    expect(result.cidade).toBe('São Paulo')
    expect(result.contentHash).toBe('abc123')
  })

  it('forcibly sets reasonId to null when sucesso starts with Sim', () => {
    const result = normalize(
      { ...BASE_RAW, Sucesso: 'Sim - Concluído' },
      BASE_ARGS.tenantId, BASE_ARGS.uploadId, BASE_ARGS.tecnicoId,
      'some-reason-id',
      BASE_ARGS.contentHash,
    )
    expect(result.reasonId).toBeNull()
    expect(result.sucesso).toBe('Sim - Concluído')
  })

  it('preserva reasonId quando sucesso não é Sim', () => {
    const result = normalize(
      { ...BASE_RAW, Sucesso: 'Não - Cliente Ausente' },
      BASE_ARGS.tenantId, BASE_ARGS.uploadId, BASE_ARGS.tecnicoId,
      'reason-99',
      BASE_ARGS.contentHash,
    )
    expect(result.reasonId).toBe('reason-99')
  })

  it('booleanos: Sim → true, null → false, Não → false', () => {
    const result = normalize(
      { ...BASE_RAW, Improdutiva: 'Sim', Condominio: 'Não', Garantia: undefined },
      BASE_ARGS.tenantId, BASE_ARGS.uploadId, BASE_ARGS.tecnicoId, null, BASE_ARGS.contentHash,
    )
    expect(result.improdutiva).toBe(true)
    expect(result.condominio).toBe(false)
    expect(result.garantia).toBe(false)
  })

  it('tipoAtendimento: Externo → Externo, Interno → Interno, outro → null', () => {
    const externo = normalize({ ...BASE_RAW, TipoAtendimento: 'Externo' }, BASE_ARGS.tenantId, BASE_ARGS.uploadId, null, null, BASE_ARGS.contentHash)
    expect(externo.tipoAtendimento).toBe('Externo')

    const interno = normalize({ ...BASE_RAW, TipoAtendimento: 'Interno' }, BASE_ARGS.tenantId, BASE_ARGS.uploadId, null, null, BASE_ARGS.contentHash)
    expect(interno.tipoAtendimento).toBe('Interno')

    const invalido = normalize({ ...BASE_RAW, TipoAtendimento: null }, BASE_ARGS.tenantId, BASE_ARGS.uploadId, null, null, BASE_ARGS.contentHash)
    expect(invalido.tipoAtendimento).toBeNull()
  })

  it('parseNullableInt arredonda decimais', () => {
    const result = normalize(
      { ...BASE_RAW, ConectoresUsados: 3.7, NumTecnicos: 1.2 },
      BASE_ARGS.tenantId, BASE_ARGS.uploadId, null, null, BASE_ARGS.contentHash,
    )
    expect(result.conectoresUsados).toBe(4)
    expect(result.numTecnicos).toBe(1)
  })

  it('campos opcionais nulos retornam null', () => {
    const result = normalize(BASE_RAW, BASE_ARGS.tenantId, BASE_ARGS.uploadId, null, null, BASE_ARGS.contentHash)
    expect(result.dropUsado).toBeNull()
    expect(result.faixaDrop).toBeNull()
    expect(result.motivoTroca).toBeNull()
    expect(result.observacoes).toBeNull()
    expect(result.clienteUsuario).toBeNull()
    expect(result.contrato).toBeNull()
  })

  it('trim em campos de string', () => {
    const result = normalize(
      { ...BASE_RAW, Finalidade: '  Instalação  ', Tecnico: '  Maria  ' },
      BASE_ARGS.tenantId, BASE_ARGS.uploadId, null, null, BASE_ARGS.contentHash,
    )
    expect(result.finalidade).toBe('Instalação')
    expect(result.tecnicoRaw).toBe('Maria')
  })
})
