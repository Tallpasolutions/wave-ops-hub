type PillVariant = 'green' | 'amber' | 'red' | 'cyan'

interface Props {
  label: string
  value: string
  valueSuffix?: string
  valueGradient?: boolean
  pill?: { text: string; variant: PillVariant }
  foot?: string
}

const PILL_CLASSES: Record<PillVariant, string> = {
  green: 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]',
  amber: 'bg-[rgba(255,181,71,0.12)] text-[var(--amber)]',
  red: 'bg-[rgba(255,84,112,0.13)] text-[var(--red)]',
  cyan: 'bg-[rgba(0,212,255,0.12)] text-[var(--cyan)]',
}

export function KpiCard({ label, value, valueSuffix, valueGradient, pill, foot }: Props) {
  return (
    <div className="group relative overflow-hidden rounded-[14px] border border-[var(--line)] bg-gradient-to-b from-[var(--bg-1)] to-[rgba(13,21,48,0.6)] px-[18px] py-5 transition-colors hover:border-[var(--line-strong)]">
      {/* top gradient line */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-grad opacity-70" />

      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[1.4px] text-[var(--text-3)]">
        {label}
      </p>

      <p
        className={`font-display text-[clamp(20px,2.2vw,28px)] font-bold leading-none tracking-[-1px] mb-2 whitespace-nowrap tabular-nums ${
          valueGradient
            ? 'bg-grad bg-clip-text text-transparent'
            : 'text-[var(--text)]'
        }`}
      >
        {value}
        {valueSuffix && (
          <span className="font-body text-lg font-normal text-[var(--text-2)]">{valueSuffix}</span>
        )}
      </p>

      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-2)]">
        {pill && (
          <span
            className={`font-mono text-[10px] font-bold rounded px-1.5 py-0.5 ${PILL_CLASSES[pill.variant]}`}
          >
            {pill.text}
          </span>
        )}
        {foot && <span>{foot}</span>}
      </div>
    </div>
  )
}
