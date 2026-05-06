# ADR-004 — Motor de Regras LPU

**Status:** Aceito
**Data:** 2026-05-05
**Decisores:** Jhoni Cleyton (Tallpa)

---

## Contexto

O cliente confirmou que a LPU da Wave (lista de preços que define quanto pagar ao técnico) **tem várias regras combinadas** — não é uma simples tabela `tipo × valor`. Pode envolver finalidade, tipo de atendimento, cidade, faixa de drop, condomínio sim/não, e provavelmente outras dimensões que serão descobertas conforme as regras reais forem cadastradas.

Hard-codar dimensões no schema (criar colunas `valor_brusque`, `valor_externa`, `valor_drop_curto`...) seria desastre: cada nova dimensão exigiria migration, e clientes diferentes teriam dimensões diferentes.

---

## Decisão

Implementar um **motor de regras genérico baseado em condições JSONB com sistema de prioridades**.

### Estrutura

```sql
CREATE TABLE lpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nome TEXT NOT NULL,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,                     -- NULL = vigente
  ativa BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lpu_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lpu_id UUID NOT NULL REFERENCES lpus(id) ON DELETE CASCADE,
  prioridade INTEGER NOT NULL,
  conditions JSONB NOT NULL,
  payout JSONB NOT NULL,
  description TEXT NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lpu_rules_lpu_prioridade ON lpu_rules(lpu_id, prioridade DESC) WHERE ativa = true;
```

### Estrutura do `conditions` (JSONB)

```json
{
  "finalidade": "Suporte Fibra",
  "tipo_atendimento": "Externo",
  "sucesso": "Sim",
  "cidade": ["Brusque", "Bombinhas"],
  "faixa_drop_min": 0,
  "faixa_drop_max": 100,
  "condominio": false
}
```

Cada chave é uma condição. O motor avalia: **todas as condições presentes precisam dar match**. Chaves ausentes são "qualquer".

### Estrutura do `payout` (JSONB)

Caso 1 — valor fixo:
```json
{
  "type": "fixed",
  "value": 80.00
}
```

Caso 2 — fórmula simples:
```json
{
  "type": "formula",
  "base": 50.00,
  "additional": {
    "field": "drop_usado",
    "rate_per_unit": 0.30
  }
}
```

Caso 3 — referência a outra regra (composição, fase futura):
```json
{
  "type": "reference",
  "rule_id": "<uuid>"
}
```

### Algoritmo de matching

```typescript
// src/lib/lpu/match-engine.ts
import type { ServiceVisit, LpuRule } from '@/types';

export function findApplicableRule(
  visit: ServiceVisit,
  rules: LpuRule[]
): LpuRule | null {
  // Regras já vêm ordenadas por prioridade DESC
  for (const rule of rules) {
    if (matchesConditions(visit, rule.conditions)) {
      return rule;
    }
  }
  return null;
}

function matchesConditions(
  visit: ServiceVisit,
  conditions: Record<string, unknown>
): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = getVisitField(visit, key);
    if (!matchValue(actual, expected)) return false;
  }
  return true;
}

function matchValue(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }
  if (typeof expected === 'object' && expected !== null) {
    if ('min' in expected || 'max' in expected) {
      const num = Number(actual);
      const { min, max } = expected as { min?: number; max?: number };
      if (min !== undefined && num < min) return false;
      if (max !== undefined && num > max) return false;
      return true;
    }
  }
  return actual === expected;
}
```

### Cálculo do payout

```typescript
export function calculatePayout(
  visit: ServiceVisit,
  rule: LpuRule
): number {
  const { payout } = rule;

  if (payout.type === 'fixed') {
    return payout.value;
  }

  if (payout.type === 'formula') {
    const base = payout.base;
    const fieldValue = Number(getVisitField(visit, payout.additional.field) ?? 0);
    const additional = fieldValue * payout.additional.rate_per_unit;
    return base + additional;
  }

  throw new Error(`Unsupported payout type: ${payout.type}`);
}
```

---

