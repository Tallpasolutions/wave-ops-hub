# ADR-021 — Registro e notificação de alterações de valor da Unetvale (OS de garantia)

**Status:** Aceito (implementado; migration 0041 + recálculo a aplicar no deploy)
**Data:** 2026-08-03
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** pedido do gestor — "conseguimos ver OSs que são garantia? teria como registrar as OSs em que vem um valor e depois a Unetvale altera esse valor?"

---

## Contexto

A Unetvale mexe no valor de uma OS **depois** de já ter informado outro. Hoje isso passa em
silêncio: a planilha nova sobrescreve a antiga, o payout é recalculado e ninguém — nem a Wave, nem
o técnico — fica sabendo que aquele valor mudou.

O dado para enxergar isso **já existia e ninguém tinha olhado**: o trigger `trg_audit_visits`
(migration 0001) grava `before`/`after` em `service_visits_audit` a cada UPDATE de visita. Em
03/08/2026 a tabela tinha 3.554 linhas. Descontando 237 que são a correção de locale de 14/07
(6446 → 64,46, migration nossa), sobraram **21 alterações reais da Unetvale**, cada uma com a
observação da própria Unetvale explicando o motivo:

| Motivo (texto da observação) | Qtd | Efeito |
|---|---|---|
| `Pagamento zerado devido o técnico X ter realizado o fechamento desta OS` | 15 | receita → R$ 0,00 |
| `Pagamento alterado devido a abertura da OS de garantia` | 4 | receita **−R$ 60,50 exatos** |
| `Visita improdutiva invalidada` | 2 | 15,98 → 0 |

As 4 de garantia, todas de julho/2026:

| OS | Receita antes → depois | Payout do técnico |
|---|---|---|
| 572737 | R$ 64,46 → R$ 3,96 | não mudou |
| 571722 | R$ 206,26 → R$ 145,76 | não mudou (R$ 100) |
| 573851 | R$ 232,04 → R$ 171,54 | não mudou (R$ 100) |
| 574908 | R$ 232,04 → R$ 171,54 | não mudou (R$ 135) |

**R$ 242,00 de receita perdida sem ninguém tomar conhecimento.**

### O campo `garantia` da planilha não serve

Primeira coisa investigada, e o resultado descarta o caminho óbvio: das 2.345 visitas do tenant,
**todas têm `garantia = false` e nenhuma tem `true`** — a Unetvale nunca preenche a coluna. O
único sinal de garantia é o texto da observação.

Isso tem uma consequência que extrapola este ADR: as duas regras `{"garantia": true}` da LPU
"SEM AUXILIAR" (`Instalação/Suporte em garantia (não paga)`, prioridade 900, migration 0036)
**nunca casaram e nunca vão casar nada**. O "não paga em garantia" que a Wave quis não está
valendo. Registrado em `docs/tech-debt.md` (026) para decisão.

## Decisão

Registrar em tabela própria toda alteração de valor da Unetvale **por abertura de OS de
garantia**, notificar a Wave sempre e o técnico quando os **pontos dele** mudarem.

Escopo deliberadamente estreito (decisão do gestor, 03/08): os outros dois motivos ficam de fora.
"Outro técnico fechou" já tem tratamento — o [ADR-020](./ADR-020-receita-zerada-sem-repasse.md)
zera o payout e o técnico contesta pelo app; "improdutiva invalidada" são 2 casos sem impacto.

### O gatilho é duplo, e isso é deliberado

1. **Fato objetivo:** a receita mudou entre duas ingestões — comparação numérica sobre
   `service_visits_audit`. É o que dispara.
2. **Classificação:** o texto da observação separa garantia dos outros motivos.

O projeto já rejeitou texto livre da Unetvale como base de regra duas vezes (`trocado_drop` em
[`05-regras-especiais.md`](../domain/05-regras-especiais.md), glosa no adendo do
[ADR-015](./ADR-015-homologacao-repasse.md)). A diferença: lá o texto decidiria **dinheiro**; aqui
decide se um **aviso** é criado. Ainda assim é frágil — se a Unetvale mudar a redação, a detecção
para em silêncio, que é o padrão de bug mais recorrente deste projeto. Duas travas:

- **Assinatura numérica:** redução de exatamente R$ 60,50, o valor nos quatro casos. Texto **ou**
  assinatura registra. Um teste cobre justamente a redação nova que só passa pela assinatura.
