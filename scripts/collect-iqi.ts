/**
 * Coleta do IQI executada NO RUNNER do GitHub Actions (não na Vercel).
 *
 * Motivo (ADR-012): a Unetvale bloqueia os IPs de datacenter da Vercel — toda
 * requisição estourava o timeout (15s), o cron dava 504 e o botão girava sem fim.
 * O runner do GitHub alcança a Unetvale em <1s, então a coleta roda aqui e grava
 * direto no Supabase com service role.
 *
 * Rodado por .github/workflows/iqi-cron.yml com:
 *   node --conditions=react-server --import tsx scripts/collect-iqi.ts
 * (a flag react-server neutraliza o guard `import 'server-only'` do coletor,
 * espelhando o ambiente de servidor do Next.)
 *
 * Env necessária: UNETVALE_USER, UNETVALE_PASSWORD,
 *                 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { runIqiCollection } from '@/lib/iqi'

async function main(): Promise<void> {
  const r = await runIqiCollection()

  console.log(
    `Resumo: ${r.tecnicosProcessados} técnicos processados · ${r.mesesGravados} meses gravados · ` +
      `${r.semCodigoUnetvale.length} sem código Unetvale · ${r.erros.length} com erro.`,
  )
  if (r.semCodigoUnetvale.length > 0) {
    console.log(`Sem código Unetvale: ${r.semCodigoUnetvale.join(', ')}`)
  }
  for (const e of r.erros) {
    console.log(`  ERRO ${e.tecnico}: ${e.erro}`)
  }

  // Falha o job apenas se NINGUÉM foi processado (login quebrado, egress bloqueado,
  // etc.). Se ao menos um técnico foi gravado, é sucesso parcial — sai 0 para não
  // marcar o cron inteiro como falho por causa de códigos individuais errados.
  if (r.tecnicosProcessados === 0) {
    process.exitCode = 1
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack ?? e.message : String(e))
  process.exit(1)
})
