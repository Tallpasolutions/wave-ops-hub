import { createHash } from 'crypto'
import type { RawRow } from './schemas'

export function computeContentHash(row: RawRow): string {
  const canonical = JSON.stringify({
    data: row.Data.toISOString(),
    inicio: row.Inicio.toISOString(),
    os: row.OS,
    finalidade: row.Finalidade,
    tecnico: row.Tecnico,
    sucesso: row.Sucesso,
    improdutiva: row.Improdutiva ?? null,
    valor: row.Valor,
    cidade: row.Cidade,
    tipoAtendimento: row.TipoAtendimento ?? null,
    condominio: row.Condominio ?? null,
    dropUsado: row.DropUsado ?? null,
    faixaDrop: row.FaixaDrop ?? null,
    conectoresUsados: row.ConectoresUsados ?? null,
    numTecnicos: row.NumTecnicos ?? null,
  })
  return createHash('sha256').update(canonical).digest('hex')
}
