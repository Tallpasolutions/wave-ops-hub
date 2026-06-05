# Sprint 3 — LPU + Motivos

**Duração estimada:** 1 semana
**Status:** Concluída — Etapas 1–5 concluídas (2026-06-01)
**Pré-requisitos:** Sprint 2 concluída

---

## Objetivo

Implementar o motor de regras LPU e a configuração de motivos. Ao final, gestor da Wave consegue cadastrar a LPU real, classificar todos os motivos da planilha de abril, simular o cálculo nas visitas existentes e validar os números.

---

## Escopo IN

### 1. Schema do banco ✅ Concluída (2026-05-31)

**SQL já existia em `0001_initial_schema.sql`** — nenhuma migration nova necessária:
- `lpus`: id, tenant_id, nome, vigencia_inicio, vigencia_fim, ativa, created_by, created_at, updated_at + CHECK (vigencia_fim >= vigencia_inicio)
- `lpu_rules`: id, lpu_id, prioridade, conditions JSONB, payout JSONB, description, ativa, created_at, updated_at
- `lpu_rules_audit`: id, rule_id, changed_at, changed_by, before JSONB, after JSONB
- RLS em todas as tabelas (via `tenant_isolation` + JOIN em `lpus`)
- Trigger `enforce_single_active_lpu`: rejeita INSERT/UPDATE se já existe LPU ativa no tenant
- Trigger `trg_lpu_rules_audit_changes`: AFTER UPDATE em `lpu_rules` → INSERT em `lpu_rules_audit`
- GRANTs para `authenticated` em `0005_grant_permissions.sql` (SELECT + INSERT + UPDATE + DELETE em `lpus`, `lpu_rules`; SELECT-only em `lpu_rules_audit`)

**Schemas Drizzle criados (type-safety em queries TypeScript):**
- `src/db/schema/lpus.ts` — `lpus` + tipos `Lpu`, `NewLpu`, `LpuConditions`, `PayoutType`, `LpuPayout`
- `src/db/schema/lpu-rules.ts` — `lpu_rules` + `lpu_rules_audit` + tipos `LpuRule`, `NewLpuRule`, `LpuRuleAudit`
- `src/db/schema/index.ts` — exports atualizados (10 tabelas, ordem FK respeitada)

**Decisões:**
- `LpuConditions` e `LpuPayout` definidos como `Record<string, unknown>` + union de `type` — serão narrowados em `src/lib/lpu/types.ts` na Etapa 3 sem quebrar retrocompatibilidade
- GIN index em `conditions` omitido do schema Drizzle — `.using("gin")` não suportado nesta versão do Drizzle; já garantido pelo SQL de `0001`
- `db:generate` gerou snapshot `0001_snapshot.json` (10 tabelas); o arquivo SQL gerado foi deletado (tabelas já existem); segundo `db:generate` confirmou "No schema changes"

### 2. Adicionar `reason_id` em `service_visits`

```sql
ALTER TABLE service_visits ADD COLUMN reason_id UUID REFERENCES reasons(id);
```

- [x] **Já implementado** — coluna presente em `0001_initial_schema.sql`; ETL (Sprint 2) já preenche `reason_id` na ingestão e auto-cria motivos com `pendente_classificacao`

### 3. Lib `src/lib/lpu/` ✅ Concluída (2026-05-31)

