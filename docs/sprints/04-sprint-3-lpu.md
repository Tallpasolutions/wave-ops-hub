# Sprint 3 — LPU + Motivos

**Duração estimada:** 1 semana
**Status:** Pendente
**Pré-requisitos:** Sprint 2 concluída

---

## Objetivo

Implementar o motor de regras LPU e a configuração de motivos. Ao final, gestor da Wave consegue cadastrar a LPU real, classificar todos os motivos da planilha de abril, simular o cálculo nas visitas existentes e validar os números.

---

## Escopo IN

### 1. Schema do banco

```sql
CREATE TABLE lpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nome TEXT NOT NULL,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  motivo_original TEXT NOT NULL,
  motivo_normalizado TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'falha_tecnico', 'falha_cliente', 'forca_maior', 'falha_sistema', 'pendente_classificacao'
  )),
  paga_improdutiva BOOLEAN NOT NULL DEFAULT false,
  valor_improdutiva NUMERIC(10, 2),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, motivo_original)
);

CREATE TABLE lpu_rules_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES lpu_rules(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES users(id),
  before JSONB NOT NULL,
  after JSONB NOT NULL
);
```

- [ ] Migrations aplicadas
- [ ] RLS em todas as novas tabelas
- [ ] Constraint via trigger: apenas uma LPU `ativa = true` por tenant
- [ ] Triggers de auditoria em `lpu_rules`

### 2. Adicionar `reason_id` em `service_visits`

```sql
ALTER TABLE service_visits ADD COLUMN reason_id UUID REFERENCES reasons(id);
```

- [ ] Migration aplicada
- [ ] Atualizar ETL (Sprint 2) para preencher `reason_id` no momento da ingestão (auto-criando reason se motivo novo)

### 3. Lib `src/lib/lpu/`

```
src/lib/lpu/
├── index.ts              # API pública
├── types.ts              # tipos LPU, LpuRule, MatchResult, PayoutResult
├── schemas.ts            # Zod para conditions e payout JSONB
├── match-engine.ts       # findApplicableRule(visit, rules)
├── calculate-payout.ts   # apply payout formula
├── conflicts.ts          # detect rules conflicts
├── simulator.ts          # simulate(lpu, visits) → estatísticas
└── __tests__/
```

- [ ] Implementar tudo + tests
- [ ] Testes cobrindo:
  - Match de regra exata
  - Match com array (cidade in [A, B])
  - Match com range (faixa_drop_min/max)
  - Não-match (regra não aplica)
  - Conflito (duas regras com mesma prioridade casam)
  - Tipos de payout: fixed, formula, percentage_of_revenue
  - Cálculo de prioridade automática

### 4. Telas de LPU

- [ ] `/lpu` — lista de LPUs (vigente em destaque, histórico abaixo)
- [ ] `/lpu/[id]` — visualização da LPU com lista de regras ordenadas por prioridade
- [ ] `/lpu/new` — criar LPU (rascunho), define vigência, depois adiciona regras
- [ ] `/lpu/[id]/rules/new` — formulário de regra:
  - Builder visual de `conditions` (chave → operador → valor)
  - Builder de payout (radio: fixed / formula / percentage)
  - Prioridade (auto ou manual)
  - Description (texto livre)
- [ ] `/lpu/[id]/rules/[ruleId]/edit` — editar regra
- [ ] Botão "Desativar regra" (soft delete)
- [ ] Botão "Duplicar regra" (gera cópia editável)

### 5. Tela de simulação

- [ ] `/lpu/[id]/simulate` — escolhe período (default: mês atual)
- [ ] Roda match engine sobre todas as visitas do período
- [ ] Mostra:
  - Total visitas processadas
  - Visitas com regra encontrada
  - Visitas sem regra (com lista detalhada)
  - Total estimado a pagar
  - Receita total
  - Margem
  - Distribuição por técnico
- [ ] Botão "Ver visitas sem regra" → drill-down
- [ ] Botão "Ativar esta LPU" (com confirmação)

### 6. Telas de motivos

- [ ] `/motivos` — lista de motivos cadastrados, filtros por categoria
- [ ] `/motivos/[id]/edit` — editar motivo:
  - Categoria (radio: 4 opções)
  - Paga improdutiva (toggle)
  - Valor de improdutiva (NULL = usa LPU; campo valor = override)
  - Motivo normalizado (texto livre — "Cliente ausente" para mostrar em UI)
- [ ] Highlighter de motivos pendentes (`pendente_classificacao`) com badge
- [ ] Após classificação, oferecer "Recalcular payouts afetados"

### 7. Auto-criação de motivos na ingestão

- [ ] Atualizar `src/lib/etl/matchers.ts` para criar motivo automaticamente
- [ ] Notificação no painel quando motivo novo aparece

### 8. Permissões

- [ ] Apenas `tenant_owner`, `tenant_manager` e `tallpa_owner` podem editar LPU
- [ ] Mesmo para motivos
- [ ] Técnicos não acessam essas telas

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

_(preencher ao concluir)_
