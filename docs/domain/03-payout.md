# Domínio 03 — Payouts e Fechamento Mensal

> Este documento detalha o ciclo de vida do pagamento ao técnico, desde o cálculo automático até a aprovação final pelo gestor.

---

## Entidade `payout`

### O que é
Registro de cálculo de pagamento para uma visita específica. Cada visita tem zero ou um payout. O payout é calculado automaticamente pelo motor de regras a partir da LPU vigente na data de execução.

### Campos do banco

```sql
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  visit_id UUID NOT NULL UNIQUE REFERENCES service_visits(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES technicians(id),

  -- Cálculo
  lpu_id UUID REFERENCES lpus(id),
  lpu_rule_id UUID REFERENCES lpu_rules(id),
  reason_id UUID REFERENCES reasons(id),
  valor_calculado NUMERIC(10, 2),
  valor_deixado_na_mesa NUMERIC(10, 2) NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL CHECK (status IN (
    'pending_calculation',
    'pending_review',
    'pending',
    'approved',
    'paid',
    'contestado',
    'override',
    'no_rule_match',
    'pending_classification',
    'conflict'
  )),

  -- Override manual
  valor_override NUMERIC(10, 2),
  override_motivo TEXT,
  override_by UUID REFERENCES users(id),
  override_at TIMESTAMPTZ,

  -- Aprovação
  closing_id UUID REFERENCES monthly_closings(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Estados (status)

```
pending_calculation
        ↓
   ┌────┴──────────────────────────────────┐
   ↓                    ↓                  ↓
pending_review     no_rule_match        conflict
   ↓           pending_classification
   │    (gestor resolve → recalculate → pending_review)
   ↓
 pending  ← solicitarAprovacao() move pending_review → pending
   ↓
approved  ← aprovarFechamento()
   ↓
  paid    ← marcarComoPago()

Lateral a qualquer estado (exceto approved/paid):
   → override  ← gestor edita valor manualmente
