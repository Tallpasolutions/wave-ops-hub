# Sprint 9 — LPU por Técnico + Role Supervisor

**Duração estimada:** 1 semana
**Status:** Concluída ✅ (2026-07-01)
**Branch:** `feat/sprint-9-supervisor` → PR aberto em `https://github.com/Tallpasolutions/wave-ops-hub/pull/new/feat/sprint-9-supervisor`
**Pré-requisitos:** Sprint 8 concluída ✅ · Migration 0009 aplicada manualmente

---

## Objetivo

Dois recursos novos independentes:

1. **LPU por Técnico** — regras LPU com condição `tecnicoId` para tarifas específicas por técnico, com fallback automático via sistema de prioridades existente.
2. **Role Supervisor** — novo role `tenant_supervisor` para líderes de equipe que acessam o portal técnico e visualizam KPIs mensais da equipe supervisionada.

---

## Etapas

### 9-A — Condição `tecnicoId` no motor LPU

**Arquivos modificados:**
- `src/lib/lpu/schemas.ts` — `tecnicoId` adicionado a `VALID_CONDITION_KEYS`
- `src/lib/lpu/types.ts` — `tecnicoId: string | null` adicionado a `VisitForMatch`
- `src/lib/lpu/simulator.ts` — `SimVisit` não precisa mais declarar `tecnicoId` (herdado)
- `src/lib/lpu/__tests__/match-engine.test.ts` — 3 novos casos de teste
- `src/lib/lpu/__tests__/calculate-payout.test.ts` — fixture `BASE_VISIT` atualizado
- `src/app/(manager)/lpu/actions.ts` — nova action `getTechniciansForRule`
- `src/app/(manager)/lpu/[id]/rules/new/page.tsx` — carrega lista de técnicos
- `src/app/(manager)/lpu/[id]/rules/new/_components/CreateRuleForm.tsx` — novo tipo `'technician'` + select
- `src/app/(manager)/lpu/[id]/rules/[ruleId]/edit/page.tsx` — carrega lista de técnicos
- `src/app/(manager)/lpu/[id]/rules/[ruleId]/edit/_components/EditRuleForm.tsx` — novo tipo `'technician'` + select
- `docs/domain/06-lpu-por-tecnico.md` — **novo** documento de domínio

**Invariante:** Regra com `{ finalidade: "X", tecnicoId: "uuid" }` tem 2 condições → prioridade 200. Regra geral `{ finalidade: "X" }` tem 1 condição → prioridade 100. O motor escolhe a maior prioridade que casa — fallback automático sem mudança de algoritmo.

### 9-B — Migration 0009 + Schema Drizzle

**Arquivos criados/modificados:**
- `supabase/migrations/0009_supervisor_role.sql` — **novo**
  - CHECK de `users.role` atualizado (inclui `tenant_supervisor`)
  - CHECKs de consistência atualizados (supervisor tem `tenant_id` + `technician_id`)
  - Tabela `supervisor_technicians` com RLS de isolamento por tenant
  - RLS de `service_visits` e `payouts` atualizado para supervisores
- `src/db/schema/supervisor-technicians.ts` — **novo** schema Drizzle
- `src/db/schema/index.ts` — re-exporta novo schema
- `src/db/schema/users.ts` — CHECKs atualizados (Drizzle type safety)

### 9-C — Auth: role `tenant_supervisor`

**Arquivos modificados:**
- `src/lib/auth/types.ts` — `tenant_supervisor` adicionado ao tipo `AppRole`
- `src/app/(technician)/layout.tsx` — aceita `tenant_supervisor` além de `tenant_technician`

### 9-D — CRUD de Supervisores (portal manager)

**Arquivos criados/modificados:**
- `src/app/(manager)/equipe/page.tsx` — link "Supervisores" adicionado ao header
- `src/app/(manager)/equipe/supervisores/page.tsx` — **novo** — lista supervisores com contagem de equipe
- `src/app/(manager)/equipe/supervisores/new/page.tsx` — **novo** — formulário de criação
- `src/app/(manager)/equipe/supervisores/new/_components/CreateSupervisorForm.tsx` — **novo** — Client Component com checkboxes de equipe
- `src/app/(manager)/equipe/supervisores/[id]/page.tsx` — **novo** — detalhe + gerenciar equipe (adicionar/remover técnicos)
- `src/app/(manager)/equipe/supervisores/actions.ts` — **novo** — `createSupervisor`, `addTechnicianToSupervisor`, `removeTechnicianFromSupervisor`
- `src/app/(admin)/admin/users/page.tsx` — `RoleBadge` atualizado com `tenant_supervisor`

### 9-E — Portal Técnico: tela Minha Equipe

**Arquivos criados/modificados:**
- `src/app/(technician)/_components/TechBottomNav.tsx` — item "Equipe" condicional ao role supervisor
- `src/app/(technician)/layout.tsx` — passa `isSupervisor` para `TechBottomNav`
- `src/app/(technician)/minha-equipe/page.tsx` — **novo** — KPIs mensais por técnico supervisionado

---

## Definition of Done

- [x] Regra LPU com condição "Técnico" pode ser criada na UI
- [x] Técnico X recebe regra específica (prio 200); outros técnicos recebem regra geral (prio 100)
- [x] 3 novos testes passando no match engine (69 total)
- [x] Migration 0009 aplicada — constraint aceita `tenant_supervisor`
- [x] Gestor cria supervisor em `/equipe/supervisores/new`
- [x] Gestor gerencia equipe em `/equipe/supervisores/[id]`
- [x] Login com supervisor abre portal técnico (não manager)
- [x] Sidebar exibe "Equipe" apenas para supervisores
- [x] `/minha-equipe` exibe KPIs mensais da equipe
- [x] Supervisor não acessa dados fora da equipe (RLS via Supabase)
- [x] `pnpm typecheck` sem erros
- [x] `pnpm lint` sem erros
- [x] 69 testes passando

## Migrations

- `0009_supervisor_role.sql` — role, tabela e RLS do supervisor

## Commits

- `96a5fb0` — `feat(lpu): adicionar condição tecnicoId nas regras LPU`
- `2fef4ac` — `chore(db): migration 0009 - role supervisor e tabela supervisor_technicians`
- `e603d9b` — `feat(auth): adicionar role tenant_supervisor ao tipo AppRole`
- `03af542` — `feat(supervisores): CRUD de supervisores no portal manager`
- `6e802f1` — `feat(supervisor): portal técnico - tela Minha Equipe`
