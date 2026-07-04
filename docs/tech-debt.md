# Dívida Técnica

> Registro de coisas que **não estão tão boas quanto poderiam estar**, mas foram aceitas conscientemente para manter o ritmo de entrega. Cada item tem contexto, impacto estimado e plano de resolução (mesmo que vago).

**Regra:** todo item aqui é uma dívida **conscientemente assumida**. Bugs vão para issues do GitHub, não aqui.

---

## Itens em aberto

### 001 — UNIQUE constraints declarados como uniqueIndex no Drizzle
**Identificado em:** Sprint 1, Fase 0
**Onde:** `src/db/schema/technicians.ts` (uq_technicians_tenant_email, uq_technicians_tenant_cpf, uq_technicians_tenant_codigo)
**Por quê:** A migration SQL inicial declarou UNIQUE inline na tabela (ex: `UNIQUE (tenant_id, email)`), mas os schemas Drizzle usam `uniqueIndex(...)` separado. Funcionalmente equivalente no Postgres (UNIQUE constraint cria index automaticamente), mas são entidades distintas em introspection.
**Impacto se não resolver:** Divergência cosmética em futura introspection do Drizzle. Nenhum impacto funcional.
**Esforço estimado:** XS
**Quando idealmente resolver:** Quando houver primeiro `drizzle-kit introspect` formal contra o banco real, reconciliar os schemas TS com o que o Postgres realmente tem.

### 002 — JWT custom claims: jsonb_set + to_jsonb(uuid::text) propaga null
**Identificado em:** Sprint 1, Fase 2
**Onde:** `supabase/migrations/0002_auth_hook.sql`
**Por quê:** A combinação `jsonb_set(claims, '{path}', to_jsonb(uuid_value::text))` retorna null quando o UUID é NULL — null propaga e a function inteira retorna `{"claims": null}`.
**Solução adotada:** usar operador `||` (jsonb concat) com `jsonb_build_object` e `to_jsonb(uuid)` direto (sem cast intermediário para text).
**Lição:** Para mesclar objetos jsonb, prefira `||` sobre `jsonb_set`. Para serializar UUIDs nullable em jsonb, use `to_jsonb(uuid_value)` direto.
**Impacto se não resolver:** N/A — já resolvido. A versão bugada nunca foi para produção.
**Esforço estimado:** Resolvido.
**Quando idealmente resolver:** Já resolvido em Sprint 1, Fase 2.

### 003 — tailwind.config.ts: require() não funciona em contexto ESM
**Identificado em:** Sprint 1, Fase 1 (descoberto durante validação manual)
**Onde:** `tailwind.config.ts` linha de `plugins`
**Por quê:** Next.js 15 + arquivo `.ts` operam em ESM. `require()` é sintaxe CommonJS, lança ReferenceError em runtime quando o Tailwind tenta processar a config para rotas que usam plugins.
**Solução adotada:** import ESM no topo do arquivo (`import tailwindcssAnimate from "tailwindcss-animate"`) e referência direta em `plugins`.
**Lição:** Em `tailwind.config.ts` (TypeScript) sempre use `import` no topo. `require()` só funciona em `tailwind.config.js` (CommonJS).
**Impacto se não resolver:** N/A — já resolvido.
**Esforço estimado:** Resolvido.
**Quando idealmente resolver:** Já resolvido em Sprint 1, Fase 1 (validação).

