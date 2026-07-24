# Sprint 15 — IQI e Gestão de Produtividade

**Origem:** Demanda do gestor 19/07/2026 — trazer o IQI da Unetvale para o sistema, numa visão
gerencial de produtividade de equipes, e também no app do técnico (visão individual).
**Status:** ✅ **Concluída (2026-07-22)** — Fases A, B e C entregues e em produção. Ver
"Estado final" no fim do documento.
**Depende de:** [ADR-012](../architecture/ADR-012-iqi-ingestao-scraping.md) — hoje **Aceito**
**Regras de execução:** [`regras-de-execucao.md`](./regras-de-execucao.md)

> **Nota de numeração (resolvida em 24/07):** esta demanda nasceu sem slot no roadmap. Ficou como
> **Sprint 15**; os temas antes reservados para 15–19 foram repriorizados no
> [roadmap](./00-roadmap.md#roadmap-pós-estabilização).

---

## Objetivo

1. **Coletar e persistir o IQI** da Unetvale (ADR-012).
2. **Tela gerencial de produtividade**: IQI + métricas internas das planilhas, com gráficos e
   filtros, para gestão das equipes.
3. **IQI no app do técnico**: cada técnico vê apenas o próprio IQI e as próprias métricas de
   produtividade.

## O que já foi verificado (19/07/2026)

- Endpoint IQI, auth, parâmetros e schema de resposta mapeados (ver ADR-012).
- Mapa técnico→id da Unetvale coletado; casa com `technicians.codigo_unetvale`.
- `service_visits`/`service_orders` têm os campos para as métricas internas (finalidade, sucesso,
  improdutiva, reason/categoria, datas, tecnico_id, contrato).
- Não há infra de cron → MVP com sincronização manual.
- Stack de gráfico do projeto: **Recharts** (não introduzir outra lib).
- Padrão de filtros combináveis por querystring já existe (ADR-010) — reaproveitar.

---

## Fases

### Fase A — Coletor e persistência do IQI (`src/lib/iqi/` + migration)

- Migration numerada criando `iqi_snapshots` (esboço no ADR-012) com RLS por tenant e leitura
  do próprio registro pelo técnico.
- `src/lib/iqi/collector.ts`: login autenticado, fetch por técnico (`codigo_unetvale`), parse do
  JSON Highcharts → registros mensais normalizados. **Testes unitários** do parser (fixtures de
  resposta real, sem dados sensíveis) — lógica de domínio exige teste (CLAUDE.md §6).
- Credencial só via env/Vault no servidor (`UNETVALE_USER`, `UNETVALE_PASSWORD`). Técnicos sem
  `codigo_unetvale` são reportados, não quebram a coleta.
- Server Action `sincronizarIqi()` (service role) que orquestra e faz upsert idempotente.
- **Coleta agendada 2x/dia às 08:00 e 20:00 (America/São_Paulo)** via GitHub Actions (ADR-012):
  `.github/workflows/iqi-cron.yml` com `0 11,23 * * *` (UTC = 08:00/20:00 BRT) → `curl` no route
  handler `src/app/api/cron/iqi/route.ts` protegido por `CRON_SECRET`, chamando o mesmo coletor.

**DoD:** o cron dispara às 08:00/20:00 BRT e popula `iqi_snapshots` para os técnicos com
`codigo_unetvale`; a sincronização manual também popula; o `pct_reincidencia` de um técnico/mês
bate com o valor exibido na Unetvale (verificação cruzada).

### Fase B — Tela gerencial de produtividade (grupo `(manager)`)

- Nova rota em `src/app/(manager)/` (ex.: `/produtividade`) + item no `Sidebar`.
- Server Component busca IQI (`iqi_snapshots`) + métricas internas agregadas de `service_visits`:
  OS/dia por técnico, % de sucesso na 1ª visita, improdutivas por categoria (com destaque
  `falha_tecnico` = "deixado na mesa"), volume por finalidade/cidade.
- Gráficos em Recharts: tendência do IQI por técnico (linha), ranking de reincidência, comparativo
  de equipe. Botão "Sincronizar IQI" (dispara Fase A) exibindo `synced_at`.
- Filtros combináveis por querystring reaproveitando o padrão do ADR-010 (período, técnico).

**DoD:** gestor abre `/produtividade`, vê IQI + produtividade por técnico/equipe, filtra por
período/técnico e os painéis reconciliam; screenshot antes/depois no PR.

### Fase C — IQI no app do técnico (grupo `(technician)`)

- Visão individual (ex.: `/meu-iqi` ou seção na home do técnico): tendência do próprio IQI +
  métricas de produtividade individuais (média de OS/dia etc.).
- RLS garante que o técnico só lê o próprio `iqi_snapshots`; agregações cross-RLS (ex.: posição no
  ranking anônimo) via admin client no servidor, como já feito em `(technician)/page.tsx`.
- Exibir `synced_at` e deixar claro que o IQI é **as-of última sincronização** (o dado da Unetvale
  é mensal/raspado — não é tempo real estrito; produtividade vem das planilhas, também periódica).

**DoD:** logado como técnico, a tela mostra apenas o IQI e as métricas daquele técnico, com a data
da última sincronização; nenhum dado de outro técnico é acessível.

---

## Fora do escopo

- Cálculo interno do IQI / conciliação híbrida (opção A rejeitada no ADR-012) — evolução futura.
- Notificações/alertas de IQI ruim.

## Checklist anti-alucinação da sprint

- Colunas só do schema real (`0001_initial_schema.sql` + migrations); `tecnico_id`, não
  `technician_id`; `technicians.nome_completo`.
- Erros PostgREST são silenciosos → checar `error` em toda query.
- `sucesso` comparado com o padrão `startsWith('sim')`, nunca `=== 'Sim'`.
- Verificação cruzada do IQI raspado contra o número exibido na Unetvale antes de fechar DoD.
- `pnpm typecheck` e `pnpm lint` antes de concluir.

## Definition of Done da sprint

- IQI coletado e persistido, reconciliando com a Unetvale.
- Tela gerencial de produtividade no ar (IQI + métricas internas), com filtros.
- App do técnico exibindo IQI + produtividade individual, respeitando RLS.
- Migration numerada aplicada; testes do parser passando; ADR-012 movido para "Aceito".

---

## Estado final (2026-07-22) — DoD fechado

Todas as fases foram implementadas, mergeadas e estão em produção. ADR-012 está **Aceito**.

| Fase | Entrega | Onde |
|---|---|---|
| A | Coletor + persistência (`iqi_snapshots`, RLS por tenant/técnico) | `src/lib/iqi/`, migration `0020_iqi_snapshots.sql` |
| A | Seed de `technicians.codigo_unetvale` + correção do prefixo | migrations `0021`, `0024` |
| A | Agendamento 2x/dia (08:00 e 20:00 BRT) | `.github/workflows/iqi-cron.yml` |
| B | Tela gerencial `/produtividade` (tendência de IQI, tabela por técnico, botão Sincronizar, filtro por técnico) | `src/app/(manager)/produtividade/` |
| C | `/iqi` no app do técnico (só o próprio, com `synced_at`) | `src/app/(technician)/iqi/` |
| — | Análise pura + testes (`buildIqiTrend`, `iqiByTecnico`, `teamIqi`, `iqiLevel`/`iqiTone`) | `src/lib/iqi/analytics.ts`, `tone.ts`, `__tests__/` |

### Desvios do plano original (e por quê)

1. **A coleta não roda mais na Vercel.** A Unetvale bloqueia os IPs de datacenter da Vercel:
   100% das requisições estouravam o timeout, o cron dava 504 e o botão "Sincronizar" girava sem
   fim. A coleta passou a rodar **no runner do GitHub Actions** (`scripts/collect-iqi.ts`,
   gravando com service role) e o botão apenas **dispara** o workflow via `workflow_dispatch` —
   a sincronização é assíncrona e a tela reflete no load seguinte. A route `/api/cron/iqi` foi
   removida. Detalhes e envs novos (`GITHUB_DISPATCH_TOKEN`) no adendo do ADR-012.
2. **Timeout por requisição e coleta paralela** foram necessários antes disso: uma única
   requisição pendurada travava a sincronização inteira.
3. **Filtro por técnico** em `/produtividade` entrou como ajuste de uso já na mesma sprint.

### Fora do escopo (mantido)

- Cálculo interno do IQI / conciliação híbrida (opção A rejeitada no ADR-012).
- Notificações/alertas de IQI ruim.