**Arquivos criados:**
- `src/lib/lpu/types.ts` — `VisitForMatch`, `LpuRuleNarrowed`, `MatchResult`, `PayoutResult`, `SimulationResult`, `ReasonForPayout`, `ConflictGroup`, `PayoutNarrowed` (Fixed | Formula | Percentage)
- `src/lib/lpu/schemas.ts` — `lpuConditionsSchema`, `lpuPayoutSchema`, `createLpuRuleSchema` (Zod discriminated union), `calcPrioridade(conditions) → number`
- `src/lib/lpu/match-engine.ts` — `findApplicableRule(visit, rules)`: suporta exact, array `includes`, range `{min?, max?}`; ordena por prioridade DESC; retorna `{ type: 'match' | 'no_match' | 'conflict' }`
- `src/lib/lpu/calculate-payout.ts` — `applyPayoutFormula(payout, visit)`: 3 tipos suportados; `calculatePayout(visit, rules, reason)`: fluxo completo incluindo improdutiva e fallback ao match engine; `calculateDeixadoNaMesa(visit, rules, reason)`: simula "sucesso" para falha_tecnico
- `src/lib/lpu/conflicts.ts` — `detectConflicts(rules)`: agrupa regras ativas por prioridade, retorna grupos com ≥ 2 regras
- `src/lib/lpu/simulator.ts` — `simulate(rules, visitas, reasons)`: loop puro, acumula totais por status e técnico, retorna `SimulationResult` com distribuição e detalhes de sem-regra
- `src/lib/lpu/index.ts` — re-exports da API pública

**Testes (`src/lib/lpu/__tests__/`):**
- `match-engine.test.ts` — 7 casos: exact, array, range casa, range não casa, condition difere, conflito, sem regras ativas
- `calculate-payout.test.ts` — 10 casos: fixed, formula+drop, formula+null, percentage, no_rule_match, falha_tecnico valor=0+deixadoNaMesa, override fixo, pending_classification, calculateDeixadoNaMesa (2 casos)
- `conflicts.test.ts` — 3 casos: sem conflito, com conflito, regras inativas ignoradas
- `simulator.test.ts` — 4 casos: todas com regra, mix, pending_classification, lista vazia

**Decisões:**
- `conditions` armazena camelCase — consistente com TypeScript e Drizzle, sem mapeamento no match engine
- `LpuRuleNarrowed` extends `LpuRule` do schema Drizzle com `conditions` e `payout` narrowados
- `ConditionValue` suporta escalar | array | range `{min?, max?}` — cobre casos reais sem complexidade excessiva
- Lib é 100% pura (sem IO): Server Actions / Server Components fetcham dados e delegam para a lib
- `Map.groupBy` evitado — `reduce` manual para compatibilidade com Node 20 LTS
- `calculatePayout` trata `sucesso='Sim'` separado de improdutiva: improdutiva paga com `valorImprodutiva` override → fallback ao match engine procurando regra `sucesso='Improdutiva'`
- 52 testes passando (28 ETL + 24 LPU), typecheck zero erros, lint zero warnings

### 4. Telas de LPU ✅ Concluída (2026-05-31)

**Arquivos criados:**
- `src/app/(manager)/lpu/actions.ts` — 6 Server Actions: `createLpu`, `activateLpu`, `createLpuRule`, `updateLpuRule`, `deactivateLpuRule`, `duplicateLpuRule`
- `src/app/(manager)/lpu/page.tsx` — lista de LPUs com LPU ativa destacada (border cyan), tabela histórico, empty state com CTA
- `src/app/(manager)/lpu/new/page.tsx` + `_components/CreateLpuForm.tsx` — formulário de criação com nome, vigência início/fim; LPU nasce como rascunho
- `src/app/(manager)/lpu/[id]/page.tsx` — detalhe com badge Ativa/Rascunho, banner de conflitos (via `detectConflicts`), tabela de regras com Editar/Duplicar/Desativar, botão "Ativar esta LPU", link Simular (placeholder Etapa 5)
- `src/app/(manager)/lpu/[id]/rules/new/page.tsx` + `_components/CreateRuleForm.tsx` — builder de conditions (11 campos, 5 tipos de input: text, select, boolean, number, range) + builder de payout (3 tipos: valor fixo, fórmula, % receita) + prioridade auto/manual
- `src/app/(manager)/lpu/[id]/rules/[ruleId]/edit/page.tsx` + `_components/EditRuleForm.tsx` — mesmos builders inicializados com dados da regra existente; botões Desativar e Duplicar; feedback de sucesso
- `src/app/(manager)/_components/Sidebar.tsx` — item "LPU" com ícone `ScrollText` adicionado entre Motivos e OSs

