# Dívida Técnica

> Registro de coisas que **não estão tão boas quanto poderiam estar**, mas foram aceitas conscientemente para manter o ritmo de entrega. Cada item tem contexto, impacto estimado e plano de resolução (mesmo que vago).

**Regra:** todo item aqui é uma dívida **conscientemente assumida**. Bugs vão para issues do GitHub, não aqui.

---

## Itens em aberto

### 001 — UNIQUE constraints declarados como uniqueIndex no Drizzle
**Identificado em:** Sprint 1, Fase 0
**Onde:** `src/db/schema/technicians.ts` (uq_technicians_tenant_email, uq_technicians_tenant_cpf, uq_technicians_tenant_codigo)
**Por quê:** A migration SQL inicial declarou UNIQUE inline na tabela (ex: `UNIQUE (tenant_id, email)`), mas os schemas Drizzle usam `uniqueIndex(...)` separado. Funcionalmente equivalente no Postgres (UNIQUE constraint cria index automaticamente), mas são entidades distintas em introspection.
**Impacto se não resolver:** Divergência cosmética em futura introspection do Drizzle. Nenhum impacto funcional.
**Esforço estimado:** XS
**Quando idealmente resolver:** Quando houver primeiro `drizzle-kit introspect` formal contra o banco real, reconciliar os schemas TS com o que o Postgres realmente tem.

### 002 — JWT custom claims: jsonb_set + to_jsonb(uuid::text) propaga null
**Identificado em:** Sprint 1, Fase 2
**Onde:** `supabase/migrations/0002_auth_hook.sql`
**Por quê:** A combinação `jsonb_set(claims, '{path}', to_jsonb(uuid_value::text))` retorna null quando o UUID é NULL — null propaga e a function inteira retorna `{"claims": null}`.
**Solução adotada:** usar operador `||` (jsonb concat) com `jsonb_build_object` e `to_jsonb(uuid)` direto (sem cast intermediário para text).
**Lição:** Para mesclar objetos jsonb, prefira `||` sobre `jsonb_set`. Para serializar UUIDs nullable em jsonb, use `to_jsonb(uuid_value)` direto.
**Impacto se não resolver:** N/A — já resolvido. A versão bugada nunca foi para produção.
**Esforço estimado:** Resolvido.
**Quando idealmente resolver:** Já resolvido em Sprint 1, Fase 2.

### 003 — tailwind.config.ts: require() não funciona em contexto ESM
**Identificado em:** Sprint 1, Fase 1 (descoberto durante validação manual)
**Onde:** `tailwind.config.ts` linha de `plugins`
**Por quê:** Next.js 15 + arquivo `.ts` operam em ESM. `require()` é sintaxe CommonJS, lança ReferenceError em runtime quando o Tailwind tenta processar a config para rotas que usam plugins.
**Solução adotada:** import ESM no topo do arquivo (`import tailwindcssAnimate from "tailwindcss-animate"`) e referência direta em `plugins`.
**Lição:** Em `tailwind.config.ts` (TypeScript) sempre use `import` no topo. `require()` só funciona em `tailwind.config.js` (CommonJS).
**Impacto se não resolver:** N/A — já resolvido.
**Esforço estimado:** Resolvido.
**Quando idealmente resolver:** Já resolvido em Sprint 1, Fase 1 (validação).

### 005 — Next.js 15 Server Actions: cookies recém-setados não são lidos na mesma execução
**Identificado em:** Sprint 1, Fase 3 (durante validação manual de login)
**Onde:** `src/app/(public)/login/actions.ts`
**Por quê:** Em Next.js 15, quando uma Server Action chama `supabase.auth.signInWithPassword`, o cookie de sessão é setado mas não é legível por chamadas subsequentes de `auth.getUser()` na mesma execução. `getCurrentUser()` (que internamente chama `auth.getUser()`) retorna null mesmo após login bem-sucedido, gerando falso positivo de "usuário não encontrado".
**Solução adotada:** decodificar o `data.session.access_token` retornado pelo `signInWithPassword` para ler o `role` dos custom claims do JWT. O Auth Hook (`custom_jwt_claims`) injeta `role` no **payload do JWT** (campo `claims`), não em `app_metadata` — `app_metadata` é `raw_app_meta_data`, campo separado que o hook nunca escreve.
**Lição:** O hook escreve em `event.claims` (payload JWT), não em `app_metadata`. Para ler custom claims no mesmo request do login, decodifique o `access_token` com `Buffer.from(token.split('.')[1], 'base64url')`. `getCurrentUser()` continua válido em Server Components de rotas protegidas (request seguinte, com cookie já estabelecido).
**Esforço para resolver definitivamente:** N/A — solução adotada é a recomendada pelo padrão Supabase + Next.js.
**Quando idealmente resolver:** Já resolvido em Sprint 1, Fase 3.

### 006 — Route groups com paths colidentes em Next.js App Router
**Identificado em:** Sprint 1, Fase 3 (validação manual)
**Onde:** `src/app/(admin)/dashboard/page.tsx` vs `src/app/(manager)/dashboard/page.tsx`
**Por quê:** Route groups (pastas com parênteses) NÃO criam segmento de URL no Next.js App Router. Múltiplos groups com mesmo path interno colidem em URL única, gerando build error.
**Solução adotada:** path explícito por portal: admin usa `/admin/dashboard`, manager usa `/dashboard`, technician usa `/profile`. Mesmo com subdomain isolando o acesso, o roteador Next.js precisa de paths únicos no nível de filesystem.
**Lição:** ao criar route groups, garantir que cada group tem paths únicos OU paths explicitamente diferentes na estrutura de pastas. Não confiar em subdomain pra "isolar" rotas em Next.js.
**Esforço para resolver definitivamente:** Já resolvido.
**Quando idealmente resolver:** Já resolvido em Sprint 1, Fase 3.

### Template

```
### NNN — [Título curto]
**Identificado em:** Sprint X
**Onde:** caminho/arquivo ou descrição
**Por quê:** justificativa de ter aceitado a dívida
**Impacto se não resolver:** o que vai doer no futuro
**Esforço estimado pra resolver:** XS / S / M / L / XL
**Quando idealmente resolver:** Sprint X / Após go-live / Quando volume passar de Y / Etc.
```

---

## Itens resolvidos

_(mover para cá quando resolvido, com link pro PR/commit)_
