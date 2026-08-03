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

## Suporte externo: com x sem troca de drop (2026-07-30)

As regras **"Suporte Fibra Aéreo Externo" (R$ 120)** e **"Suporte Fibra Subterrâneo Externo"
(R$ 135)** casam por `tipoAtendimento` + `subterraneaAereo`. Elas foram desenhadas para o suporte
**com troca de drop**, cuja receita da Unetvale é ~R$ 206 (aéreo) / ~R$ 232 (subterrâneo) — a
margem fecha. Mas a LPU não tem como distinguir, por esses dois campos, o **suporte simples**
(`"Suporte | 50 * 1.1 …"`, receita R$ 64,46): quando a planilha o traz marcado como Externo com o
meio preenchido, ele casava a mesma regra e pagava 4x o devido, com **margem negativa**
(R$ 120 pagos sobre R$ 64,46 recebidos).

O corte é por **receita da Unetvale** — o mesmo padrão de threshold descrito acima. Quatro regras
de prioridade **500** (5 condições), que vencem as de 400 quando a receita indica que não houve
troca de drop:

| Regra | Condições (além da lista de finalidades de suporte) | Valor |
|---|---|---|
| Suporte Fibra Aéreo Externo sem troca de drop | `Externo` + `Aéreo` + `agregada: false` + receita `{min:40, max:150}` | R$ 30 |
| Suporte Fibra Subterrâneo Externo sem troca de drop | `Externo` + `Subterrâneo` + `agregada: false` + receita `{min:40, max:150}` | R$ 30 |
| … + venda atrelada (aéreo) | idem com `agregada: true` | R$ 45 |
| … + venda atrelada (subterrâneo) | idem com `agregada: true` | R$ 45 |

Os valores espelham o par já vigente do suporte simples **interno** (R$ 30 / R$ 45). As duas
regras `agregada: true` são preventivas — nenhuma visita casa esse cenário hoje; existem para o
bug não voltar pela porta da venda atrelada.

**A faixa R$ 40–150 foi calibrada contra os dados reais**, não escolhida por estética:

- **Dentro:** suporte simples (64,46) · suporte condomínio sem troca de fibra (64,46) · suporte
  retenção sem troca de drop (106,54) · troca de equipamento de local (109,87)
- **Fora:** troca de drop aéreo (206,26 / 247,51 / 412,52) e subterrâneo (232,04 / 278,45) ·
  improdutivas (15,98 e 0,00 — já resolvidas antes do motor de LPU)
- **O piso de R$ 40 é deliberado:** deixa fora as visitas externas *com* troca de drop cuja receita
  veio R$ 0,00. **Esse caso foi decidido em 03/08/2026 pelo
  [ADR-020](../architecture/ADR-020-receita-zerada-sem-repasse.md):** receita R$ 0,00 com sucesso
  não gera repasse automático — o payout sai R$ 0,00 antes mesmo de chegar ao motor de LPU, e o
  técnico contesta pelo app se discordar. O piso continua fazendo sentido no motor (mantém a regra
  de threshold coerente), mas na prática nenhuma visita de receita zerada chega até ele.

Migration: [`supabase/migrations/0032_lpu_suporte_externo_sem_troca_drop.sql`](../../supabase/migrations/0032_lpu_suporte_externo_sem_troca_drop.sql).
Testes de regressão em `src/lib/lpu/__tests__/match-engine.test.ts`.

> **Por que não condicionar por "houve troca de drop"?** Seria mais fiel ao domínio, mas exigiria
> uma chave de condição nova no motor (`trocadoDrop`) — mudança de código + ADR. E a coluna
> `trocado_drop` da planilha **não é confiável**: em 11 visitas cuja explicação de valor descreve
> troca de drop, ela veio `false`. A receita é o sinal mais estável, e é o mesmo critério que o
> ADR-015 e o ADR-016 já usam.

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
