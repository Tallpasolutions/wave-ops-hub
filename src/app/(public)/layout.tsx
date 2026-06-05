import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { template: '%s | Wave Ops Hub', default: 'Acesso — Wave Ops Hub' },
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
