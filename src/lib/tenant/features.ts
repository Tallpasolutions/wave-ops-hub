// Feature flags por tenant, lidas de `tenants.config` (jsonb).
//
// Leitura sempre DEFENSIVA e com comparação estrita `=== true`: chave ausente, null, a string
// "true" ou config corrompido significam DESLIGADO. É o padrão já em uso no projeto para
// `homologacao_por_explicacao` (ADR-015, lido em recalculate-batch.ts) — chave ausente = o
// comportamento antigo, intacto.
//
// Estas flags NÃO vão para o JWT: o auth hook é intocável (tech-debt 002 e 007) e um valor no
// token só passaria a valer depois do refresh, o que impediria ligar ou desligar na hora.

function flagLigada(config: unknown, chave: string): boolean {
  if (!config || typeof config !== 'object') return false
  return (config as Record<string, unknown>)[chave] === true
}

// Módulo Supervisão de Campo (ADR-022). Nasce desligada em todo tenant (migration 0042).
export function isSupervisaoCampoOn(config: unknown): boolean {
  return flagLigada(config, 'supervisao_campo_habilitada')
}
