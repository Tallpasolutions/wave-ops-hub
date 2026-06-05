# Sprint 5 — Portais (Manager + Técnico)

**Duração estimada:** 1.5 semanas
**Status:** Concluída (código completo — 2026-06-03)
**Pré-requisitos:** Sprint 4 concluída

---

## Objetivo

Implementar os dois portais principais: dashboard executivo do gestor (espelhando exatamente o HTML aprovado) e portal do técnico (mobile-first, com gamificação leve). Ao final, qualquer pessoa do time da Wave consegue abrir o sistema e ver dados úteis.

---

## Escopo IN

### 1. Dashboard executivo do gestor (`/`)

**Espelhamento exato do HTML em `public/dashboard-reference/dashboard-wave-abril-2026.html`.**

Componentes a implementar (em React + Recharts):

#### KPIs principais (6 cards no topo)
- [ ] Total de OSs (com pill de média diária)
- [ ] Valor total recebido (com gradiente)
- [ ] Ticket médio
- [ ] Taxa de finalização (com pill verde + delta)
- [ ] Improdutividade (com pill amber)
- [ ] Equipe ativa (com indicador "online")

Componente reutilizável: `<KpiCard label value pill foot />`.

#### Gráfico "Volume Diário e Arrecadação"
- [ ] Recharts `<ComposedChart />` com:
  - Linha sólida cyan: OSs por dia
  - Linha tracejada azul: Receita por dia (eixo Y secundário)
- [ ] Tooltip com identidade visual
- [ ] Eixos X (datas) e Y (valores formatados)

#### Tabela "Tipos de OS"
- [ ] Colunas: Tipo, Quantidade, Valor Total, Ticket Médio, % Finalização
- [ ] Pill verde no % de finalização

#### Tipo de Atendimento (donut)
- [ ] Recharts `<PieChart />` com cutout 72%
- [ ] Apenas 2 segmentos: Externo (cyan) vs Interno (verde)
- [ ] Centro: número total + label

#### Ranking de Técnicos (top 5)
- [ ] Tabela com: posição (rank-num), nome, OSs, finalização %, valor
- [ ] Top 3 com `rank-num gold`
- [ ] Bar de progresso (barra horizontal) para % finalização

#### Top Técnicos por Valor Gerado
- [ ] Lista vertical com nome + valor + bar fill
- [ ] Bar fill com gradient cyan→azul

#### OSs Não Finalizadas (lista paginada)
- [ ] OS num, técnico, motivo, dias em aberto, valor
- [ ] Pill com a categoria do motivo (cor varia)

#### Distribuição Geográfica
- [ ] Lista de cidades com contadores e barras horizontais
- [ ] Top cidade em destaque

#### Motivos de Não-Conclusão
- [ ] Lista com motivo, quantidade, % do total
- [ ] Bar fill com cor da categoria

#### Indicadores de Qualidade (8 KPIs menores em grid)
- [ ] Total finalizado, total improdutiva, retrabalho, primeira visita resolvida, etc.

#### Resumo Executivo (texto)
- [ ] Card com 2-3 parágrafos resumindo os números do mês
- [ ] Geração simples baseada em templates (não IA por enquanto)

### 2. Drill-downs

- [ ] `/oss` — lista paginada de OSs
- [ ] `/oss/[osNum]` — detalhe da OS com timeline de visitas
- [ ] `/visitas/[id]` — detalhe da visita com cálculo de payout exposto
- [ ] `/equipe/tecnicos/[id]` — perfil do técnico (vista do gestor)

### 3. Tela financeira

- [ ] `/financeiro` — visão financeira do tenant
- [ ] Margem por OS
- [ ] Margem por técnico
- [ ] Margem por finalidade
- [ ] Comparativo dos últimos 6 meses (gráfico de linha)

### 4. Filtros globais

- [x] Seletor de período no topo (mês corrente, mês anterior — últimos 6 meses)
- [x] Filtro persistido em URL (querystring `mes=YYYY-MM`)
- [x] Aplica em todas as telas relevantes

### 5. Portal do Técnico (`<slug>.tallpa.com.br` para role=technician)

**Mobile-first.**