## Sistema de prioridades

A `prioridade` é um inteiro. Regras com prioridade maior são avaliadas primeiro. Por padrão:

- Regras com mais condições recebem prioridade automaticamente maior (calculada como `count(keys(conditions)) * 100` ao salvar)
- O usuário pode sobrescrever manualmente via campo `prioridade`

Exemplo:
- Regra A: `{finalidade: "Suporte Fibra", tipo_atendimento: "Externo"}` → prioridade automática 200
- Regra B: `{finalidade: "Suporte Fibra"}` → prioridade automática 100
- Visita "Suporte Fibra Externo" → casa com A primeiro (mais específica), pega valor de A

---

## Validação ao salvar regra

Antes de inserir/atualizar uma regra, validar:

1. **Todas as condições referenciam campos válidos** de `service_visits` (ou aliases conhecidos como `faixa_drop_min`/`max`)
2. **Tipos batem** (não pode comparar string com número)
3. **Não há regra idêntica** já existente na mesma LPU
4. **Payout válido** (valor não-negativo, fórmula com campos válidos)

Schema Zod em `src/lib/lpu/schemas.ts`.

---

## Simulação antes de ativar

Quando o usuário monta uma LPU, antes de ativar oferecer:

> **Simular nas visitas de [período]**

O sistema roda o match engine sobre todas as visitas do período escolhido e mostra:

- Total de visitas com regra encontrada
- Total de visitas **sem regra aplicável** (warning)
- Total estimado a pagar
- Margem estimada
- Lista detalhada de visitas sem regra (para o usuário ajustar a LPU)

---

## Versionamento e vigência

LPU tem `vigencia_inicio` e `vigencia_fim`. Para cada visita, ao calcular payout, o sistema busca a LPU vigente em `data_execucao` (não em `data_atual`).

```typescript
async function getVigentLpu(tenantId: string, executionDate: Date): Promise<Lpu | null> {
  return db.query.lpus.findFirst({
    where: and(
      eq(lpus.tenantId, tenantId),
      eq(lpus.ativa, true),
      lte(lpus.vigenciaInicio, executionDate),
      or(isNull(lpus.vigenciaFim), gte(lpus.vigenciaFim, executionDate))
    ),
    with: { rules: { where: eq(lpuRules.ativa, true), orderBy: desc(lpuRules.prioridade) } }
  });
}
```

**Importante:** ao salvar um payout, **gravar o `lpu_rule_id` que foi aplicado**. Isso permite auditoria total. Mesmo se a regra for alterada depois, o histórico do payout permanece intacto.

---

## Cadastro de motivos de não-conclusão

Tabela separada — não confundir com regras LPU:

```sql
CREATE TABLE reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  motivo_original TEXT NOT NULL,        -- string exata da planilha
  motivo_normalizado TEXT NOT NULL,
  categoria TEXT NOT NULL,              -- 'falha_tecnico' | 'falha_cliente' | 'forca_maior' | 'falha_sistema' | 'pendente_classificacao'
  paga_improdutiva BOOLEAN NOT NULL DEFAULT false,
  valor_improdutiva NUMERIC(10, 2),     -- NULL = usa LPU; valor = override fixo
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, motivo_original)
);
```

Quando uma visita de uma planilha tem motivo não cadastrado, o sistema insere automaticamente em `reasons` com `categoria = 'pendente_classificacao'` e notifica o gestor.

---

## Consequências

### Positivas
- Cliente pode cadastrar qualquer regra sem mudanças no código
- Suporta dimensões que não conhecemos hoje (extensível)
- Auditoria completa via `lpu_rule_id` em cada payout
- Versionamento por vigência permite cálculos retroativos corretos

### Negativas / Trade-offs
- JSONB perde type safety — mitigação via Zod ao salvar/carregar
- Performance pode degradar com muitas regras (mitigação: índice + ordenação por prioridade; volumes esperados são <50 regras por LPU)
- Cliente pode criar regras conflitantes (mitigação: validação ao salvar + simulação antes de ativar)
