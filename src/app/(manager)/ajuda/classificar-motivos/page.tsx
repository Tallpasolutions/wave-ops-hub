import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Classificar motivos' }

export default function ClassificarMotivosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <Link
        href="/ajuda"
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text)]"
      >
        <ChevronLeft size={14} /> Central de Ajuda
      </Link>

      <article className="space-y-4 text-[var(--text-2)]">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Classificar motivos</h1>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Por que classificar importa</h2>
        <p className="leading-relaxed">
          Quando uma visita é improdutiva (não concluída), o sistema cria automaticamente um motivo com o
          texto vindo da planilha. Enquanto não for classificado, o pagamento da visita fica{' '}
          <strong className="font-medium text-[var(--text)]">pendente de cálculo</strong>.
        </p>
        <p className="leading-relaxed">
          A categoria determina se o técnico recebe o pagamento de improdutiva, se o valor &quot;deixado na mesa&quot;
          é contabilizado e quem foi responsável pela falha.
        </p>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">As 4 categorias</h2>
        <div className="rounded-xl border border-[var(--line)] overflow-hidden text-sm">
          {[
            ['Falha do técnico', 'O técnico não compareceu, chegou atrasado ou cometeu erro operacional'],
            ['Falha do cliente', 'O cliente não estava presente, cancelou ou não deu acesso'],
            ['Falha externa', 'Problema de infraestrutura, clima ou situação fora do controle'],
            ['Cancelamento pelo cliente', 'O cliente solicitou cancelamento formal da OS'],
          ].map(([cat, desc], i) => (
            <div
              key={cat}
              className={`flex gap-4 px-4 py-3 ${i % 2 === 0 ? 'bg-[var(--bg-1)]' : 'bg-[var(--bg)]'}`}
            >
              <span className="w-44 shrink-0 font-medium text-[var(--text)]">{cat}</span>
              <span className="text-[var(--text-3)]">{desc}</span>
            </div>
          ))}
        </div>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Passo a passo para classificar</h2>
        <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
          <li>No menu lateral, clique em <strong className="font-medium text-[var(--text)]">Motivos</strong></li>
          <li>Clique no chip <strong className="font-medium text-[var(--text)]">Pendente</strong> para filtrar os não classificados</li>
          <li>Clique em <strong className="font-medium text-[var(--text)]">Editar</strong> no motivo desejado</li>
          <li>Selecione a categoria adequada</li>
          <li>Marque <strong className="font-medium text-[var(--text)]">Paga improdutiva</strong> se o técnico deve receber mesmo sem ter concluído</li>
          <li>Opcionalmente, informe um valor fixo de improdutiva (se vazio, usa a regra da LPU)</li>
          <li>Clique em <strong className="font-medium text-[var(--text)]">Salvar motivo</strong></li>
        </ol>
        <p className="leading-relaxed">
          O pagamento da visita é recalculado automaticamente após salvar.
        </p>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-4 text-sm">
          <strong className="font-medium text-[var(--text)]">Dica:</strong> classifique os motivos logo após
          o upload da planilha. Deixar muitos motivos pendentes no final do mês pode atrasar a aprovação do fechamento.
        </div>
      </article>
    </div>
  )
}
