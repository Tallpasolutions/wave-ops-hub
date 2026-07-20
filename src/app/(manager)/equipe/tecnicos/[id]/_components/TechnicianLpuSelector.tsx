'use client'
import { useState, useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setTechnicianLpu } from '../../actions'

type Lpu = { id: string; nome: string; ativa: boolean }

const DEFAULT = '__default__'

export function TechnicianLpuSelector({
  technicianId,
  currentLpuId,
  lpus,
}: {
  technicianId: string
  currentLpuId: string | null
  lpus: Lpu[]
}) {
  const [value, setValue] = useState(currentLpuId ?? DEFAULT)
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const ativa = lpus.find((l) => l.ativa)
  const alternativas = lpus.filter((l) => !l.ativa)

  function onChange(v: string) {
    setValue(v)
    setMsg(null)
    const lpuId = v === DEFAULT ? null : v
    startTransition(async () => {
      const r = await setTechnicianLpu(technicianId, lpuId)
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: 'LPU atualizada e payouts recalculados.' })
    })
  }

  return (
    <div className="mb-8 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
      <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
        LPU do técnico
      </h2>
      <p className="mb-3 text-xs text-[var(--text-3)]">
        Tabela de valores usada no cálculo dos payouts deste técnico.
      </p>
      <Select value={value} onValueChange={onChange} disabled={isPending}>
        <SelectTrigger className="w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>
            Padrão do tenant{ativa ? ` (${ativa.nome})` : ''}
          </SelectItem>
          {alternativas.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {msg && (
        <p className={`mt-2 text-xs ${msg.ok ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