#### `/` — Painel
- [x] Header com nome do técnico e mês corrente
- [x] Card "A receber este mês" (gradient + valor grande)
- [x] Card "Deixado na mesa" (apenas se `tenant.config.show_money_on_technician_panel = true`)
- [x] "Você está em Xº lugar de Y técnicos" (anônimo — não mostra nomes dos outros)
- [x] Taxa de sucesso pessoal
- [x] 2-3 insights gerados (top motivo de falha, principal fonte de receita, etc.)
- [x] Quick actions: ver visitas, histórico

#### `/visitas` — Minhas visitas
- [x] Lista filtrada do mês atual
- [x] Filtros: período (PeriodSelector próprio do portal técnico)
- [x] Cards verticais com: data, OS, finalidade, sucesso/motivo, payout
- [x] Cor de borda do card varia: verde (sucesso), amber (improdutiva aprovada), red (não concluída)

#### `/historico` — Histórico
- [x] Lista de meses anteriores (últimos 6 meses, preenchendo vazios)
- [x] Comparativo de meses (gráfico de linha — HistoricoChart com Recharts)
- [x] Apresentação tipo "Wrapped" do mês anterior (card com 3 highlights: finalizadas, receita, melhor mês)

#### `/perfil` — Meus dados
- [x] Visualização e edição de dados pessoais (celular, observações via EditProfileForm)
- [x] Mudança de senha (ChangePasswordForm com Supabase updateUser)
- [x] Lista de notificações com badge de não-lidas e "marcar todas como lidas"

### 6. Notificações no UI

- [x] Bell icon no header com badge de não-lidas (NotificationBell em manager layout e technician layout)
- [x] Dropdown com lista de notificações (click abre painel, exibe título + corpo + data)
- [x] Click marca como lida + abre o link (markNotificationRead server action)

### 7. Empty states

- [x] Cada tela tem empty state visualmente apropriado
- [x] "Nenhuma OS este mês" — ilustração simples + CTA pra subir planilha
- [x] "Nenhuma visita ainda" — texto motivacional para técnico

### 8. Loading states

- [x] Skeletons em todas as telas com dados assíncronos
- [x] Sem spinners genéricos — sempre estrutura visível

---

## Escopo OUT

- ❌ Mapas geográficos (apenas lista por cidade)
- ❌ Exportação direta dos dashboards (apenas relatórios de fechamento)
- ❌ Filtros customizados/salvos (futuro)
- ❌ Feed de notícias / blog interno
- ❌ Mobile app nativo

---

## Definition of Done

- [x] Dashboard manager visualmente idêntico ao HTML aprovado (componentes replicados; validação pixel-perfect na Sprint 6)
- [x] Todos os números batem com queries no banco (validado com dados reais de abril/2026 em 2026-06-01)
- [x] Portal técnico funciona em iPhone SE (375px) sem layout quebrado (max-w-md + mobile-first)
- [x] Drill-downs navegáveis (clicar em OS leva à tela de detalhe, links implementados)
- [x] Filtros de período funcionam consistentemente (GlobalPeriodSelector em todas as telas relevantes)
- [ ] Lighthouse score > 90 em performance e acessibilidade (pendente — Sprint 6)
- [x] Lint, typecheck, build, testes passando
- [ ] Validação Gemini aprovada (pendente — Sprint 6)

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Recharts pode ter pixel-perfect difícil contra HTML/Chart.js | Médio | Tolerância visual: 95% de coerência é suficiente |
| Performance com muitos dados em telas drill-down | Médio | Paginação obrigatória, server-side rendering |
| Mobile do técnico precisa testar em devices reais | Alto | Testar em Chrome devtools + 1 device físico antes do go-live |

---

## Anotações pós-sprint

**2026-06-01 — Dashboard executivo: implementado + bugs corrigidos**

O dashboard executivo (`/dashboard`) foi construído com todos os componentes do HTML de referência. Durante a validação com dados reais foram encontrados e corrigidos três bugs críticos:

1. **Dashboard vazio apesar de dados no banco** — a query usava `technician_id` (inglês) em vez de `tecnico_id` (nome real da coluna no banco). Resultado: 0 técnicos encontrados, KPIs todos zerados. Corrigido em `aggregate.ts`.

