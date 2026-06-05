# Sprint 1 — Multi-tenant + Acesso

**Duração estimada:** 1 semana
**Status:** Concluída (2026-05-30)
**Pré-requisitos:** Sprint 0 concluída

---

## Objetivo

Implementar isolamento multi-tenant via subdomínio + RLS, autenticação completa (login, recuperação de senha) e os portais base (Admin, Manager, Técnico). Ao final, cada subdomínio resolve para o tenant correto, login funciona end-to-end, e Jhoni consegue criar Wave Telecom como tenant + usuários.

---

## Escopo IN

### 1. Middleware de subdomínio

- [x] `src/middleware.ts` extrai subdomain do header `host`
- [x] Injeta header `x-subdomain` em todos os requests
- [x] Retorna 404 customizada para subdomains inválidos/reservados
- [x] `src/lib/tenant/resolve.ts` — resolve tenant a partir do subdomain via Supabase

### 2. Auth completo

- [x] Tela `/login` funcional (email + senha) — **login client-side via `createBrowserClient`**
- [x] Tela `/forgot-password` (envia link de reset)
- [x] Tela `/reset-password` (com token na URL)
- [x] Tela `/first-access` (definir senha pela primeira vez)
- [x] Logout (`src/lib/auth/logout.ts`)
- [x] Helper `getCurrentUser()` em Server Components (com `React.cache()`)
- [x] Helper `getUserRole()`
- [x] Session exchange cross-subdomain via `/auth/callback` (tallpa_owner em localhost)

### 3. JWT custom claims

- [x] Supabase Auth Hook (`public.custom_jwt_claims`) — migration `0002_auth_hook.sql`
- [x] Claims: `app_role`, `tenant_id`, `technician_id`
- [x] **IMPORTANTE:** campo é `app_role` (não `role`) — `role` é reservado pelo PostgREST para `SET ROLE`
- [x] Correção aplicada em migration `0004_fix_jwt_app_role_claim.sql`
- [x] Funções RLS helpers: `current_tenant_id()`, `current_user_role()`, `current_technician_id()`, `is_tallpa_owner()`

### 4. RLS + GRANTs

- [x] RLS habilitado em todas as tabelas (migration `0001_initial_schema.sql`)
- [x] Policies de isolamento por tenant em todas as tabelas operacionais
- [x] Policies especiais para `tenants` (leitura pública) e `users` (acesso próprio)
- [x] GRANTs explícitos para `authenticated` e `anon` (migration `0005_grant_permissions.sql`)
  - _Tabelas criadas via SQL não recebem grants automáticos — diferença do Supabase Dashboard_

### 5. Portal Tallpa Admin (`admin.localhost:3000`)

- [x] Layout guard em `src/app/(admin)/admin/layout.tsx` (redireciona se não for `tallpa_owner`)
- [x] Layout visual com sidebar (`_components/Sidebar.tsx`) — Dashboard, Tenants, Usuários, logo, logout
- [x] `/(admin)/admin/dashboard` — 3 KPI cards + tabela de tenants recentes
- [x] `/(admin)/admin/tenants` — listar todos com plano, status, ações (suspender/reativar)
- [x] `/(admin)/admin/tenants/new` — formulário (slug, nome, plano); `brandPath` auto-setado = slug
- [x] `/(admin)/admin/users` — listar com role badge, tenant, último acesso, ações
- [x] `/(admin)/admin/users/new` — criar usuário (email, nome, role, tenant condicional, senha inicial)

### 6. Portal Tenant Manager (`wave.localhost:3000`)

- [x] Layout guard em `src/app/(manager)/layout.tsx` (redireciona se não for manager/owner)
- [x] Layout visual completo — sidebar com `ManagerSidebar` (`_components/Sidebar.tsx`)
  - Nav items: Dashboard, Equipe, Técnicos, OSs (disabled + badge "Em breve"), Financeiro (disabled)
  - Header da sidebar: logo do tenant + nome do tenant + label "Manager"
  - Footer: nome/email do usuário + botão Sair
- [x] `/dashboard` — 6 KPI cards placeholder com "—" + painel "disponível a partir da Sprint 2"
- [x] `/equipe` — listar usuários do tenant (roles owner/manager); criar disponível apenas para `tenant_owner`; toggle ativo/inativo; reset senha
- [x] `/equipe/new` — formulário de criação (nome, email, role: owner|manager, senha inicial); `tenant_id` auto-setado pelo server action
- [x] `/equipe/tecnicos` — listar técnicos com CPF mascarado, celular, código Unetvale, status; toggle ativo/inativo
- [x] `/equipe/tecnicos/new` — formulário de cadastro (nome\*, email\*; CPF, celular, código Unetvale opcionais); sem criação de login em auth.users

### 7. Portal Técnico (`wave.localhost:3000` quando role=`tenant_technician`)

