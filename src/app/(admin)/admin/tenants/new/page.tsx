'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createTenant } from '../actions'

const initialState = { error: null as string | null }

export default function TenantNewPage() {
  const [state, formAction, isPending] = useActionState(createTenant, initialState)

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link
          href="/admin/tenants"
          className="mb-4 flex items-center gap-2 text-sm text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft size={14} />
          Voltar para Tenants
        </Link>
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Novo Tenant</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Cadastre um novo cliente na plataforma
        </p>
      </div>

      <div className="max-w-lg rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-6">
        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="slug" className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
              Slug
            </Label>
            <Input
              id="slug"
              name="slug"
              type="text"
              placeholder="ex: wave"
              pattern="^[a-z0-9-]{2,32}$"
              title="Apenas letras minúsculas, números e hífens (2–32 caracteres)"
              required
            />
            <p className="text-xs text-[var(--text-3)]">
              Usado como subdomínio: <span className="font-mono text-[var(--cyan)]">slug.tallpa.com.br</span>
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nome" className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
              Nome
            </Label>
            <Input
              id="nome"
              name="nome"
              type="text"
              placeholder="ex: Wave Telecom"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="plano" className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
              Plano
            </Label>
            <Select name="plano" defaultValue="starter" required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state.error && (
            <p className="rounded-lg bg-[rgba(255,84,112,0.1)] px-3 py-2 text-sm text-[var(--red)]">
              {state.error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? 'Criando…' : 'Criar Tenant'}
            </Button>
            <Link href="/admin/tenants">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