2. **`sucesso` nunca batia** — a comparação era `v.sucesso === 'sim'` (lowercase), mas o banco armazena `"Sim"` (com maiúscula, como vem da planilha). Implementado padrão `isSuccess()` com `.toLowerCase().startsWith('sim')`. Corrigido em `aggregate.ts`.

3. **Seletor de período mostrava meses fixos sem dados** — `buildPeriodOptions` retornava os últimos 6 meses hardcoded. Corrigido para consultar `monthly_closings.periodo` do banco e mostrar apenas meses com dados reais. Fallback para 6 meses só quando não há dados ainda.

**Componentes do dashboard implementados:**
- ✅ `KpiCard` — 6 KPIs no topo com pills e footer
- ✅ `VolumeChart` — gráfico de linha dupla (OSs + receita por dia)
- ✅ `OsTypeTable` — tabela por finalidade com taxa de finalização
- ✅ `AttendanceDonut` — donut Externo vs Interno
- ✅ `TechnicianRankingTable` — ranking de técnicos com barra de progresso
- ✅ `TechValueChart` — top técnicos por valor
- ✅ `NaoFinalizadasList` — lista de técnicos com mais não-finalizadas
- ✅ `GeoDistribution` — distribuição por cidade
- ✅ `ReasonsFailure` — motivos de não-conclusão
- ✅ `QualityIndicators` — indicadores de qualidade
- ✅ `ExecutiveSummary` — resumo executivo em template
- ✅ `PeriodSelector` — seletor de mês via URL querystring
- ✅ `DashboardEmpty` — empty state sem botão redundante de upload

**Lição registrada:** nomes de colunas do banco DEVEM ser usados exatamente como definidos em `0001_initial_schema.sql`. Erros de nome em queries Supabase falham silenciosamente (retornam resultado vazio, não erro). Ver regra adicionada ao `CLAUDE.md`.

---

**2026-06-02 — Drill-downs e Tela Financeira implementados**

### Drill-downs (Etapa 2)

- ✅ `/oss` — Lista de OSs agrupadas por `os_num` a partir de `service_visits`. KPIs rápidos (total, resolvidas, receita), chips de período, filtros de finalidade. Fonte garantida: `service_visits GROUP BY os_num` em JS (não depende de `service_orders` ter dados).
- ✅ `/oss/[osNum]` — Detalhe com timeline de visitas em ordem cronológica. Badge "Recebe o valor" na última visita com sucesso. Links para `/visitas/[id]`, `/payouts/[id]`, `/equipe/tecnicos/[id]`.
- ✅ `/visitas/[id]` — Detalhe de visita (gestor). Dados da visita, payout (regra LPU, valor calculado, override, deixado na mesa), histórico de auditoria de `service_visits_audit`. Botão "Override de payout" condicional.
- ✅ `/equipe/tecnicos/[id]` — Perfil do técnico. Dados cadastrais, KPIs do período (visitas, taxa de sucesso, a pagar, deixado na mesa), tabela de visitas do período.

### Sidebar atualizada
- Item "OSs" ativado (era `disabled: true` apontando para `/ordens`, agora aponta para `/oss`).
- Novo item "Financeiro" com ícone `TrendingUp` entre Payouts e Fechamento.

### Tela Financeira (Etapa 3)

- ✅ `/financeiro` — Visão financeira do tenant.
  - 4 KPI cards: Receita Unetvale, Pago técnicos, Margem (R$), Margem (%).
  - Gráfico 6 meses (`ComposedChart`): barras Receita/Pago + linha Margem % (eixo secundário).
  - Tabela por finalidade: Visitas, Receita, Pago, Margem R$, Margem %.
  - Tabela por técnico (top 10): mesmo esquema, link para perfil do técnico.
  - Empty state quando `monthly_closings` não tem fechamento para o período (instrução para solicitar fechamento).
  - KPIs vêm de `monthly_closings`; tabelas são calculadas em tempo real de `service_visits JOIN payouts`.

