import { Navigation, ClipboardCheck } from 'lucide-react'
import { proximaAcao, type StatusSupervisao } from '@/lib/supervisao'
import { avancarStatus } from '../../actions'

// Os três momentos em campo. "Finalizar vistoria" NÃO aparece aqui: concluir tem regra
// própria (checklist completo, fotos obrigatórias, parecer) e vive no formulário de
// conclusão, no fim da tela.
export function BotaoAcao({
  supervisaoId,
  status,
}: {
  supervisaoId: string
  status: StatusSupervisao
}) {
  const acao = proximaAcao(status)
  if (!acao || acao.proximoStatus === 'concluida') return null

  const avancar = avancarStatus.bind(null, supervisaoId, acao.proximoStatus)
  const Icone = acao.proximoStatus === 'em_deslocamento' ? Navigation : ClipboardCheck

  return (
    <form action={avancar}>
      <button
        type="submit"
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--cyan)] px-4 text-sm font-bold text-[#04121a] transition-opacity active:opacity-80"
      >
        <Icone size={18} />
        {acao.label}
      </button>
    </form>
  )
}
