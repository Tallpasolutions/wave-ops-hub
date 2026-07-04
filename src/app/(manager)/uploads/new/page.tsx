import type { Metadata } from 'next'
import { UploadForm } from './UploadForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Novo Upload' }

export default function NewUploadPage() {
  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Novo Upload</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Envie a planilha XLSX com as visitas do período
        </p>
      </div>
      <UploadForm />
    </div>
  )
}