```

| Status | Significado | Próxima ação |
|---|---|---|
| `pending_calculation` | Aguardando match engine rodar | Automático — recalculate-batch |
| `pending_review` | Calculado, aguardando inclusão em fechamento | Aguardar `solicitarAprovacao` |
| `pending` | Incluído em fechamento aguardando aprovação | Aguardar `aprovarFechamento` |
| `approved` | Aprovado para pagamento | Gestor executa pagamento externo |
| `paid` | Pagamento registrado | Estado final imutável |
| `no_rule_match` | Nenhuma regra LPU aplica | Gestor cria/ajusta regra → recálculo automático |
| `pending_classification` | Motivo não classificado ainda | Gestor classifica em /motivos → recálculo automático |
| `conflict` | Múltiplas regras com mesma prioridade casaram | Gestor ajusta prioridades em /lpu → recálculo |
| `override` | Gestor alterou valor manualmente | Segue fluxo normal para aprovação |
| `contestado` | Técnico contestou o valor (ADR-013) | Wave resolve em `/fechamento/[periodo]` → volta para `pending` |

### Override manual

Gestor pode editar o valor de um payout antes da aprovação. Ao fazer isso:
- `valor_override` é preenchido
- `override_motivo` é obrigatório (texto livre)
- `override_by` e `override_at` registrados
- `status` muda para `override`
- `valor_calculado` é preservado para auditoria

O valor **efetivo** sempre é: `COALESCE(valor_override, valor_calculado)`.

---

## Ordem de precedência do cálculo

`buildPayoutUpsert` (`src/lib/payouts/calculate.ts`) é uma função pura com **saídas antecipadas**:
a primeira condição que casa decide o payout. A ordem abaixo é a decisão de domínio — não um
detalhe de implementação. Mudá-la muda o valor pago.

| # | Condição | Resultado | Origem |
|---|---|---|---|
| 0 | Payout travado (`approved`/`paid`/`contestado`/`override_by`) | **Não recalcula** (nem chega aqui) | Invariante Sprint 4 + ADR-013 |
| 1 | Sem sucesso **e** Unetvale = R$ 15,98 **e** técnico mapeado | R$ 15,00, já `approved`, fora da fila | Improdutiva padrão |
| 2 | Sem sucesso **e** Unetvale = R$ 0,00 | R$ 0,00, fora da fila, preserva "deixado na mesa" | Improdutiva sem reembolso |
| 3 | Com sucesso **e** Unetvale = R$ 29,30 | R$ 0,00 (roteador agregado — não paga) | [ADR-016](../architecture/ADR-016-ajustes-coluna-z.md) |
| 4 | Com sucesso **e** coluna Z começa com "Homologa…" | Repasse fixo pelo mapa de homologação; valor não cadastrado → `no_rule_match` | [ADR-015](../architecture/ADR-015-homologacao-repasse.md) |
| 5 | Com sucesso **e** finalidade = "Venda Produto Externo" | Valor-base pela coluna Z; não reconhecido → `no_rule_match` | ADR-016 |
| 6 | Com sucesso **e** finalidade do grupo Cabeamento/Condomínio | Valor da **classificação do gestor** (`/cabeamento`); sem classificação → `no_rule_match` | [ADR-009](../architecture/ADR-009-cabeamento-classificacao.md) |
| 7 | Demais casos | **Motor de LPU** (match engine) + política do motivo | [ADR-004](../architecture/ADR-004-lpu-rule-engine.md) |

Sobre o valor-base resolvido acima incidem, nesta ordem, dois modificadores:

1. **Ponto adicional** (coluna Z, `(+73 * N ponto(s) adicional(is))`): `+R$ 36 por ponto`, aplicado
   nos caminhos 5, 6 e 7. **Homologação (4) não passa por aqui** — o repasse com ponto já vem do
   próprio mapa. Improdutiva não tem ponto na coluna Z. — ADR-016
2. **Acréscimo de domingo/feriado**: `× 1,15` sobre base + ponto, **apenas em execução com
   sucesso**, nos caminhos 4, 5, 6 e 7. Improdutiva nunca recebe. —
   [ADR-011](../architecture/ADR-011-acrescimo-domingo-feriado.md)

E, transversalmente, a **LPU aplicável é resolvida por técnico**: um técnico vinculado a uma LPU
alternativa (ex.: "SEM AUXILIAR") casa as regras daquela tabela, não da padrão —
[ADR-014](../architecture/ADR-014-lpu-por-tecnico.md).

> **Por que homologação, coluna Z e cabeamento precedem a LPU:** a finalidade da Unetvale não
> descreve o serviço real nesses casos. Uma homologação chega com finalidade "Instalação - Fibra"
> e casaria a regra de instalação real, pagando 120/135 em vez do repasse de 35. O que distingue
> está na coluna Z (`explicacao_valor`), por isso ela é consultada **antes** do motor de LPU.

---

### Improdutiva por receita da Unetvale

O payout da improdutiva é decidido pela receita da Unetvale (`valor_recebido_unetvale`), no cálculo (`buildPayoutUpsert`), **independente da classificação do motivo**:

| Receita Unetvale | Payout ao técnico | Status / fila |
|---|---|---|
| **R$ 15,98** (improdutiva padrão) | **R$ 15,00 fixos** | `approved`, `improdutiva_aprovada = true` — **fora da fila** |
| **R$ 0,00** (Unetvale não reembolsou, típico de falha do técnico) | **R$ 0,00** | `improdutiva_aprovada = false` — **fora da fila**; preserva "deixado na mesa" |
| **Qualquer outro valor** | fluxo normal (motivo/LPU) | entra na fila `/improdutivas` para validação manual |

Detalhes:
- **15,98 → 15,00**: sobrepõe `paga_improdutiva`/`valor_improdutiva`/categoria (inclusive `falha_tecnico` e `pendente_classificacao`). Exige **técnico mapeado** (`tecnico_id` não nulo); sem técnico cai no fluxo normal (o fechamento sinaliza a visita sem técnico). Como sai `approved`, fica travada contra recálculo (ver invariante abaixo); reverter exige **Desfazer** na fila ou reabrir fechamento.
- **0,00 → 0,00**: decisão automática de não pagar; sai da fila mas **não trava** (não é `approved`), então o recálculo reavalia — se a receita mudar para 15,98 num re-upload, passa a 15,00. `null` (receita desconhecida) **não** conta como zero: segue o fluxo normal.
- **Decisão manual do gestor prevalece**: quando existe `override_by` (rejeição manual) — ou o payout está `approved`/`paid` (aprovação manual, já travado) — as regras automáticas **não** se aplicam.
- Valores fixos no código (`src/lib/payouts/calculate.ts`): `UNETVALE_IMPRODUTIVA_PADRAO_CENTAVOS = 1598`, `PAYOUT_IMPRODUTIVA_PADRAO = 15,00`. Comparação em centavos (evita drift de float). Tornar configurável por tenant exige ADR.

---

## Recálculo de payouts

Recálculo é automático e disparado por:

1. **Ingestão de upload** — `processUpload` chama `recalculatePendingPayouts(tenantId, supabase)` após ingestão bem-sucedida
2. **Ativação de nova LPU** — `activateLpu` chama `recalculatePendingPayouts` sem filtro (nova LPU pode afetar todos os períodos abertos)
3. **Classificação de motivo** — `updateReason` chama `recalculatePendingPayouts` após classificar o motivo
4. **Vinculação manual de técnico** — `linkTechnicianRaw` chama `recalculatePendingPayouts` com IDs das visitas vinculadas

A função `recalculatePendingPayouts` (`src/lib/payouts/recalculate-batch.ts`):
- Busca visitas pendentes (sem payout travado — ver invariante abaixo)
- Calcula via `buildPayoutUpsert` para cada visita
- Faz upsert em `payouts` com `ON CONFLICT visit_id → UPDATE`
- Cria `monthly_closing` do período se não existir (idempotente)

**Invariante crítica:** Recálculo NUNCA reprocessa payouts travados — preserva **status E valor**:
- `status IN ('approved', 'paid')`: fechados/pagos, travados para preservar histórico financeiro.
- `status = 'contestado'`: contestação aberta do técnico (ADR-013). Reprocessar apagaria o status
  enquanto a contestação continuaria aberta em `payout_contestacoes` — inconsistência. Ao resolver,
  a Wave devolve o payout para `pending` (destravado) e ele volta a reprocessar normalmente.
- `override_by` preenchido: **override/rejeição manual do gestor**. Reprocessar sobrescreveria o status — ex.: uma improdutiva rejeitada, ao ser reprocessada pela LPU, viraria `no_rule_match` e **travaria o fechamento**, mesmo com `valor_override` mantendo R$ 0. Os fluxos de **desfazer** e **reabertura** limpam `override_by` ANTES de recalcular, então continuam reprocessando normalmente.

Para forçar recálculo de aprovado, gestor precisa primeiro **reabrir o fechamento** (ação auditada com motivo obrigatório de 20 chars).

---

## Fechamento Mensal

### Entidade `monthly_closing`

```sql
CREATE TABLE monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  periodo TEXT NOT NULL,                    -- '2026-04'
  status TEXT NOT NULL CHECK (status IN ('aberto', 'aguardando_aprovacao', 'aprovado', 'pago', 'reaberto')),

  total_a_pagar NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_receita_unetvale NUMERIC(12, 2) NOT NULL DEFAULT 0,
  margem NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_visitas INTEGER NOT NULL DEFAULT 0,
  total_oss INTEGER NOT NULL DEFAULT 0,

  aprovado_por UUID REFERENCES users(id),
  aprovado_em TIMESTAMPTZ,

  reaberto_por UUID REFERENCES users(id),
  reaberto_em TIMESTAMPTZ,
  reaberto_motivo TEXT,

  pago_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, periodo)
);
```

### Lifecycle do fechamento

```
[Sistema cria automaticamente quando primeira visita do período é ingerida]
          ↓
   aberto (recebendo visitas/payouts)
          ↓
   aguardando_aprovacao (gestor clicou "Solicitar fechamento")
          │   ← conferência dos técnicos (ADR-013): cada técnico aprova ou contesta
          │     seu período em /aprovacoes; contestação aberta BLOQUEIA o passo seguinte
          ↓
   aprovado (gestor aprovou)
          ↓
   pago (gestor marcou como pago)
