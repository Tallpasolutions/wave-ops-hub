import { matchTechnician } from './matchers'
import type { TechnicianRef } from './matchers'

// A Unetvale identifica a empresa do técnico por um prefixo na coluna Técnico
// ("JVM - Jorge Luiz Silva"). Exige espaço em ao menos um lado do hífen: é o que aceita as
// variações reais ("JVM -GABRIEL", "INFRA UNET -  Mauricio") sem ler sobrenome composto
// ("Ana-Maria Silva") como empresa.
const PREFIXO_EMPRESA = /^(.+?)(?:\s+-\s*|\s*-\s+)/

function normalizarEmpresa(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function extrairEmpresa(tecnicoRaw: string): string | null {
  const match = tecnicoRaw.trim().match(PREFIXO_EMPRESA)
  return match?.[1] ? normalizarEmpresa(match[1]) : null
}

export function lerEmpresasDoTenant(config: unknown): ReadonlySet<string> {
  const lista = (config as { prefixos_empresa?: unknown } | null)?.prefixos_empresa
  if (!Array.isArray(lista)) return new Set()
  return new Set(
    lista.filter((p): p is string => typeof p === 'string').map(normalizarEmpresa),
  )
}

// Devolve a empresa de fora, ou null se a linha fica. Lista de permissão porque a lista de
// empresas da Unetvale é aberta e cresce sem aviso (ADR-024). Na dúvida a linha fica: sem
// prefixo ela aparece em "sem vínculo" para o gestor, enquanto descartar uma visita real
// deixaria um técnico sem receber sem que ninguém visse. Tenant sem lista não filtra.
export function empresaDeFora(
  tecnicoRaw: string,
  empresas: ReadonlySet<string>,
  tecnicos: TechnicianRef[],
): string | null {
  if (empresas.size === 0) return null
  const empresa = extrairEmpresa(tecnicoRaw)
  if (!empresa || empresas.has(empresa)) return null
  return matchTechnician(tecnicoRaw, tecnicos) ? null : empresa
}
