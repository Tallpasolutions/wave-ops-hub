# ADR-019 — Valores de pagamento próprios de cada LPU

**Status:** Aceito (implementado)
**Data:** 2026-07-30
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** A entrada em uso da tabela "SEM AUXILIAR" mostrou que o vínculo por técnico do
[ADR-014](./ADR-014-lpu-por-tecnico.md) cobria só o motor de LPU. Estende o ADR-014, o
[ADR-009](./ADR-009-cabeamento-classificacao.md), o [ADR-011](./ADR-011-acrescimo-domingo-feriado.md),
o [ADR-015](./ADR-015-homologacao-repasse.md) e o [ADR-016](./ADR-016-ajustes-coluna-z.md).

## Contexto

O ADR-014 permitiu atribuir uma LPU alternativa a um técnico, e o motor passou a resolver, por
visita, qual conjunto de **regras de LPU** usar. Mas quatro valores continuaram globais:

| Valor | Onde vivia | Escopo |
|---|---|---|
| Acréscimo por ponto adicional (R$ 36) | constante em `calculate.ts` (ADR-016) | global |
| Repasse de improdutiva padrão (R$ 15) | constante em `calculate.ts` | global |
| Acréscimo de domingo/feriado (15%) | `tenants.config.feriado_acrescimo_pct` (ADR-011) | tenant |
| Classificações de cabeamento e de homologação | tabelas próprias (ADR-009, ADR-015) | tenant |

A planilha "SEM AUXILIAR" traz valores próprios para **todos** eles: ponto R$ 30, improdutiva
R$ 10, feriado 10%, cabeamento R$ 30 (base), homologação R$ 30. Sem mudança, um técnico com a
tabela alternativa receberia instalação e suporte pelos valores novos e **todo o resto pelos da
tabela padrão** — pagamento misturado entre duas tabelas, sem sinal na tela.

## Decisão

**Esses valores passam a poder ser declarados por LPU. Toda declaração é opcional, e a ausência
significa "usa o valor de hoje".**

Requisito explícito do usuário (30/07/2026): *"as regras da LPU e motores já definidos e ativos
estão ok e não devem ser mexidos"*. Por isso a tabela padrão não declara nenhum valor e seu
cálculo permanece idêntico — a mudança é aditiva, nunca substitutiva.

### 1. Colunas escalares em `lpus` (migration 0035)
`ponto_adicional_valor`, `improdutiva_valor`, `feriado_acrescimo_pct`, todas nulas. O motor
resolve com `??` (e não `||`), para que um R$ 0 configurado de propósito seja respeitado.

A **lista** de feriados continua do tenant: o calendário é o mesmo para todos, só o percentual
muda por tabela.

### 2. `lpu_id` em `cabeamento_classifications` e `homologacao_classifications` (0035)
`NULL` = classificação do tenant (todas as existentes). Os `UNIQUE` de escopo viraram índices
únicos parciais, para a mesma chave poder ter um valor no tenant e outro na LPU.

### 3. Herança por chave, não por conjunto
As classificações da LPU são aplicadas **sobre** as do tenant, chave a chave. Substituir o
conjunto inteiro abriria buraco: uma chave que a tabela alternativa não declara (ex.:
"Cabeamento fibra aérea") ficaria sem valor, a visita cairia em `no_rule_match` e **travaria o
fechamento**. Com o merge, o gestor cadastra só as diferenças.

### 4. `buildPayoutUpsert` recebe os valores; `loadRecalcContext` os carrega
Novo parâmetro opcional `lpuValores`. O contexto de recálculo carrega, para cada LPU alternativa,
seus valores escalares e suas classificações, junto das regras que o ADR-014 já trazia.

## Consequências

- **A tabela padrão não muda.** Quatro testes em `calculate.test.ts` existem só para falhar se
  alguém alterar isso por acidente — sem valores declarados, o resultado é R$ 36 / R$ 15 / 15%.
- **Uma LPU alternativa é auto-contida no que declara** e herda o resto. É o meio-termo entre
  "tudo isolado" (que abriria buracos) e "tudo global" (que era o problema).
- **A UI ainda não edita esses valores.** Hoje entram por migration. Uma tela de edição da LPU
  (valores escalares + classificações por tabela) é o passo natural quando a Wave tiver uma
  terceira tabela ou quiser ajustar sem deploy.
- **Sinalização:** `/pagamentos`, `/pagamentos/[id]` e `/visitas/[id]` mostram de qual tabela veio
  o valor (`src/lib/lpu/tabela-preco.ts`). Em lista, só a alternativa é sinalizada.

## Considerados e rejeitados

- **Duas LPUs ativas ao mesmo tempo** (pedido inicial): o trigger `trg_single_active_lpu` proíbe,
  e `loadRecalcContext` busca a ativa com cardinalidade única — duas linhas derrubariam o
  recálculo inteiro. Além disso não resolveria o problema: "ativa" significa *tabela padrão do
  tenant*, e o que se queria era *tabela por técnico*, que o ADR-014 já entrega.
- **Substituir todo o conjunto de classificações** quando a LPU declara alguma: simples, mas
  transforma omissão em `no_rule_match` — falha que trava fechamento em vez de degradar.
- **Percentual de feriado por técnico** em vez de por LPU: o dado é da tabela de preços, não da
  pessoa; por técnico duplicaria a configuração a cada novo contratado.
