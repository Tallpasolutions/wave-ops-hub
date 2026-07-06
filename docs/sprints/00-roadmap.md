# Roadmap de Sprints — Wave Ops Hub

> Plano de execução do projeto. Cada sprint tem escopo travado, entregas concretas e lista do que NÃO entra (anti-scope-creep).

---

## Visão geral

| Sprint | Nome | Duração estimada | Foco | Status |
|---|---|---|---|---|
| 0 | Setup | 1 semana | Fundação técnica, identidade visual, layout shell | ✅ Concluída |
| 1 | Multi-tenant + Acesso | 1 semana | Auth, roles, subdomain routing, portal Tallpa Admin | ✅ Concluída |
| 2 | Ingestão (ETL) | 1 semana | Upload, parser, idempotência, audit log | ✅ Concluída |
| 3 | LPU + Motivos | 1 semana | Motor de regras, configuração de motivos, simulação | ✅ Concluída |
| 4 | Payouts | 1 semana | Cálculo automático, "deixado na mesa", fechamento | ✅ Concluída |
| 5 | Portais | 1.5 semanas | Dashboard manager (replicando HTML), portal técnico | ✅ Concluída |
| 6 | Polish | 0.5 semana | Testes E2E, ajustes, deploy, onboarding Wave | ✅ Concluída (2026-06-05) |
| 7 | ETL & Dados | 0.5 semana | Normalização de acentos, combobox LPU, explicação valor | ✅ Concluída (2026-06-29) |
| 8 | Improdutivas | 0.5 semana | Tela de aprovação, sheet de motivos, UX Wave | ✅ Concluída (2026-06-30) |
| 9 | Supervisor | 1 semana | LPU por técnico, role supervisor, portal Minha Equipe | ✅ Concluída (2026-07-01) |
| 10 | Hotfixes + LPU Wave | 1 sessão | `nome_completo`, conflitos LPU, processo Git Flow | 🔄 Em andamento — 10-A mergeado; 10-B absorvido pelas Sprints 11–12 |
| 11 | Estabilização Crítica (P0) | 2–4 sessões | Sessão Supabase, varredura `technicians(nome)`, recalcular 503, fechamento zerado | ✅ Concluída (2026-07-03, verificada em produção) |
| 12 | Dados Confiáveis | 3–4 sessões | Encoding ETL, vínculo de técnicos, cobertura LPU, guard rails de aprovação | ✅ Concluída (2026-07-04, verificada em produção) |
| 13 | UX e Consistência | 3 sessões | Período inteligente, números reconciliados, busca+paginação, rejeição em lote | ✅ Concluída (2026-07-04) — Fases A–D verificadas em produção |
| 14 | Acabamento | 1–2 sessões | Último acesso, cosméticos S1–S6, QA de regressão final | ✅ Concluída (2026-07-04) — A/B/C verificadas em prod; QA de regressão do relatório 02/07 refeito sem regressões. **Ciclo de estabilização pós-QA (11→14) encerrado** |

**Sprints 11–14 nascem do [Relatório de QA em produção de 02/07/2026](../qa/2026-07-02-relatorio-qa-producao.md).**
A execução de qualquer sprint segue as [Regras de Execução Anti-Alucinação](./regras-de-execucao.md) — documento vinculante.

**Total estimado (0–9):** ~7 semanas (com folga, ~8-9 semanas em ritmo realista solo)

---

## Princípios

1. **Cada sprint termina com algo demonstrável.** Mesmo que não esteja completo, há um fluxo end-to-end utilizável.

2. **Escopo travado = aprovação fechada.** Mudanças no escopo da sprint atual exigem renegociação explícita, com ajuste do prazo.

3. **Definition of Done** uniforme:
   - Código revisado, lintado (`pnpm lint`), tipado (`pnpm typecheck`)
   - Testes para a lógica de domínio passando
   - Commit message conforme Conventional Commits
   - Documentação atualizada (ADR/glossário/domain se aplicável)
   - Deploy em ambiente de staging funcionando
   - Validação cruzada com Gemini (checklist em `docs/validation/`)

4. **Sem big bang final.** A cada sprint, deploy em staging e teste com dados reais (planilha existente da Wave de abril/2026).

5. **Regras anti-alucinação são vinculantes.** Toda sessão de execução de sprint segue
   [`regras-de-execucao.md`](./regras-de-execucao.md): evidência antes de afirmação, grep
   completo antes de declarar bug corrigido, verificação em produção antes de fechar DoD,
   e seção "Estado verificado" atualizada em cada fase.

6. **Bug reportado em produção só fecha verificado em produção.** Typecheck verde e teste
   local passando não fecham item de QA.

---

