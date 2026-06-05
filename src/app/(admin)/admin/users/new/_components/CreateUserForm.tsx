'use client'
import { useActionState, useState } from 'react'
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
import { createUser } from '../../actions'
import type { AppRole } from '@/lib/auth/types'

type TenantOption = { id: string; slug: string; nome: string }

const initialState = { error: null as string | null }

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'tallpa_owner', label: 'Admin Tallpa' },
  { value: 'tenant_owner', label: 'Proprietário' },
  { value: 'tenant_manager', label: 'Gerente' },
  { value: 'tenant_technician', label: 'Técnico' },
]

export function CreateUserForm({ tenants }: { tenants: TenantOption[] }) {
  const [state, formAction, isPending] = useActionState(createUser, initialState)
  const [selectedRole, setSelectedRole] = useState<AppRole>('tenant_owner')

  const needsTenant = selectedRole !== 'tallpa_owner'

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link
          href="/admin/users"
          className="mb-4 flex items-center gap-2 text-sm text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft size={14} />
          Voltar para Usuários
        </Link>
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Novo Usuário</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">Cadastre um novo usuário na plataforma</p>
      </div>

      <div className="max-w-lg rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-6">
        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="nomeCompleto"
              className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
            >
              Nome completo
            </Label>
            <Input
              id="nomeCompleto"
              name="nomeCompleto"
              type="text"
              placeholder="Nome Sobrenome"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="email"
              className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
            >
              E-mail
            </Label>
            <Input id="email" name="email" type="email" placeholder="usuario@empresa.com" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="role"
              className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
            >
              Cargo
            </Label>
            <Select
              name="role"
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v as AppRole)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cargo" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsTenant && (
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="tenantId"
                className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
              >
                Tenant
              </Label>
              <Select name="tenantId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}{' '}
                      <span className="text-[var(--text-3)]">({t.slug})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="senhaInicial"
              className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
            >
              Senha inicial
            </Label>
            <Input
              id="senhaInicial"
              name="senhaInicial"
              type="password"
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
            />
            <p className="text-xs text-[var(--text-3)]">
              O usuário poderá trocar a senha no primeiro acesso.
            </p>
          </div>

          {state.error && (
            <p className="rounded-lg bg-[rgba(255,84,112,0.1)] px-3 py-2 text-sm text-[var(--red)]">
              {state.error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? 'Criando…' : 'Criar Usuário'}
            </Button>
            <Link href="/admin/users">
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
