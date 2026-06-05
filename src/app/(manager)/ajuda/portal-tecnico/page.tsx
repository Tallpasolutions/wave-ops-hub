import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Portal do técnico' }

export default function PortalTecnicoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <Link
        href="/ajuda"
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text)]"
      >
        <ChevronLeft size={14} /> Central de Ajuda
      </Link>

      <article className="space-y-4 text-[var(--text-2)]">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Portal do técnico</h1>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Como o técnico acessa</h2>
        <p className="leading-relaxed">
          O técnico acessa pelo mesmo endereço do portal do gestor (ex:{' '}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">wave.tallpa.com.br</code>).
          As credenciais (e-mail e senha inicial) são fornecidas pelo gestor no momento do cadastro.
        </p>
        <p className="leading-relaxed">
          No primeiro acesso, o técnico receberá um e-mail para definir sua própria senha.
        </p>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Painel (tela inicial)</h2>
        <p className="leading-relaxed">A tela inicial exibe os KPIs do período selecionado:</p>
        <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
          <li><strong className="font-medium text-[var(--text)]">Visitas realizadas</strong> — total de visitas no mês</li>
          <li><strong className="font-medium text-[var(--text)]">Pagamentos aprovados</strong> — valor total aprovado para pagamento</li>
          <li><strong className="font-medium text-[var(--text)]">Improdutivas</strong> — número de visitas não concluídas</li>
        </ul>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Aba Visitas</h2>
        <p className="leading-relaxed">
          Lista todas as visitas do período com data, número da OS, finalidade, cidade, status do pagamento e valor calculado.
        </p>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Aba Histórico</h2>
        <p className="leading-relaxed">
          Gráfico de barras com a evolução mensal dos pagamentos nos últimos meses. Permite visualizar
          tendências e comparar desempenho entre períodos.
        </p>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Aba Perfil</h2>
        <p className="leading-relaxed">
          Permite ao técnico atualizar nome completo, celular e senha de acesso. E-mail e CPF são
          gerenciados pelo gestor e não podem ser alterados pelo técnico.
        </p>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Notificações</h2>
        <p className="leading-relaxed">
          O ícone de sino no topo da tela exibe notificações do sistema, como fechamento aprovado e
          pagamento realizado.
        </p>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-4 text-sm">
          <strong className="font-medium text-[var(--text)]">Dúvidas do técnico:</strong> oriente o técnico
          a entrar em contato com o gestor responsável da equipe em caso de problemas de acesso ou dados incorretos.
        </div>
      </article>
    </div>
  )
}