```

**reaberto** é um estado especial: gestor pode reabrir um fechamento aprovado se descobriu erro. Ação auditada com motivo obrigatório.

### Conferência do técnico (ADR-013)

`aguardando_aprovacao` significa "aguardando conferência dos técnicos". O estado por técnico fica
em `closing_technician_reviews` (`pendente` | `aprovado` | `contestado`), criado/resetado no
"Solicitar aprovação", que também notifica cada técnico.

- O técnico **aprova** o período ou **contesta** OSs específicas com motivo. Contestar também é
  possível fora da janela de fechamento, direto de `/visitas` (contestação contínua) — nesse caso
  a revisão do período ainda não existe e a atualização é no-op.
- Cada contestação aberta põe o payout em `contestado` (travado) e aparece agrupada por técnico em
  `/fechamento/[periodo]`.
- A Wave **resolve** com uma resposta e, opcionalmente, um novo valor: o payout volta a `pending`
  (com `override` se houve ajuste), a revisão do técnico volta a `pendente` e ele reconfere,
  vendo a pontuação antes → depois.
- **Aprovar pagamento fica bloqueado enquanto houver contestação aberta** no período. Revisões
  `pendente` (técnico que não respondeu) geram alerta visual, mas não travam.

### Quando virar "aguardando_aprovacao"

O gestor decide manualmente clicando "Solicitar fechamento de [mês]". Antes de virar este estado, o sistema valida:

- Nenhum payout no período com status `pending_classification`
- Nenhum payout no período com status `no_rule_match`
- Nenhum payout no período com status `conflict`
- Nenhuma visita no período com `tecnico_id IS NULL`

Se houver pendências, o sistema mostra a lista e bloqueia até resolução.

### Aprovação

Apenas `tenant_owner` ou `tenant_manager` (e `tallpa_owner` em caso de suporte). Ação:

1. Calcula totais via `buildClosingTotals()` → grava em `monthly_closing` (`total_a_pagar`, `total_visitas`)
2. Move todos os payouts `pending` do período para `approved`, preenchendo `closing_id`, `approved_by`, `approved_at`
3. Fecha o `monthly_closing` (`status = 'aprovado'`, `aprovado_por`, `aprovado_em`)
4. INSERT em `notifications` para cada técnico com payout aprovado
5. Relatórios ficam disponíveis por demanda via route handlers — não gerados automaticamente na aprovação

### Marcação de pagamento

Após pagar de fato (PIX, transferência, etc.), gestor clica "Marcar como pago". Sistema:

1. Move todos os payouts `approved` para `paid`
2. Atualiza `monthly_closing.status = 'pago'`, `pago_em = now()`
3. Notifica técnicos

Pagamento em si **NÃO é processado pelo sistema** — apenas registrado.

### Reabertura

Em caso de erro descoberto após aprovação:

1. Gestor clica "Reabrir fechamento"
2. Preenche motivo obrigatório
3. Sistema move payouts de `approved` (mas não `paid`) de volta para `pending`
4. `monthly_closing.status = 'reaberto'`
5. Após correções, gestor reaprova

**Payouts já pagos (`paid`) NÃO podem ser reabertos** — exigem estorno via fluxo manual fora do sistema.

---

## Relatórios de fechamento

### Relatório consolidado por técnico

```
Fechamento Wave Telecom — Abril/2026 — APROVADO em 03/05/2026 por João Silva