### 005 — Next.js 15 Server Actions: cookies recém-setados não são lidos na mesma execução
**Identificado em:** Sprint 1, Fase 3 (durante validação manual de login)
**Onde:** `src/app/(public)/login/actions.ts`
**Por quê:** Em Next.js 15, quando uma Server Action chama `supabase.auth.signInWithPassword`, o cookie de sessão é setado mas não é legível por chamadas subsequentes de `auth.getUser()` na mesma execução. `getCurrentUser()` (que internamente chama `auth.getUser()`) retorna null mesmo após login bem-sucedido, gerando falso positivo de "usuário não encontrado".
**Solução adotada:** decodificar o `data.session.access_token` retornado pelo `signInWithPassword` para ler o `role` dos custom claims do JWT. O Auth Hook (`custom_jwt_claims`) injeta `role` no **payload do JWT** (campo `claims`), não em `app_metadata` — `app_metadata` é `raw_app_meta_data`, campo separado que o hook nunca escreve.
**Lição:** O hook escreve em `event.claims` (payload JWT), não em `app_metadata`. Para ler custom claims no mesmo request do login, decodifique o `access_token` com `Buffer.from(token.split('.')[1], 'base64url')`. `getCurrentUser()` continua válido em Server Components de rotas protegidas (request seguinte, com cookie já estabelecido).
**Esforço para resolver definitivamente:** N/A — solução adotada é a recomendada pelo padrão Supabase + Next.js.
**Quando idealmente resolver:** Já resolvido em Sprint 1, Fase 3.

### 006 — Route groups com paths colidentes em Next.js App Router
**Identificado em:** Sprint 1, Fase 3 (validação manual)
**Onde:** `src/app/(admin)/dashboard/page.tsx` vs `src/app/(manager)/dashboard/page.tsx`
**Por quê:** Route groups (pastas com parênteses) NÃO criam segmento de URL no Next.js App Router. Múltiplos groups com mesmo path interno colidem em URL única, gerando build error.
**Solução adotada:** path explícito por portal: admin usa `/admin/dashboard`, manager usa `/dashboard`, technician usa `/profile`. Mesmo com subdomain isolando o acesso, o roteador Next.js precisa de paths únicos no nível de filesystem.
**Lição:** ao criar route groups, garantir que cada group tem paths únicos OU paths explicitamente diferentes na estrutura de pastas. Não confiar em subdomain pra "isolar" rotas em Next.js.
**Esforço para resolver definitivamente:** Já resolvido.
**Quando idealmente resolver:** Já resolvido em Sprint 1, Fase 3.

### 007 — JWT `role` conflita com role do PostgREST; cross-subdomain cookie exchange frágil
**Identificado em:** Sprint 1 (retomada no novo MacBook, 2026-05-29)
**Onde:** `supabase/migrations/0002_auth_hook.sql` (corrigido em `0004`), `src/app/auth/callback/route.ts`
**Por quê:** O campo `role` no JWT é reservado pelo PostgREST para `SET ROLE` no PostgreSQL. Ao sobrescrevê-lo com nossos roles de negócio (`tenant_owner`, `tallpa_owner`), o PostgREST tentava `SET ROLE tenant_owner` que não existe, causando "role does not exist" em todas as queries. Corrigido renomeando para `app_role`. Adicionalmente, o mecanismo de session exchange cross-subdomain via URL é necessário em dev (browsers rejeitam `domain=.localhost`) mas deixa o `access_token` exposto na URL. Tokens expirados stale em cookies de `admin.localhost` podem causar confusão.
**Solução adotada:** Renomear claim para `app_role` (migration 0004). Exchange via `/auth/callback` com tokens na URL para dev. `tallpa_owner` deve sempre preferir logar direto em `admin.localhost:3000/login` para evitar o exchange.
**Impacto se não resolver:** N/A — corrigido. Em produção (`.tallpa.com.br`), o cookie domain compartilhado elimina o cross-subdomain exchange.
**Esforço estimado:** Resolvido.
**Quando idealmente resolver:** Monitorar se o exchange causa problemas em produção; se sim, usar PKCE code flow.

