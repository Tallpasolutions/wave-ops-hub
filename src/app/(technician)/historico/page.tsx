import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Histórico' }
import { HistoricoChart } from './_components/HistoricoChart'

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function sixMonthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  return start.toISOString().slice(0, 10)
}

type MonthData = {
  mes: string
  label: string
  totalVisitas: number
  finalizadas: number
  taxaSucesso: number
  arrecadacao: number
}

export default async function HistoricoPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.technicianId || !user.tenantId) redirect('/profile')

  const supabase = await createSupabaseServerClient()
  const start = sixMonthBounds()

  const { data: visits } = await supabase
    .from('service_visits')
    .select('data_execucao, sucesso, valor_recebido_unetvale')
    .eq('tenant_id', user.tenantId)
    .eq('technician_id', user.technicianId)
    .gte('data_execucao', start)
    .order('data_execucao', { ascending: true })

  // Agregar por mês
  const monthMap = new Map<string, { totalVisitas: number; finalizadas: number; arrecadacao: number }>()
  for (const v of visits ?? []) {
    const mes = (v.data_execucao as string).slice(0, 7)
    const cur = monthMap.get(mes) ?? { totalVisitas: 0, finalizadas: 0, arrecadacao: 0 }
    cur.totalVisitas += 1
    if ((v.sucesso as string)?.toLowerCase().startsWith('s')) cur.finalizadas += 1
    cur.arrecadacao += (v.valor_recebido_unetvale as number) ?? 0
    monthMap.set(mes, cur)
  }

  // Preencher os 6 meses mesmo que vazios
  const now = new Date()
  const months: MonthData[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    const data = monthMap.get(mes)
    months.push({
      mes,
      label,
      totalVisitas: data?.totalVisitas ?? 0,
      finalizadas: data?.finalizadas ?? 0,
      taxaSucesso:
        (data?.totalVisitas ?? 0) > 0
          ? ((data?.finalizadas ?? 0) / data!.totalVisitas) * 100
          : 0,
      arrecadacao: data?.arrecadacao ?? 0,
    })
  }

  const mesAnterior = months[months.length - 2]

  // "Wrapped" do mês anterior
  const melhorMes = [...months].sort((a, b) => b.arrecadacao - a.arrecadacao)[0]

  const temDados = months.some((m) => m.totalVisitas > 0)

  return (
    <div className="mx-auto max-w-md px-4 py-5">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-[var(--text)]">Histórico</h1>
        <p className="mt-0.5 text-[12px] text-[var(--text-2)]">Seus últimos 6 meses</p>
      </div>

      {!temDados ? (
        <EmptyState
          variant="card"
          icon={BarChart3}
          title="Sem histórico ainda"
          description="Os dados dos seus meses anteriores aparecerão aqui."
        />
      ) : (
        <>
          {/* Gráfico comparativo */}
          <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
            <p className="mb-3 font-display text-[14px] font-semibold text-[var(--text)]">
              Receita por mês
            </p>
            <HistoricoChart data={months} />
          </div>

          {/* Cards de cada mês */}
          <div className="mb-4 space-y-2">
            {[...months].reverse().map((m, i) => {
              const isCurrentMonth = i === 0
              return (
                <div
                  key={m.mes}
                  className={`rounded-xl border p-4 ${
                    isCurrentMonth
                      ? 'border-[rgba(0,212,255,0.25)] bg-[rgba(0,212,255,0.04)]'
                      : 'border-[var(--line)] bg-[var(--bg-1)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-2)]">
                        {m.label}
                        {isCurrentMonth && (
                          <span className="ml-2 rounded-full bg-[var(--cyan)]/15 px-2 py-0.5 text-[9px] font-bold text-[var(--cyan)]">
                            Mês atual
                          </span>
                        )}
                      </p>
                      <p className="mt-1 font-mono text-[16px] font-bold text-[var(--text)]">
                        {fmtBRL(m.arrecadacao)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-[var(--text-3)]">{m.totalVisitas} visitas</p>
                      <p
                        className={`mt-0.5 font-mono text-[13px] font-bold ${
                          m.taxaSucesso >= 70
                            ? 'text-[var(--green)]'
                            : m.taxaSucesso >= 55
                              ? 'text-[var(--cyan)]'
                              : m.totalVisitas === 0
                                ? 'text-[var(--text-3)]'
                                : 'text-[var(--amber)]'
                        }`}
                      >
                        {m.totalVisitas > 0 ? `${m.taxaSucesso.toFixed(0)}%` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Wrapped do mês anterior */}
          {mesAnterior.totalVisitas > 0 && (
            <div
              className="rounded-2xl border p-5"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(30,107,255,0.04))',
                borderColor: 'rgba(0,212,255,0.18)',
              }}
            >
              <p className="mb-3 font-display text-[14px] font-semibold capitalize text-[var(--cyan)]">
                Destaque de {mesAnterior.label}
              </p>
              <ul className="space-y-3">
                <li className="flex gap-2.5 text-[12px] leading-relaxed text-[var(--text-2)]">
                  <span className="font-display font-extrabold text-[var(--cyan)]">01</span>
                  <span>
                    <strong className="text-[var(--text)]">
                      {mesAnterior.finalizadas} OS finalizadas
                    </strong>{' '}
                    de {mesAnterior.totalVisitas} executadas (
                    {mesAnterior.taxaSucesso.toFixed(0)}% de sucesso)
                  </span>
                </li>
                <li className="flex gap-2.5 text-[12px] leading-relaxed text-[var(--text-2)]">
                  <span className="font-display font-extrabold text-[var(--cyan)]">02</span>
                  <span>
                    <strong className="text-[var(--text)]">
                      {fmtBRL(mesAnterior.arrecadacao)}
                    </strong>{' '}
                    em valor recebido no período
                  </span>
                </li>
                {melhorMes.mes !== mesAnterior.mes && melhorMes.totalVisitas > 0 && (
                  <li className="flex gap-2.5 text-[12px] leading-relaxed text-[var(--text-2)]">
                    <span className="font-display font-extrabold text-[var(--cyan)]">03</span>
                    <span>
                      Seu melhor mês recente foi{' '}
                      <strong className="text-[var(--text)] capitalize">{melhorMes.label}</strong>{' '}
                      com {fmtBRL(melhorMes.arrecadacao)}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
