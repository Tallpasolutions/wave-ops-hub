# Sprint 0 — Setup

**Duração estimada:** 1 semana
**Status:** Parcialmente concluída (fundação técnica local validada; pendências: infra Supabase, Vercel, primitivos UI)
**Pré-requisitos:** nenhum

---

## Objetivo

Estabelecer toda a fundação técnica do projeto: repositório, CI/CD, ambientes, schema base, identidade visual e shell de layout. Ao final da sprint, o app deve abrir em `localhost:3000` mostrando uma tela de login com identidade visual Tallpa.

---

## Escopo IN

### 1. Repositório e versionamento

- [ ] Criar repositório `tallpa/wave-ops-hub` no GitHub (privado)
- [ ] Branch principal `main` protegida (PR obrigatório)
- [x] Configurar `.gitignore` (Next.js + node_modules + .env*)
- [x] Configurar `.editorconfig`
- [ ] Configurar README inicial (cópia deste repo)

### 2. Stack base

- [x] `pnpm create next-app@latest wave-ops-hub --typescript --tailwind --app --no-src-dir`
- [x] Mover para estrutura com `src/` (movido manual após init)
- [x] Configurar `tsconfig.json` com `strict: true` e path alias `@/*`
- [x] Instalar dependências core:
  - `@supabase/ssr`, `@supabase/supabase-js`
  - `drizzle-orm`, `drizzle-kit`, `postgres`
  - `zod`
  - `@tanstack/react-query`
  - `recharts`
  - `lucide-react`
  - `class-variance-authority`, `clsx`, `tailwind-merge`
- [x] Instalar dev dependencies:
  - `vitest`, `@vitejs/plugin-react`
  - `@playwright/test`
  - `eslint`, `prettier`, `eslint-config-next`, `prettier-plugin-tailwindcss`
  - `husky`, `lint-staged`
  - `@types/node`

### 3. Configuração

- [x] ESLint config estendendo `next/core-web-vitals` + regras estritas (adicionado `@typescript-eslint/eslint-plugin`, `eslint-config-prettier` e declaração explícita do parser/plugin — omitidos no setup inicial)
- [x] Prettier config + `.prettierrc.json`
- [x] Husky pre-commit rodando `pnpm lint-staged` (configurado; hook só ativa após `git init`)
- [x] lint-staged: ESLint + Prettier nos staged files
- [x] `package.json` scripts:
  ```
  dev, build, start, lint, format, typecheck, test, test:e2e,
  db:generate, db:push, db:seed, db:studio
  ```

### 4. Supabase

- [ ] Criar 2 projetos Supabase: `wave-ops-hub-dev` e `wave-ops-hub-staging`
- [ ] Configurar Auth (email/password ativo, magic link desativado)
- [ ] Criar bucket `uploads` no Storage com policies (cada tenant tem pasta própria)
- [x] Configurar `.env.example` com todas as variáveis necessárias
- [x] Configurar `.env.local` (não commitado) com creds dev

### 5. Drizzle

- [x] Configurar `drizzle.config.ts`
- [x] Schema inicial (apenas tabelas de plataforma):
  - `tenants`
  - `users`
  - `technicians`
- [x] Migration inicial gerada (`supabase/migrations/0001_initial_schema.sql`)
- [ ] Migration aplicada no Supabase (pendente: projeto Supabase ainda não criado)
- [ ] Seed inicial: 1 `tallpa_owner` (Jhoni) + 1 tenant Wave + 1 `tenant_owner` Wave fictício (seed.sql criado, pendente aplicação)

### 6. Identidade visual

- [x] Copiar HTML aprovado para `public/dashboard-reference/dashboard-wave-abril-2026.html`
- [x] Criar `app/globals.css` com todos os tokens (cores, fontes, gradientes) do `docs/visual-identity/tokens.md`
- [x] Configurar fonts via `next/font` (Manrope, Poppins, JetBrains Mono)
- [x] Configurar `tailwind.config.ts` extendendo cores e fontes dos tokens
- [x] Criar componente `<TenantLogo />` (com placeholder gradient T)
- [ ] Criar primitivos básicos em `src/components/ui/` (movido para Sprint 1):
  - `Button`
  - `Input`
  - `Label`
  - `Card`
  - `Pill`
  - `Skeleton`

