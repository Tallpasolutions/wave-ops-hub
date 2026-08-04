# Sprint 18 — LPU "SEM AUXILIAR", precisão de pagamento, IQI e português integral

**Período:** 2026-07-30 em diante
**Status (03/08):** 🟢 Fases 0, 1, 3 e 4 **concluídas e verificadas em produção** · 🔴 **Fase 2
(IQI) é a única aberta** — a coleta segue parada. A Fase 0 cresceu de 3 para 10 itens ao longo da
sprint, todos nascidos de OSs que o gestor estranhou na tela.
**Origem:** Auditoria de uma OS de suporte que pagava R$ 120 (30/07), que abriu quatro frentes —
precisão do cálculo, a segunda tabela de preços da Wave, coleta do IQI parada e linguagem técnica
vazando para a tela.
**Regras de execução:** [`regras-de-execucao.md`](./regras-de-execucao.md)

---

## Fase 0 — Precisão do pagamento (CONCLUÍDA)

Três correções da mesma investigação, todas com evidência colhida no banco de produção.

| Item | O que era | Migration | Estado |
|---|---|---|---|
| **0.1** Suporte externo sem troca de drop pagava R$ 120 sobre receita de R$ 64,46 | Regras de R$ 120/R$ 135 casavam por tipo+meio; valiam para o suporte **com** troca de drop (receita ~R$ 206/~R$ 232) | [0032](../../supabase/migrations/0032_lpu_suporte_externo_sem_troca_drop.sql) | ✅ **verificado em produção** |
| **0.2** "Troca de Poste" aparecia como "Sem regra" | Lista de infra tinha `"Troca de postes"` (plural); planilha emite o singular. Match exato → nunca casou | [0033](../../supabase/migrations/0033_finalidade_troca_de_poste_infra.sql) | ✅ aplicada |
| **0.3** Contestação respondida **sem** ajuste ficava destravada no recálculo | `override_by` só era gravado quando a Wave alterava o valor; manter o valor não travava, e um recálculo desfazia a conferência em silêncio | [0034](../../supabase/migrations/0034_trava_contestacoes_resolvidas_sem_ajuste.sql) | ✅ aplicada |

Detalhes: [`docs/domain/05-regras-especiais.md`](../domain/05-regras-especiais.md) ·
adendos no [ADR-008](../architecture/ADR-008-exclusao-finalidades-infra.md) e
[ADR-013](../architecture/ADR-013-aprovacao-contestacao-tecnico.md) · tech-debt 020 e 021.

### 0.4 — Receita zerada da Unetvale não gera repasse (03/08)

