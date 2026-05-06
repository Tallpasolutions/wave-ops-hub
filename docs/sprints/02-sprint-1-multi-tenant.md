# Sprint 1 — Multi-tenant + Acesso

**Duração estimada:** 1 semana
**Status:** Pendente
**Pré-requisitos:** Sprint 0 concluída

---

## Objetivo

Implementar isolamento multi-tenant via subdomínio + RLS, autenticação completa (login, recuperação de senha) e o portal Tallpa Admin com gestão de tenants e usuários. Ao final, cada subdomínio resolve para o tenant correto, login funciona, e Jhoni consegue criar Wave Telecom como tenant + usuários.

---

## Escopo IN

### 1. Middleware de subdomínio

- [ ] `src/middleware.ts` extrai subdomain do header `host`
- [ ] Roteamento:
  - `tallpa.com.br` raiz (fora do app — não tratado aqui, redireciona pra site de marketing)
  - `admin.tallpa.com.br` → grupo de rotas `(admin)` (acesso só `tallpa_owner`)
  - `<slug>.tallpa.com.br` → grupo `(manager)` ou `(technician)` baseado em role do user
  - Subdomain inválido (não existe na tabela `tenants`) → 404 customizada
- [ ] Helper `getTenantFromRequest(request)` consulta tabela `tenants` (cache em memória 5min)
- [ ] Suporte para `localhost` em dev (extrai de query param `?tenant=wave` ou `localhost:3000` redireciona pra wave por padrão)

### 2. Auth completo

- [ ] Tela `/login` funcional (email + senha)
- [ ] Tela `/recuperar-senha` (envia link de reset)
- [ ] Tela `/redefinir-senha` (com token na URL)
- [ ] Tela `/primeiro-acesso` (definir senha pela primeira vez via magic link)
- [ ] Logout (limpa session)
- [ ] Helper `getCurrentUser()` em Server Components
- [ ] Helper `requireRole(roles)` em Server Actions

### 3. JWT custom claims

- [ ] Configurar Supabase Auth Hook (Postgres function) que adiciona claims:
  - `role`
  - `tenant_id`
  - `technician_id`
- [ ] Hook lê da tabela `users` ao gerar JWT
- [ ] Validar que claims aparecem corretamente

### 4. RLS

- [ ] Aplicar RLS em todas as tabelas de domínio:
  - `tenants` (leitura pública limitada para middleware funcionar)
  - `users`
  - `technicians`
- [ ] Policy padrão: `tenant_id = jwt.tenant_id OR jwt.role = 'tallpa_owner'`
- [ ] Para `users`: técnicos veem apenas a si mesmos (`auth.uid() = id OR jwt.role IN (...)`)
- [ ] Testes manuais: tentar buscar dados de outro tenant deve falhar

### 5. Portal Tallpa Admin (`admin.tallpa.com.br`)

- [ ] Layout dedicado `app/(admin)/layout.tsx`
- [ ] Sidebar com navegação: Dashboard, Tenants, Usuários, Auditoria
- [ ] `/(admin)/dashboard` — placeholder com lista de tenants e contadores básicos
- [ ] `/(admin)/tenants` — listar, criar, editar, suspender
- [ ] `/(admin)/tenants/new` — formulário com slug, nome, brand_path, plano
- [ ] `/(admin)/tenants/[slug]` — drill-down (placeholder, completar nas próximas sprints)
- [ ] `/(admin)/users` — listar todos os usuários globais, criar, resetar senha
- [ ] `/(admin)/users/new` — criar usuário associando a tenant + role

### 6. Portal Tenant Manager (`<slug>.tallpa.com.br`)

- [ ] Layout dedicado `app/(manager)/layout.tsx` com identidade visual completa do dashboard de referência
- [ ] Sidebar/header conforme HTML aprovado
- [ ] `/` — placeholder do dashboard executivo (sem dados ainda — caixas vazias com identidade)
- [ ] `/equipe` — listar usuários do tenant, criar (apenas `tenant_owner`)
- [ ] `/equipe/tecnicos` — listar técnicos, cadastrar técnicos com campos:
  - nome_completo, email, senha inicial, cpf, celular, codigo_unetvale, ativo, data_admissao

### 7. Portal Técnico (`<slug>.tallpa.com.br` quando role=technician)

- [ ] Layout dedicado mobile-first `app/(technician)/layout.tsx`
- [ ] Header simples, bottom navigation (Painel, Visitas, Perfil)
- [ ] `/` — placeholder com nome do técnico e mensagem "em breve"
- [ ] `/perfil` — visualizar e editar dados próprios, mudar senha

### 8. Tabelas de banco

```sql
-- já criadas no Sprint 0:
-- tenants, users, technicians

-- adicionar nesta sprint:
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  before JSONB,
  after JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 9. Testes

- [ ] E2E Playwright:
  - Login com credenciais válidas → redireciona para dashboard
  - Login com credenciais inválidas → mensagem de erro
  - Recuperar senha → envia e-mail (verificar Supabase logs)
  - Logout → volta para `/login`
  - Tentar acessar `/(admin)` sendo `tenant_manager` → 403
  - Tentar acessar dados de outro tenant via URL direta → 404 ou 403
- [ ] Unit tests em `src/lib/auth/permissions.ts`

---

## Escopo OUT

- ❌ Upload de planilha
- ❌ Telas de OSs/visitas com dados
- ❌ LPU / motivos / payouts
- ❌ Dashboard executivo com dados reais
- ❌ Domínio customizado por tenant (fase 2)
- ❌ MFA/2FA
- ❌ OAuth social

---

## Definition of Done

- [ ] Tudo do escopo IN concluído
- [ ] Lint, typecheck, build sem erros
- [ ] Testes E2E passando localmente e em CI
- [ ] Deploy em staging funciona
- [ ] Acessar `staging.admin.tallpa.com.br` → portal Tallpa Admin
- [ ] Acessar `staging.wave.tallpa.com.br` → portal Wave (com user `tenant_owner` cadastrado no seed)
- [ ] Login funciona com credenciais reais
- [ ] Validação Gemini aprovada

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Custom JWT claims podem demorar a propagar (~1h em alguns casos) | Médio | Testar em staging cedo, ter fallback que consulta `users` em cada request |
| RLS quebra queries em desenvolvimento se `auth.uid()` não estiver populado | Alto | Sempre usar cliente autenticado, nunca `service_role` no client; documentar bem |
| Subdomain wildcard DNS pode falhar | Médio | Testar imediatamente no Cloudflare, ter plano B com paths (`/wave/*`) caso urja |

---

## Anotações pós-sprint

_(preencher ao concluir)_
