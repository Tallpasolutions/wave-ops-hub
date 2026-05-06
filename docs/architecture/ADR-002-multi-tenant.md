# ADR-002 — Arquitetura Multi-Tenant

**Status:** Aceito
**Data:** 2026-05-05
**Decisores:** Jhoni Cleyton (Tallpa)

---

## Contexto

Wave Ops Hub começa com Wave Telecom como único cliente, mas o produto é desenhado para servir múltiplos clientes (próximos previstos: Scooby, e potencialmente outras empresas de instalação técnica). Cada cliente precisa:

- Ver apenas seus próprios dados (isolamento total)
- Ter sua própria identidade visual (logo, possivelmente cores)
- Ter seu próprio domínio amigável (`<slug>.tallpa.com.br` e, no futuro, domínio próprio)
- Ter usuários independentes
- Ter LPU própria (regras de pagamento são específicas de cada cliente)

A escolha entre as três estratégias de multi-tenancy precisa balancear:
- Isolamento (segurança)
- Custo operacional
- Complexidade de desenvolvimento e manutenção
- Capacidade de oferecer customizações por cliente

---

## Decisão

**Estratégia escolhida: Single database, shared schema, com `tenant_id` em todas as tabelas e RLS (Row-Level Security) do Postgres.**

### Detalhamento

1. **Único banco Postgres no Supabase** — todos os tenants compartilham o mesmo banco
2. **Coluna `tenant_id UUID NOT NULL`** em toda tabela de domínio (exceto tabela `tenants` em si e tabelas de plataforma)
3. **Row-Level Security ativada** em todas as tabelas de domínio
4. **Policies RLS** isolam linhas por `tenant_id` baseado em claim do JWT
5. **Subdomínio resolve tenant** — middleware Next.js extrai `wave` de `wave.tallpa.com.br` e injeta no contexto
6. **Super-admin Tallpa bypassa RLS** via policy especial que checa `auth.jwt() ->> 'role' = 'tallpa_owner'`
7. **Service role key NUNCA exposta ao cliente** — apenas Server Actions críticas usam

### Resolução de tenant

```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  const host = request.headers.get('host'); // wave.tallpa.com.br
  const subdomain = host.split('.')[0];      // wave
  
  // tallpa.com.br raiz → site marketing (fora deste app)
  // admin.tallpa.com.br → portal Tallpa Admin
  // <slug>.tallpa.com.br → portal de cliente (slug = tenant.slug)
  
  request.headers.set('x-tenant-slug', subdomain);
  return NextResponse.next();
}
```

### RLS Policy padrão

```sql
-- Toda tabela de domínio segue este padrão
CREATE POLICY tenant_isolation ON service_visits
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR auth.jwt() ->> 'role' = 'tallpa_owner'
  );
```

### Tabela `tenants`

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- 'wave', 'scooby'
  nome TEXT NOT NULL,                  -- 'Wave Telecom'
  dominio_custom TEXT,                 -- 'portal.wavetelecom.com.br' (futuro)
  brand_path TEXT NOT NULL,            -- 'wave' (corresponde à pasta /public/brands/<brand_path>/)
  plano TEXT NOT NULL DEFAULT 'starter',
  config JSONB NOT NULL DEFAULT '{}',  -- features ligadas/desligadas, etc.
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

A RLS desta tabela permite leitura pública apenas dos campos `slug, brand_path, ativo` (necessário pro middleware funcionar antes da autenticação).

---

## Considerados e rejeitados

### Banco por tenant
**Rejeitado.** Cria explosão de complexidade operacional (N migrations, N backups, N conexões). Faz sentido apenas em casos de compliance estrito (saúde, financeiro). Não é o caso.

### Schema por tenant
**Rejeitado.** Postgres suporta múltiplos schemas, mas: migrations ficam complexas (rodar em cada schema), queries cross-tenant (relatórios Tallpa) viram dor, e RLS por linha é mais simples que isolamento por schema.

### Multi-tenant via aplicação (sem RLS)
**Rejeitado.** Esquecer um `WHERE tenant_id = ?` em uma query causaria vazamento de dados. RLS no banco é o cinto de segurança — mesmo se a aplicação tiver bug, o banco bloqueia.

---

## Identidade visual por tenant

- Logos em `public/brands/<brand_path>/` (ex: `public/brands/wave/`)
- Componente `<TenantLogo />` lê `brand_path` do tenant ativo e busca em `/brands/<path>/logo.svg`
- Tema de cores **inicialmente fixo** (identidade Tallpa). Customização de cores por tenant fica para fase futura — quando vier, será via CSS vars no `<html>` injetadas pelo layout server.

---

## Domínios customizados (fase futura)

Schema já contempla `dominio_custom`. Implementação:
- Middleware verifica primeiro se `host` é domínio customizado conhecido (query na tabela `tenants`)
- Se sim, usa o `tenant_id` correspondente
- Se não, faz fallback para extração de subdomínio
- Cliente configura CNAME apontando para `cname.vercel-dns.com`

---

## Onboarding de novo tenant (operação Tallpa)

1. Sócio Tallpa acessa portal `admin.tallpa.com.br/tenants/new`
2. Preenche: `slug`, `nome`, `brand_path` (default = slug), plano
3. Sistema cria registro em `tenants`
4. Sistema cria primeiro usuário `tenant_owner` e envia magic link de setup
5. Sócio do tenant define senha, faz login, cadastra demais usuários e técnicos
6. Sistema disponibiliza `<slug>.tallpa.com.br` automaticamente (DNS wildcard já resolve)

---

## Consequências

### Positivas
- Isolamento garantido pelo banco (RLS) — defesa em profundidade
- Custos baixos (um banco para todos)
- Migrations simples (uma execução para todos)
- Relatórios cross-tenant para Tallpa são triviais (apenas remover filtro)
- Onboarding de novo tenant em minutos, sem provisionar infra

### Negativas / Trade-offs
- Toda query precisa estar consciente do contexto de tenant (mitigação: cliente Supabase com JWT autenticado faz isso automaticamente)
- Performance pode degradar se um tenant tiver volume muito acima dos outros (mitigação distante: particionamento por tenant_id em tabelas grandes)
- Backup/restore de um tenant individual é mais complexo (mitigação: views filtradas por tenant exportadas via job)
