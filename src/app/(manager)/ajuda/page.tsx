import type { Metadata } from 'next'
import Link from 'next/link'
import { LogIn, FileUp, ScrollText, Tag, CalendarCheck, HardHat, HelpCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Central de Ajuda' }

const GUIDES = [
  {
    href: '/ajuda/primeiros-passos',
    icon: LogIn,
    title: 'Primeiros passos',
    description: 'Login, primeiro acesso, navegação e como atualizar seu perfil.',
  },
  {
    href: '/ajuda/upload-planilha',
    icon: FileUp,
    title: 'Upload de planilha',
    description: 'Formato esperado, passo a passo de envio e significado dos status.',
  },
  {
    href: '/ajuda/configurar-lpu',
    icon: ScrollText,
    title: 'Configurar LPU',
    description: 'Como criar a lista de preços, adicionar regras e ativar.',
  },
  {
    href: '/ajuda/classificar-motivos',
    icon: Tag,
    title: 'Classificar motivos',
    description: 'Categorias de improdutiva e impacto no cálculo de pagamento.',
  },
  {
    href: '/ajuda/aprovar-fechamento',
    icon: CalendarCheck,
    title: 'Aprovar fechamento',
    description: 'Fluxo completo do fechamento mensal e exportação de relatórios.',
  },
  {
    href: '/ajuda/portal-tecnico',
    icon: HardHat,
    title: 'Portal do técnico',
    description: 'Como o técnico acessa a plataforma e usa o portal mobile.',
  },
  {
    href: '/ajuda/faq',
    icon: HelpCircle,
    title: 'Perguntas frequentes',
    description: 'Respostas para as dúvidas mais comuns da equipe.',
  },
]

export default function AjudaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-bold text-[var(--text)]">Central de Ajuda</h1>
      <p className="mt-2 text-sm text-[var(--text-3)]">
        Guias de uso da plataforma Wave Ops Hub.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {GUIDES.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="flex gap-4 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 transition-colors hover:border-[var(--cyan)]/40 hover:bg-[var(--grad-soft)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--cyan)]/10 text-[var(--cyan)]">
              <Icon size={20} />
            </div>
            <div>
              <p className="font-medium text-[var(--text)]">{title}</p>
              <p className="mt-0.5 text-sm text-[var(--text-3)]">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
