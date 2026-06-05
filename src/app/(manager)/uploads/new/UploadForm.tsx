'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileUp, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { prepareUpload, processUpload } from '../actions'

const MAX_SIZE_MB = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB ?? 10)
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

type UploadPhase =
  | { phase: 'idle' }
  | { phase: 'hashing' }
  | { phase: 'uploading' }
  | { phase: 'processing' }
  | { phase: 'duplicate'; uploadId: string }
  | { phase: 'error'; message: string }

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function UploadForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<UploadPhase>({ phase: 'idle' })
  const [dragOver, setDragOver] = useState(false)

  function handleFileChange(f: File | null) {
    if (!f) return

    if (!f.name.endsWith('.xlsx')) {
      setState({ phase: 'error', message: 'Apenas arquivos .xlsx são aceitos.' })
      return
    }
    if (f.size > MAX_SIZE_BYTES) {
      setState({ phase: 'error', message: `Arquivo muito grande. Limite: ${MAX_SIZE_MB} MB.` })
      return
    }

    setFile(f)
    setState({ phase: 'idle' })
  }

  async function handleSubmit() {
    if (!file) return

    try {
      setState({ phase: 'hashing' })
      const hash = await computeSHA256(file)

      const result = await prepareUpload(file.name, hash)

      if (result.duplicate) {
        setState({ phase: 'duplicate', uploadId: result.uploadId })
        return
      }

      setState({ phase: 'uploading' })
      const uploadRes = await fetch(result.signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      if (!uploadRes.ok) {
        setState({ phase: 'error', message: 'Falha ao enviar arquivo para o Storage.' })
        return
      }

      setState({ phase: 'processing' })
      await processUpload(result.uploadId)

      router.push(`/uploads/${result.uploadId}`)
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Erro desconhecido. Tente novamente.',
      })
    }
  }

  const busy =
    state.phase === 'hashing' ||
    state.phase === 'uploading' ||
    state.phase === 'processing'

  return (
    <div className="max-w-xl">
      <div
        className={`relative rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver
            ? 'border-[var(--cyan)] bg-[rgba(0,229,255,0.05)]'
            : 'border-[var(--line)] bg-[var(--bg-1)]'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const dropped = e.dataTransfer.files[0]
          if (dropped) handleFileChange(dropped)
        }}
      >
        <FileUp size={32} className="mx-auto mb-3 text-[var(--text-3)]" />
        <p className="mb-1 text-sm font-medium text-[var(--text)]">
          {file ? file.name : 'Arraste a planilha aqui ou clique para selecionar'}
        </p>
        <p className="text-xs text-[var(--text-3)]">
          {file
            ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
            : `Apenas .xlsx — até ${MAX_SIZE_MB} MB`}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
      </div>

      {state.phase === 'error' && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[rgba(255,84,112,0.3)] bg-[rgba(255,84,112,0.08)] px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--red)]" />
          <p className="text-sm text-[var(--red)]">{state.message}</p>
        </div>
      )}

      {state.phase === 'duplicate' && (
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3">
          <p className="text-sm text-[var(--text-2)]">
            Este arquivo já foi enviado anteriormente.{' '}
            <Link
              href={`/uploads/${state.uploadId}`}
              className="text-[var(--cyan)] hover:underline"
            >
              Ver upload existente
            </Link>
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={!file || busy || state.phase === 'duplicate'}
        >
          {state.phase === 'hashing' && 'Calculando hash...'}
          {state.phase === 'uploading' && 'Enviando...'}
          {state.phase === 'processing' && 'Processando...'}
          {(state.phase === 'idle' || state.phase === 'error') && 'Enviar planilha'}
          {state.phase === 'duplicate' && 'Enviar planilha'}
        </Button>
        {!busy && (
          <Link href="/uploads" className="text-sm text-[var(--text-3)] hover:text-[var(--text)]">
            Cancelar
          </Link>
        )}
      </div>
    </div>
  )
}
