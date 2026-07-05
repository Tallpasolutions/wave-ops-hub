import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { normalizeExplicacao } from '@/lib/etl/explicacao'
import { ClassifyRow } from './_components/ClassifyRow'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Classificar Cabeamento' }

type VisitRow = {
  os_num: number | string
  explicacao_valor: string | null
  valor_recebido_unetvale: number | string | null
}

type Pattern = {
  key: string
  original: string
  count: number
  exampleOs: number
  receita: number | null
  valor: number | null
}

const fmtBRL = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function CabeamentoPage() {
  const user = await getCurrentUser()
  if (!user?.tenantId) return null

  const supabase = await createSupabaseServerClient()

  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('config')
    .eq('id', user.tenantId)
    .single()
  const cfg = (tenantRow?.config ?? {}) as { finalidades_classificar_explicacao?: unknown }
  const finalidades = Array.isArray(cfg.finalidades_classificar_explicacao)
    ? (cfg.finalidades_classificar_explicacao as string[])
    : []

  const [{ rows: visits }, { data: classRaw }] = await Promise.all([
    fetchAllPages<VisitRow>((from, to) =>
      supabase
        .from('service_visits')
        .select('os_num, explicacao_valor, valor_recebido_unetvale')
        .eq('tenant_id', user.tenantId!)
        .eq('fora_escopo', false)
        .in('finalidade', finalidades)
        .ilike('sucesso', 'sim%')
        .order('os_num')
        .range(from, to),
    ),
    supabase
      .from('cabeamento_classifications')
      .select('explicacao_key, valor')
      .eq('tenant_id', user.tenantId),
  ])

  const classMap = new Map(
    (classRaw ?? []).map((c) => [c.explicacao_key as string, Number(c.valor)]),
  )

  const patterns = new Map<string, Pattern>()
  for (const v of visits) {
    const key = normalizeExplicacao(v.explicacao_valor)
    if (!key) continue
    const existing = patterns.get(key)
    if (existing) {
      existing.count += 1
    } else {
      patterns.set(key, {
        key,
        original: v.explicacao_valor ?? '',
        count: 1,
        exampleOs: Number(v.os_num),
        receita: v.valor_recebido_unetvale != null ? Number(v.valor_recebido_unetvale) : null,
        valor: classMap.get(key) ?? null,
      })
    }
  }

  const list = [...patterns.values()].sort((a, b) => {
    // não classificados primeiro; depois por volume
    if ((a.valor === null) !== (b.valor === null)) return a.valor === null ? -1 : 1
    return b.count - a.count
  })
  const pendentes = list.filter((p) => p.valor === null).length

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">
          Classificar Cabeamento
        </h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          {finalidades.join(' · ') || 'Nenhuma finalidade configurada'}
        </p>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          O valor do técnico para Cabeamento/Condomínio depende do serviço descrito na planilha
          (coluna Z), não da finalidade. Defina o valor de cada padrão distinto — ele vale para
          todas as visitas com o mesmo padrão e recalcula os payouts.
          {pendentes > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-[rgba(255,84,112,0.13)] px-2 py-0.5 text-[10px] font-bold text-[var(--red)]">
              {pendentes} sem valor
            </span>
          )}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-8 text-center text-sm text-[var(--text-3)]">
          Nenhuma visita de Cabeamento com sucesso encontrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--bg-1)]">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Serviço (coluna Z normalizada)
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Visitas
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Receita (ref.)
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Valor do técnico
                </th>
              </tr>
            </thead>
            <tbody className="bg-[var(--bg)]">
              {list.map((p) => (
                <tr key={p.key} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-5 py-3">
                    <span className="block font-medium text-[var(--text)]">{p.key}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-[var(--text-3)]">
                      ex.: OS {p.exampleOs} · {p.original}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--text-2)]">{p.count}</td>
                  <td className="px-5 py-3 font-mono text-xs text-[var(--text-3)]">
                    {fmtBRL(p.receita)}
                  </td>
                  <td className="px-5 py-3">
                    <ClassifyRow
                      explicacaoKey={p.key}
                      explicacaoOriginal={p.original}
                      valorAtual={p.valor}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
