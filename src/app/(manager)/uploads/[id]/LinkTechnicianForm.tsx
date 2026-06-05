'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { linkTechnicianRaw } from '../actions'

type Props = {
  tecnicoRaw: string
  visitCount: number
  technicians: { id: string; nome_completo: string }[]
  uploadId: string
}

export function LinkTechnicianForm({ tecnicoRaw, visitCount, technicians, uploadId }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [isPending, startTransition] = useTransition()
  const [linkError, setLinkError] = useState<string | null>(null)

  const cleanName = tecnicoRaw.replace(/^WAVE\s*-\s*/i, '').trim()

  function handleLink() {
    if (!selectedId) return
    setLinkError(null)
    startTransition(async () => {
      const result = await linkTechnicianRaw(tecnicoRaw, selectedId, uploadId)
      if (result.error) setLinkError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--line)] py-4 last:border-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text)]">{cleanName}</p>
        <p className="text-xs text-[var(--text-3)]">
          {visitCount} {visitCount === 1 ? 'visita não vinculada' : 'visitas não vinculadas'}
        </p>
        {linkError && (
          <p className="mt-1 text-xs text-[var(--red)]">{linkError}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedId} onValueChange={setSelectedId} disabled={isPending}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecionar técnico..." />
          </SelectTrigger>
          <SelectContent>
            {technicians.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nome_completo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleLink}
          disabled={!selectedId || isPending}
          size="sm"
        >
          {isPending ? 'Vinculando…' : 'Vincular'}
        </Button>

        <Link
          href={`/equipe/tecnicos/new?nomeCompleto=${encodeURIComponent(cleanName)}&from=/uploads/${uploadId}`}
          className="whitespace-nowrap text-xs text-[var(--blue)] underline-offset-2 hover:underline"
        >
          Cadastrar novo
        </Link>
      </div>
    </div>
  )
}
