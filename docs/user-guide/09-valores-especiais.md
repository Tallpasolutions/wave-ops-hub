# Guia 09 — Valores especiais: Homologação, Cabeamento e LPU por técnico

A LPU resolve a maioria dos serviços, mas há casos em que **a finalidade da planilha não descreve o serviço real** — e aí o valor não pode sair da LPU. Todos ficam no menu **Regras**.

## Homologação

Uma homologação chega na planilha com finalidade de instalação ("Instalação - Fibra", "Mudança Endereço Fibra"). Se dependesse só da finalidade, pagaria como instalação real — bem mais do que deveria. O que identifica a homologação é a **coluna de explicação do valor**, que começa com "Homologa...".

O repasse é **fixo, indexado pelo valor que a Unetvale pagou**:

| Unetvale pagou | Técnico recebe |
|---|---|
| R$ 64,46 (base) | R$ 35,00 |
| R$ 128,92 (dobrado) | R$ 70,00 |
| R$ 142,23 (base + 1 ponto adicional) | R$ 79,00 |

Em **Regras → Homologação** você mantém esse mapa. Se aparecer um valor de Unetvale que não está cadastrado, a OS fica como **sem regra** na fila — cadastre o valor correspondente e o payout é recalculado.

## Cabeamento e segundo ponto

As finalidades do grupo Cabeamento/Condomínio também não trazem o valor na finalidade: ele varia conforme o que foi feito, descrito na coluna de explicação do valor.

Em **Regras → Cabeamento**, cada padrão de explicação encontrado nas planilhas aparece para você classificar com o valor a pagar. Depois de classificar, as visitas correspondentes saem de "sem regra" e recebem o valor no recálculo.

## Pontos adicionais

Quando a explicação do valor traz "ponto(s) adicional(is)", o sistema soma **R$ 36 por ponto** sobre o valor-base do serviço — vale para instalação, cabeamento e condomínio.

Exemplo: instalação subterrânea de R$ 135 com 1 ponto adicional = **R$ 171**.

Homologação é a exceção: o valor já vem pronto do mapa acima (a linha de R$ 142,23 é justamente "base + 1 ponto").

## Casos que não pagam

- **Unetvale pagou R$ 29,30** — tipicamente roteador agregado a uma OS de suporte/cabeamento. Não gera repasse ao técnico.
- **Finalidade "Venda Produto Externo"** — o serviço real está na explicação do valor. Se for um padrão reconhecido, paga por ele; se não for reconhecido, cai como sem regra para você avaliar.

## Domingos e feriados

Execuções **com sucesso** em domingo ou feriado recebem **+15%** sobre o valor final (já com o ponto adicional). Improdutivas nunca recebem o acréscimo.

Domingo é automático. **Feriados dependem de uma lista cadastrada** — enquanto ela não for informada, apenas domingos recebem o acréscimo. O sistema não adivinha feriado.

## LPU por técnico

Quando existe uma tabela alternativa (ex.: "SEM AUXILIAR", com valores menores para serviço executado sem auxiliar), ela pode valer **só para os técnicos que você escolher**. Os demais continuam na LPU padrão.

O vínculo é feito no cadastro da LPU alternativa. Ao calcular, o sistema resolve primeiro **qual LPU vale para aquele técnico** e só depois casa as regras.

## Ordem em que o sistema decide

Para entender por que uma OS pagou determinado valor, é essa a ordem:

1. Improdutiva com receita de R$ 15,98 → R$ 15,00 (já aprovada) · receita R$ 0,00 → R$ 0,00
2. Receita de R$ 29,30 → não paga
3. Homologação (pela coluna de explicação) → mapa de homologação
4. Venda Produto Externo → valor pela explicação
5. Cabeamento/Condomínio → classificação do gestor
6. Todo o resto → LPU

Depois, sobre o valor encontrado: **+ pontos adicionais** e, se for domingo/feriado com sucesso, **+15%**.
