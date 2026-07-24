# Documentação de Domínio

Esta pasta detalha as regras de negócio do Wave Ops Hub. Antes de implementar qualquer feature que toque essas regras, leia o arquivo correspondente.

| Documento | Conteúdo |
|---|---|
| [01 — OS e Visitas](./01-os-e-visitas.md) | Modelagem das duas entidades centrais, idempotência, estados, vinculação |
| [02 — LPU e Motivos](./02-lpu-e-motivos.md) | Motor de regras, tipos de payout, política de motivos, "deixado na mesa" |
| [03 — Payout](./03-payout.md) | **Ordem de precedência do cálculo**, estados, recálculo e travas, fechamento mensal, conferência do técnico, auditoria |
| [04 — Personas](./04-personas.md) | Cada papel do sistema, telas, permissões |
| [05 — Regras especiais](./05-regras-especiais.md) | Casos que fogem do motor de LPU padrão |
| [06 — LPU por técnico](./06-lpu-por-tecnico.md) | Tabela alternativa (ex.: "SEM AUXILIAR") válida só para técnicos escolhidos |

**Começe por [03 — Payout](./03-payout.md#ordem-de-precedência-do-cálculo)** se a dúvida é "por que
esta OS pagou esse valor?". A ordem de precedência ali é a única fonte de verdade sobre como
homologação, coluna Z, cabeamento, LPU, pontos adicionais e domingo/feriado se combinam.

## Convenção

- Toda regra de negócio nova deve ser documentada aqui antes de virar código
- Se alguém pergunta "como funciona X?", a resposta deve estar aqui — se não estiver, é gap a corrigir
- Mudanças de regra exigem atualização deste documento na mesma PR que muda o código
