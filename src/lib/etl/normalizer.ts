import type { RawRow } from './schemas'
import type { NormalizedRow } from './types'

function parseBool(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === 'sim'
}

function parseNullableInt(value: number | null | undefined): number | null {
  if (value == null) return null
  return Math.round(value)
}

// Finalidades de infra (ADR-008) vêm normalizadas (trim+lower) do tenant config.
export function isFinalidadeInfra(
  finalidade: string | null | undefined,
  infraSet: ReadonlySet<string>,
): boolean {
  if (!finalidade) return false
  return infraSet.has(finalidade.trim().toLowerCase())
}

// Canonicaliza o meio (Aéreo/Subterrâneo) a partir de um texto: o valor da coluna
// "Subterrâneo/Aéreo" ou, como fallback, a "Explicação do valor". As regras da LPU fazem
// match EXATO por esse campo (Suporte Aéreo Externo R$120 vs Subterrâneo R$135), então
// qualquer variante quebra o match. Dois casos: (1) coluna com mojibake não reparado
// ("AÈreo" — o detector do encoding.ts não pega palavra iniciada em maiúscula) e (2) coluna
// vazia, com o meio só na explicação ("... troca de drop aérea ..."). O NFD+strip de acentos
// normaliza "AÈreo"→"aereo" e "aérea"→"aerea". Retorna o valor canônico, ou null.
export function deriveSubterraneoAereo(
  texto: string | null | undefined,
): string | null {
  if (!texto) return null
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (t.includes('aere')) return 'Aéreo'
  if (t.includes('subterr')) return 'Subterrâneo'
  return null
}

export function normalize(
  row: RawRow,
  tenantId: string,
  uploadId: string,
  tecnicoId: string | null,
  reasonId: string | null,
  contentHash: string,
  infraSet: ReadonlySet<string> = new Set(),
): NormalizedRow {
  const isSuccess = row.Sucesso.trim().toLowerCase().startsWith('sim')

  const rawTipo = row.TipoAtendimento
  const tipoAtendimento: 'Externo' | 'Interno' | null =
    rawTipo === 'Externo' || rawTipo === 'Interno' ? rawTipo : null

  return {
    tenantId,
    uploadId,
    osNum: row.OS,
    dataExecucao: row.Data,
    tecnicoId,
    tecnicoRaw: row.Tecnico.trim(),
    reasonId: isSuccess ? null : reasonId,
    finalidade: row.Finalidade?.trim() ?? null,
    tipoAtendimento,
    cidade: row.Cidade?.trim() ?? null,
    sucesso: row.Sucesso.trim(),
    improdutiva: parseBool(row.Improdutiva),
    valorRecebidoUnetvale: row.Valor ?? null,
    dropUsado: row.DropUsado ?? null,
    faixaDrop: row.FaixaDrop?.trim() ?? null,
    conectoresUsados: parseNullableInt(row.ConectoresUsados),
    condominio: parseBool(row.Condominio),
    // Canonicaliza o valor da coluna (conserta mojibake "AÈreo" → "Aéreo"); se a coluna não
    // resolver (vazia ou irreconhecível), deriva o meio da explicação do valor.
    subterraneaAereo:
      deriveSubterraneoAereo(row.SubterraneoAereo) ?? deriveSubterraneoAereo(row.ExplicacaoValor),
    garantia: parseBool(row.Garantia),
    validada: parseBool(row.Validada),
    agregada: parseBool(row.Agregada),
    rejeitada: parseBool(row.Rejeitada),
    agendada: parseBool(row.Agendada),
    trocadoDrop: parseBool(row.TrocadoDrop),
    motivoTroca: row.MotivoTroca?.trim() ?? null,
    outrasFibras: parseBool(row.OutrasFibras),
    quantasFibras: parseNullableInt(row.QuantasFibras),
    categoriaInterna: row.CategoriaInterna?.trim() ?? null,
    cat1: row.Cat1?.trim() ?? null,
    cat2: row.Cat2?.trim() ?? null,
    cat3: row.Cat3?.trim() ?? null,
    explicacaoValor: row.ExplicacaoValor?.trim() ?? null,
    observacoes: row.Observacoes?.trim() ?? null,
    numTecnicos: parseNullableInt(row.NumTecnicos),
    foraEscopo: isFinalidadeInfra(row.Finalidade, infraSet),
    contentHash,
    clienteUsuario: row.Usuario?.trim() ?? null,
    contrato: row.Contrato?.trim() ?? null,
  }
}
