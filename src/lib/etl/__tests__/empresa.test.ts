import { describe, it, expect } from 'vitest'
import { empresaDeFora, extrairEmpresa, lerEmpresasDoTenant } from '../empresa'

const WAVE = lerEmpresasDoTenant({ prefixos_empresa: ['WAVE', 'INFRA WAVE', 'WAVE SUPERVISOR'] })

describe('extrairEmpresa', () => {
  it.each([
    ['WAVE - Caua de Oliveira Souza', 'WAVE'],
    ['INFRA WAVE - Joao Revair Dill', 'INFRA WAVE'],
    ['WAVE SUPERVISOR - Carlos Henrique Subtil Rodrigues', 'WAVE SUPERVISOR'],
    ['3 ELLO - Jeferson da Silva Braga', '3 ELLO'],
    ['JVM -GABRIEL DE OLIVEIRA BRANDAO', 'JVM'],
    ['INFRA UNET -  Mauricio Capitanio', 'INFRA UNET'],
    ['  Cleiton  Telecom  - Cleiton Pinheiro', 'CLEITON TELECOM'],
  ])('%s → %s', (raw, empresa) => {
    expect(extrairEmpresa(raw)).toBe(empresa)
  })

  it.each(['Lucas Luiz da Silva Rolla', 'Ana-Maria Silva', ''])('"%s" não tem empresa', (raw) => {
    expect(extrairEmpresa(raw)).toBeNull()
  })
})

describe('lerEmpresasDoTenant', () => {
  it('normaliza caixa e espaços da config', () => {
    expect(lerEmpresasDoTenant({ prefixos_empresa: [' infra  wave '] }).has('INFRA WAVE')).toBe(true)
  })

  it.each([[null], [{}], [{ prefixos_empresa: 'WAVE' }]])('config %j resulta em lista vazia', (config) => {
    expect(lerEmpresasDoTenant(config).size).toBe(0)
  })
})

describe('empresaDeFora', () => {
  it.each([
    'WAVE - Caua de Oliveira Souza',
    'wave - caua de oliveira souza',
    'INFRA WAVE - Joao Revair Dill',
    'WAVE SUPERVISOR - Carlos Henrique Subtil Rodrigues',
  ])('mantém %s', (raw) => {
    expect(empresaDeFora(raw, WAVE, [])).toBeNull()
  })

  it.each([
    ['JVM - Jorge Luiz Silva', 'JVM'],
    ['INFRA - Leandro Nunes Mayer', 'INFRA'],
    ['INFRASEG - Adair José Weiss', 'INFRASEG'],
    ['EMPRESA NOVA - Fulano de Tal', 'EMPRESA NOVA'],
  ])('descarta %s', (raw, empresa) => {
    expect(empresaDeFora(raw, WAVE, [])).toBe(empresa)
  })

  it('nome sem prefixo fica, para o gestor decidir em "sem vínculo"', () => {
    expect(empresaDeFora('Lucas Luiz da Silva Rolla', WAVE, [])).toBeNull()
  })

  it('técnico cadastrado no tenant fica, mesmo com prefixo fora da lista', () => {
    const tecnicos = [{ id: 't-1', nome_completo: 'PARCEIRO - Fulano de Tal' }]
    expect(empresaDeFora('PARCEIRO - Fulano de Tal', WAVE, tecnicos)).toBeNull()
  })

  it('tenant sem lista não descarta nada', () => {
    expect(empresaDeFora('JVM - Jorge Luiz Silva', new Set(), [])).toBeNull()
  })
})
