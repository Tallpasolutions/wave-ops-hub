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
