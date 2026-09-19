import { CalendarClock, Navigation, ClipboardCheck, CircleCheck, CircleSlash } from 'lucide-react'

type Marco = { label: string; em: string | null; icone: typeof CalendarClock }

// Hora local em pt-BR. Recebe timestamptz do banco, que o toLocaleString já converte.
function hora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  criadaEm: string
  deslocamentoEm: string | null
  chegadaEm: string | null
  iniciadaEm: string | null
  concluidaEm: string | null
  canceladaEm: string | null
}

export function LinhaDoTempo(p: Props) {
  const marcos: Marco[] = [
    { label: 'Agendada', em: p.criadaEm, icone: CalendarClock },
    { label: 'Saiu para o local', em: p.deslocamentoEm, icone: Navigation },
    { label: 'Chegou', em: p.chegadaEm, icone: Navigation },
    { label: 'Iniciou a vistoria', em: p.iniciadaEm, icone: ClipboardCheck },
    { label: 'Finalizou', em: p.concluidaEm, icone: CircleCheck },
  ]

  if (p.canceladaEm) {
    marcos.push({ label: 'Cancelada', em: p.canceladaEm, icone: CircleSlash })
  }

  // Marcos sem hora aparecem apagados em vez de sumirem: o gestor precisa ver o que FALTA
  // acontecer, não só o que já aconteceu. Deslocamento vazio numa supervisão em campo
  // significa que o supervisor pulou o registro da saída — e isso é informação.
  return (
    <ol className="flex flex-col gap-3">
      {marcos.map((m) => {
        const Icone = m.icone
        const feito = !!m.em
        return (
          <li key={m.label} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                feito
                  ? 'bg-[rgba(0,212,255,0.12)] text-[var(--cyan)]'
                  : 'bg-white/[0.04] text-[var(--text-3)]'
              }`}
            >
              <Icone size={14} />
            </span>
            <span className={`text-sm ${feito ? 'text-[var(--text)]' : 'text-[var(--text-3)]'}`}>
              {m.label}
            </span>
            <span className="ml-auto font-mono text-xs text-[var(--text-3)]">
              {m.em ? hora(m.em) : '—'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
