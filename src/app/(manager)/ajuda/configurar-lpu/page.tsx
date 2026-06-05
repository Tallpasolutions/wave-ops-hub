import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Configurar LPU' }

export default function ConfigurarLpuPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <Link
        href="/ajuda"
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text)]"
      >
        <ChevronLeft size={14} /> Central de Ajuda
      </Link>

      <article className="space-y-4 text-[var(--text-2)]">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Configurar LPU</h1>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">O que é LPU</h2>
        <p className="leading-relaxed">
          LPU (Lista de Preços Unitários) é o conjunto de regras que define{' '}
          <strong className="font-medium text-[var(--text)]">quanto pagar ao técnico</strong> por cada visita
          realizada. Sem uma LPU ativa, os pagamentos não são calculados.
        </p>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-4 text-sm">
          Configure a LPU <strong className="font-medium text-[var(--text)]">antes</strong> de processar a
          primeira planilha do mês para garantir que os pagamentos sejam calculados corretamente.
        </div>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Criar uma nova LPU</h2>
        <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
          <li>No menu lateral, clique em <strong className="font-medium text-[var(--text)]">LPU</strong></li>
          <li>Clique em <strong className="font-medium text-[var(--text)]">Nova LPU</strong></li>
          <li>Preencha o nome (ex: &quot;LPU Maio 2026&quot;) e a data de início de vigência</li>
          <li>Clique em <strong className="font-medium text-[var(--text)]">Criar LPU</strong></li>
        </ol>
        <p className="leading-relaxed">
          A LPU é criada como <strong className="font-medium text-[var(--text)]">Rascunho</strong> — ainda
          não está ativa e não afeta os cálculos.
        </p>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Adicionar regras</h2>
        <p className="leading-relaxed">
          Com a LPU aberta, clique em <strong className="font-medium text-[var(--text)]">Nova Regra</strong>.
          Cada regra define condições e o pagamento correspondente:
        </p>
        <p className="leading-relaxed font-medium text-[var(--text)]">Condições disponíveis:</p>
        <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
          <li>Finalidade (ex: Instalação, Suporte Fibra)</li>
          <li>Tipo de atendimento (ex: Externo, Interno)</li>
          <li>Cidade</li>
          <li>Sucesso (visita concluída ou improdutiva)</li>
          <li>Outros campos da visita</li>
        </ul>
        <p className="leading-relaxed font-medium text-[var(--text)]">Tipos de pagamento:</p>
        <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
          <li><strong className="font-medium text-[var(--text)]">Valor fixo</strong> — um valor em reais independente de variáveis</li>
          <li><strong className="font-medium text-[var(--text)]">Fórmula</strong> — cálculo baseado em campos da visita</li>
          <li><strong className="font-medium text-[var(--text)]">Percentual</strong> — percentual do valor recebido da Unetvale</li>
        </ul>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Simular antes de ativar</h2>
        <p className="leading-relaxed">
          Use o botão <strong className="font-medium text-[var(--text)]">Simulação</strong> na página da LPU
          para ver como as regras se aplicariam às visitas já processadas. Verifique quantas visitas ficam
          sem regra e a distribuição de pagamentos por técnico antes de ativar.
        </p>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Ativar a LPU</h2>
        <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
          <li>Abra a LPU em Rascunho</li>
          <li>Clique em <strong className="font-medium text-[var(--text)]">Ativar esta LPU</strong></li>
          <li>Confirme a ação</li>
        </ol>
        <p className="leading-relaxed">
          A LPU anterior é desativada automaticamente. O sistema recalcula os pagamentos pendentes.
        </p>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-4 text-sm">
          <strong className="font-medium text-[var(--text)]">Atenção:</strong> pagamentos já{' '}
          <strong className="font-medium text-[var(--text)]">aprovados ou pagos</strong> não são recalculados
          ao ativar uma nova LPU.
        </div>
      </article>
    </div>
  )
}
