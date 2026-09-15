# Guia 03 — Configurar LPU

## O que é LPU

LPU (Lista de Preços Unitários) é o conjunto de regras que define **quanto pagar ao técnico** por cada visita realizada. Sem uma LPU ativa, os payouts não são calculados.

Configure a LPU **antes** de processar a primeira planilha do mês.

## Criar uma nova LPU

1. No menu lateral, abra **Regras** → clique em **LPU**
2. Clique em **Nova LPU**
3. Preencha o **nome** (ex: "LPU Maio 2026") e a **data de início de vigência**
4. Clique em **Criar LPU**

A LPU é criada como **Rascunho** — ainda não está ativa e não afeta os cálculos.

## Adicionar regras

Com a LPU aberta, clique em **Nova Regra**. Cada regra define:

**Condições** (critérios para a regra ser aplicada):
- Finalidade (ex: Instalação, Suporte Fibra)
- Tipo de atendimento (ex: Externo, Interno)
- Cidade
- E outros campos da visita

**Payout** (o que pagar quando a regra for aplicada):
- **Valor fixo** — um valor em reais independente de qualquer variável
- **Fórmula** — cálculo baseado em campos da visita
- **Percentual** — percentual do valor recebido da Unetvale

Adicione quantas regras forem necessárias. A prioridade determina qual regra é usada quando mais de uma se aplica à mesma visita.

## Simular antes de ativar

Antes de ativar, use a tela de **Simulação** (botão na página da LPU) para ver como as regras se aplicariam às visitas já processadas. Verifique:
- Quantas visitas ficam sem regra
- Distribuição de payouts por técnico
- KPIs financeiros resultantes

## Ativar a LPU

Quando as regras estiverem configuradas e validadas:

1. Abra a LPU
2. Clique em **Ativar esta LPU**
3. Confirme

A LPU anterior é desativada automaticamente. O sistema recalcula os payouts pendentes com as novas regras.

> **Atenção:** payouts já aprovados ou pagos **não são recalculados** ao ativar uma nova LPU.
