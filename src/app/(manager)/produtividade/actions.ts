'use server'
import { requireRole } from '@/lib/auth'

// Repositório que hospeda o workflow de coleta do IQI (não é segredo).
const GH_OWNER = 'Tallpasolutions'
const GH_REPO = 'wave-ops-hub'
const GH_WORKFLOW = 'iqi-cron.yml'
const GH_REF = 'main'

// Sincronização manual do IQI (ADR-012). O scraping NÃO pode rodar na Vercel — a
// Unetvale bloqueia os IPs dela (todo request dava timeout). Por isso o botão apenas
// DISPARA o workflow do GitHub Actions (que roda a coleta no runner, com egress que
// alcança a Unetvale). A coleta é assíncrona; a tela reflete os dados no próximo load.
export async function sincronizarIqi(): Promise<{
  ok: boolean
  mensagem: string
}> {
  await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  const token = process.env.GITHUB_DISPATCH_TOKEN
  if (!token) {
    return {
      ok: false,
      mensagem: 'Sincronização não configurada: falta GITHUB_DISPATCH_TOKEN no servidor.',
    }
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: GH_REF }),
      },
    )

    // A API responde 204 No Content quando o disparo é aceito.
    if (res.status === 204) {
      return {
        ok: true,
        mensagem:
          'Sincronização iniciada. Os dados do IQI atualizam em cerca de 1 minuto — recarregue a página em instantes.',
      }
    }

    const corpo = await res.text()
    return {
      ok: false,
      mensagem: `Falha ao iniciar a sincronização (HTTP ${res.status}). ${corpo.slice(0, 200)}`,
    }
  } catch (e) {
    return {
      ok: false,
      mensagem: e instanceof Error ? e.message : 'Falha ao acionar a sincronização.',
    }
  }
}