### 008 — `upsertVisit`: índice único parcial para tecnico_id NULL não declarável no Drizzle
**Identificado em:** Sprint 2, Etapa 3
**Onde:** `src/lib/etl/ingestor.ts` — função `upsertVisit`
**Por quê:** O banco tem um índice único parcial `WHERE tecnico_id IS NULL` (migration 0001), que garante unicidade de `(tenant_id, os_num, data_execucao, tecnico_raw)` quando `tecnico_id` é nulo. O Drizzle TS não consegue declarar `WHERE` em índices — a constraint existe apenas no banco. No código, o `upsertVisit` replica a lógica manualmente: se `tecnicoId` é null, adiciona `.is('tecnico_id', null).eq('tecnico_raw', ...)` na query de busca antes de inserir.
**Impacto se não resolver:** Race condition teórico em inserts paralelos com tecnico_id=null. Em produção, uploads são sequenciais por tenant, então o risco é negligenciável no MVP.
**Esforço estimado:** XS (adicionar comentário na migration e no código; sem mudança funcional)
**Quando idealmente resolver:** Quando houver uploads concorrentes ou volume que justifique paralelismo — Sprint 5 ou posterior.

### 009 — PDF consolidado não inclui detalhes de visitas por técnico
**Identificado em:** Sprint 4, Etapa 6
**Onde:** `src/app/(manager)/fechamento/[periodo]/export/pdf/route.ts` + `src/lib/payouts/reports.tsx` (`generatePdfReport`)
**Por quê:** `generatePdfReport` espera `TechWithDetails[]` (que inclui `visitDetails`). O route handler do PDF consolidado não busca detalhes de visita por técnico — passa `visitDetails: []` para cada técnico. O layout de resumo consolidado não exibe visitas individuais, só totais, então o dado vazio não é visível no output atual.
**Impacto se não resolver:** Se o layout do PDF consolidado for atualizado para incluir seção de detalhe de visitas por técnico, o dado estará vazio. Atualmente o output está correto visualmente.
**Esforço estimado pra resolver:** S — adicionar query de visitas no route handler e popular `visitDetails`.
**Quando idealmente resolver:** Quando o cliente Wave pedir detalhe de visitas no PDF consolidado — Sprint 6 (polish).

### 010 — Valores de texto da planilha armazenados sem normalização
**Identificado em:** Sprint 4 (validação com planilha real Wave)
**Onde:** `src/lib/etl/normalizer.ts` — campos como `finalidade`, `cidade`, `sucesso`, `tecnico_raw`, motivos
**Por quê:** O ingestor persiste os valores exatamente como vêm da planilha (ex: `"INSTALAÇAO"`, `"São paulo"`, `"Nao encontrou endereco"`). Normalização de capitalização e acentuação não foi implementada para não atrasar a entrega.
**Impacto se não resolver:** Duplicação de motivos/cidades por variação de escrita; agrupamentos e filtros por cidade/finalidade podem não casar; exibição inconsistente na UI.
**Esforço estimado pra resolver:** S — adicionar funções de normalização (trim + title case + remoção de acentos opcionalmente) no `normalizer.ts` antes de persistir.
**Quando idealmente resolver:** Quando o cliente Wave reportar inconsistência nos relatórios por cidade ou finalidade — ou como melhoria planejada em Sprint 6+.

### 011 — Ingestor batch: `periodo` de carga determina o SELECT inicial
**Identificado em:** Sprint 5, Etapa 1 (validação com planilha real)
**Onde:** `src/lib/etl/ingestor.ts` — query de visitas existentes
**Por quê:** O SELECT inicial para construir o Map de visitas existentes filtra por `data_execucao` entre `periodoInicio` e `periodoFim` da planilha carregada. Se uma planilha de fevereiro incluir por acidente linhas de janeiro, as visitas de janeiro não estarão no Map e serão tentadas como INSERT (resultando em duplicate key error ou duplicata). No MVP, planilhas são de meses exatos — não é problema em produção ainda.
**Impacto se não resolver:** Erro de constraint (não duplicata silenciosa) se planilha tiver range maior que um mês. Upload falhará com erro no `error_log`.
**Esforço estimado:** S — ampliar o range do SELECT para `min(data) - 1 dia` a `max(data) + 1 dia`
**Quando idealmente resolver:** Quando a Wave começar a exportar planilhas com overlapping de meses — Sprint 6 ou sob demanda.

