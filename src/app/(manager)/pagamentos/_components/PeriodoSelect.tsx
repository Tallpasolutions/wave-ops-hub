'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { buildPeriodOptions } from '../../_lib/period'

function getCurrentMes(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function PeriodoSelect() {
  const router = useRouter()
  const params = useSearchParams()
  const mesAtual = params.get('mes') ?? getCurrentMes()
  const options = buildPeriodOptions()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const p = new URLSearchParams(params.toString())
    p.set('mes', e.target.value)
    router.push('/pagamentos?' + p.toString())
  }

  return (
    <select
      value={mesAtual}
      onChange={handleChange}
      className="h-9 rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-3 text-sm font-medium text-[var(--text)] outline-none focus:border-[var(--cyan)]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
