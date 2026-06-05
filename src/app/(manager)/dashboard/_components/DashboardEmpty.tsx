import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

interface Props {
  periodLabel: string
}

export function DashboardEmpty({ periodLabel }: Props) {
  return (
    <EmptyState
      icon={BarChart3}
      title={`Nenhuma OS em ${periodLabel}`}
      description="Selecione outro período ou envie a planilha do mês para começar."
      cta={{ label: 'Fazer upload', href: '/uploads/new' }}
    />
  )
}