## Sprint 0 — Setup [`01-sprint-0-setup.md`](./01-sprint-0-setup.md)

**Status:** Concluída (infra local + dev Supabase prontos; GitHub/Vercel/staging pendentes mas não bloqueadores)

**Entregas concluídas:**
- Stack instalada e validada (`pnpm install`, `lint`, `typecheck`, `build`, `dev` — todos passando)
- CI workflow criado (`.github/workflows/ci.yml`)
- Schema Drizzle + migration 0001 aplicada no Supabase dev
- Identidade visual completa (tokens, fonts, layout shell)
- Tela `/login` com visual correto
- Primitivos shadcn/ui instalados (Button, Input, Card, Label, Select, Badge, etc.)
- Projeto Supabase dev criado + credenciais em `.env.local`
- Documentação base (sprints, ADRs, domain docs)

**Pendentes não-bloqueadores (executar quando conveniente):**
- Criar repo GitHub + branch protection
- Criar projeto Supabase staging
- Criar bucket `uploads` com policies
- Configurar Vercel + Cloudflare wildcard
- Aplicar seed inicial
- Validação Gemini

**Dependências externas:** nenhuma.

---

## Sprint 1 — Multi-tenant + Acesso [`02-sprint-1-multi-tenant.md`](./02-sprint-1-multi-tenant.md)

**Status:** Concluída (2026-05-30)

**Entregas concluídas:**
- Middleware de subdomínio + tenant resolution
- Auth completo (login, logout, forgot-password, reset-password, first-access)
- JWT custom claims (`app_role`, `tenant_id`, `technician_id`) via Auth Hook
- Login end-to-end funcionando (client-side `createBrowserClient`, sem race condition)
- Session exchange cross-subdomain via `/auth/callback` (tallpa_owner em localhost)
- Layout guards por role (admin, manager, technician)
- RLS em todas as tabelas + GRANTs (migrations 0001–0005)
- `getCurrentUser()` + `getUserRole()` com `React.cache()`
- Portal Admin: sidebar, dashboard KPIs, CRUD tenants, CRUD usuários
- Portal Manager: sidebar, dashboard placeholder, equipe, técnicos
- Portal Técnico: layout mobile-first, `/profile` com dados reais
- Testes E2E Playwright: fluxos de login por role, proteção de rotas

**Dependências:** Sprint 0.

---

## Sprint 2 — Ingestão [`03-sprint-2-etl.md`](./03-sprint-2-etl.md)

**Status:** Código concluído (Etapas 1–6 — 2026-05-31) · Pendente: teste com dados reais + Validação Gemini

**Concluído:**
- ✅ Schema Drizzle: `uploads`, `reasons`, `service-orders`, `service-visits` com types completos
- ✅ Storage: migration `0006_storage_bucket.sql` criada e **aplicada no Supabase dev** — bucket ativo
- ✅ UI de upload: `/uploads`, `/uploads/new`, `/uploads/[id]` — drag-and-drop, hash client-side, signed URL, estados por fase
- ✅ Sidebar do Portal Manager atualizado com item "Uploads"
- ✅ Lib ETL completa: 9 módulos em `src/lib/etl/`, 28 testes Vitest passando, typecheck e lint limpos
- ✅ `vitest.config.ts` configurado na raiz do projeto
- ✅ `processUpload` real: baixa do Storage, chama `ingestor.run()`, retorna `IngestResult`
- ✅ Card `Ignoradas` adicionado à página de detalhe do upload (evidencia deduplicação)
- ✅ Deduplicação em duas camadas: `file_hash` (binário) + `content_hash` por linha
- ✅ Vinculação de técnicos não matchados: `linkTechnicianRaw` + `LinkTechnicianForm` + redirect pré-preenchido para cadastro
- ✅ Motivos pendentes exibidos em `/uploads/[id]` (informativo, classificação na Sprint 3)
- ✅ Auditoria: trigger `trg_visits_audit_changes` (já existia em 0001) + página `/uploads/[id]/audit` com diff before/after por visita

**Pendente (não-bloqueador para Sprint 3):**
- ⏳ Teste com planilha real `lista-os-Wave-Abril-2026.xlsx` (validação do DoD)
- ⏳ Validação Gemini

**Dependências:** Sprints 0 e 1.

---

## Sprint 3 — LPU + Motivos [`04-sprint-3-lpu.md`](./04-sprint-3-lpu.md)

**Status:** Concluída (2026-06-01) · Pendente não-bloqueador: teste com planilha real + Validação Gemini

