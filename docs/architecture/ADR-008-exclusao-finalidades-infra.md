# ADR-008 — Exclusão de finalidades de infraestrutura do escopo de payout

**Status:** Aceito
**Data:** 2026-07-03
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** Sprint 12, Fase C — diagnóstico dos payouts `no_rule_match`

---

## Contexto

O diagnóstico dos 248 payouts "sem regra" de junho/2026 revelou que uma parcela grande
(98 visitas, incluindo as 90 de "Projeto Infra") são **ordens de serviço das equipes de
infraestrutura**, não dos técnicos de campo. A explicação de valor da planilha confirma:
"OS infra feita por terceirizada".

Decisão de negócio da Wave (03/07/2026): essas OSs **não são pagas aos técnicos de campo e
não devem contabilizar em nada** no sistema — nem em KPIs, nem em pendências, nem em payouts.
Elas continuam vindo na planilha da Unetvale (que é a fonte única), mas o Wave Ops Hub deve
ignorá-las para fins operacionais e financeiros dos técnicos.

Finalidades de infraestrutura (lista fornecida pela Wave):
`Manutenção Infra`, `Manutenção Programada`, `Ativação Infra`, `Troca de postes`, `Massiva`,
`Adequação de Rede`, `Projeto Infra`, `Viabilidade Infra`, `Notificação Celesc`, `Genérico`,
`Parcial`.

---

## Decisões

### 1. Flag `fora_escopo` na visita, não exclusão na ingestão

**Decisão:** Visitas de finalidade de infraestrutura são **ingeridas normalmente** e marcadas
com `service_visits.fora_escopo = true`. Não são descartadas no ETL.

**Razão:** Manter o registro preserva a auditoria e a reconciliação com a planilha da Unetvale
(o total ingerido bate com o arquivo). Descartar na ingestão criaria uma divergência silenciosa
"planilha tem N linhas, sistema tem N−98" difícil de explicar. A flag deixa a exclusão
explícita e reversível (se a Wave reclassificar uma finalidade, basta recalcular).

**Consequência:** Toda leitura que contabiliza precisa filtrar `fora_escopo = false`. Ver
decisão 3.

### 2. Lista de finalidades por tenant, na config JSONB

**Decisão:** A lista fica em `tenants.config -> 'finalidades_infra'` (array de strings),
seguindo o padrão dos flags existentes (`show_money_on_technician_panel`, `auto_create_reasons`).
Sem tabela nova.

**Razão:** É configuração por tenant, de baixo volume, que muda raramente. O JSONB já existe.
O match é por finalidade normalizada (trim + lower) para tolerar variação de caixa.

**Consequência:** Não há UI para editar a lista nesta fase — é semeada por migration. Uma tela
de configuração fica registrada como débito para quando um segundo tenant precisar.

### 3. Exclusão em duas camadas: payout + leitura

**Decisão:**
- **Payout:** `recalculatePendingPayouts` pula visitas `fora_escopo` — elas **nunca geram
  payout**. A migration remove os payouts de infra já existentes.
- **Leitura:** as superfícies que contabilizam filtram `fora_escopo = false`: dashboard,
  financeiro, receita do fechamento, lista de OSs, perfil do técnico, técnicos não vinculados,
  simulação de LPU. As demais (detalhe de uma OS/visita específica, histórico do upload) não
  filtram — são consultas pontuais/auditoria, não agregados.

**Razão:** Como quase toda tela financeira lê `payouts` (não `service_visits`), remover o payout
já exclui infra da maioria dos lugares automaticamente. O filtro explícito cobre só as telas que
leem `service_visits` direto para contar/somar. Isso minimiza a superfície de mudança e o risco
de esquecer um ponto.

**Consequência:** Uma visita `fora_escopo` existe no banco mas é invisível nos números. O
detalhe de upload continua mostrando a contagem total ingerida (transparência da ingestão),
com nota de quantas são infra.

### 4. Categoria de match da LPU permanece por finalidade + atributos (inalterada)

**Decisão:** Este ADR **não** muda o motor de match da LPU. As finalidades de infra simplesmente
não chegam ao motor (não geram payout). As demais finalidades sem regra que **são** pagas
(Cabeamento/Segundo Ponto, Cabeamento Fibra) exigem match pela explicação de valor (coluna Z),
o que é uma decisão arquitetural separada — será tratada em ADR próprio quando priorizada.

**Consequência:** Após esta mudança, os "sem regra" de junho caem de 248 para ~73, todos do
grupo Cabeamento (o do futuro ADR de match-por-explicação).

---

## Alternativas consideradas

- **Descartar na ingestão:** rejeitada — quebra a reconciliação com a planilha (decisão 1).
- **Status de payout `fora_escopo`:** criar payouts com um status especial em vez de não criar.
  Rejeitada — poluiria a tabela de payouts com linhas que nunca serão pagas e exigiria filtrar
  esse status em todo lugar; não gerar payout é mais limpo.
- **Tabela `finalidades` normalizada com flag:** rejeitada por ora — não há tabela de finalidades
  (é texto livre na visita); criar uma é escopo maior sem ganho imediato para um tenant.

---

## Implementação

- Migration `0013_finalidades_infra.sql`: coluna `fora_escopo`, seed de `config.finalidades_infra`
  para o tenant Wave, backfill das visitas existentes, remoção dos payouts de infra.
- ETL: `normalizer`/`ingestor` setam `fora_escopo` a partir da lista do tenant.
- `recalculate-batch.ts`: pula `fora_escopo`.
- Filtros de leitura nas superfícies que contabilizam (decisão 3).

## Adendo (2026-07-22) — nome real "Infra Genérico"

A lista original tinha `Genérico` e `Parcial` sem prefixo, mas o dado da Unetvale vem como
**`Infra Genérico`** — como o match é exato (trim+lower), a OS passava pelo filtro (ex.: OS 560133
apareceu como `no_rule_match` no fechamento). Migration `0028_finalidade_infra_generico.sql`
adiciona `Infra Genérico` e `Infra Parcial` a `config.finalidades_infra` e remarca os dados
existentes. Como o `ingestor` lê a lista do config, uploads futuros já saem marcados.