**Decisões:**
- `activateLpu` usa assinatura `(lpuId, _formData) => void` — plain form action sem `useActionState`; revalidatePath re-renderiza a página mostrando o novo estado
- `EditRuleForm` é componente standalone (não reutiliza `CreateRuleForm`) — evita prop drilling excessivo para casos distintos
- Funções `conditionsToRows` e `payoutToState` em `EditRuleForm` convertem JSON do banco para estado React inicial
- `formatConditions` e `formatPayout` como helpers locais em `[id]/page.tsx` — lógica de display só relevante aqui
- typecheck zero erros, lint zero warnings, 52 testes passando (nenhum novo — lib pura sem IO)

- [x] `/lpu` — lista de LPUs (vigente em destaque, histórico abaixo)
- [x] `/lpu/[id]` — visualização da LPU com lista de regras ordenadas por prioridade
- [x] `/lpu/new` — criar LPU (rascunho), define vigência, depois adiciona regras
- [x] `/lpu/[id]/rules/new` — formulário de regra:
  - Builder visual de `conditions` (chave → operador → valor)
  - Builder de payout (botões: fixo / fórmula / % receita)
  - Prioridade (auto ou manual)
  - Description (texto livre)
- [x] `/lpu/[id]/rules/[ruleId]/edit` — editar regra
- [x] Botão "Desativar regra" (soft delete)
- [x] Botão "Duplicar regra" (gera cópia editável)

### 5. Tela de simulação ✅ Concluída (2026-06-01)

**Arquivo criado:**
- `src/app/(manager)/lpu/[id]/simulate/page.tsx` — Server Component puro; 1 arquivo novo

**Funcionalidades:**
- Filtro de período por mês (chips dos últimos 6 meses via `searchParams.mes` = `YYYY-MM`, default mês atual)
- 5 queries paralelas: LPU, regras ativas, visitas do período, motivos, técnicos
- Mapeamento snake_case → camelCase para `SimVisit[]` (ex: `subterraneo_aereo` → `subterraneaAereo`)
- Chamada a `simulate(rules, simVisits, reasons)` da lib — sem IO, puro
- Grid de 5 KPIs de visitas: Total, Com regra, Sem regra (vermelho), Conflito (vermelho), Pendentes (vermelho)
- Grid de 3 KPIs financeiros: Total estimado a pagar, Receita total, Margem (verde)
- Tabela de distribuição por técnico (nome resolvido via Map, fallback "Técnico desconhecido")
- Tabela de visitas sem regra (OS, finalidade, sucesso) — exibida inline quando `visitasSemRegra > 0`
- Empty state quando nenhuma visita no período
- Botão "Ativar esta LPU" (se LPU em rascunho) — reutiliza `activateLpu` de `../actions`

**Decisões:**
- Server Component puro — sem estado cliente; período via URL é suficiente para MVP
- Filtro por `data_execucao` (não por `upload_id`) — mês de execução real das visitas
- `.lt('data_execucao', fimExclusivo)` com primeiro dia do mês seguinte — evita ambiguidade de timestamp
- Todos os técnicos incluídos no lookup (sem filtro `ativo=true`) — preserva histórico de técnicos desativados
- typecheck zero erros, lint zero warnings, 52 testes passando (nenhum novo)

- [x] `/lpu/[id]/simulate` — escolhe período (default: mês atual)
- [x] Roda match engine sobre todas as visitas do período
- [x] Mostra total a pagar, receita, margem, visitas com/sem regra, conflito, pendentes
- [x] Distribuição por técnico
- [x] Lista inline de visitas sem regra (OS, finalidade, sucesso)
- [x] Botão "Ativar esta LPU"

### 6. Telas de motivos ✅ Concluída (2026-05-31)