### 7. Layout shell

- [x] `app/layout.tsx` raiz com fontes e CSS vars
- [x] Página `/` placeholder com logo Tallpa centralizado
- [x] Página `/login` skeleton (sem lógica ainda — só visual)
- [x] 404 customizada com identidade visual

### 8. CI/CD

- [x] GitHub Action: lint + typecheck + build em PR (`.github/workflows/ci.yml`)
- [ ] GitHub Action: deploy automático em staging quando merge em `main`
- [ ] Configurar Vercel: projeto, env vars, domínio staging (`staging.wave.tallpa.com.br`)
- [ ] Configurar Cloudflare: wildcard `*.tallpa.com.br` apontando para Vercel

### 9. Documentação

- [ ] Atualizar `README.md` com instruções de setup local funcionando
- [ ] Tirar screenshots da tela de login para registrar baseline visual
- [x] Docs de sprint (sprints 0–6), ADRs (001–006), domain docs, visual-identity, validation checklist criados

---

## Escopo OUT (NÃO entra nesta sprint)

- ❌ Lógica de auth real (apenas tela visual)
- ❌ Middleware de subdomain
- ❌ Roles e permissions
- ❌ Upload de planilha
- ❌ LPU
- ❌ Payouts
- ❌ Dashboard com dados
- ❌ Portal do técnico

---

## Definition of Done

- [x] `pnpm dev` roda sem warnings nem erros (localhost:3000, HTTP 200)
- [x] `pnpm build` completa com sucesso (3 rotas: `/`, `/login`, `/_not-found`)
- [x] `pnpm typecheck` zero erros
- [x] `pnpm lint` zero warnings
- [ ] Deploy em `staging.wave.tallpa.com.br` funcionando (pendente: Vercel + Supabase)
- [x] Tela `/login` aparece com identidade visual Tallpa correta
- [ ] Pré-commit hook bloqueia commits que falham lint (Husky configurado; ativa após `git init`)
- [ ] CI passa em todos os steps em um PR de teste (workflow criado; pendente: push ao GitHub)
- [ ] Migrations aplicadas com sucesso em dev e staging (pendente: projeto Supabase)
- [ ] Seed roda sem erro (pendente: projeto Supabase)
- [ ] Validação Gemini (checklist `docs/validation/gemini-checklist.md`) aprovada

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Configuração de subdomain DNS pode demorar a propagar | Médio | Testar logo no início, paralelizar outras tarefas |
| Conflitos entre Tailwind e CSS vars dos tokens | Baixo | Usar Tailwind puro onde possível, CSS vars apenas para tokens semânticos |
| Husky pode ser irritante em commits emergenciais | Baixo | `--no-verify` está disponível, com responsabilidade |

---

## Anotações pós-sprint

_(atualizado em 2026-05-05)_

- **Tempo real:** ~2 dias (setup de código) + pendências de infra
- **Desvios do plano:**
  - `eslint-config-prettier` e `@typescript-eslint/eslint-plugin`/`parser` não foram adicionados ao `package.json` inicial; corrigidos durante validação
  - Primitivos UI (Button, Input, Card, Label, Pill, Skeleton) não foram criados; movidos para o início do Sprint 1
  - Repositório ainda não foi inicializado como git (`git init`) nem publicado no GitHub; Husky ficará ativo só após isso
- **O que ficou pra próxima sprint:**
  - Criar repositório GitHub (`tallpa/wave-ops-hub`) e fazer push inicial
  - `git init` + configurar branch protection
  - Criar projetos Supabase (dev + staging) e aplicar migration inicial
  - Configurar Auth no Supabase (email/password, magic link desativado)
  - Criar bucket `uploads` com policies
  - Configurar Vercel + domínio staging
  - Configurar Cloudflare wildcard
  - Primitivos UI básicos (`Button`, `Input`, `Label`, `Card`, `Pill`, `Skeleton`)
  - Validação Gemini do Sprint 0
- **Aprendizados:**
  - ESLint 9 com `.eslintrc.json` (formato legado) exige declaração explícita do `parser` e `plugins` para `@typescript-eslint` mesmo que já instalado via dependência transitiva
  - pnpm não vem pré-instalado no ambiente local; usar `corepack enable` para ativar via Node.js
