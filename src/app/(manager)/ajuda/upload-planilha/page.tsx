import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Upload de planilha' }

export default function UploadPlanilhaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <Link
        href="/ajuda"
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text)]"
      >
        <ChevronLeft size={14} /> Central de Ajuda
      </Link>

      <article className="space-y-4 text-[var(--text-2)]">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Upload de planilha</h1>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Formato esperado</h2>
        <p className="leading-relaxed">
          A planilha deve estar no formato <strong className="font-medium text-[var(--text)]">.xlsx</strong> com
          as seguintes colunas obrigatórias:
        </p>
        <div className="rounded-xl border border-[var(--line)] overflow-hidden text-sm">
          {[
            ['Data', 'Data de execução da visita (DD/MM/AAAA)'],
            ['OS', 'Número da Ordem de Serviço'],
            ['Tecnico', 'Nome do técnico responsável'],
            ['Finalidade', 'Tipo de serviço (ex: Instalação, Suporte Fibra)'],
            ['TipoAtendimento', 'Externo, Interno, etc.'],
            ['Cidade', 'Cidade do atendimento'],
            ['Sucesso', '"Sim" se resolvida, "Não" se improdutiva'],
            ['Improdutiva', 'Motivo da não-conclusão (quando Sucesso = Não)'],
            ['Valor', 'Valor recebido pela Unetvale'],
          ].map(([col, desc], i) => (
            <div
              key={col}
              className={`flex gap-4 px-4 py-3 ${i % 2 === 0 ? 'bg-[var(--bg-1)]' : 'bg-[var(--bg)]'}`}
            >
              <span className="w-36 shrink-0 font-mono text-xs font-medium text-[var(--cyan)]">{col}</span>
              <span className="text-[var(--text-3)]">{desc}</span>
            </div>
          ))}
        </div>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Passo a passo para enviar</h2>
        <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
          <li>No menu lateral, clique em <strong className="font-medium text-[var(--text)]">Uploads</strong></li>
          <li>Clique em <strong className="font-medium text-[var(--text)]">Nova Planilha</strong></li>
          <li>Arraste o arquivo <code className="rounded bg-white/10 px-1 py-0.5 text-xs">.xlsx</code> para a área indicada ou clique para selecionar</li>
          <li>Verifique que o nome do arquivo apareceu na tela</li>
          <li>Clique em <strong className="font-medium text-[var(--text)]">Enviar planilha</strong></li>
          <li>Aguarde o processamento — pode levar alguns segundos</li>
        </ol>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">Significado dos status</h2>
        <div className="rounded-xl border border-[var(--line)] overflow-hidden text-sm">
          {[
            ['Processando', 'A planilha está sendo lida e os dados inseridos'],
            ['Concluído', 'Processamento finalizado com sucesso'],
            ['Erro', 'Ocorreu uma falha — veja o log de erros na página do upload'],
            ['Duplicata', 'Este arquivo já foi enviado anteriormente'],
          ].map(([status, desc], i) => (
            <div
              key={status}
              className={`flex gap-4 px-4 py-3 ${i % 2 === 0 ? 'bg-[var(--bg-1)]' : 'bg-[var(--bg)]'}`}
            >
              <span className="w-24 shrink-0 font-medium text-[var(--text)]">{status}</span>
              <span className="text-[var(--text-3)]">{desc}</span>
            </div>
          ))}
        </div>

        <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-3">O que fazer se retornou Erro</h2>
        <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
          <li>Abra o upload clicando nele na lista</li>
          <li>Leia a mensagem de erro exibida</li>
          <li>Corrija o arquivo (colunas faltando, formato de data incorreto, etc.)</li>
          <li>Faça um novo upload com o arquivo corrigido</li>
        </ol>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-4 text-sm">
          <strong className="font-medium text-[var(--text)]">Idempotência:</strong>{' '}
          o sistema detecta automaticamente arquivos idênticos. Se tentar enviar o mesmo arquivo duas vezes,
          ele será marcado como duplicata sem criar dados duplicados.
        </div>
      </article>
    </div>
  )
}
