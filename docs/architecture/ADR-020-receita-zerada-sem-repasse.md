# ADR-020 — Receita zerada da Unetvale não gera repasse automático

**Status:** Aceito (implementado; sem migration — regra de cálculo)
**Data:** 2026-08-03
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** OS 575303 (Cabeamento/Segundo Ponto, 25/07/2026) — receita da Unetvale R$ 0,00, com a
observação da própria Unetvale *"Pagamento zerado devido o técnico RM - Matheus Deiss Silva ter
realizado o fechamento desta OS"*, e ainda assim o sistema repassou R$ 30,00 ao técnico da visita.

---

## Contexto

Quando a Unetvale zera a receita de uma linha da planilha, ela está dizendo que **não pagou nada
por aquela execução**. O motivo mais comum é a OS ter sido fechada por outro técnico — a receita
vai para a linha de quem fechou, e a linha do outro técnico fica em R$ 0,00. A coluna Z continua
descrevendo o serviço ("Instalação nova | 160 (aéreo)", "Suporte com troca de drop aérea | 160",
"Cabeamento | 88"), porque ela descreve **o serviço da OS**, não o que foi pago naquela linha.

O motor de payout, até aqui, só olhava a receita zerada em improdutivas. Com sucesso, o valor era
resolvido pelo serviço descrito — LPU, classificação de cabeamento (ADR-009), homologação
(ADR-015) ou coluna Z (ADR-016) — e a receita R$ 0,00 era ignorada. Resultado: a Wave repassava do
próprio bolso um serviço que não faturou.

**Levantamento em produção (03/08/2026, tenant Wave, consulta na sessão):** 186 visitas com sucesso
e receita R$ 0,00; **52 delas com payout efetivo > 0, somando R$ 3.980,50** (maio R$ 1.539,50 ·
junho R$ 970,00 · julho R$ 1.471,00). Concentradas em Suporte Fibra (36), Instalação - Fibra - PF
(8), Troca de Equipamentos (5), Mudança Endereço Fibra (2) e Cabeamento/Segundo Ponto (1). Nenhuma
estava travada (`approved`/`paid`/`contestado`) — todas em `pending_review` ou `no_rule_match`.

O ponto delicado: **parte dessas visitas é trabalho real e completo** (troca de drop, instalação
nova). Não dá para distinguir automaticamente "linha zerada porque outro fechou a OS" de "linha
zerada indevidamente pela Unetvale" — a planilha não traz esse sinal de forma confiável. O que
existe é um caminho humano já construído para isso: a contestação do técnico (ADR-013).

## Decisão

**Sem receita da Unetvale, não há repasse automático.** Visita com sucesso e
`valor_recebido_unetvale = R$ 0,00` exatos gera payout **R$ 0,00**, e o técnico que discordar
**contesta a OS pelo aplicativo** — a Wave responde e ajusta o valor caso a caso.

- **Precedência:** a regra entra **antes** de homologação (ADR-015), coluna Z (ADR-016),
  classificação de cabeamento (ADR-009) e do motor de LPU (ADR-004) — todos pagariam pelo serviço
  descrito, ignorando a receita. Fica logo depois das regras de improdutiva, na posição 3 da
  [tabela de precedência](../domain/03-payout.md#ordem-de-precedência-do-cálculo).
- **Sem modificadores:** não incide ponto adicional (ADR-016) nem acréscimo de domingo/feriado
  (ADR-011) — não há base sobre a qual incidir.
- **Status `pending_review`, com `lpu_rule_id = null`.** Não trava: se um re-upload trouxer receita,
  o recálculo passa a pagar normalmente. E, por não ser `approved`, o técnico consegue contestar.
- **"Deixado na mesa" = 0.** Houve sucesso; nada foi perdido por falha do técnico.
- **`null` (receita desconhecida) não é zero.** Só R$ 0,00 exato dispara a regra — mesma convenção
  já usada na improdutiva zerada.
- **Decisão manual do gestor prevalece.** Payout `approved`/`paid`/`contestado` ou com
  `override_by` não é recalculado (invariante da Sprint 4 + ADR-013); a regra automática não
  desfaz um ajuste da Wave.

Implementação: saída antecipada em `buildPayoutUpsert`
([`src/lib/payouts/calculate.ts`](../../src/lib/payouts/calculate.ts)). Sem migration — é regra de
cálculo, aplicada pelo recálculo de pendentes.

**Nas telas.** O R$ 0,00 não aparece sem explicação:

- App do técnico (`/visitas`): *"Esta OS veio sem valor pela Unetvale, por isso não gerou pontos.
  Se você entende que deveria receber, conteste aqui embaixo."*, logo acima do botão de contestar.
- Painel da Wave (`/visitas/[id]`): nota no bloco de Pagamento dizendo que não houve repasse
  automático porque a Unetvale não pagou a visita, e que o caminho é a contestação.

## Considerados e rejeitados

- **Pagar mesmo assim e deixar a Wave estornar depois.** É o comportamento atual, e foi ele que
  gerou o caso da OS 575303: o dinheiro sai sem ninguém decidir, e o estorno depende de alguém
  perceber. Inverter o default coloca a decisão em quem tem a informação.
- **Distinguir "OS fechada por outro técnico" pela coluna de observações.** A observação existe
  (foi ela que denunciou o caso), mas é texto livre da Unetvale, sem formato garantido — o mesmo
  motivo pelo qual `trocado_drop` foi descartado como sinal em
  [`05-regras-especiais.md`](../domain/05-regras-especiais.md). Regra baseada em texto livre
  quebra em silêncio.
- **Mandar para a fila (`no_rule_match`) em vez de pagar R$ 0,00.** Colocaria ~50 visitas por
  trimestre na mesa do gestor sem que ele tenha mais informação que o técnico sobre o que
  aconteceu em campo. A contestação leva a mesma pergunta a quem esteve lá.
- **Limitar a regra a algumas finalidades** (só cabeamento, por exemplo). O sinal é a receita, não
  a finalidade; recortar por finalidade só reproduziria o mesmo bug em outra porta.

## Consequências

**Positivas**
- A Wave deixa de repassar serviço que não faturou. No histórico levantado, R$ 3.980,50 em três
  meses.
- A regra é única e vale para toda finalidade — não há brecha nova a cada tipo de serviço.
- Quem tem a informação decide: o técnico contesta, a Wave responde com o contexto da OS.

**Negativas / trade-offs aceitos**
- **Trabalho real vai sair zerado.** Instalações e trocas de drop completas cuja linha veio sem
  receita passam a pagar R$ 0,00 até o técnico contestar. É deliberado: o default vira "não paga",
  e a exceção é decidida caso a caso.
- **Volume de contestações deve subir** no primeiro fechamento após o deploy, com efeito nos
  períodos abertos que forem recalculados.
- O ganho depende do técnico contestar. A nota nas telas existe para que o R$ 0,00 nunca apareça
  como erro silencioso.
