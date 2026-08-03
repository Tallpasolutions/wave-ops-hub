import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { isHomologacao } from '@/lib/etl/explicacao'
import { HomologacaoRow } from './_components/HomologacaoRow'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Repasse de Homologação' }

type VisitRow = {
  os_num: number | string
  explicacao_valor: string | null
  valor_recebido_unetvale: number | string | null
}

type Pattern = {
  cents: number
  valorUnetvale: number
  count: number
  exampleOs: number
  exampleExpl: string
  valor: number | null
}

const fmtBRL = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function HomologacaoPage() {
  const user = await getCurrentUser()
  if (!user?.tenantId) return null

  const supabase = await createSupabaseServerClient()

  const [{ rows: visits }, { data: classRaw }] = await Promise.all([
    fetchAllPages<VisitRow>((from, to) =>
      supabase
        .from('service_visits')
        .select('os_num, explicacao_valor, valor_recebido_unetvale')
        .eq('tenant_id', user.tenantId!)
        .eq('fora_escopo', false)
        .ilike('explicacao_valor', 'homologa%')
        .ilike('sucesso', 'sim%')
        .order('os_num')
        .range(from, to),
    ),
    // ADR-019: só os repasses do tenant — os próprios de uma LPU alternativa carregam o mesmo
    // tenant_id e apareceriam misturados com os da tabela padrão.
    supabase
      .from('homologacao_classifications')
      .select('valor_unetvale, valor_repasse')
      .eq('tenant_id', user.tenantId)
      .is('lpu_id', null),
  ])

  // Mapa valor Unetvale (centavos) → repasse cadastrado.
  const classMap = new Map<number, number>(
    (classRaw ?? []).map((c) => [
      Math.round(Number(c.valor_unetvale) * 100),
      Number(c.valor_repasse),
    ]),
  )

  // Agrupa as visitas de homologação por valor da Unetvale (chave do repasse).
  const patterns = new Map<number, Pattern>()
  for (const v of visits) {
    if (!isHomologacao(v.explicacao_valor)) continue
    if (v.valor_recebido_unetvale == null) continue
    const valorUnetvale = Number(v.valor_recebido_unetvale)
    const cents = Math.round(valorUnetvale * 100)
    const existing = patterns.get(cents)
    if (existing) {
      existing.count += 1
    } else {
      patterns.set(cents, {
        cents,
        valorUnetvale,
        count: 1,
        exampleOs: Number(v.os_num),
        exampleExpl: v.explicacao_valor ?? '',
        valor: classMap.get(cents) ?? null,
      })
    }
  }

  const list = [...patterns.values()].sort((a, b) => {
    // não cadastrados primeiro; depois por volume
    if ((a.valor === null) !== (b.valor === null)) return a.valor === null ? -1 : 1
    return b.count - a.count
  })
  const pendentes = list.filter((p) => p.valor === null).length

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">
          Repasse de Homologação
        </h1>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Homologação é reconhecida pela explicação do valor (coluna Z), não pela finalidade. O
          repasse ao técnico varia com o valor que a Unetvale pagou — inclusive o caso dobrado, que
          tem a mesma explicação da base e só se distingue pela receita. Defina o repasse de cada
          valor distinto; ele vale para todas as homologações com aquele valor e recalcula os
          payouts.
          {pendentes > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-[rgba(255,84,112,0.13)] px-2 py-0.5 text-[10px] font-bold text-[var(--red)]">
              {pendentes} sem repasse
            </span>
          )}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-8 text-center text-sm text-[var(--text-3)]">
          Nenhuma visita de homologação com sucesso encontrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--bg-1)]">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Valor da Unetvale
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Visitas
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Exemplo
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Repasse ao técnico
                </th>
              </tr>
            </thead>
            <tbody className="bg-[var(--bg)]">
              {list.map((p) => (
                <tr key={p.cents} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-5 py-3 font-mono font-medium text-[var(--text)]">
                    {fmtBRL(p.valorUnetvale)}
                  </td>
                  <td className="px-5 py-3 text-[var(--text-2)]">{p.count}</td>
                  <td className="px-5 py-3">
                    <span className="block font-mono text-[11px] text-[var(--text-3)]">
                      OS {p.exampleOs} · {p.exampleExpl}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <HomologacaoRow valorUnetvale={p.valorUnetvale} valorAtual={p.valor} />
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