**Concluído:**
- ✅ CRUD de motivos: `/motivos` (lista + filtros) e `/motivos/[id]/edit` (categorização, improdutiva, valor override)
- ✅ Sidebar do Manager atualizado com itens "Motivos" e "LPU"
- ✅ Schema Drizzle LPU: `src/db/schema/lpus.ts` + `lpu-rules.ts` + `index.ts` (10 tabelas)
- ✅ `lpus`, `lpu_rules`, `lpu_rules_audit` já existiam em `0001_initial_schema.sql` — sem migration nova
- ✅ Lib `src/lib/lpu/`: match engine, calculate-payout, simulator, conflicts, schemas Zod — 24 testes (52 total)
- ✅ Telas de LPU: `/lpu`, `/lpu/new`, `/lpu/[id]`, `/lpu/[id]/rules/new`, `/lpu/[id]/rules/[ruleId]/edit`
- ✅ 6 Server Actions: `createLpu`, `activateLpu`, `createLpuRule`, `updateLpuRule`, `deactivateLpuRule`, `duplicateLpuRule`
- ✅ Builder de conditions (11 campos, 5 tipos de input) + builder de payout (3 tipos) + detecção de conflitos de prioridade
- ✅ Tela de simulação: `/lpu/[id]/simulate` — KPIs de visitas + KPIs financeiros + distribuição por técnico + visitas sem regra + chips de período (6 meses)

**Pendentes não-bloqueadores (para Sprint 4):**
- ⏳ Teste com planilha real `lista-os-Wave-Abril-2026.xlsx` (validação DoD Sprint 2 e 3)
- ⏳ Validação Gemini
- ⏳ Auto-criação de motivos com notificação no painel (adiado — fora do escopo MVP da Sprint 3)

**Dependências:** Sprint 2.

---

## Sprint 4 — Payouts [`05-sprint-4-payouts.md`](./05-sprint-4-payouts.md)

**Status:** Concluída (2026-06-01)

**Concluído:**
- ✅ Schemas Drizzle: `payouts`, `monthly_closings`, `notifications`, `payouts_audit` (13 tabelas no total)
- ✅ Lib `src/lib/payouts/`: `calculate.ts`, `recalculate-batch.ts`, `closing.ts`, `reports.tsx`, `index.ts` — 14 testes unitários (66 total)
- ✅ Recálculo automático wirereado: `processUpload`, `activateLpu`, `updateReason`, `linkTechnicianRaw`
- ✅ Invariante crítica: `approved`/`paid` nunca recalculados automaticamente
- ✅ Telas: `/payouts` (lista + pendências críticas + chips de período), `/payouts/[id]` (detalhe + auditoria), `/payouts/[id]/override` (form override)
- ✅ Override manual com `valor_calculado` preservado para auditoria
- ✅ Lifecycle completo de fechamento: `solicitarAprovacao`, `aprovarFechamento`, `marcarComoPago`, `reabrirFechamento`
- ✅ Telas: `/fechamento` (cards por período), `/fechamento/[periodo]` (KPIs + tabela por técnico + ações condicionais)
- ✅ Export Excel: `/fechamento/[periodo]/export/excel` (3 sheets)
- ✅ Export PDF consolidado: `/fechamento/[periodo]/export/pdf`
- ✅ Export PDF individual: `/fechamento/[periodo]/export/pdf/[tecnicoId]`
- ✅ Notificações para técnicos na aprovação e no pagamento
- ✅ Sidebar atualizada: Payouts + Fechamento

**Dependências:** Sprint 3.

---

## Sprint 5 — Portais [`06-sprint-5-portals.md`](./06-sprint-5-portals.md)

**Status:** Concluída (código completo — 2026-06-03)

**Entregas concluídas:**
- ✅ Dashboard executivo com 11 componentes (KPIs, gráficos, ranking, distribuição geográfica, resumo executivo)
- ✅ Drill-downs: `/oss`, `/oss/[osNum]`, `/visitas/[id]`, `/equipe/tecnicos/[id]`
- ✅ Tela financeira: `/financeiro` (4 KPIs, gráfico 6 meses, tabelas por finalidade e técnico)
- ✅ Filtros globais de período (`GlobalPeriodSelector` na topbar, persiste via URL querystring)
- ✅ Portal do técnico (4 telas mobile-first): home, visitas, histórico, perfil
- ✅ Notificações no UI: `NotificationBell` em todos os portais com badge, dropdown e mark-as-read
- ✅ Empty states reutilizáveis: componente `EmptyState` com variants page/card
- ✅ Loading skeletons: 12 arquivos `loading.tsx` em todas as telas com dados assíncronos
- ✅ 66/66 testes passando · typecheck ✅ · lint ✅

**Dependências:** Sprint 4.

---

## Sprint 6 — Polish [`07-sprint-6-polish.md`](./07-sprint-6-polish.md)

