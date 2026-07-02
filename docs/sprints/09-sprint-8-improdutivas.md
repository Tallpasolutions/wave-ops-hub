# Sprint 8 — Improdutivas & Melhorias de UX

**Duração estimada:** 0.5 semana
**Status:** Concluída ✅ (2026-06-30)
**Branch:** `feat/sprint-8-improdutivas` → merge em `main` em `d387dae`
**Pré-requisitos:** Sprint 7 concluída ✅

---

## Objetivo

Fluxo operacional completo para aprovação de visitas improdutivas pelo gestor, com ações individuais e em lote. Ajustes de UX solicitados pela Wave pós-go-live.

---

## Etapas

### 8-A — Migration 0008: campo `improdutiva_aprovada` em payouts

**Arquivo:** `supabase/migrations/0008_improdutiva_approval.sql`

Adiciona `improdutiva_aprovada BOOLEAN DEFAULT false` na tabela `payouts`.
Permite rastrear quais visitas improdutivas foram revisadas/aprovadas pelo gestor antes do fechamento.

### 8-B — Tela de aprovação de improdutivas

**Arquivos:** `src/app/(manager)/improdutivas/page.tsx` + `actions.ts`

Tela dedicada `/improdutivas` com:
- Listagem de visitas improdutivas com payout pendente
- Ação individual: aprovar/rejeitar por linha
- Ação em lote: selecionar múltiplas + botão "Aprovar selecionadas"
- Componente `Checkbox` (shadcn) para seleção múltipla

### 8-C — Sheet lateral de visitas por motivo

**Arquivo:** `src/app/(manager)/improdutivas/` + Sheet (shadcn)

Ao clicar em um motivo na listagem de improdutivas, abre um Sheet lateral com todas as visitas daquele motivo. Permite inspeção rápida sem navegar.

### 8-D — Renomear "Motivos" para "Improdutivas" na sidebar

**Arquivo:** `src/app/(manager)/_components/ManagerSidebar.tsx` (ou similar)

Item da sidebar alterado de "Motivos" → "Improdutivas" para melhor semântica operacional.

### 8-E — Ocultar campos de infra da UI (Wave)

**Arquivo:** `src/app/(manager)/visitas/[id]/page.tsx`

Campos técnicos de infraestrutura ocultados da UI por solicitação explícita da Wave Telecom — não são operacionalmente relevantes para o gestor no dia a dia.

### 8-F — Fix: permitir `value: 0` em regras de payout fixo

**Arquivo:** `src/lib/lpu/schemas.ts`

Schema Zod validava `value` com `.positive()` rejeitando zero. Corrigido para `.nonnegative()` — caso de uso legítimo de payout zero para determinadas condições.

---

## Definition of Done

- [x] Migration 0008 aplicada em produção
- [x] Tela `/improdutivas` com aprovação individual e em lote
- [x] Sheet de visitas por motivo funcionando
- [x] Sidebar com "Improdutivas" (renomeado)
- [x] Campos de infra ocultados na UI de detalhe de visita
- [x] Payout fixo com `value: 0` aceito pelo schema
- [x] `pnpm typecheck` sem erros
- [x] `pnpm lint` sem erros
- [x] 66 testes passando

## Migrations

- `0008_improdutiva_approval.sql` — campo `improdutiva_aprovada` em `payouts`

## Commits

- `e32f293` — `chore(db): migration 0008 - campo improdutiva_aprovada em payouts`
- `6273e16` — `feat(improdutivas): nova tela de aprovacao com acoes individuais e em lote`
- `756f034` — `feat(motivos): renomear "Motivos" para "Improdutivas" na UI`
- `cad050b` — `feat(motivos): sheet lateral com listagem de visitas por motivo`
- `3883c0d` — `fix(lpu): permitir value: 0 em regras de payout fixo`
- `ae1c06e` — `feat(visitas): ocultar campos de infra da UI por solicitacao da Wave`
- `6ae8fde` — `chore: adicionar dependencias shadcn (sheet, checkbox)`
- Merge: `d387dae`
