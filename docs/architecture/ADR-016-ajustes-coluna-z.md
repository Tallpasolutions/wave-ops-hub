# ADR-016 — Ajustes de payout pela coluna Z (Unetvale 29,30, pontos adicionais, Venda Produto Externo)

**Status:** Aceito (implementado; recálculo a aplicar no deploy)
**Data:** 2026-07-22
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** Validação do fechamento de julho contra a planilha conferida da Wave (técnico Eduardo Ribeiro de Souza) — divergências entre o valor gerado e o repasse correto.

---

## Contexto

A conferência OS a OS (planilha da Wave × sistema) revelou padrões em que a **finalidade da
Unetvale é genérica/não-confiável** e o serviço real (e o valor) está na coluna Z
(`explicacao_valor`). Mesma lição da homologação (ADR-015) e do cabeamento (ADR-009),
generalizada. Quatro ajustes confirmados pela Wave:

1. **Unetvale = R$ 29,30 → não paga** o técnico. São tipicamente "Roteador agregado ‡ OS de
   Suporte/Cabeamento" (agregado a outra OS). Hoje pagavam R$ 30 (regra de suporte/troca).

2. **"Venda Produto Externo" — serviço real na coluna Z:**
   - `Roteador | 50 * 1.1 ...` → **R$ 30**
   - `Cabeamento agregado | 73 ...` → **R$ 44**
   - `Roteador agregado ...` → **R$ 0**
   A finalidade "Venda Produto Externo" pagava R$ 0 pela LPU, mascarando esses serviços.

3. **Ponto adicional é um acréscimo uniforme.** O modificador `(+73 * N ponto(s) adicional(is))`
   soma **+R$ 36 por ponto** sobre o valor-base do serviço:

   | Serviço | Base | + ponto |
   |---|---|---|
   | Instalação aérea | 120 | 156 |
   | Instalação subterrânea | 135 | 171 |
   | Condomínio (2º cliente/ftta) | 70 | 106 |
   | Cabeamento/Segundo Ponto | 44 | 80 |

   Antes, o cabeamento **embutia** o ponto na classificação com incremento inconsistente
   (76 = 44+32; 106). A homologação é a exceção: seu ponto adicional (+R$ 44) já vem do mapa
   de homologação (ADR-015), então não passa por este acréscimo.

4. **Domingo/feriado (ADR-011)** aplica **+15% sobre (base + ponto)** — ex.: instalação
   subterrânea + ponto no domingo = (135+36) × 1,15 = R$ 196,65.

## Decisão

Tratar os quatro casos no motor de payout (`buildPayoutUpsert`), pela coluna Z, **antes** da LPU:

- **Unetvale 29,30 → 0**: curto-circuito por valor da receita (como a improdutiva padrão 15,98),
  para qualquer finalidade com sucesso.
- **Venda Produto Externo**: `resolveVendaProdutoExterno` lê a coluna Z (Roteador → 30,
  Cabeamento agregado → 44, Roteador agregado → 0). Não reconhecido → `no_rule_match` (fila).
- **Pontos adicionais**: `parsePontosAdicionais` extrai N; o acréscimo `N × 36` soma sobre a base
  (LPU de instalação/condomínio e classificação de cabeamento). `normalizeExplicacao` passou a
  **remover** o modificador de pontos, então as variantes com ponto colapsam na chave-base e o
  valor vira base + N×36 (migration 0026 remove as linhas de cabeamento com ponto embutido).
- **Domingo/feriado**: reaproveita `comAcrescimo` (ADR-011), aplicado por cima de (base + ponto).

Sem migration de schema; sem flag de tenant (as regras disparam só em padrões do vocabulário
Unetvale — finalidade "Venda Produto Externo", coluna Z com "+73 * N ponto", receita 29,30 —,
como já ocorre com as regras de improdutiva 15,98/0,00). Migration 0026 só limpa dados órfãos.

## Fora de escopo (adiado)

- **Base da instalação pela coluna Z sobrepondo a flag de condomínio** (ex.: OS 557101, flag
  `condominio=true` mas coluna Z de subterrânea normal, deveria pagar 171). É **ambíguo**: uma
  instalação de condomínio real tem a MESMA coluna Z de uma subterrânea normal — só a flag as
  distingue. Sobrepor pela coluna Z quebraria condomínios legítimos. Esses poucos casos ficam
  para **override manual** até haver um sinal confiável.

## Consequências

- Dry-run tenant-wide: **97 payouts** mudam, delta **+R$ 1.778** (todos os meses). Todas as
  mudanças casam com as regras confirmadas; nenhuma regressão em suporte/improdutiva/cabeamento-base.
- Aplicar migration 0026 e "Recalcular pendentes" no deploy.
- Novos padrões de "Venda Produto Externo" não reconhecidos surgem como `no_rule_match` (fila),
  nunca pagam errado em silêncio.
