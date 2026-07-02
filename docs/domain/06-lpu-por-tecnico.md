# LPU por Técnico

## Contexto

Regras LPU podem incluir a condição `tecnicoId` (UUID do técnico) para restringir a aplicação de uma regra a um único técnico. O motor de matching existente suporta isso nativamente — sem nova tabela, sem novo algoritmo.

## Invariante de prioridade

O mecanismo de fallback funciona pelo próprio sistema de prioridade:

- Regra geral (ex: `{ finalidade: "Suporte Fibra" }`) → 1 condição → prioridade automática **100**
- Regra por técnico (ex: `{ finalidade: "Suporte Fibra", tecnicoId: "uuid-X" }`) → 2 condições → prioridade automática **200**

O motor escolhe a regra com maior prioridade que case com a visita. Técnico X recebe sua regra específica (200); todos os outros técnicos fazem fallback para a regra geral (100).

## Exemplo de configuração

| Descrição | Condições | Prioridade | Payout |
|---|---|---|---|
| Suporte Fibra Externo — Geral | `{ finalidade: "Suporte Fibra", tipoAtendimento: "Externo" }` | 200 (auto) | R$ 80 |
| Suporte Fibra Externo — Técnico Sênior | `{ finalidade: "Suporte Fibra", tipoAtendimento: "Externo", tecnicoId: "uuid-senior" }` | 300 (auto) | R$ 100 |

## Fluxo técnico

1. `rowToSimVisit` em `recalculate-batch.ts` mapeia `v.tecnico_id` → `simVisit.tecnicoId`
2. `findApplicableRule` em `match-engine.ts` checa `tecnicoId` via `matchesCondition` (comparação de string — UUID iguala ou não)
3. Regra específica tem mais condições → prioridade maior → vence o match
4. Se o técnico não tem regra específica, a regra com `tecnicoId` não casa → motor seleciona a regra geral

## Criação na UI

O formulário de criação/edição de regra expõe "Técnico" como opção de condição. O select é populado via `getTechniciansForRule(tenantId)` — apenas técnicos ativos do tenant.

## Restrições

- O campo `tecnicoId` no `VALID_CONDITION_KEYS` aceita apenas string (UUID) — não aceita array nem range.
- Conflito ainda se aplica: duas regras com `tecnicoId` idêntico e mesma prioridade geram conflito.
- O gestor deve garantir prioridade coerente ao usar prioridade manual.
