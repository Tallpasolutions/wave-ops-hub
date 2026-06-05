# Configurar Custom Access Token Hook no Supabase

## O que esse passo faz

Após aplicar a migration `0002_auth_hook.sql`, a Postgres function `custom_jwt_claims`
existe no banco mas ainda não está ativa. É preciso registrá-la no painel do Supabase
para que seja chamada automaticamente toda vez que um JWT é gerado.

Sem esse registro, o JWT **não carrega** `role`, `tenant_id` nem `technician_id`,
e o RLS multi-tenant falha silenciosamente (todas as queries retornam vazio).

---

## Pré-requisito: aplicar a migration

Cole o conteúdo de `supabase/migrations/0002_auth_hook.sql` no SQL Editor do Supabase e execute.

Confirmar que a function foi criada:

```sql
SELECT routine_name, routine_type
  FROM information_schema.routines
 WHERE routine_schema = 'public'
   AND routine_name = 'custom_jwt_claims';
-- Deve retornar 1 linha com routine_type = 'FUNCTION'
```

---

## Configurar o hook no painel

1. Acesse [supabase.com](https://supabase.com) → seu projeto
2. Menu lateral: **Authentication** → **Hooks** (abaixo de Configuration)
3. Localize a seção **"Custom Access Token"**
4. Clique em **"Add hook"** (ou Edit se já existir)
5. Configure:
   - **Hook type:** `Custom Access Token`
   - **Database function:** selecione `public.custom_jwt_claims`
6. Clique em **Save**

---

## Testar se funcionou

### Passo 1 — Forçar regeneração do JWT

O JWT é gerado no login. Para testar, faça logout e login novamente com as mesmas credenciais.

### Passo 2 — Inspecionar as claims

**Opção A — Via SQL Editor (recomendado):**

No SQL Editor do Supabase, autenticado como o usuário logado:

```sql
SELECT
  auth.jwt() ->> 'app_role'       AS app_role,
  auth.jwt() ->> 'tenant_id'      AS tenant_id,
  auth.jwt() ->> 'technician_id'  AS technician_id;
```

Deve retornar os valores do usuário logado, não NULL.

**ATENÇÃO:** o campo é `app_role`, não `role`. O campo `role` é reservado pelo PostgREST. Ver migration `0004_fix_jwt_app_role_claim.sql`.

**Opção B — Via browser (DevTools):**

```
1. DevTools → Application → Cookies
2. Localize: sb-<ref>-auth-token
3. Copie o access_token (começa com eyJ...)
4. Cole em https://jwt.io
5. No payload, verifique:
   {
     "app_role": "tallpa_owner",
     "tenant_id": null,        ← null para tallpa_owner
     "technician_id": null,
     ...
   }
```

**Opção C — Via Server Component de diagnóstico (apagar após validar):**

```typescript
// src/app/(dev)/dev/check-jwt/page.tsx
import { getCurrentUser } from '@/lib/auth'

export default async function CheckJwtPage() {
  const user = await getCurrentUser()
  return <pre>{JSON.stringify(user, null, 2)}</pre>
}
```

### Critério de aprovação

- [ ] `app_role` no JWT corresponde ao role cadastrado em `public.users`
- [ ] `tenant_id` no JWT corresponde ao tenant_id do usuário (null para tallpa_owner)
- [ ] `tenant_technician` tem `technician_id` preenchido
- [ ] A query SQL `auth.jwt() ->> 'app_role'` retorna o role correto
- [ ] `SELECT * FROM public.users` retorna dados do tenant do usuário logado, não de outros tenants

---

## Troubleshooting

**JWT não tem as claims customizadas**
- Verificar se o hook foi salvo no painel (Authentication → Hooks)
- Verificar se a function existe no banco (query acima)
- Fazer logout e login de novo (JWT antigo ainda válido por até 7 dias)

**`custom_jwt_claims` retorna erro**
- Verificar se o usuário existe em `public.users` com `ativo = true`
- Verificar se o GRANT foi executado:
  ```sql
  SELECT has_function_privilege('supabase_auth_admin', 'public.custom_jwt_claims(jsonb)', 'EXECUTE');
  -- Deve retornar: t
  ```

**RLS bloqueia mesmo com claims corretas**
- Usar o server client (cookie-based), não um client sem JWT
- Executar `SELECT auth.uid()` no SQL Editor — deve retornar o UUID do usuário, não null