### 012 — Upload lifecycle: `reprocessUpload` não recalcula payouts
**Identificado em:** Sprint 5, Etapa 1
**Onde:** `src/app/(manager)/uploads/actions.ts` — `reprocessUpload`
**Por quê:** `reprocessUpload` apenas conta visitas no banco e corrige `status`/contadores do upload, sem re-rodar o ingestor nem o cálculo de payouts. Serve para recuperar uploads travados, não para atualizar payouts com novas regras.
**Impacto se não resolver:** Gestor que usa `reprocessUpload` (não `rerunUpload`) não verá payouts recalculados. Distinção não é óbvia na UI atual.
**Esforço estimado:** XS — adicionar label explicativo na UI do upload distinguindo os dois botões
**Quando idealmente resolver:** Quando o feedback da Wave indicar confusão — Sprint 6.

### 013 — Dupla instância de `createSupabaseServerClient` em Server Actions invalida sessão
**Identificado em:** Sprint 6 (teste manual de criação de usuário)
**Onde:** `src/app/(manager)/equipe/actions.ts`, `src/app/(admin)/admin/users/actions.ts`
**Por quê:** As actions `createManagerUser` e `createUser` instanciavam `createSupabaseServerClient()` duas vezes na mesma execução — uma vez indiretamente via `requireRole` → `getCurrentUser`, e novamente para fazer o `from('users').insert()`. A segunda instância dispara `getUser()` internamente, que pode fazer refresh de token e escrever novos cookies de sessão. Em certas condições (token próximo da expiração ou race no cookie store), o cookie do criador é sobrescrito com dados inválidos, causando redirect para `/login` na próxima navegação.
**Solução adotada:** usar `adminClient.from('users').insert/update` nas operações de escrita subsequentes ao `adminClient.auth.admin.createUser()`. O `adminClient` não gerencia sessão (usa service role key, `persistSession: false`), eliminando o conflito de cookies.
**Lição:** dentro de uma Server Action, evite criar múltiplas instâncias de `createSupabaseServerClient`. Se a action já chamou `requireRole` (que cria um client), reutilize o mesmo ou use `adminClient` para operações subsequentes onde a autorização já foi verificada.
**Impacto se não resolver:** N/A — já resolvido.
**Esforço estimado:** Resolvido (XS).
**Quando idealmente resolver:** Já resolvido em Sprint 6.

### 014 — Rotas `/admin/*` acessíveis de qualquer subdomínio
**Identificado em:** Sprint 6 (teste manual com usuário tallpa_owner em `wave.localhost`)
**Onde:** `src/middleware.ts` — sem regra de bloqueio de rotas `/admin/*` por subdomínio
**Por quê:** O Next.js App Router serve todas as rotas de qualquer subdomínio. O middleware apenas injeta o header `x-subdomain` mas não bloqueia `/admin/*` para subdomínios não-admin. O layout `(admin)` verifica o role (`requireRole(['tallpa_owner'])`), então há proteção de acesso, mas a rota é servida de qualquer subdomínio (ex: `wave.tallpa.com.br/admin/dashboard`).
**Impacto se não resolver:** UX inconsistente — em produção, um `tallpa_owner` que acesse `wave.tallpa.com.br/admin/dashboard` diretamente consegue usar o painel admin no subdomínio errado. Não é brecha de segurança (role check ocorre), mas o URL correto deveria ser sempre `admin.tallpa.com.br/admin/dashboard`.
**Solução proposta:** adicionar regra no middleware: se `pathname.startsWith('/admin')` e `subdomain !== 'admin'`, redirecionar para `admin.${ROOT}/admin/...`.
**Esforço estimado:** XS
**Quando idealmente resolver:** Sprint 6 — antes do go-live em produção.

