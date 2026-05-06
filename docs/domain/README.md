# Documentação de Domínio

Esta pasta detalha as regras de negócio do Wave Ops Hub. Antes de implementar qualquer feature que toque essas regras, leia o arquivo correspondente.

| Documento | Conteúdo |
|---|---|
| [01 — OS e Visitas](./01-os-e-visitas.md) | Modelagem das duas entidades centrais, idempotência, estados, vinculação |
| [02 — LPU e Motivos](./02-lpu-e-motivos.md) | Motor de regras, tipos de payout, política de motivos, "deixado na mesa" |
| [03 — Payout](./03-payout.md) | Cálculo, estados, fechamento mensal, aprovação, auditoria |
| [04 — Personas](./04-personas.md) | Cada papel do sistema, telas, permissões |

## Convenção

- Toda regra de negócio nova deve ser documentada aqui antes de virar código
- Se alguém pergunta "como funciona X?", a resposta deve estar aqui — se não estiver, é gap a corrigir
- Mudanças de regra exigem atualização deste documento na mesma PR que muda o código