**Entregas:**
- Cobertura de testes E2E nos fluxos críticos
- Ajustes visuais finais
- Documentação de uso para Wave
- Onboarding ao vivo
- Deploy em produção (`wave.tallpa.com.br`)

**Dependências:** Sprint 5.

---

## Sprints 10–14 — Ciclo de estabilização pós-QA

| Sprint | Arquivo | Resumo |
|---|---|---|
| 10 | [`11-sprint-10-hotfixes.md`](./11-sprint-10-hotfixes.md) | Hotfix `nome_completo` (parcial — 3 de 9 ocorrências), conflitos LPU, retomada do Git Flow. Etapa 10-B (LPU Wave + diagnóstico sem regra) foi absorvida pelas Sprints 11 (recalcular) e 12 (cobertura LPU) |
| 11 | [`12-sprint-11-estabilizacao.md`](./12-sprint-11-estabilizacao.md) | **P0.** Sessão Supabase (refresh token race), varredura completa `technicians(nome)` (corrige 404 do pagamento e fechamento zerado), recalcular pendentes sem 503, financeiro sem contradições |
| 12 | [`13-sprint-12-dados-confiaveis.md`](./13-sprint-12-dados-confiaveis.md) | Encoding do ETL + normalização dos dados gravados, vínculo assistido de técnicos (72% sem vínculo), cobertura LPU dos "sem regra", guard rails de aprovação/rejeição |
| 13 | [`14-sprint-13-ux-consistencia.md`](./14-sprint-13-ux-consistencia.md) | Período default inteligente e persistente, reconciliação de contagens (OSs × visitas, ticket médio), busca + paginação, rejeição em lote, taxonomia única |
| 14 | [`15-sprint-14-acabamento.md`](./15-sprint-14-acabamento.md) | Último acesso, cosméticos S1–S6, QA de regressão completo fechando o ciclo |

**Ordem obrigatória: 11 → 12 → 13 → 14.** A Sprint 12 depende do recálculo em lote (11-C);
a 13 depende dos dados saneados; a 14 fecha com reteste integral do relatório de QA.

---

## Roadmap pós-estabilização (Sprints 15+, a repriorizar após a 14)

**Prioritárias (nascidas de achados recentes):**

| Sprint | Tema | Itens |
|---|---|---|
| ~~A~~ | ~~**Match LPU por explicação de valor**~~ | ✅ **Concluída (04/07)** — ADR-009: em vez de match automático, **classificação pelo gestor** por padrão de coluna Z (`/cabeamento` → valor da LPU → recálculo). Fases 1–4 implementadas e deployadas; motor de LPU intacto. Migration 0015 aplicada. Falta só o gestor classificar os 10 padrões para os ~31 saírem de `no_rule_match` |
| ~~B~~ | ~~**Dashboard & Interatividade**~~ | ✅ **Concluída e verificada em prod (04/07)** — D1 cards não estouram (grid 1→4 col + valor responsivo); D2 copy dos cards; D3 **drill-down interativo** (ADR-010): clicar em finalidade/cidade/técnico/tipo filtra o painel, filtros combináveis AND, estado na URL. Verificado: Suporte Fibra + Brusque filtra tudo reconciliando (194 OSs / R$ 18.317,60), chips removem, período preservado |
| ~~C~~ | ~~**ETL: parse de valores com vírgula de milhar**~~ | ✅ **Concluída (04/07)** — `parseBrNumber` (`src/lib/etl/number.ts`): "4.688,83" não zera mais, "1.000"→1000. Ligado no schema `Valor`. Visitas já ingeridas e zeradas precisam de re-upload para corrigir |

**Herdadas do planejamento anterior à Sprint 10:**

| Sprint | Tema | Itens |
|---|---|---|
| 15 | LPU Phase 2 + Texto | Campo `explicacaoValor` no ETL → pontos, cordoalha, homologação |
| 16 | Feriados + Políticas | +15% feriados, calendário SC/Unetvale |
| 17 | Wave Onboarding completo | Usuários reais, rotina mensal de planilha + fechamento assistido |
| 18 | Contestação Técnico | Portal técnico: contestar payout + workflow de aprovação |
| 19 | Notificações | WhatsApp/push payout aprovado, improdutiva classificada |

---

## Fora deste roadmap (fase 2 — pós-MVP)

- Contestação de payouts pelos técnicos
- Domínio customizado por tenant (`portal.wavetelecom.com.br`)
- Customização de cores por tenant
- MFA/2FA
- Integração PIX para pagamento direto
- Mobile app nativo (técnicos)
- API pública para integração
- Reclame Aqui API (avaliado separadamente)
- Notificações push / WhatsApp
- Bot Telegram para gestão básica
- IA para sugerir LPU baseado em histórico
- Multi-cliente para Tallpa (Scooby como segundo tenant)