**Arquivos criados:**
- `src/app/(manager)/motivos/page.tsx` — lista com 6 chips de filtro por categoria (Todos | Falha Técnico | Falha Cliente | Força Maior | Falha Sistema | Pendentes); filtro via URL `?categoria=X`; `CategoriaBadge` com badge vermelho pulsante para `pendente_classificacao`; tabela com motivo original, normalizado, categoria e paga improdutiva; link "Editar" por linha
- `src/app/(manager)/motivos/actions.ts` — `updateReason(reasonId, _prevState, formData)`: Zod, `requireRole`, atualiza `motivo_normalizado`, `categoria`, `paga_improdutiva`, `valor_improdutiva`, `observacao`; `recalculateAffectedPayouts` (stub — retorna mensagem de disponibilidade na Etapa 3)
- `src/app/(manager)/motivos/[id]/edit/page.tsx` — breadcrumb, header com `motivo_original` read-only, `<EditReasonForm />`
- `src/app/(manager)/motivos/[id]/edit/_components/EditReasonForm.tsx` — `useActionState` com `.bind(null, reasonId)`; radio group 4 categorias (sem `pendente_classificacao`); checkbox `pagaImprodutiva`; input numérico `valorImprodutiva` (vazio = usa LPU); textarea `observacao`; feedback de erro e sucesso
- `src/app/(manager)/_components/Sidebar.tsx` — item "Motivos" com ícone `Tag` entre Uploads e OSs

**Decisões:**
- `motivo_original` nunca editável — chave única `(tenant_id, motivo_original)` usada pelo ETL para deduplicação
- `pendente_classificacao` fora do radio — ao salvar, o motivo sempre recebe uma das 4 categorias reais
- Filtro server-side via URL — sem estado cliente; `searchParams` async (Next.js 15)
- Botão "Recalcular payouts" é stub — payouts são Sprint 4; botão desabilitado com mensagem explicativa
- `valor_improdutiva` em branco → NULL no banco — semântica "usa regra da LPU"

### 7. Auto-criação de motivos na ingestão

- [ ] Atualizar `src/lib/etl/matchers.ts` para criar motivo automaticamente
- [ ] Notificação no painel quando motivo novo aparece

### 8. Permissões

- [ ] Apenas `tenant_owner`, `tenant_manager` e `tallpa_owner` podem editar LPU
- [x] Motivos: `requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])` em todas as actions
- [x] Técnicos não acessam `/motivos` (layout guard do portal manager)

---

## Escopo OUT

- ❌ Cálculo de payouts em massa (Sprint 4)
- ❌ Override manual de payout (Sprint 4)
- ❌ Fechamento mensal (Sprint 4)
- ❌ Tipos de payout `tiered` ou `reference` (futuro)
- ❌ Builder visual avançado de regras (drag & drop) — usar form simples no MVP

---

## Definition of Done

- [ ] Cadastro completo da LPU real da Wave (todas as regras)
- [ ] Simulação nas 857 visitas de abril/2026 mostra:
  - Total a pagar próximo do esperado pelo cliente
  - Lista de visitas sem regra com motivo claro (nova finalidade, etc.)
- [ ] Todos os motivos da planilha de abril classificados
- [ ] Re-simulação após classificação reduz/zera as visitas com `payout = NULL`
- [ ] Lint, typecheck, build, testes passando
- [ ] Validação Gemini aprovada

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| LPU real do cliente é mais complexa que o esperado | Alto | Validação cedo: cliente fornece LPU real na primeira semana, ajustar tipos de payout |
| JSONB conditions ficam difíceis de editar via UI simples | Médio | Começa com form simples campo-a-campo; melhora depois |
| Performance da simulação com muitas regras × muitas visitas | Baixo | Match engine é O(rules × visits), tranquilo com volumes esperados |

---

## Anotações pós-sprint

**2026-05-31 — Etapa 1 concluída (Telas de Motivos):**
- 4 arquivos criados em `src/app/(manager)/motivos/` + sidebar atualizado
- `reason_id` já estava em `0001_initial_schema.sql` e sendo preenchido pelo ETL — sem migration nova necessária
- Filtro de categoria via URL funcional, sem estado cliente
- `updateReason` com Zod: atualiza normalizado, categoria, improdutiva, observação; nunca toca `motivo_original`
- `recalculateAffectedPayouts` stub retorna mensagem explicando disponibilidade futura
- typecheck zero erros, lint zero warnings, 28 testes passando