### 015 — `service_role` sem GRANT nas tabelas operacionais
**Identificado em:** Sprint 6, Etapa 4 (cleanup E2E)
**Onde:** `supabase/migrations/0005_grant_permissions.sql` — apenas `authenticated` e `anon` receberam GRANTs; `service_role` foi omitido
**Por quê:** Migration 0005 foi escrita focando nos roles do PostgREST para usuários finais. O `service_role` tem `BYPASSRLS` no PostgreSQL mas ainda precisa de GRANT de nível de tabela para operar via REST API.
**Solução adotada:** `supabase/migrations/0007_grant_service_role.sql` — GRANT completo para `service_role` em todas as tabelas operacionais. Aplicado no Supabase dev em 2026-06-05.
**Lição:** tabelas criadas via SQL migration (não pelo Dashboard) não recebem GRANTs automáticos para nenhum role. `service_role` bypassa RLS mas não bypassa table-level grants.
**Impacto se não resolver:** N/A — já resolvido.
**Esforço estimado:** Resolvido (XS).
**Quando idealmente resolver:** Já resolvido em Sprint 6, Etapa 4.

### Template

```
### NNN — [Título curto]
**Identificado em:** Sprint X
**Onde:** caminho/arquivo ou descrição
**Por quê:** justificativa de ter aceitado a dívida
**Impacto se não resolver:** o que vai doer no futuro
**Esforço estimado pra resolver:** XS / S / M / L / XL
**Quando idealmente resolver:** Sprint X / Após go-live / Quando volume passar de Y / Etc.
```

---

## Itens resolvidos

_(mover para cá quando resolvido, com link pro PR/commit)_

## 2026-07-03 — Query mensal do dashboard sem paginação (corte de 1000 do PostgREST)

`src/app/(manager)/dashboard/page.tsx` busca as visitas do mês sem `range()`/paginação —
o PostgREST corta em 1000 linhas em silêncio. Junho tem ~602 visitas, mas meses maiores
vão estourar. Corrigir com `fetchAllPages` (`src/lib/supabase/fetch-all.ts`), como já
feito em financeiro/fechamento. Encaixa na paginação da Sprint 13.

## 2026-07-04 — Feedback de QA do gestor (Sprint 13): dashboard e interatividade

Anotado a partir do teste do usuário em produção, pós-Sprint 13. Candidatos a uma
**Sprint de Dashboard & Interatividade** (ver 00-roadmap.md).

### D1 — Números estourando a largura do card (dashboard)
Com 7 cards na faixa de KPIs (`grid xl:grid-cols-7`), valores grandes (ex.: "R$ 59.408,36")
passam do tamanho do card e atrapalham a leitura. Rever tipografia responsiva / truncamento /
layout dos KpiCard. Talvez 2 linhas de cards em vez de 7 numa linha só.
**Esforço:** S · **Onde:** `dashboard/page.tsx` (KPI strip), `dashboard/_components/KpiCard.tsx`

### D2 — Informação dos cards pouco clara
O gestor apontou que algumas informações do card confundem (pill/foot). Revisar copy e
hierarquia visual de cada KpiCard (o que é valor principal, o que é contexto).
**Esforço:** S · **Onde:** `dashboard/page.tsx`

### D3 — Gráficos não interativos (deveriam filtrar ao clicar)
Os gráficos do dashboard (volume diário, tipos de OS, ranking, distribuição geográfica) eram
esperados como **interativos** — clicar num segmento/barra deveria filtrar o painel. Hoje o
clique não faz nada. Definir o comportamento (drill-down por finalidade/cidade/técnico via
querystring) e implementar nos componentes Recharts.
**Esforço:** M–L · **Onde:** `dashboard/_components/*Chart*.tsx`, `VolumeChart`, `AttendanceDonut`,
`GeoDistribution`, `TechValueChart`

### D4 — Perfil do técnico abria vazio (RESOLVIDO na Sprint 13)
`/equipe/tecnicos/[id]` usava `parsePeriod(mes)` → caía no mês corrente vazio. Corrigido para
`getEffectivePeriod` (último mês com dados). Movido para "Itens resolvidos" quando verificado
em produção.
