import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { parseIqiResponse } from './parser'
import type { IqiCollectionResult, IqiRawResponse } from './types'

// Fonte e fluxo documentados em docs/architecture/ADR-012-iqi-ingestao-scraping.md.
const BASE_URL = 'https://os.unetvale.com.br'
const LOGIN_PATH = '/login/do' // form em /login, POST username+password
// Tipos de serviço avaliados pelo IQI (Instalação, Migração, Mudança).
const TIPOS_SERVICO = 'INS-INS2-INS3-MIGE-MIGF-MUD-MUDF'
// Nº de meses de histórico pedido ao endpoint (a Unetvale limita a janela).
const LOOKBACK = '30'
// Tenant único hoje (Wave). Multi-tenant real exigirá credencial por tenant.
const TENANT_SLUG = 'wave'

// Reduz cada string Set-Cookie ao par `nome=valor` (descarta Path/HttpOnly/etc.)
// e acumula num mapa nome→valor para montar o header Cookie.
function mergeSetCookies(jar: Map<string, string>, setCookies: string[]): void {
  for (const c of setCookies) {
    const pair = c.split(';')[0]
    const eq = pair.indexOf('=')
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

/**
 * Autentica na Unetvale e devolve o header Cookie da sessão. Não há API/token
 * oficial — auth é por sessão. Fluxo fiel ao navegador: GET /login prima o
 * cookie de sessão; POST /login/do (form username+password) o valida.
 */
async function loginUnetvale(): Promise<string> {
  const username = process.env.UNETVALE_USER
  const password = process.env.UNETVALE_PASSWORD
  if (!username || !password) {
    throw new Error('UNETVALE_USER/UNETVALE_PASSWORD não configurados no servidor.')
  }

  const jar = new Map<string, string>()

  // 1. Prime: obtém o cookie de sessão inicial.
  const prime = await fetch(`${BASE_URL}/login`, { redirect: 'manual' })
  mergeSetCookies(jar, prime.headers.getSetCookie?.() ?? [])

  // 2. Valida as credenciais reaproveitando o cookie de sessão.
  const res = await fetch(`${BASE_URL}${LOGIN_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(jar.size > 0 ? { Cookie: cookieHeader(jar) } : {}),
    },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  })
  mergeSetCookies(jar, res.headers.getSetCookie?.() ?? [])

  if (jar.size === 0) {
    throw new Error('Login na Unetvale falhou: nenhum cookie de sessão retornado.')
  }
  return cookieHeader(jar)
}

/** Busca o JSON do IQI de um técnico. O header X-Requested-With é obrigatório. */
async function fetchIqiRaw(cookie: string, techId: string): Promise<IqiRawResponse> {
  const url = `${BASE_URL}/index/iqi/${TIPOS_SERVICO}/${LOOKBACK}/${techId}`
  const res = await fetch(url, {
    headers: { Cookie: cookie, 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!res.ok) throw new Error(`IQI HTTP ${res.status} para técnico ${techId}`)
  return (await res.json()) as IqiRawResponse
}

/**
 * Executa uma coleta completa: login, fetch por técnico com `codigo_unetvale`,
 * parse e upsert idempotente em `iqi_snapshots`. Um técnico que falha não
 * derruba os demais. Escreve com service role (bypassa RLS — ADR-002/012).
 */
export async function runIqiCollection(): Promise<IqiCollectionResult> {
  const supabase = createSupabaseAdminClient()

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', TENANT_SLUG)
    .single()
  if (tenantErr || !tenant) {
    throw new Error(`Tenant '${TENANT_SLUG}' não encontrado: ${tenantErr?.message ?? 'sem dados'}`)
  }

  const { data: technicians, error: techErr } = await supabase
    .from('technicians')
    .select('id, nome_completo, codigo_unetvale')
    .eq('tenant_id', tenant.id)
    .eq('ativo', true)
  if (techErr) throw new Error(`Erro ao listar técnicos: ${techErr.message}`)

  const result: IqiCollectionResult = {
    tecnicosProcessados: 0,
    mesesGravados: 0,
    semCodigoUnetvale: [],
    erros: [],
  }

  const comCodigo = (technicians ?? []).filter((t) => {
    if (!t.codigo_unetvale) {
      result.semCodigoUnetvale.push(t.nome_completo)
      return false
    }
    return true
  })
  if (comCodigo.length === 0) return result

  const cookie = await loginUnetvale()

  for (const tech of comCodigo) {
    try {
      const raw = await fetchIqiRaw(cookie, String(tech.codigo_unetvale))
      const meses = parseIqiResponse(raw)
      result.tecnicosProcessados++
      if (meses.length === 0) continue

      const rows = meses.map((m) => ({
        tenant_id: tenant.id,
        tecnico_id: tech.id,
        competencia: m.competencia,
        total_os: m.totalOs,
        contratos_reincidentes: m.contratosReincidentes,
        pct_reincidencia: m.pctReincidencia,
        os_nums: m.osNums,
        tipos_servico: TIPOS_SERVICO,
        synced_at: new Date().toISOString(),
      }))

      const { error: upsertErr } = await supabase
        .from('iqi_snapshots')
        .upsert(rows, { onConflict: 'tenant_id,tecnico_id,competencia' })
      if (upsertErr) throw new Error(upsertErr.message)

      result.mesesGravados += rows.length
    } catch (e) {
      result.erros.push({
        tecnico: tech.nome_completo,
        erro: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return result
}