Mesma frente de precisão, aberta pela OS 575303: a Unetvale zerou a receita ("Pagamento zerado
devido o técnico RM - Matheus Deiss Silva ter realizado o fechamento desta OS") e o sistema
repassou R$ 30,00 assim mesmo. **Decisão:** sucesso com `valor_recebido_unetvale = R$ 0,00` passa a
pagar R$ 0,00, e quem discordar contesta pelo app —
[ADR-020](../architecture/ADR-020-receita-zerada-sem-repasse.md).

Sem migration (regra de cálculo em `buildPayoutUpsert`); aplica pelo recálculo de pendentes.

**Levantamento em produção (03/08, consulta direta ao banco):** 186 visitas com sucesso e receita
R$ 0,00, das quais **51 serão zeradas, somando R$ 3.950,50** (maio 18 · R$ 1.539,50 | junho 13 ·
R$ 970,00 | julho 20 · R$ 1.441,00). A OS 574142 fica de fora — tem override do gestor vindo de
contestação resolvida. Parte das 51 é trabalho real (troca de drop, instalação nova) e deve gerar
contestação: é o caminho previsto.

### 0.5 — Vazamento entre tabelas de preço (03/08)

Aberto pela OS 573312: cabeamento pagando **R$ 30 (SEM AUXILIAR) em vez de R$ 44** para um técnico
da tabela padrão. `loadRecalcContext` carregava as classificações do tenant filtrando só por
`tenant_id` — e as classificações próprias de uma LPU alternativa carregam o **mesmo** `tenant_id`
(migration 0036). As duas coleções caíam no mesmo mapa e a chave da LPU alternativa sobrescrevia a
do tenant (`new Map` mantém a última linha), **para todos os técnicos**. Como a ordem das linhas
não é garantida, o valor pago nem era estável.

| Onde | O que era | Correção |
|---|---|---|
| `loadRecalcContext` (cabeamento e homologação) | `.eq('tenant_id')` sem `lpu_id IS NULL` | filtro adicionado + teste de regressão `recalc-context.test.ts` |
| `/cabeamento` e `/homologacao` (telas) | mesma query, gestor via valores misturados | filtro adicionado |
| `classifyCabeamento` / `classifyHomologacao` | `onConflict` num UNIQUE que a 0035 trocou por índice **parcial** → `42P10`, salvar quebrado desde então | update-or-insert explícito, escopado a `lpu_id IS NULL` |

**Alcance medido (03/08, consulta paginada):** 68 visitas pagando a menos — 46 de cabeamento
(R$ 640,00) e 22 de homologação (R$ 110,00), **R$ 750,00** no total (maio 31 · junho 13 · julho 24).
Nenhuma travada: todas voltam ao valor correto no recálculo. Sem migration.

### 0.6 — Cabeamento de fibra da SEM AUXILIAR nunca foi cadastrado (03/08)

Aberto pela OS 569827, pagando R$ 120 em vez de R$ 100. **Não é bug do motor** — é o oposto do
0.5: a chave existe no tenant e **falta** na LPU alternativa, então a herança por chave
(ADR-019, decisão 3) faz o técnico da SEM AUXILIAR receber o valor da tabela padrão.

A 0036 cadastrou só as chaves-base ("Cabeamento" e "Cabeamento agregado"); "Cabeamento fibra
aérea" (tenant R$ 120) e "Cabeamento fibra subterrênea" (tenant R$ 135) ficaram de fora.
**Decisão do usuário (03/08): as duas valem R$ 100** — a distinção aéreo/subterrâneo da padrão
não existe na SEM AUXILIAR, onde instalação e suporte pagam 100 nos dois meios.

Migration [0038](../../supabase/migrations/0038_lpu_sem_auxiliar_cabeamento_fibra.sql).
**Alcance:** 8 visitas dos 3 técnicos da tabela nova (4 aéreas em 120, 4 subterrâneas em 135),
todas `pending_review`, nenhuma com ajuste manual → **−R$ 220** no recálculo.

Chaves que a SEM AUXILIAR continua herdando **de propósito**, conferidas na mesma consulta:
"Retirada condomínio" (R$ 20, igual na planilha) e "Outros motivos sem contrato atrelado,
pagamento zerado" (R$ 0).

> ⚠️ **Padrão a lembrar:** valor que a planilha da tabela alternativa tem mas que ninguém
> cadastrou **não** aparece como erro — paga o valor da padrão em silêncio. Ao criar uma LPU
> alternativa, conferir serviço a serviço em `/cabeamento` e `/homologacao`.

### 0.7 — "Configuração de Roteador Externo" sem regra na SEM AUXILIAR (03/08)

Aberto pela OS 572037, em "Sem regra de LPU". A finalidade existe na tabela padrão como regra
explícita de R$ 0 (vinda do seed), e a SEM AUXILIAR nunca a declarou. **Regra de LPU não tem
herança entre tabelas** — só as classificações de cabeamento/homologação têm (ADR-019). Sem regra
que case, o payout fica `no_rule_match`: não paga **e** trava o fechamento.

**Decisão do usuário (03/08): R$ 30 na SEM AUXILIAR** — o mesmo do suporte interno da tabela nova,
e o mesmo que o ADR-016 já repassa quando o roteador chega como "Venda Produto Externo".
Migration [0039](../../supabase/migrations/0039_lpu_sem_auxiliar_config_roteador.sql).

**Alcance:** 1 visita (a única com essa finalidade em toda a base), sem ajuste manual. A tabela
padrão segue em R$ 0 — nenhuma visita dela tem essa finalidade hoje; registrado em tech-debt 024.

### Efeito colateral bom: a fila "Sem regra" quase esvazia

Os 7 `no_rule_match` de hoje, conferidos um a um em 03/08:

| OS | Causa | Depois deste PR |
|---|---|---|
| 573797, 576398, 574298, 575683, 575110 | receita R$ 0,00 (suporte e homologação) | R$ 0,00 `pending_review` pelo ADR-020 — saem da fila |
| 572037 | finalidade sem regra na SEM AUXILIAR | R$ 30 pela 0039 |
| 572737 | homologação com receita R$ 3,96, valor não cadastrado no mapa | **continua na fila** — a Wave precisa decidir o repasse dessa receita |

### 0.8 — A última "Sem regra": OS 572737 (investigada em 03/08)

**Não é bug, e não tem código a mudar.** A Unetvale glosou o pagamento: a visita de 20/07
(Douglas Ribeiro, Mudança Endereço Fibra, coluna Z `Homologação | 60.50`) veio com receita
**R$ 3,96** em vez de R$ 64,46, e a observação da própria Unetvale na OS explica:
*"21/07/2026 17:04 - Pagamento alterado devido a abertura da OS de garantia"*.

R$ 3,96 não está no mapa de homologação, então o ADR-015 manda para a fila em vez de pagar os
R$ 35 da homologação cheia — que é exatamente o comportamento desenhado. Detalhes e as três
armadilhas do caso (glosa não tem campo próprio; `garantia` da visita é `false` porque a OS de
garantia é outra; valor cadastrado vale para o tenant inteiro) no adendo do
[ADR-015](../architecture/ADR-015-homologacao-repasse.md#adendo--receita-glosada-pela-unetvale-03082026).

**Resolução: é decisão da Wave, feita na tela.** Cadastrar o repasse de R$ 3,96 em
`/homologacao` — que voltou a salvar com a correção do `42P10` (Fase 0.5). Enquanto não for
cadastrado, o fechamento de julho segue bloqueado por essa visita.

Frequência: 1 em 50 homologações do tenant. Se virar volume, o caminho é um ADR sobre glosa,
não mais cadastros avulsos.

### 0.9 — Reemissão da Unetvale duplicava a visita (03/08)

Aberto pela OS 572894: 3 visitas e receita R$ 634,50 no sistema, contra **2 linhas** na planilha.

**Causa:** ao corrigir o pagamento de uma OS já entregue, a Unetvale reemite a linha com o valor
novo e carimba na coluna de data de execução o **horário do ajuste**. Como `data_execucao` faz
parte da chave natural da visita, o ingestor **insere em vez de atualizar** — mesma execução,
duas visitas, duas receitas, **dois payouts**.

Na 572894 a linha voltou como 15/07 **23:48** (R$ 412,26) no lugar de 15/07 **20:24**
(R$ 206,26), e a observação da linha nova preserva o horário verdadeiro: *"Acréscimo de pagamento
pelo atendimento fora do horário de expediente [...] 15/07/2026 20:24"*.

**Varredura completa da base:** 3 ocorrências, todas do upload de 03/08, todas com a linha nova
em 23:4x e observação explicando o acréscimo. Todas `pending_review`, nenhuma travada.

| OS | Técnico | Original | Reemitida | Payout duplicado |
|---|---|---|---|---|
| 572894 | Douglas Ribeiro | 15/07 20:24 · R$ 206,26 | 15/07 23:48 · R$ 412,26 | R$ 100 |
| 569727 | Eduardo Ribeiro | 01/07 16:54 · R$ 64,46 | 01/07 23:44 · R$ 128,92 | R$ 30 |
| 568969 | Eduardo Ribeiro | 01/07 11:24 · R$ 64,46 | 01/07 23:43 · R$ 128,92 | R$ 30 |

Migration [0040](../../supabase/migrations/0040_remove_visitas_reemitidas.sql) remove as três
linhas antigas (o payout cai por cascata): **−R$ 160** de payout duplicado e **−R$ 335,18** de
receita fantasma. A OS 572894 volta a R$ 428,24.

> **A chave natural NÃO virou "por dia"** — seria a correção óbvia e está errada. A OS 568170 tem
> duas visitas com sucesso do mesmo técnico no mesmo dia (10:03 e 10:51), **ambas na mesma
> planilha**, uma zerada pela Unetvale porque a outra fechou a OS. Colapsar por dia apagaria uma
> execução real. Adendo no [ADR-003](../architecture/ADR-003-os-visit-modeling.md).

**Prevenção ainda em aberto (tech-debt 025):** a limpeza é retroativa; nada impede a próxima
reemissão. O desenho proposto é **avisar, não mesclar** — detectar no fim da ingestão e exibir no
detalhe do upload via `IngestWarning` (o tipo já existe e hoje nenhuma tela o consome).

### 0.10 — Registro e notificação das alterações de valor da Unetvale (03/08)

Pedido do gestor: "registrar as OSs em que vem um valor e depois a Unetvale altera esse valor".
Implementado com escopo em **abertura de OS de garantia**, por decisão dele —
[ADR-021](../architecture/ADR-021-alteracoes-unetvale-garantia.md), migration
[0041](../../supabase/migrations/0041_unetvale_alteracoes.sql).

**O dado já existia e ninguém tinha olhado:** `service_visits_audit` guarda `before`/`after` de
todo UPDATE de visita desde a migration 0001 — 3.554 linhas. Dentro delas, **21 alterações reais
da Unetvale** (as outras 237 são a correção de locale de 14/07):

| Motivo (observação da Unetvale) | Qtd | No escopo? |
|---|---|---|
| `Pagamento zerado devido o técnico X ter realizado o fechamento desta OS` | 15 | não — ADR-020 já trata |
| `Pagamento alterado devido a abertura da OS de garantia` | **4** | **sim** |
| `Visita improdutiva invalidada` | 2 | não |

As 4 de garantia reduziram a receita em **exatamente R$ 60,50** cada — R$ 242,00 que a Wave perdeu
sem ninguém ver. Em nenhuma delas o pagamento do técnico mudou.

**Achado que descartou o caminho óbvio:** o campo `garantia` da planilha **nunca vem preenchido**
(0 de 2.345 visitas). Consequência que extrapola esta fase — as regras `{"garantia": true}` da LPU
SEM AUXILIAR nunca casaram nada, ou seja, o "não paga em garantia" da planilha da Wave **não está
valendo**. Registrado em tech-debt 026 para decisão do gestor.

**O que entrou:** tabela `unetvale_alteracoes` com backfill dos 4 casos · detecção em
`src/lib/etl/alteracoes.ts` (gatilho objetivo pelo valor + classificação pelo texto, com trava de
assinatura numérica) · gancho no fluxo de upload · notificação por `notify.ts` (gestor sempre,
técnico só quando os pontos mudam, um resumo por upload) · tela `/alteracoes` com "Ciente" ·
aviso não-bloqueante em `/pagamentos` · contexto no detalhe da visita e no card do técnico.

---

## Fase 1 — LPU "SEM AUXILIAR" (PRIORIDADE)

### Primeiro: a premissa precisa ser corrigida

O pedido foi "deixar duas LPUs ativas". **O sistema não precisa disso — e com duas ativas ele
quebra.** Existem duas travas:

1. `trg_single_active_lpu` ([0001_initial_schema.sql:290](../../supabase/migrations/0001_initial_schema.sql)) rejeita duas ativas no mesmo tenant
2. `loadRecalcContext` ([recalculate-batch.ts:98](../../src/lib/payouts/recalculate-batch.ts)) busca a LPU ativa com `.single()` — duas linhas retornam **erro**, e o recálculo inteiro falha

O que você quer **já está implementado** desde o [ADR-014](../architecture/ADR-014-lpu-por-tecnico.md)
(20/07), por outro caminho — e o ADR foi escrito citando esta planilha pelo nome:

> *"A Wave passou a ter uma LPU alternativa 'SEM AUXILIAR' (valores menores, serviço sem técnico
> auxiliar) que deve valer só para técnicos específicos escolhidos pelo gestor."*

O desenho: a LPU alternativa é cadastrada como **segunda LPU não-ativa**. `ativa = true` significa
apenas "tabela padrão do tenant", não "em uso". O motor resolve **por visita**: usa as regras da
LPU do técnico se ele tiver uma atribuída, senão as da padrão. Uma LPU não-ativa atribuída a um
técnico é aplicada normalmente — o filtro `ativa` no carregamento das regras alternativas é sobre
`lpu_rules.ativa` (a regra), não sobre `lpus.ativa`.

**O que já existe e funciona:**

| Peça | Onde | Estado |
|---|---|---|
| Coluna `technicians.lpu_id` | migration 0023 | ✅ aplicada |
| Motor resolve LPU por técnico | `recalculate-batch.ts:80` (`lpuByTecnico`) | ✅ |
| Seletor "LPU do técnico" no cadastro | `/equipe/tecnicos/[id]` → `TechnicianLpuSelector` | ✅ lista "Padrão" + alternativas |
| Recálculo escopado ao técnico ao trocar a LPU | `setTechnicianLpu` | ✅ |

**Verificado hoje:** 13 técnicos ativos, **0 com LPU própria** — o mecanismo nunca foi usado porque
a LPU "SEM AUXILIAR" nunca foi cadastrada. É exatamente a pendência que o ADR-014 deixou registrada.

> **Portanto o trabalho não é "permitir duas ativas".** É (1) cadastrar a LPU SEM AUXILIAR,
> (2) atribuir aos técnicos e (3) sinalizar na tela qual tabela pagou cada OS.

### 1.1 — Mapear a planilha para regras

A planilha tem 44 linhas. Elas se dividem em três grupos, e só o primeiro vira regra de LPU.

#### Grupo A — vira regra de LPU (mecânico, valores comparados com a tabela padrão)

| Serviço na planilha | SEM AUXILIAR | Padrão hoje | Condições |
|---|---|---|---|
| Instalação aérea | 100 | 120 | `condominio:false` + `Aéreo` |
| Instalação subterrânea | 100 | 135 | `condominio:false` + `Subterrâneo` |
| Instalação Condomínio externo aéreo + DG até AP | 150 | 190 | `condominio:true` + `Aéreo` + `Externo` |
| Instalação Condomínio externo subterrâneo + DG até AP | 70 | 70 | `condominio:true` + `Subterrâneo` + `Externo` |
| Instalação Condomínio do DG até o AP | 60 | 70 (genérica) | `condominio:true` |
| Retirada | 20 | 20 | `finalidade: Retirada` |
| Suporte de Fibra aérea | 100 | 120 | suporte + `Aéreo` + `Externo` |
| Suporte de Fibra Subterrânea | 100 | 135 | suporte + `Subterrâneo` + `Externo` |
| Suporte de Fibra aérea **mais venda atrelada** | 100 | 130 | idem + `agregada:true` |
| Suporte de Fibra Subterrânea **mais venda atrelada** | 100 | 135 | idem + `agregada:true` |
| Suporte Fibra Interno | 30 | 30 | suporte + `Interno` |
| Suporte Fibra Interno **mais venda de roteador** | 30 | 45 | idem + `agregada:true` |
| Suporte Fibra Retenção · Suporte Interno (Config./Garantia) · Suporte Rádio | 30 | 30 | já caem em Suporte Interno |

**Itens com garantia pagam "-" (zero)** — e isso é modelável: `garantia` é condição válida do motor.
São 6 linhas: instalação aérea/subterrânea com garantia, condomínio DG-AP menos garantia, suporte
subterrâneo/aéreo com OS de garantia, suporte retenção com garantia, suporte fibra interno com
garantia. ⚠️ **A tabela padrão não tem essas regras** — hoje, uma OS de garantia paga valor cheio
para todo mundo. Confirmar se o "não paga em garantia" vale só para SEM AUXILIAR ou para as duas.

#### Grupo B — precisa de decisão sua (o motor não resolve sozinho)

| Item | Conflito |
|---|---|
| **Instalação aérea/subterrânea com ponto adicional → 130** | O motor soma **+R$ 36 por ponto** (ADR-016), o que daria 100 + 36 = **136**, não 130. Para SEM AUXILIAR o ponto vale **+R$ 30**? Se sim, o acréscimo por ponto precisa deixar de ser constante no código e passar a variar por LPU. |
| **Suporte Fibra Interno com ponto adicional → 60** | Mesma coisa: 30 + 30 = 60 (e não 30 + 36 = 66). Confirma que na SEM AUXILIAR o ponto é R$ 30. |
| **Cordoalha → 200** (instalação aérea/subterrânea + cordoalha; suporte aéreo/subterrâneo com cordoalha) | "Cordoalha" **não é condição do motor** — aparece só na coluna Z. Hoje nenhuma regra a considera. Precisa de mecanismo novo (como foi feito para homologação e pontos adicionais). |
| **Telefonia** (suporte mesma localidade 20 / outra 30; cabeamento novo 30 / atrelado 30) | Qual é a **finalidade exata** que a Unetvale emite para telefonia? Sem o texto da planilha da Unetvale não dá para escrever a condição. |
| **Cabeamento segundo ponto com EX-220 → 20** | Depende do texto exato da coluna Z. |

#### Grupo C — está FORA do motor de LPU (o achado mais importante desta fase)

Estes serviços **não passam pela LPU** hoje. São resolvidos por estruturas **por tenant** — o que
significa que atribuir a LPU alternativa a um técnico **não muda nada** neles:

| Serviço | SEM AUXILIAR | Valor de hoje | Onde é resolvido | Escopo |
|---|---|---|---|---|
| Cabeamento/Segundo Ponto | 30 | 44 | `cabeamento_classifications` (ADR-009) | **tenant** |
| Cabeamento 2 pontos / DG até AP + 2º ponto | 60 | 70 | idem | **tenant** |
| Cabeamento 3 pontos | 90 | 106 | idem | **tenant** |
| Instalação Fibra Homologação | 30 | 35 | `homologacao_classifications` (ADR-015) | **tenant** |
| Visita improdutiva | 10 | 15 (constante no código) | `calculate.ts` | **global** |
| Domingos e feriados | 10% | 15% (`config.feriado_acrescimo_pct`) | config | **tenant** |

⚠️ **Consequência prática:** se a Wave atribuir a SEM AUXILIAR a um técnico hoje, ele passa a
receber os valores menores de instalação/suporte/retirada, **mas continua recebendo R$ 44 de
cabeamento, R$ 35 de homologação, R$ 15 de improdutiva e 15% de acréscimo em feriado** — os valores
da tabela padrão. O pagamento fica misturado entre as duas tabelas.

Isso não é um bug: o ADR-014 entregou o vínculo só no motor de LPU, e essas outras estruturas
nasceram depois (ADR-015 e ADR-016 são de julho). Mas é uma limitação que precisa de decisão antes
de a LPU entrar em uso.

**Três saídas, da mais rápida à mais completa:**

- **(a) Entrar só com o Grupo A agora** e assumir a mistura, com a limitação documentada e visível
  na tela. Rápido, mas paga errado nos serviços do Grupo C.
- **(b) Tornar as três estruturas "por LPU"** — coluna `lpu_id` em `cabeamento_classifications` e
  `homologacao_classifications`, e mover improdutiva/percentual de feriado para colunas da própria
  LPU. É o modelo correto e exige ADR + migrations + mudança no `loadRecalcContext`. Esforço M.
- **(c) Adiar a SEM AUXILIAR** até (b) estar pronto.

**Recomendo (b)**, mas fatiado: entra o Grupo A junto com a mudança de escopo de
`cabeamento_classifications` e `homologacao_classifications` (que cobrem a maior parte do volume);
improdutiva e feriado ficam para um segundo momento, sinalizados na tela. Se você precisa da tabela
valendo esta semana, (a) é viável **desde que** a diferença esteja visível para o gestor.

⚠️ **Contradição na própria planilha:** a linha de domingos/feriados diz "**15%** a mais" no nome do
serviço e "**10%** a mais nos domingos e feriados" no valor. O sistema está com 15%. Qual vale?

### 1.2 — Como a LPU entra no sistema

Pelo mesmo caminho da LPU atual: **migration numerada** com o `INSERT` das regras
(o precedente é `seed-wave-lpu-2026-revisada.sql`, hoje seria uma `0035`). Rastreável, idempotente e
reproduzível — melhor do que digitar 20 regras na tela, e não precisa de acesso ao navegador.

A LPU nasce **`ativa = false`**, com nome "LPU Wave — SEM AUXILIAR". Depois o gestor atribui aos
técnicos em `/equipe/tecnicos/[id]`, um a um, e cada atribuição já recalcula os payouts daquele
técnico (`approved`/`paid`/`contestado`/`override_by` preservados — Fase 0.3).

### 1.3 — Sinalizar qual tabela pagou cada OS

Pedido seu, e **o dado já existe**: `payouts.lpu_id` é gravado a cada cálculo. Falta exibir.

| Tela | Proposta |
|---|---|
| `/pagamentos` (lista) | Coluna ou etiqueta com o nome da tabela; só aparece quando não é a padrão, para não poluir |
| `/pagamentos/[id]` | Linha "Tabela de preços: LPU Wave — SEM AUXILIAR" junto da regra aplicada |
| `/visitas/[id]` | Idem, no bloco de pagamento |
| `/fechamento/[periodo]` | Etiqueta por técnico, para o gestor conferir em bloco |
| `/equipe/tecnicos/[id]` | Já mostra o seletor; deixar explícito qual está valendo |

Visível **só para o gestor** (rotas `(manager)`) — o técnico vê pontos, não a tabela.

### DoD da Fase 1
- [ ] LPU "SEM AUXILIAR" criada por migration, inativa, com as regras do Grupo A
- [ ] Um técnico de teste atribuído, com os payouts dele recalculados e conferidos contra a planilha
- [ ] Nome da tabela visível nas telas de pagamento do gestor
- [ ] Decisão registrada (a/b/c) sobre o Grupo C, e o que ficou de fora escrito na tela
- [ ] ADR-014 atualizado com o que foi de fato entregue

---

## Fase 2 — IQI: a coleta continua parada, mas por outro motivo

### O secret foi corrigido — e o erro mudou

Sua regravação **funcionou**. O `Invalid API key` desapareceu: o coletor agora autentica no
Supabase, lê o tenant e lista os 13 técnicos. O run de 30/07 17:19 falha em outro ponto:

```
Resumo: 0 técnicos processados · 0 meses gravados · 1 sem código Unetvale · 12 com erro.
  ERRO Carlos Henrique...: Tempo esgotado (15000ms) em
       https://os.unetvale.com.br/index/iqi/INS-INS2-INS3-MIGE-MIGF-MUD-MUDF/30/540
  (… os mesmos 15000ms para todos os 12 técnicos)
```

Todos os 12 fetches ao endpoint do IQI estouram o timeout de 15s. É o **mesmo sintoma que motivou
tirar a coleta da Vercel** ([ADR-012](../architecture/ADR-012-iqi-ingestao-scraping.md)) — só que
agora no runner do GitHub.

### Duas hipóteses, e o teste que as separa

**H1 — Sessão inválida.** Os secrets `UNETVALE_USER`/`UNETVALE_PASSWORD` também foram regravados em
23/07 00:20. E a validação do login é frouxa: `loginUnetvale` só verifica se **veio algum cookie**
([collector.ts:86](../../src/lib/iqi/collector.ts)) — se a Unetvale devolver a página de login com
um cookie de sessão novo, o código segue achando que logou. Com sessão inválida, o endpoint pode
pendurar em vez de responder 401.

**H2 — Bloqueio de IP.** A Unetvale passou a barrar também os IPs do GitHub Actions.

**O que aponta para H1:** o login (2 requisições ao mesmo host) **passou sem timeout**; só
`/index/iqi/...` pendura. Bloqueio de IP costuma derrubar o host inteiro, não uma rota.

**Teste que decide:** com credencial válida e um IP residencial, chamar o endpoint de um técnico
(ex.: 540) com o cookie de sessão. Responde rápido → H2. Pendura igual → o endpoint mudou. Volta
HTML de login → H1 confirmada, e a correção é regravar a senha da Unetvale.

### 2.1 — Correções de robustez (independentes de qual hipótese vencer)

| Item | Mudança |
|---|---|
| Validar o login de verdade | Checar se a resposta é redirect/sessão autenticada, não só "veio cookie". Login falho tem de **falhar dizendo que é login**, não virar 12 timeouts |
| Mensagem honesta no botão | Hoje `sincronizarIqi` trata o HTTP 204 do `workflow_dispatch` como sucesso — é só "disparo aceito". Foi assim que a tela exibiu 24 mensagens verdes com zero coleta |
| Verificar o efeito | Após disparar, consultar `max(synced_at)` a cada ~5s (até ~3 min): mudou → "IQI atualizado"; não mudou → "A coleta não concluiu" com link para o histórico |
| Dado velho visível | "Última sincronização: <data>" sempre na tela, com destaque acima de 48h (a coleta é 2x/dia) |

### DoD da Fase 2
- [ ] Hipótese decidida com evidência (não com suposição)
- [ ] Um run verde, com `iqi_snapshots.synced_at` do dia
- [ ] Botão mostrando resultado real, testado com a coleta funcionando **e** quebrada de propósito
- [ ] "Última sincronização" em `/produtividade`

---

## Fase 3 — Português integral na interface

Nenhum termo em inglês deve chegar ao gestor ou ao técnico. Já foi pedido antes (`payout` →
**pagamento**) e voltou — a causa é estrutural, não descuido.

**Mapas de rótulo duplicados, cada um com fallback que vaza o termo cru:**

| Arquivo | Situação |
|---|---|
| `pagamentos/page.tsx:31` | mapa próprio |
| `pagamentos/[id]/page.tsx:25` | **outro** mapa, rótulos diferentes para o mesmo status |
| `motivos/_components/OsListSheet.tsx:24` | terceiro mapa, `?? v.payoutStatus` → mostra `pending_review` |

Mais: `override` visível em `OverridePayoutForm.tsx:42` e `pagamentos/[id]/page.tsx:191`; e
`FIELD_LABELS` duplicado em `visitas/[id]/page.tsx:17` e `uploads/[id]/audit/page.tsx:37`, ambos com
`?? key` — campos fora do mapa aparecem como `subterraneo_aereo`, `explicacao_valor`.

**Proposta:** fonte única em `src/lib/labels/` (`payout-status.ts`, `campos.ts`) **sem fallback
silencioso** — chave desconhecida vira erro de tipo, não texto cru; `override` → "ajuste manual";
e um **teste de regressão** varrendo `.tsx` por lista negra de termos, no espírito do
`schema-conventions.test.ts`. É o teste que impede a próxima reincidência.

"LPU" e "OS" ficam — são o vocabulário da Wave.

**Decisão pendente:** trocar só na interface, ou renomear também código/banco/ADRs? Recomendo **só
a interface** — renomear o resto toca ~40 arquivos, a tabela `payouts` e todos os ADRs, com risco
alto e zero ganho para quem usa.

---

## Fase 4 — Tirar código e log da interface

| Onde | Hoje | Proposta |
|---|---|---|
| `visitas/[id]/page.tsx:286` | JSON da regra (`{"type":"fixed","value":20}`) | "Valor fixo de R$ 20,00" |
| `pagamentos/[id]/page.tsx:230,236` | JSON de `conditions` **e** de `payout` | "Retirada · valor fixo de R$ 20,00" + condições em lista |
| `uploads/[id]/page.tsx:260` | JSON dos erros de importação | Lista com linha e motivo |
| `visitas/[id]`, `uploads/[id]/audit` | `before`/`after` com nomes de coluna crus | Usa a fonte única da Fase 3 |

A formatação de uma regra é lógica de domínio: entra em `src/lib/lpu/format.ts`
(`formatPayout`, `formatConditions`) com teste dos três tipos de payout. `(dev)/` fica como está.

---

## Ordem de execução

1. **Fase 1 — LPU SEM AUXILIAR** (prioridade sua). Bloqueada nas decisões do Grupo B/C abaixo
2. **Fase 2.1 — teste do endpoint da Unetvale**: 10 minutos, decide entre senha errada e bloqueio
3. **Fase 4** — maior ganho visível por esforço, escopo fechado, sem decisão pendente
4. **Fase 3** — depende da decisão sobre o alcance da renomeação
5. **Fase 2 restante** — feedback real do botão, depois que a coleta estiver verde

## Decisões que destravam a Fase 1

1. **Ponto adicional na SEM AUXILIAR é R$ 30** (100→130, 30→60)? Hoje o motor soma R$ 36 fixo para todos.
2. **Garantia não paga** — vale só para a SEM AUXILIAR ou também para a tabela padrão?
3. **Grupo C** — (a) entrar já assumindo a mistura, (b) tornar cabeamento/homologação por LPU antes, ou (c) adiar?
4. **Domingo/feriado: 10% ou 15%?** A planilha se contradiz; o sistema está em 15%.
5. **Cordoalha e Telefonia** — quais finalidades/textos exatos a Unetvale emite? Sem isso não dá para escrever a condição.

---

## Estado verificado

- **30/07 — Fase 0.1 verificada em produção:** 0032 aplicada + recálculo; 3 visitas em R$ 30 com a
  regra nova; LPU ativa de 14 → 18 regras.
- **30/07 — 0033 e 0034 aplicadas** pelo usuário; PR mergeado.
- **30/07 — Fase 1 levantada:** mecanismo do ADR-014 confirmado pronto (coluna, motor, UI);
  **13 técnicos ativos, 0 com LPU atribuída**; a LPU SEM AUXILIAR nunca foi cadastrada.
- **03/08 — Fase 0.4:** 186 visitas com sucesso e receita R$ 0,00 no tenant Wave; 51 serão zeradas
  (R$ 3.950,50, maio a julho) e 1 fica protegida por override de contestação resolvida.
- **03/08 — Fase 0.5:** vazamento das classificações da SEM AUXILIAR para a tabela padrão
  confirmado no banco (tenant `Cabeamento` = 44, SEM AUXILIAR = 30, payout gravado = 30 com
  `lpu_id` da padrão). 68 visitas afetadas, R$ 750,00. O salvar das telas `/cabeamento` e
  `/homologacao` estava quebrado desde a 0035 — sondado e confirmado (`42P10`).
- **03/08 — Estado dos travados (verificado):** 14 contestações, todas resolvidas e **todas com
  `override_by`** → protegidas. 421 payouts `approved`, 17 com override do gestor, 0 `paid`.
  ⚠️ **Maio está com `monthly_closings.status = 'pago'` mas tem 644 payouts em `pending_review`**
  (só 123 `approved`) — um recálculo global reprocessa maio. Decisão do usuário (03/08): **não
  travar por período**; a proteção é contestação do técnico + alteração do gestor + aprovado/pago,
  que é o que `recalculate-batch` já aplica por payout.
- **03/08 — Fase 0.6:** 8 visitas de cabeamento de fibra dos técnicos da SEM AUXILIAR (4 em
  R$ 120, 4 em R$ 135), todas `pending_review` e sem ajuste manual → R$ 100 pela migration 0038.
- **03/08 — Fase 0.7:** 1 visita (OS 572037), única com a finalidade "Configuração de Roteador
  Externo" na base inteira, em `no_rule_match` → R$ 30 pela migration 0039.
- **03/08 — 0038 aplicada em produção** pelo usuário; classificações conferidas no banco (tenant
  120/135 intactos, SEM AUXILIAR 100/100). Payouts ainda em 120/135 — mudam só no recálculo.
- **03/08 — Fases 0.4 a 0.7 VERIFICADAS EM PRODUÇÃO.** PR #52 mergeado, 0038 e 0039 aplicadas,
  recálculo rodado. Consulta ao banco após o recálculo:

  | OS | Fase | Esperado | Em produção |
  |---|---|---|---|
  | 573312 | 0.5 vazamento | R$ 44 | ✅ R$ 44 |
  | 575303 | 0.4 receita zerada | R$ 0 | ✅ R$ 0 |
  | 569827 | 0.6 cabeamento de fibra | R$ 100 | ✅ R$ 100 |
  | 572037 | 0.7 configuração de roteador | R$ 30 | ✅ R$ 30 |

  **Fila "Sem regra de LPU": 7 → 1** (só a OS 572737, da Fase 0.8, que depende de decisão da Wave).
- **03/08 — Fase 0.8:** OS 572737 investigada — glosa da Unetvale por abertura de OS de garantia.
  Sem código a mudar; resolve cadastrando o repasse de R$ 3,96 em `/homologacao`.
- **03/08 — Fase 0.10 VERIFICADA EM PRODUÇÃO.** PR #54 mergeado e 0041 aplicada. Backfill conferido
  no banco: **exatamente 4 registros** (OSs 571722, 572737, 573851 e 574908), **todos com variação
  de −R$ 60,50**, nenhum de "outro técnico fechou" ou "improdutiva invalidada" — o predicado está
  no ponto. Campo `garantia` da planilha vazio em 100% das 2.345 visitas (tech-debt 026).
  - **Correção logo em seguida (PR de fix):** os registros retroativos entram com `payout_novo`
    nulo, e a comparação inicial lia isso como mudança — o gestor via "R$ 100,00 → —" e o técnico
    via "seus pontos mudaram" num pagamento que ficou igual. `payout_novo` nulo passou a
    significar **não avaliado**; sem migration, só código. Adendo no ADR-021.
- **03/08 — Fase 0.9:** varredura completa das 2.348 visitas do tenant: **3 duplicatas por
  reemissão**, todas do upload de 03/08 (`lista-os-julho-2026-completa.xlsx`), todas
  `pending_review` e sem ajuste manual. Migration 0040 escrita; **falta aplicar**. A OS 568170
  foi conferida linha a linha e **não** é duplicata — é o caso legítimo que impede a mudança da
  chave natural.
- **30/07 — Fase 2:** secret do Supabase corrigido (o `Invalid API key` sumiu); a coleta agora falha
  com timeout de 15s em todos os 12 fetches ao endpoint do IQI. Hipótese principal: sessão inválida
  na Unetvale (login validado de forma frouxa + senha regravada em 23/07).