- **Contagem das não classificadas:** alterações de valor no mesmo upload que não casaram nenhum
  dos dois entram no corpo da notificação do gestor (*"houve também N outras alterações de valor
  neste envio, por outro motivo"*), sem virar registro. Se a Unetvale mudar tudo, o número sobe e
  alguém percebe.

### Estrutura

Tabela `unetvale_alteracoes` (migration 0041), RLS copiada de `payout_contestacoes` (0022):
tenant + técnico vê o próprio + supervisor vê a equipe + gestor/owner vê tudo. Guarda receita
antes/depois, payout antes/depois, a observação bruta como evidência, e `ciente_por`/`ciente_em`.

`UNIQUE (visit_id, upload_id, receita_anterior, receita_nova)` — **índice único simples, não
parcial**, para o `on_conflict` do PostgREST conseguir inferi-lo (a armadilha `42P10` que quebrou
as telas de classificação por meses — ver adendo 5 do [ADR-019](./ADR-019-valores-por-lpu.md)).

### Momento da detecção

No fluxo de upload (`src/app/(manager)/uploads/actions.ts`), em volta do recálculo:

1. `detectarAlteracoesGarantia` — **antes**, para o snapshot de `payout_anterior` refletir o que o
   técnico via
2. o recálculo de sempre
3. `finalizarAlteracoes` — **depois**, grava `payout_novo` e devolve o que vira notificação

Tudo em try/catch: registro é secundário, não pode derrubar a ingestão — mesmo espírito do
`pushSafely` de `notify.ts`.

### Notificação

Pelo ponto único `notify.ts` (CLAUDE.md §6), o que dá Web Push com app fechado de graça (ADR-018).
**Um resumo por upload**, não uma notificação por OS — um upload real trouxe 15 alterações.

- **Gestor** (`unetvale_garantia_alterou_valor`): sempre que a receita muda, com o total em R$.
- **Técnico** (`pagamento_alterado_unetvale`): **só quando `payout_anterior != payout_novo`**. Ele
  não vê receita da Unetvale no app, só pontos; avisar sobre mudança que não mexe nos pontos dele
  gera dúvida sem ação possível.

Nos 4 casos históricos o pagamento do técnico não mudou — nenhum deles teria gerado notificação
para técnico. A regra existe porque **pode** disparar: a redução de receita pode cruzar uma faixa
da LPU (as regras de suporte cortam por receita entre R$ 40 e R$ 150) e aí os pontos mudam.

### O que o registro NÃO faz

Não altera payout. Quem decide mudar o valor do técnico é a Wave, pelo ajuste manual em
`/pagamentos`; o técnico discorda pelo app (ADR-013). "Ciente" é só reconhecimento — tira a linha
da fila, não muda dinheiro nem status de fechamento.

## Adendo — `payout_novo` nulo é "não avaliado" (03/08/2026, na verificação em produção)

Os 4 registros do backfill entram com `payout_novo` **nulo**: são retroativos, nunca passaram por
`finalizarAlteracoes`. A primeira versão comparava `payout_anterior` com `payout_novo` usando
`?? 0` dos dois lados, o que lia `R$ 100 → null` como **mudança** — e produzia dois erros na tela
já em produção: o gestor via "R$ 100,00 → —" em destaque, e o técnico via *"seus pontos mudaram"*
num pagamento que ficou exatamente igual. Alarme falso no lugar mais sensível do produto.

A semântica correta, agora em `payoutMudou` e nas duas telas: **`payout_novo` nulo significa "não
avaliado", não "virou nada"** — nunca afirma mudança. O caminho oposto (não tinha payout e passou
a ter) continua sendo mudança de verdade. A tela do gestor marca essas linhas como
"registro retroativo".

Optamos por **não** preencher `payout_novo` com o valor anterior numa migration de correção: o
nulo é o marcador honesto de que aquele registro nunca foi avaliado, e preenchê-lo tornaria um
registro retroativo indistinguível de um avaliado de verdade.

## Considerados e rejeitados

- **Detectar pelo campo `garantia` da planilha.** É o caminho óbvio e não funciona: a coluna vem
  sempre `false`. Foi o primeiro fato verificado.
- **Bloquear o fechamento enquanto houver alteração sem ciência.** Descartado pelo gestor: a
  alteração é informativa e travar o mês por ela atrapalharia a operação. Aparece como aviso em
  `/pagamentos`, fora do bloco de pendências críticas.
- **Registrar todos os motivos de alteração.** O gestor pediu escopo em garantia. "Outro técnico
  fechou" já é resolvido pelo ADR-020, com fluxo de contestação próprio.
- **Ajustar o payout automaticamente quando a receita cai.** Seria decidir dinheiro por texto
  livre da Unetvale — exatamente o que este projeto evita.

## Consequências

**Positivas**
- Redução de receita deixa de passar em branco. O primeiro efeito é retroativo: o backfill traz
  as 4 de julho, R$ 242,00 que ninguém tinha visto.
- A auditoria de visitas, que existia desde a migration 0001 e nunca tinha sido usada, vira fonte
  de um produto.
- O técnico só é incomodado quando há o que ele possa contestar.

**Negativas / trade-offs aceitos**
- A classificação depende de texto livre. As duas travas reduzem o risco, não o eliminam.
- A assinatura de R$ 60,50 é o valor de hoje. Se a Unetvale mudar o desconto, essa trava perde
  efeito e sobra o texto — a contagem de não classificadas é o que vai denunciar.
- Mais uma fila para o gestor. Mitigado por ser pequena (4 registros em ~3 meses) e não bloquear.