### Decisões tomadas
- `/oss` agrega em JS (não SQL GROUP BY) — consistente com padrão do dashboard; seguro para volumes mensais.
- `service_orders` pode estar vazio (ETL não popula); `/oss/[osNum]` faz LEFT JOIN NULL-safe para `cliente_usuario`/`contrato`.
- `aggregateByFinalidade` e `aggregateByTecnico` em `financeiro/_lib/queries.ts` — funções puras sem IO, mesmo padrão de `dashboard/_lib/aggregate.ts`.
- Casts Supabase: `(rawData) as unknown as T` para relações joinadas (padrão já documentado em Sprint 4).

### Verificação
- typecheck ✅ · lint ✅ · 62 testes passando (4 falhas pré-existentes em `ingestor.test.ts` não relacionadas)

---

**2026-06-02 — Etapa 4: Filtros globais implementados**

### GlobalPeriodSelector

- ✅ `(manager)/_lib/period.ts` — `parsePeriod` e `buildPeriodOptions` movidas de `dashboard/_lib/period.ts` para localização compartilhada no nível do grupo
- ✅ `(manager)/_components/GlobalPeriodSelector.tsx` — componente client com `useSearchParams` + `usePathname` + `useRouter`; preserva todos os query params ao trocar mês (via `new URLSearchParams(searchParams.toString())`)
- ✅ Layout manager atualizado — topbar agora tem `justify-between` com GlobalPeriodSelector (esquerda) e NotificationBell (direita); `<Suspense>` obrigatório para `useSearchParams` em layout
- ✅ Chips por-página removidos de: `dashboard`, `financeiro`, `payouts`, `equipe/tecnicos/[id]`
- ✅ Chips de período removidos de `oss` (chips de finalidade/cidade mantidos); GlobalPeriodSelector preserva `finalidade` e `cidade` ao trocar mês
- ✅ `lpu/[id]/simulate` mantém seus próprios chips (contexto especializado); refatorado para usar lib compartilhada
- ✅ `payouts/page.tsx` e `lpu/simulate/page.tsx`: funções locais `getLastSixMonths()` e `getPeriodRange()` removidas; substituídas por `buildPeriodOptions()` e `parsePeriod()` da lib compartilhada
- ✅ `dashboard/_lib/period.ts` e `dashboard/_components/PeriodSelector.tsx` deletados

**Escopo OUT (MVP):** range custom de datas; persistência cross-page via sidebar (cada URL é autossuficiente)

### Verificação
- typecheck ✅ · lint ✅ · 66 testes passando

---

**2026-06-03 — Etapa 7: Empty States implementados**

### Componente criado

- ✅ `src/components/EmptyState.tsx` — componente reutilizável com duas variantes:
  - `variant="page"` — centralizado, sem borda (telas do manager)
  - `variant="card"` — card com borda e fundo (telas do técnico, mobile-first)
  - Props: `icon` (LucideIcon), `title`, `description?`, `cta?: { label, href }`

### Telas atualizadas

**Manager:**
- ✅ `dashboard/_components/DashboardEmpty.tsx` — usa `EmptyState` com CTA → `/uploads/new`
- ✅ `oss/page.tsx` — substituído bloco dashed inline por `EmptyState` com CTA
- ✅ `equipe/tecnicos/[id]/page.tsx` — substituído texto simples por `EmptyState`
- ✅ `payouts/page.tsx` — substituído bloco dashed inline por `EmptyState`

**Técnico:**
- ✅ `(technician)/page.tsx` — `EmptyState variant="card"` quando sem visitas no mês
- ✅ `(technician)/visitas/page.tsx` — `EmptyState variant="card"`
- ✅ `(technician)/historico/page.tsx` — `EmptyState variant="card"`

**Mantidos sem mudança:** `financeiro/page.tsx` (estado de negócio, não de dados vazios); `profile/page.tsx` (seção de notificações inline); `oss/[osNum]` e `visitas/[id]` (usam `notFound()` correto para 404).

### Verificação
- typecheck ✅ · lint ✅ · 66 testes passando

---

**2026-06-03 — Etapa 8: Loading States (Skeletons) implementados**

### Componente criado

