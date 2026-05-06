# ADR-005 — Autenticação e Autorização

**Status:** Aceito
**Data:** 2026-05-05
**Decisores:** Jhoni Cleyton (Tallpa)

---

## Contexto

O sistema tem 4 papéis distintos com acessos muito diferentes:

| Role | Quem | Pode |
|---|---|---|
| `tallpa_owner` | Sócios Tallpa | Tudo, em todos os tenants |
| `tenant_owner` | Donos da empresa cliente | Tudo no seu tenant |
| `tenant_manager` | Gestores operacionais | Operações do dia-a-dia, exceto criar outros owners e gerenciar billing |
| `tenant_technician` | Técnicos | Apenas seus próprios dados |

A autenticação precisa ser robusta o suficiente para uso comercial, mas simples o suficiente para técnicos em campo.

---

## Decisão

### Autenticação: e-mail + senha via Supabase Auth

Para todos os papéis, sem exceção. Decidido pelo cliente.

- Supabase Auth gerencia tudo (signup, login, recuperação de senha, sessões)
- Senhas são hasheadas pelo Supabase (bcrypt)
- Sessões via JWT
- Recuperação de senha via e-mail

### Autorização: claims customizadas no JWT + RLS

Quando o usuário se autentica, o JWT contém:

```json
{
  "sub": "<user_id>",
  "email": "...",
  "role": "tenant_manager",
  "tenant_id": "<uuid>",
  "technician_id": "<uuid|null>"
}
```

`role` e `tenant_id` são adicionados via [Supabase Auth Hook](https://supabase.com/docs/guides/auth/auth-hooks) que lê da tabela `users` ao gerar o token.

`technician_id` (preenchido apenas para `tenant_technician`) permite RLS filtrar dados pelo técnico específico.

### Tabela `users`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id), -- NULL para tallpa_owner
  email TEXT NOT NULL UNIQUE,
  nome_completo TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('tallpa_owner', 'tenant_owner', 'tenant_manager', 'tenant_technician')),
  technician_id UUID REFERENCES technicians(id), -- preenchido apenas para tenant_technician
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (role = 'tallpa_owner' AND tenant_id IS NULL) OR
    (role IN ('tenant_owner', 'tenant_manager', 'tenant_technician') AND tenant_id IS NOT NULL)
  ),
  CHECK (
    (role = 'tenant_technician' AND technician_id IS NOT NULL) OR
    (role != 'tenant_technician' AND technician_id IS NULL)
  )
);
```

### Verificação de role

Helper em `src/lib/auth/permissions.ts`:

```typescript
export function canApproveClosing(user: User): boolean {
  return user.role === 'tallpa_owner' ||
         user.role === 'tenant_owner' ||
         user.role === 'tenant_manager';
}

export function canManageLpu(user: User): boolean {
  return user.role === 'tallpa_owner' ||
         user.role === 'tenant_owner' ||
         user.role === 'tenant_manager';
}

export function canManageTechnicians(user: User): boolean {
  return user.role === 'tallpa_owner' ||
         user.role === 'tenant_owner' ||
         user.role === 'tenant_manager';
}

export function canManageUsers(user: User): boolean {
  return user.role === 'tallpa_owner' ||
         user.role === 'tenant_owner';
  // tenant_manager NÃO pode criar outros usuários
}

export function canViewBilling(user: User): boolean {
  return user.role === 'tallpa_owner' ||
         user.role === 'tenant_owner';
}
```

### Server Actions

Toda Server Action começa com:

```typescript
'use server';
import { requireRole } from '@/lib/auth';

export async function approveClosing(input: ApproveInput) {
  const user = await requireRole(['tenant_owner', 'tenant_manager']);
  // ... lógica
}
```

`requireRole` lança erro se não autorizado, e Next.js intercepta apropriadamente.

### Middleware de proteção de rotas

```typescript
// src/middleware.ts (excerto)
const ROUTE_RULES = {
  '/(admin)': ['tallpa_owner'],
  '/(manager)': ['tallpa_owner', 'tenant_owner', 'tenant_manager'],
  '/(technician)': ['tallpa_owner', 'tenant_technician'],
};
```

---

## Recuperação de senha

Padrão Supabase: usuário pede recuperação → e-mail com link → página de reset → nova senha. Implementação trivial via SDK.

---

## Convite de novos usuários

Tenant owner cadastra usuário pelo painel:

1. Preenche email, nome, role, technician_id (se for técnico)
2. Sistema cria registro em `auth.users` via admin API com `email_confirm = false`
3. Sistema envia magic link de "definir senha"
4. Usuário recebe e-mail, define senha, faz primeiro login

Para técnicos, o gestor pode opcionalmente **definir uma senha inicial** ao cadastrar (caso o técnico não tenha e-mail confiável). Nesse caso o técnico recebe a senha por canal externo (WhatsApp, presencial) e é forçado a trocar no primeiro login.

---

## Sessões

- Tempo de sessão: 7 dias (Supabase default)
- Refresh automático via SDK
- Logout limpa cookies e revoga refresh token

---

## Considerados e rejeitados

### Magic link sem senha (passwordless)
**Rejeitado pelo cliente.** Foi proposta inicial, mas cliente preferiu modelo tradicional para reduzir fricção operacional (técnicos podem ter problemas pra acessar e-mail no campo).

### OAuth social (Google, Apple)
**Não implementado no MVP.** Pode ser adicionado em fase futura sem refactor.

### MFA / 2FA
**Não implementado no MVP.** Pode ser adicionado para roles `tallpa_owner` e `tenant_owner` em fase futura quando houver dados financeiros sensíveis em volume.

---

## Consequências

### Positivas
- Padrão familiar para qualquer usuário (e-mail + senha)
- Roles claras e enforced em três camadas (UI, Server Action, RLS)
- Trivial de implementar e manter (Supabase faz o pesado)

### Negativas / Trade-offs
- Senha gerenciada pelo usuário — risco de senha fraca (mitigação: validação no signup, política de senha forte)
- Sem MFA inicialmente (mitigação: roadmap futuro para roles privilegiadas)