- [x] Layout guard em `src/app/(technician)/layout.tsx`
- [x] Layout mobile-first com header fixo (logo do tenant, iniciais do usuário, botão Sair)
- [x] `/profile` — exibe dados reais do técnico (nome, email, CPF mascarado, celular, código Unetvale, data de admissão)
  - Fallback: se `technicianId` não está vinculado, exibe apenas nome e email do usuário

### 8. Testes

- [x] E2E Playwright (`playwright.config.ts` + `tests/e2e/`):
  - Login admin → redireciona para `/admin/dashboard`
  - Login manager → redireciona para `/dashboard`
  - Login técnico → redireciona para `/profile`
  - Login inválido → mensagem de erro visível
  - Rota protegida sem auth (`/admin/dashboard`, `/dashboard`, `/profile`) → redireciona para `/login`
  - Manager tentando acessar portal admin → redireciona para `/login`

---

## Escopo OUT

- ❌ Upload de planilha
- ❌ Telas de OSs/visitas com dados
- ❌ LPU / motivos / payouts
- ❌ Dashboard executivo com dados reais
- ❌ Domínio customizado por tenant
- ❌ MFA/2FA

---

## Definition of Done

- [x] Lint, typecheck, build sem erros
- [x] Login end-to-end funcionando em `wave.localhost:3000/login`
- [x] Roles direcionam para portais corretos após login
- [x] Portal Admin com UI funcional (dashboard, CRUD tenants, CRUD usuários)
- [x] Portal Manager com UI funcional (dashboard placeholder, equipe, técnicos)
- [x] Portal Técnico com UI mínima funcional (layout mobile-first + /profile com dados reais)
- [x] Testes E2E escritos (`auth.spec.ts`, `route-protection.spec.ts`) — rodar com `pnpm test:e2e` (requer vars em `.env.local`)
- [ ] Validação Gemini aprovada

---

## Decisões tomadas durante a sprint

| Decisão | Motivo |
|---|---|
| Login via `createBrowserClient` (client-side) em vez de Server Action | `@supabase/ssr` v0.10.2 tem race condition: `setAll` é chamado via `onAuthStateChange` async, mas `redirect()` termina o Server Action antes. Browser client escreve em `document.cookie` diretamente. |
| `app_role` em vez de `role` no JWT | `role` é reservado pelo PostgREST para `SET ROLE` no PostgreSQL — sobrescrever causava `role "tenant_owner" does not exist` em todas as queries. |
| Session exchange via URL para tallpa_owner em localhost | Browsers rejeitam `domain=.localhost`. Em produção, `domain=.tallpa.com.br` cobre todos os subdomínios nativamente e o exchange não é necessário. |
| GRANTs em migration separada (0005) | Tabelas criadas via SQL no Supabase não recebem grants automáticos para `authenticated`/`anon` — diferente de tabelas criadas pelo Dashboard. |
| Técnicos cadastrados sem login em auth.users (Portal Manager) | Simplifica Sprint 1: o fluxo de dar acesso ao técnico (criar usuário com role `tenant_technician` vinculado ao `technician_id`) é uma operação separada e opcional. Técnico pode existir no sistema sem ter login. |
| `/profile` exibe dados reais do técnico somente se `technicianId` está vinculado | Um usuário `tenant_technician` pode existir sem `technician_id` na tabela `users` — fallback mostra nome e email do usuário. Não é um estado esperado em produção, mas é seguro. |
| Testes E2E usam URLs absolutas por subdomain | O middleware redireciona `localhost` → `wave.localhost`, então os testes devem usar `http://wave.localhost:3000` e `http://admin.localhost:3000` explicitamente. `baseURL` do Playwright serve apenas como documentação. |
| `canManageUsers` exclui `tenant_manager` intencionalmente | Apenas `tenant_owner` pode criar/suspender outros usuários. `tenant_manager` vê a lista mas não tem ações de mutação. Consistente com ADR-005 (roles). |
| `x-subdomain` lido de `headers()` em Server Action para reset de senha (Portal Manager) | O URL de redirect do reset precisa incluir o subdomínio do tenant. Como Server Actions não recebem URL via parâmetro, o header `x-subdomain` injetado pelo middleware é a fonte correta — mais seguro do que expor env var de tenant por request. |

---

## Anotações pós-sprint

**Sprint 1 concluída (2026-05-30).** Portal Técnico e testes E2E Playwright implementados. Pendente não-bloqueante: validação Gemini e infraestrutura de staging (Vercel + Cloudflare).

- **Migrations aplicadas no Supabase dev (nesta ordem):**
  1. `0001_initial_schema.sql` — schema completo + RLS
  2. `0002_auth_hook.sql` — Auth Hook com custom claims
  3. `0003_reserved_slugs.sql` — constraint de slugs reservados
  4. `0004_fix_jwt_app_role_claim.sql` — renomeia `role` → `app_role`
  5. `0005_grant_permissions.sql` — GRANTs para PostgREST
- **Auth Hook configurado:** Authentication → Hooks → Custom Access Token → `public.custom_jwt_claims`
- **Usuário tallpa_owner criado:** `jhonicleyton@gmail.com` (UUID inserido em `public.users` com role `tallpa_owner`)
