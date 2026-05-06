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
   ┌────┴─────────────────────────┐
   ↓                ↓              ↓
pending      pending_review   no_rule_match
                                 conflict
                          pending_classification
   ↓
approved (após fechamento aprovado)
   ↓
paid (após registro de pagamento)
```

| Status | Significado | Próxima ação |
|---|---|---|
| `pending_calculation` | Aguardando match engine rodar | Automático |
| `pending_review` | Calculado, aguardando inclusão em fechamento | Aguardar fim do mês |
| `pending` | Em fechamento aberto | Aguardar aprovação |
| `approved` | Aprovado para pagamento | Efetuar pagamento |
| `paid` | Pagamento registrado | Final |
| `no_rule_match` | Nenhuma regra LPU aplica | Gestor cria/ajusta regra |
| `pending_classification` | Motivo de não-conclusão pendente classificação | Gestor classifica motivo |
| `conflict` | Múltiplas regras com mesma prioridade casaram | Gestor ajusta prioridades |
| `contestado` | (Fase 2) Técnico contestou | Gestor revisa |
| `override` | Gestor alterou valor manualmente | Aprovar normalmente |

### Override manual

Gestor pode editar o valor de um payout antes da aprovação. Ao fazer isso:
- `valor_override` é preenchido
- `override_motivo` é obrigatório (texto livre)
- `override_by` e `override_at` registrados
- `status` muda para `override`
- `valor_calculado` é preservado para auditoria

O valor **efetivo** sempre é: `COALESCE(valor_override, valor_calculado)`.

---

## Recálculo de payouts

Recálculo é automático e disparado por:

1. **Ingestão de upload** — recalcula payouts de visitas inseridas/atualizadas
2. **Mudança de LPU vigente** — recalcula payouts pendentes do período coberto
3. **Classificação de motivo** — recalcula payouts que estavam `pending_classification` para esse motivo
4. **Vinculação manual de técnico** — recalcula payouts da visita anteriormente sem técnico
5. **Manual** — gestor clica "Recalcular pendentes" no painel

**Importante:** Recálculo NÃO afeta payouts com `status IN ('approved', 'paid')`. Esses estão "trancados" para preservar histórico financeiro.

Para forçar recálculo de aprovado, gestor precisa primeiro **reabrir o fechamento** (ação auditada).

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
          ↓
   aprovado (gestor aprovou)
          ↓
   pago (gestor marcou como pago)
```

**reaberto** é um estado especial: gestor pode reabrir um fechamento aprovado se descobriu erro. Ação auditada com motivo obrigatório.

### Quando virar "aguardando_aprovacao"

O gestor decide manualmente clicando "Solicitar fechamento de [mês]". Antes de virar este estado, o sistema valida:

- Nenhum payout no período com status `pending_classification`
- Nenhum payout no período com status `no_rule_match`
- Nenhum payout no período com status `conflict`
- Nenhuma visita no período com `tecnico_id IS NULL`

Se houver pendências, o sistema mostra a lista e bloqueia até resolução.

### Aprovação

Apenas `tenant_owner` ou `tenant_manager` (e `tallpa_owner` em caso de suporte). Ação:

1. Sistema move todos os payouts `pending` do período para `approved`
2. Sistema preenche `closing_id` em cada payout
3. Fecha o `monthly_closing` (`status = 'aprovado'`, `aprovado_por`, `aprovado_em`)
4. Gera relatório PDF/Excel para download
5. Notifica todos os técnicos: "Seu pagamento de abril foi aprovado: R$ X.XXX"

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
