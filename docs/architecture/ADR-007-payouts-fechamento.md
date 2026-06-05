# ADR-007 — Arquitetura de Payouts e Fechamento Mensal

**Status:** Aceito
**Data:** 2026-06-01
**Decisores:** Jhoni Cleyton (Tallpa)

---

## Contexto

Sprint 4 implementa o ciclo financeiro completo: cálculo automático de payouts a partir das visitas ingeridas, lifecycle de aprovação mensal e geração de relatórios. As decisões abaixo foram tomadas para balancear simplicidade (MVP de ~8 técnicos) com corretude e auditabilidade.

---

## Decisões

### 1. Lib `src/lib/payouts/` é 100% pura (sem IO)

**Decisão:** Nenhuma função em `src/lib/payouts/` faz chamadas ao banco ou a serviços externos. Server Actions orquestram as queries Supabase e delegam à lib.

**Razão:** Mesmo padrão de `src/lib/lpu/` e `src/lib/etl/`. Funções puras são testáveis unitariamente sem mocks de banco. A lib de payouts tem 14 testes unitários que rodam em ~5ms.

**Consequência:** Server Actions ficam um pouco mais verbosas (buscam dados, chamam lib, persistem resultado), mas o domínio fica isolado e testável.

---

### 2. `recalculatePendingPayouts` nunca toca `approved` ou `paid`

**Decisão:** A função `recalculatePendingPayouts` (chamada nos 4 pontos de wiring) filtra payouts existentes e pula aqueles com `status IN ('approved', 'paid')`. Eles nunca são atualizados por recálculo automático.

**Razão:** Invariante financeira crítica. Uma vez aprovado pelo gestor, o valor não pode mudar sem ação explícita auditada (reabertura de fechamento). Isto preserva o histórico financeiro e evita surpresas.

**Consequência:** O único caminho para alterar um payout aprovado é: gestor reabre o fechamento (com motivo ≥ 20 chars) → payouts `approved` voltam para `pending` → recálculo pode agir → novo ciclo de aprovação.

---

### 3. Mapeamento de status entre lib LPU e banco

**Decisão:** O status `"pending"` retornado pela lib LPU (`calculate-payout.ts`) é mapeado para `"pending_review"` no banco de dados. A função `mapStatus()` em `src/lib/payouts/calculate.ts` faz essa conversão.

**Razão:** Na lib LPU, `"pending"` significa "calculado com sucesso, pronto para payout". No banco, `"pending"` tem semântica diferente: "incluído em fechamento aguardando aprovação". O status de saída do cálculo é `"pending_review"` — visita calculada, aguardando inclusão num closing.

**Consequência:** Quem lê o código deve saber que `PayoutStatus` existe em dois módulos com `"pending"` significando coisas distintas. Importar o tipo do banco como `DbPayoutStatus` em `src/lib/payouts/types.ts` deixa isso explícito.

---

### 4. Geração de relatórios síncrona via route handlers

**Decisão:** Os PDFs e o Excel são gerados sincronamente em route handlers GET (`/fechamento/[periodo]/export/...`). Não há fila assíncrona.

**Razão:** Wave tem ~8 técnicos. `renderToBuffer()` do `@react-pdf/renderer` gera cada PDF em centenas de milissegundos — muito abaixo do timeout de 10s de route handlers Vercel. Volume não justifica a complexidade de uma fila.

**Consequência:** Se o número de técnicos crescer significativamente (>50), a geração do PDF consolidado pode exceder o timeout. Nesse cenário, migrar para geração assíncrona com polling — mas isso é pós-MVP.

**Por que route handlers e não Server Actions:** Server Actions retornam objetos serializáveis via RSC Protocol — não suportam `Response` binária com `Content-Disposition`. Route handlers têm interface HTTP limpa e suportam streaming de binários.

---

### 5. `monthly_closing` criado no recálculo, não no upload

**Decisão:** `recalculatePendingPayouts` faz upsert idempotente de `monthly_closing` para cada período encontrado nas visitas processadas (`ignoreDuplicates: true` no `ON CONFLICT (tenant_id, periodo)`).

**Razão:** O upload não conhece a semântica de períodos financeiros. O recálculo já tem as visitas e sabe seus períodos — é o lugar natural para garantir que o closing exista.

**Consequência:** Todo período com pelo menos uma visita tem um `monthly_closing` correspondente. A UI de `/fechamento` reflete apenas os períodos que já têm dados reais.

---

### 6. Filtro de período por JOIN, não por coluna do payout

**Decisão:** Queries de payouts por período usam `.gte('service_visits.data_execucao', inicio)` (filter via JOIN), não uma coluna `periodo` desnormalizada em `payouts`.

**Razão:** A data de execução da visita é a fonte de verdade do período. Desnormalizar criaria inconsistência se uma visita fosse movida de período (edge case). O JOIN com filtro é resolvido pelo Supabase/PostgREST com eficiência suficiente para os volumes esperados.

**Consequência:** Queries de payouts por período sempre fazem JOIN com `service_visits`. Aceitável dado o volume (~857 visitas/mês no caso Wave).

---

### 7. Cast `as unknown as T` em relações Supabase

**Decisão:** Relações joinadas no Supabase client (ex: `payout.service_visits`) são inferidas como arrays mesmo quando a relação é 1:1. O cast correto é `as unknown as T | null`, não `as T | null`.

**Razão:** O cliente Supabase TypeScript não consegue inferir cardinalidade da relação a partir da query string. O cast direto `as T` gera erro TS2352 ("neither type sufficiently overlaps"). O `as unknown as T` é o padrão idiomático para este cenário.

**Consequência:** Toda query com JOIN em Server Components de payouts e fechamento usa este padrão de cast.

---

### 8. Validação de bloqueadores no frontend E no backend

**Decisão:** Os bloqueadores para `solicitarAprovacao` são verificados tanto na tela `/fechamento/[periodo]` (exibe lista ao gestor) quanto na Server Action `solicitarAprovacao` (chama `validateClosingReadiness()` antes de avançar).

**Razão:** A tela mostra os bloqueadores para o gestor resolver. A Server Action re-valida porque o estado pode ter mudado entre a última renderização e o click do botão (race condition improvável mas possível).

**Consequência:** `validateClosingReadiness()` é chamado em dois lugares — mas é uma função pura barata, sem IO.

---

## Consequências gerais

**Positivas:**
- Ciclo financeiro completo e auditável: todo payout tem `lpu_rule_id` + `override_motivo` (se override) + `payouts_audit` (trigger)
- Invariante `approved`/`paid` protegida em dois níveis (código + lógica de negócio)
- Relatórios disponíveis imediatamente após aprovação, sem geração batch assíncrona

**Negativas / Trade-offs:**
- Recálculo sem filtro de `visitIds` após ingestão recalcula todos os payouts pendentes do tenant (não apenas os da planilha atual) — aceitável porque locked payouts são ignorados e o volume é gerenciável
- PDF consolidado não inclui detalhes de visitas por técnico (tech-debt 009) — layout atual não precisa disso
- `solicitarAprovacao` usa filtro de período via JOIN aninhado — se Supabase mudar comportamento de nested filter, pode quebrar silenciosamente