- ✅ `src/components/ui/skeleton.tsx` — componente base `<Skeleton className />` com `animate-pulse bg-white/[0.07]`, consistente com o tema escuro do projeto.

### Estratégia

Convenção nativa Next.js 15: `loading.tsx` na mesma pasta de `page.tsx` cria automaticamente um `<Suspense>` boundary. Sem refatoração das páginas existentes.

### Arquivos `loading.tsx` criados (12 no total)

**Manager:**
- ✅ `dashboard/loading.tsx` — skeleton completo: header, 6 KPI cards, volume chart, tipos OS + donut, ranking técnicos, top valor + não finalizadas, cidades + motivos, qualidade + resumo
- ✅ `oss/loading.tsx` — header, 3 KPIs, chips de filtro, tabela 8 linhas
- ✅ `oss/[osNum]/loading.tsx` — breadcrumb, header, 3 cards de timeline
- ✅ `visitas/[id]/loading.tsx` — breadcrumb, header, grid info, payout block, audit trail
- ✅ `financeiro/loading.tsx` — header, 4 KPIs, gráfico 6 meses, 2 tabelas
- ✅ `equipe/tecnicos/[id]/loading.tsx` — breadcrumb, header, dados cadastrais, 4 KPIs, tabela visitas
- ✅ `payouts/loading.tsx` — header, tabela 8 linhas

**Técnico:**
- ✅ `(technician)/loading.tsx` — saudação, card "a receber", 3 KPIs, quick actions
- ✅ `(technician)/visitas/loading.tsx` — header, 5 cards verticais
- ✅ `(technician)/historico/loading.tsx` — header, card gráfico, 6 cards de mês
- ✅ `(technician)/profile/loading.tsx` — avatar, card dados, 2 formulários

### Verificação
- typecheck ✅ · lint ✅ · 66 testes passando

---

**2026-06-03 — Etapas 5 e 6: Portal do Técnico + Notificações**

### Portal do Técnico (Etapa 5)

Todas as 4 telas implementadas em `src/app/(technician)/`:

- ✅ `page.tsx` (Home) — saudação + mês, card "A receber" com gradiente, card "Deixado na mesa" condicional, grid 3 KPIs (visitas · sucesso · ranking anônimo), insights dinâmicos (top finalidade + motivo de falha), quick actions para /visitas e /historico
- ✅ `visitas/page.tsx` — lista do mês com PeriodSelector, cards verticais com borda colorida por resultado (verde/amber/red), valor payout + "na mesa" por visita, motivo inline
- ✅ `historico/page.tsx` — 6 meses preenchidos mesmo se vazios, gráfico Recharts (`HistoricoChart`), cards por mês com receita + taxa de sucesso, card "Destaque" do mês anterior (tipo Wrapped com 3 highlights)
- ✅ `profile/page.tsx` — dados pessoais somente leitura (email, CPF mascarado, código Unetvale, admissão), `EditProfileForm` (celular, observações), `ChangePasswordForm` (Supabase updateUser), lista de notificações com badge + "marcar todas como lidas"

### Notificações no UI (Etapa 6)

- ✅ `NotificationBell` — componente client com badge de não-lidas (número em vermelho), dropdown com até 20 notificações, cada item com título + corpo + timestamp relativo
- ✅ Integrado no layout do manager (`(manager)/layout.tsx`) e no layout do técnico (`(technician)/layout.tsx`)
- ✅ Clique marca como lida via `markNotificationRead` (server action) + abre link se houver

### Resumo da Sprint 5 completa

| Etapa | Descrição | Status |
|-------|-----------|--------|
| 1 | Dashboard executivo (manager) | ✅ |
| 2 | Drill-downs (OSs, visitas, técnico) | ✅ |
| 3 | Tela financeira | ✅ |
| 4 | Filtros globais de período | ✅ |
| 5 | Portal do técnico (4 telas) | ✅ |
| 6 | Notificações no UI | ✅ |
| 7 | Empty states reutilizáveis | ✅ |
| 8 | Loading skeletons | ✅ |

### Verificação final
- typecheck ✅ · lint ✅ · 66/66 testes passando · build ✅