Técnico              | Visitas | OSs Resolvidas | Total a Pagar | Detalhe
─────────────────────┼─────────┼────────────────┼───────────────┼─────────
Douglas Ribeiro      | 190     | 138            | R$ 14.250,00  | [ver]
Daniel Soares        | 147     | 110            | R$ 11.890,00  | [ver]
...

TOTAIS               | 857     | 595            | R$ 62.180,00

Receita Unetvale: R$ 87.869,47
Margem bruta:     R$ 25.689,47 (29,2%)

[Exportar Excel]  [Exportar PDF]  [Marcar como Pago]
```

### Relatório individual por técnico (recibo)

Documento gerado para cada técnico contendo:
- Lista de visitas com data, OS, finalidade, valor
- Total a receber
- Período de competência

---

## Performance e indices

```sql
CREATE INDEX idx_payouts_tenant_status ON payouts(tenant_id, status);
CREATE INDEX idx_payouts_visit ON payouts(visit_id);
CREATE INDEX idx_payouts_technician_status ON payouts(technician_id, status);
CREATE INDEX idx_payouts_closing ON payouts(closing_id);
```

Cálculo do total a pagar do mês:

```sql
SELECT
  technician_id,
  SUM(COALESCE(valor_override, valor_calculado)) AS total_payout,
  SUM(valor_deixado_na_mesa) AS total_deixado_na_mesa,
  COUNT(*) AS total_visitas
FROM payouts
WHERE
  tenant_id = $1
  AND closing_id IS NULL
  AND status IN ('pending', 'override')
GROUP BY technician_id;
```

---

## Auditoria

Toda mudança de status em payout gera entrada em `payouts_audit`:

```sql
CREATE TABLE payouts_audit (
  id UUID PRIMARY KEY,
  payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES users(id),
  before JSONB NOT NULL,
  after JSONB NOT NULL
);
```

Trigger automático em UPDATE de `payouts`.