**2026-05-31 — Etapa 2 concluída (Schema Drizzle LPU):**
- `lpus`, `lpu_rules`, `lpu_rules_audit` já existiam em `0001_initial_schema.sql` — sem migration nova
- `src/db/schema/lpus.ts` criado: `Lpu`, `NewLpu`, `LpuConditions`, `PayoutType`, `LpuPayout`
- `src/db/schema/lpu-rules.ts` criado: `LpuRule`, `NewLpuRule`, `LpuRuleAudit`
- `src/db/schema/index.ts` atualizado com 10 tabelas na ordem FK
- GIN index omitido do schema Drizzle (não suportado nesta versão) — garantido pelo SQL de `0001`
- `db:generate` segundo run: "No schema changes" — snapshot alinhado
- typecheck zero erros, lint zero warnings, 28 testes passando

**2026-05-31 — Etapa 3 concluída (Lib `src/lib/lpu/`):**
- 7 arquivos criados: `types.ts`, `schemas.ts`, `match-engine.ts`, `calculate-payout.ts`, `conflicts.ts`, `simulator.ts`, `index.ts`
- 4 arquivos de teste em `__tests__/` — 24 novos testes (52 total)
- `conditions` usa camelCase — sem mapeamento no match engine, consistente com Drizzle
- Match engine suporta 3 tipos de condição: exact, array `includes`, range `{min?, max?}`
- 3 tipos de payout implementados: `fixed`, `formula` (base + field × rate), `percentage_of_revenue`
- Lógica completa de improdutiva: paga_improdutiva=false → R$0 + deixadoNaMesa; override por valorImprodutiva; fallback ao match engine
- Lib pura sem IO — Server Actions orquestram fetch + delegam para a lib
- typecheck zero erros, lint zero warnings, 52 testes passando

**2026-05-31 — Etapa 4 concluída (Telas de LPU):**
- 10 arquivos criados + 1 modificado (Sidebar)
- `actions.ts` com 6 Server Actions — `activateLpu` usa plain form action (assinatura `(lpuId, _formData) → void`), sem `useActionState`, revalidatePath re-renderiza
- Ordem crítica em `activateLpu`: desativa LPU ativa antes de ativar a nova — trigger PostgreSQL `enforce_single_active_lpu` rejeita duas ativas simultâneas
- `CreateRuleForm` com builder dinâmico de conditions (11 campos, 5 tipos de input) e builder de payout (3 tipos com campos condicionais); conditions montadas como JSON em hidden input
- `EditRuleForm` standalone com converters `conditionsToRows` e `payoutToState` para inicializar estado a partir do JSONB do banco
- Detecção de conflitos via `detectConflicts()` da lib — banner amarelo exibido quando existem regras com mesma prioridade
- Sidebar atualizado com item "LPU" (ícone `ScrollText`) entre Motivos e OSs
- typecheck zero erros, lint zero warnings, 52 testes passando (nenhum novo — sem lógica de domínio nos componentes)

**2026-06-01 — Etapa 5 concluída (Tela de Simulação):**
- 1 arquivo criado: `src/app/(manager)/lpu/[id]/simulate/page.tsx`
- Server Component puro — sem estado cliente, sem Client Components, sem novas Server Actions
- 5 queries paralelas: LPU, regras ativas, visitas do período, motivos, técnicos
- Mapeamento explícito snake_case → camelCase: `subterraneo_aereo → subterraneaAereo`, `drop_usado → dropUsado`, etc. com fallbacks para campos nullable (`cidade ?? ''`, `condominio ?? false`)
- Filtro de período via `searchParams.mes` (chips dos últimos 6 meses); `.lt('data_execucao', fimExclusivo)` com primeiro dia do mês seguinte
- KPIs de visitas (5) e financeiros (3) em grids separados; tabela de técnicos com nome resolvido via Map
- Visitas sem regra exibidas inline (sem drill-down separado)
- Sprint 3 concluída — typecheck zero erros, lint zero warnings, 52 testes passando
