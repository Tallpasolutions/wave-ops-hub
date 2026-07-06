# ADR-010 — Drill-down interativo do dashboard por filtros combináveis na URL

**Status:** Proposto (aguardando validação Gemini — CLAUDE.md §11)
**Data:** 2026-07-04
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** Feedback do gestor 04/07 (`tech-debt.md` D3) — os gráficos do dashboard eram
esperados como interativos; clicar num segmento deveria filtrar o painel.

---

## Contexto

Os gráficos/tabelas do dashboard (tipos de OS, distribuição geográfica, ranking de técnicos,
tipo de atendimento) são hoje estáticos — clicar não faz nada. O gestor espera **drill-down**:
clicar num segmento filtra o painel inteiro por aquela dimensão.

Decisão do usuário (04/07): filtros **combináveis (AND)** — o gestor pode empilhar dimensões
(ex.: finalidade = Suporte Fibra **E** cidade = Brusque **E** técnico = Douglas) e ver todos os
painéis recalculados sobre esse subconjunto.

---

## Decisões

### 1. Estado do filtro na URL (querystring), uma dimensão por parâmetro

Cada dimensão filtrável é um parâmetro de querystring, com **um valor por dimensão**, combinados
por AND:

```
/dashboard?mes=2026-06&finalidade=Suporte+Fibra&cidade=Brusque&tecnico=<uuid>&tipo=Externo
```

- Dimensões v1: `finalidade`, `cidade`, `tecnico` (id), `tipo` (tipo_atendimento).
- Clicar numa segunda finalidade **substitui** o valor de `finalidade` (não acumula OR dentro da
  mesma dimensão — mantém URL e query simples). AND é entre dimensões distintas.
- `mes` (período) é ortogonal e sempre preservado. A URL é a fonte única do estado (sem estado
  client), então é compartilhável e sobrevive a reload — coerente com o `GlobalPeriodSelector`.

### 2. A query do dashboard aplica os filtros; o `aggregate` não muda

A página lê os params e adiciona `.eq()` na query de visitas para cada filtro presente
(`finalidade`, `cidade`, `tecnico_id`, `tipo_atendimento`), somados aos filtros existentes
(`tenant_id`, `fora_escopo=false`, período). O `aggregate` já opera sobre o conjunto que recebe —
**não muda**. Todos os painéis (KPIs, gráficos, tabelas, resumo) refletem o subconjunto
automaticamente.

### 3. Barra de filtros ativos (chips) com limpar

Um componente client mostra os filtros ativos como chips com "×" (remove um) e um "limpar tudo".
Cada ação reescreve a querystring preservando os demais params (inclusive `mes`). Sem filtro, a
barra não aparece.

### 4. Cliques nos gráficos/tabelas navegam (client, preservando a URL)

Cada componente clicável (OsTypeTable→finalidade, GeoDistribution→cidade,
TechnicianRankingTable/TechValueChart→tecnico, AttendanceDonut→tipo) recebe um handler que faz
`router.push` com o param da sua dimensão setado, preservando os demais (helper compartilhado
`setParam(searchParams, key, value)`). Recharts expõe `onClick` nos elementos; tabelas usam
`onClick` na linha. Clicar no valor já ativo remove o filtro (toggle).

### 5. Fora do escopo v1

- OR dentro da mesma dimensão (finalidade IN [A,B]).
- Filtro por dia (VolumeChart) e por motivo (ReasonsFailure) — podem entrar depois.
- Persistência em cookie: desnecessária (URL já carrega o estado; período mantém seu cookie).

---

## Alternativas consideradas

- **Um filtro por vez** (substitui ao clicar noutra dimensão) — rejeitado pelo usuário: perde a
  análise cruzada (finalidade × cidade × técnico).
- **Estado em client/context** em vez de URL — rejeitado: não é compartilhável nem sobrevive a
  reload, e brigaria com o Router Cache (lição da Sprint 13, período via URL).

---

## Consequências

- Dashboard vira ferramenta de análise (drill-down cruzado). Estado 100% na URL → compartilhável,
  reload-safe, testável.
- Toque cirúrgico: só a query da página ganha `.eq()` condicionais + 4 componentes ganham
  `onClick` + 1 barra de chips. `aggregate` e o resto intactos.
- Cuidado: toda navegação (período, chip, clique em gráfico) deve preservar a querystring
  completa — centralizar num helper evita perder params (repetir o bug de staleness da Sprint 13).

---

## Plano de implementação (fases)

1. **Helpers de querystring** (`_lib/filters.ts`, puro + testes): ler filtros da URL, `setParam`
   /`removeParam` preservando os demais.
2. **Query da página**: aplicar os `.eq()` condicionais; passar os filtros ativos aos componentes.
3. **Barra de chips** (`FilterBar`) com remover/limpar.
4. **Cliques**: tornar OsTypeTable, GeoDistribution, TechnicianRankingTable/TechValueChart e
   AttendanceDonut clicáveis (toggle da própria dimensão).
5. **Verificação em produção**: clicar finalidade + cidade → KPIs e demais painéis batem com o
   subconjunto; chips removem; período preservado.

**DoD:** clicar em Suporte Fibra + Brusque filtra todo o painel (números reconciliáveis), chips
removem individualmente e "limpar tudo" zera, `?mes=` nunca se perde. Verificado em produção.
