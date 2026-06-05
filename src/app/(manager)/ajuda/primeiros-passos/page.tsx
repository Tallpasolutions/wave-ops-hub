import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Primeiros passos' }

export default function PrimeirosPassosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <Link
        href="/ajuda"
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text)]"
      >
        <ChevronLeft size={14} /> Central de Ajuda
      </Link>

      <article className="space-y-4 text-[var(--text-2)]">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Primeiros passos</h1>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Como fazer login</h2>
        <p className="leading-relaxed">
          Acesse o portal pelo link fornecido pela Tallpa Solutions. Na tela de login, informe seu{' '}
          <strong className="font-medium text-[var(--text)]">e-mail</strong> e{' '}
          <strong className="font-medium text-[var(--text)]">senha</strong> e clique em Entrar.
        </p>
        <p className="leading-relaxed">
          Se esqueceu a senha, clique em <strong className="font-medium text-[var(--text)]">Esqueci minha senha</strong>,
          informe seu e-mail e aguarde o link de redefinição na caixa de entrada (verifique também o spam).
        </p>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Primeiro acesso</h2>
        <p className="leading-relaxed">
          Ao ser cadastrado, você receberá um e-mail com um link de primeiro acesso. Clique no link,
          defina sua senha pessoal e faça login normalmente a partir daí.
        </p>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Mapa do menu lateral</h2>
        <div className="rounded-xl border border-[var(--line)] overflow-hidden text-sm">
          {[
            ['Dashboard', 'Visão geral com KPIs do mês: visitas, pagamentos, improdutivas e margem'],
            ['Equipe', 'Lista de gestores cadastrados no tenant'],
            ['Técnicos', 'Cadastro e consulta de técnicos de campo'],
            ['Uploads', 'Envio e acompanhamento das planilhas de OSs'],
            ['Motivos', 'Classificação dos motivos de não-conclusão das visitas'],
            ['LPU', 'Configuração da Lista de Preços Unitários (regras de pagamento)'],
            ['OSs', 'Consulta e acompanhamento das Ordens de Serviço'],
            ['Pagamentos', 'Detalhe de pagamentos calculados por visita'],
            ['Financeiro', 'Visão financeira consolidada (receita, custo, margem)'],
            ['Fechamento', 'Ciclo mensal de aprovação e pagamento'],
          ].map(([item, desc], i) => (
            <div
              key={item}
              className={`flex gap-4 px-4 py-3 ${i % 2 === 0 ? 'bg-[var(--bg-1)]' : 'bg-[var(--bg)]'}`}
            >
              <span className="w-24 shrink-0 font-medium text-[var(--text)]">{item}</span>
              <span className="text-[var(--text-3)]">{desc}</span>
            </div>
          ))}
        </div>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Atualizar perfil e senha</h2>
        <p className="leading-relaxed">
          No menu lateral, vá em <strong className="font-medium text-[var(--text)]">Equipe</strong>, localize seu usuário
          e clique em editar para atualizar nome e e-mail. Para trocar a senha, use o formulário na mesma página de edição.
        </p>
      </article>
    </div>
  )
}
