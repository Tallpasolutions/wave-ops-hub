import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Aprovar fechamento' }

export default function AprovarFechamentoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <Link
        href="/ajuda"
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text)]"
      >
        <ChevronLeft size={14} /> Central de Ajuda
      </Link>

      <article className="space-y-4 text-[var(--text-2)]">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Aprovar fechamento</h1>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">O fluxo do fechamento mensal</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {['Aberto', 'Aguardando Aprovação', 'Aprovado', 'Pago'].map((status, i, arr) => (
            <span key={status} className="flex items-center gap-2">
              <span className="rounded-full border border-[var(--line)] bg-[var(--bg-1)] px-3 py-1 font-medium text-[var(--text)]">
                {status}
              </span>
              {i < arr.length - 1 && <span className="text-[var(--text-3)]">→</span>}
            </span>
          ))}
        </div>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">1. Verificar o fechamento</h2>
        <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
          <li>No menu lateral, clique em <strong className="font-medium text-[var(--text)]">Fechamento</strong></li>
          <li>Localize o card do mês desejado e clique para abrir</li>
          <li>Revise os KPIs: total a pagar, número de técnicos e visitas</li>
          <li>Verifique se há pagamentos pendentes de revisão e resolva antes de prosseguir</li>
        </ol>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">2. Solicitar aprovação</h2>
        <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
          <li>Na página do fechamento, clique em <strong className="font-medium text-[var(--text)]">Solicitar Aprovação</strong></li>
          <li>O status muda para <strong className="font-medium text-[var(--text)]">Aguardando Aprovação</strong></li>
          <li>O responsável pela aprovação é notificado</li>
        </ol>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">3. Aprovar o fechamento</h2>
        <p className="leading-relaxed">
          Disponível para <strong className="font-medium text-[var(--text)]">Proprietário</strong> e{' '}
          <strong className="font-medium text-[var(--text)]">Admin Tallpa</strong>:
        </p>
        <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
          <li>Abra o fechamento em status &quot;Aguardando Aprovação&quot;</li>
          <li>Revise os valores finais</li>
          <li>Clique em <strong className="font-medium text-[var(--text)]">Aprovar Fechamento</strong></li>
        </ol>
        <p className="leading-relaxed">
          Os técnicos recebem uma notificação de que o fechamento foi aprovado.
        </p>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">4. Marcar como pago</h2>
        <p className="leading-relaxed">
          Após realizar os pagamentos fora do sistema, abra o fechamento aprovado e clique em{' '}
          <strong className="font-medium text-[var(--text)]">Marcar como Pago</strong>. Os técnicos recebem
          notificação de pagamento e o ciclo é encerrado.
        </p>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Exportar relatórios</h2>
        <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
          <li><strong className="font-medium text-[var(--text)]">Excel</strong> — planilha com 3 abas: resumo consolidado, detalhe por visita, resumo por técnico</li>
          <li><strong className="font-medium text-[var(--text)]">PDF Consolidado</strong> — relatório de todos os técnicos em um único arquivo</li>
          <li><strong className="font-medium text-[var(--text)]">PDF Individual</strong> — um PDF por técnico, acessível pelo nome na tabela</li>
        </ul>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-4 text-sm">
          <strong className="font-medium text-[var(--text)]">Reabrir um fechamento:</strong> fechamentos
          aprovados ou pagos só podem ser reabertos pelo administrador Tallpa. Entre em contato com o suporte
          se necessário.
        </div>
      </article>
    </div>
  )
}
