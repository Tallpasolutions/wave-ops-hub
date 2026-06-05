import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Perguntas frequentes' }

const FAQS = [
  {
    section: 'Login e acesso',
    items: [
      {
        q: 'Não consigo fazer login.',
        a: 'Verifique se o e-mail digitado é o mesmo cadastrado pelo gestor. Se a senha estiver incorreta, use o link "Esqueci minha senha" na tela de login. Verifique também a caixa de spam.',
      },
      {
        q: 'Não recebi o e-mail de primeiro acesso.',
        a: 'Verifique a pasta de spam. Se não encontrar, solicite ao gestor que reenvie o convite ou redefina a senha pelo painel de administração.',
      },
    ],
  },
  {
    section: 'Upload de planilha',
    items: [
      {
        q: 'O upload ficou preso em "Processando".',
        a: 'Aguarde até 2 minutos. Se o status não mudar, recarregue a página e tente reprocessar. Se persistir, entre em contato com o suporte.',
      },
      {
        q: 'O upload retornou "Erro". O que fazer?',
        a: 'Abra o upload e leia a mensagem de erro. As causas mais comuns são: coluna obrigatória ausente, formato de data incorreto ou arquivo corrompido. Corrija e faça um novo upload.',
      },
      {
        q: 'Posso enviar a mesma planilha duas vezes?',
        a: 'Sim, mas o sistema detecta arquivos idênticos automaticamente e os marca como duplicata, sem criar dados duplicados.',
      },
    ],
  },
  {
    section: 'Técnicos e visitas',
    items: [
      {
        q: 'O técnico não aparece vinculado às visitas da planilha.',
        a: 'O sistema casa o nome da planilha com o Código Unetvale cadastrado no técnico. Verifique se o código bate exatamente. Use a vinculação manual em Uploads → [upload] → Vincular técnico se necessário.',
      },
      {
        q: 'O técnico não vê suas visitas no portal.',
        a: 'Confirme que o Código Unetvale no cadastro do técnico bate com o nome usado na planilha. Verifique também se o período selecionado no portal está correto.',
      },
    ],
  },
  {
    section: 'Pagamentos e LPU',
    items: [
      {
        q: 'Um pagamento aparece como "Sem regra".',
        a: 'Nenhuma regra da LPU ativa se aplicou à visita. Revise as condições das regras e compare com os dados da visita (finalidade, tipo, cidade). Ajuste as regras e ative uma nova LPU se necessário.',
      },
      {
        q: 'O pagamento de uma visita está incorreto.',
        a: 'Em Pagamentos → [pagamento], use o botão "Override manual" para corrigir o valor e registrar o motivo. O valor calculado original é preservado para auditoria.',
      },
    ],
  },
  {
    section: 'Fechamento',
    items: [
      {
        q: 'Como reabrir um fechamento aprovado?',
        a: 'Fechamentos aprovados ou pagos só podem ser reabertos pelo administrador Tallpa. Entre em contato com o suporte da Tallpa Solutions.',
      },
      {
        q: 'Posso aprovar o fechamento com motivos pendentes?',
        a: 'Tecnicamente sim, mas não é recomendado. Motivos não classificados deixam pagamentos pendentes, o que pode resultar em valores incorretos no fechamento.',
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <Link
        href="/ajuda"
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text)]"
      >
        <ChevronLeft size={14} /> Central de Ajuda
      </Link>

      <article className="space-y-4 text-[var(--text-2)]">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Perguntas frequentes</h1>

        {FAQS.map(({ section, items }) => (
          <div key={section}>
            <h2 className="font-display text-lg font-semibold text-[var(--text)] mt-8 mb-4">{section}</h2>
            <div className="space-y-4">
              {items.map(({ q, a }) => (
                <div key={q} className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-4">
                  <p className="font-medium text-[var(--text)]">{q}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-3)]">{a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-8 rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-4 text-sm">
          <strong className="font-medium text-[var(--text)]">Suporte:</strong> para problemas não cobertos
          aqui, entre em contato com a equipe da Tallpa Solutions pelo canal de suporte fornecido no contrato.
        </div>
      </article>
    </div>
  )
}
