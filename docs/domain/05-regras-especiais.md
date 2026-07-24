# Regras Especiais de LPU — Threshold R$64

Este documento descreve os padrões de configuração para finalidades com threshold de valor (ex.: "Venda de produto externo" e "Troca de equipamento"), onde o payout depende do valor recebido pela Unetvale.

> **Atualização (2026-07-22) — "Venda Produto Externo" não passa mais por aqui.**
> A partir do [ADR-016](../architecture/ADR-016-ajustes-coluna-z.md), visitas com sucesso cuja
> finalidade é exatamente `Venda Produto Externo` são resolvidas **antes** do motor de LPU: o
> serviço real (roteador, cabeamento agregado) está na coluna Z (`explicacao_valor`), não na
> finalidade, e o valor vem de lá. Padrão não reconhecido → `no_rule_match`, para o gestor avaliar.
> Regras de LPU criadas para essa finalidade **não são consultadas** nesse caminho.
>
> O padrão de threshold descrito abaixo **continua válido** para as demais finalidades (ex.:
> "Troca de equipamento"). Antes de configurar um threshold, confirme na
> [ordem de precedência](./03-payout.md#ordem-de-precedência-do-cálculo) que a finalidade
> realmente chega ao motor de LPU.

---

## Padrão: threshold com duas regras em cascata

O motor de matching avalia as regras em ordem decrescente de `prioridade`. Para implementar um threshold, cria-se **duas regras** para a mesma finalidade, com prioridades distintas.

### Regra 1 — payout zero (prioridade menor, fallback)

Captura qualquer visita da finalidade sem restrição de valor. Como tem menor prioridade, só é aplicada se a regra de valor alto não casar.

```json
{
  "conditions": {
    "finalidade": "Venda de produto externo"
  },
  "payout": {
    "type": "fixed",
    "value": 0
  },
  "prioridade": 10
}
```

### Regra 2 — payout real (prioridade maior, primeiro a ser avaliado)

Captura visitas cujo `valorRecebidoUnetvale` é maior que R$64. A prioridade maior garante que ela é avaliada antes da regra zero.

```json
{
  "conditions": {
    "finalidade": "Venda de produto externo",
    "valorRecebidoUnetvale": { "min": 64.01 }
  },
  "payout": {
    "type": "percentage_of_revenue",
    "percentage": 30
  },
  "prioridade": 20
}
```

> **Prioridade maior = avaliada primeiro.** Nunca inverta essa ordem — a regra zero viraria default universal.

---

## Finalidades com threshold em produção (Wave Telecom)

| Finalidade | Threshold | Regra abaixo | Regra acima |
|---|---|---|---|
| Venda de produto externo | R$ 64,00 | `fixed: 0` | `percentage_of_revenue` ou `fixed` conforme contrato |
| Troca de equipamento | R$ 64,00 | `fixed: 0` | idem |

---

## Invariantes do motor

- O campo `valorRecebidoUnetvale` vem da planilha Unetvale e é armazenado em `service_visits.valor_recebido_unetvale` (numeric).
- A condição `{ min: X }` no schema Zod (`lpuConditionsSchema`) aceita `min` e `max` opcionais — nenhuma alteração de código é necessária para adicionar novos thresholds via UI.
- `value: 0` é válido no schema `payoutFixedSchema` (campo usa `.nonnegative()`, não `.positive()`).

---

## Como adicionar um novo threshold

1. Abrir "LPUs" no portal manager e entrar no LPU do período vigente.
2. Criar a regra de payout zero para a finalidade desejada com prioridade baixa (ex.: 10).
3. Criar a regra de payout real com `valorRecebidoUnetvale: { min: <threshold + 0.01> }` e prioridade maior (ex.: 20).
4. Testar com uma visita de valor abaixo e uma acima do threshold na tela de auditoria.
