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
**Atualização (2026-07-19):** manifestou-se no campo `subterraneo_aereo` — valores com mojibake (`"AÈreo"`) e vazios deixavam visitas "sem regra de LPU" (match exato). Resolvido **pontualmente** para esse campo (`deriveSubterraneoAereo` em `normalizer.ts` + migrations 0017/0018 — ver ADR-006). A dívida geral (demais campos) segue em aberto.

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

### 016 — Dashboard do gestor busca visitas do mês sem paginação (corte de 1000 do PostgREST)
**Identificado em:** 2026-07-03 · **reconfirmado em 2026-07-24** (segue em aberto)
**Onde:** `src/app/(manager)/dashboard/page.tsx` — query de `service_visits` do período, sem `range()`
**Por quê:** ficou para a paginação da Sprint 13, que cobriu `/oss`, `/pagamentos` e financeiro
(via `fetchAllPages` em `src/lib/supabase/fetch-all.ts`), mas **não** o dashboard.
**Impacto se não resolver:** o PostgREST corta em 1000 linhas **em silêncio** — sem erro. Em um mês
com mais de 1000 visitas, todos os painéis do dashboard (KPIs, gráficos, ranking, distribuição
geográfica) passam a mostrar números menores que a realidade, e o gestor não tem como perceber.
Junho tinha ~602 visitas; o volume só cresce, então isso vira bug de dado silencioso, não "se".
**Esforço estimado:** XS — trocar a query por `fetchAllPages`, como já feito nas outras telas.
**Quando idealmente resolver:** próxima sprint. É o item de maior risco/menor esforço da lista.

### 017 — Ajuda in-app (`/ajuda`) não cobre as telas das Sprints 15–16
**Identificado em:** Sprint 16 (revisão documental de 24/07)
**Onde:** `src/app/(manager)/ajuda/*` — seis guias (primeiros passos, upload, LPU, motivos,
fechamento, portal do técnico) + FAQ, escritos à mão em TSX
**Por quê:** as telas novas entraram sob pressão do fechamento de julho; a ajuda ficou para depois.
Faltam: Produtividade/IQI, Homologação, Cabeamento, e a conferência/contestação do técnico —
esta última é a mais sensível, porque é fluxo **novo para o técnico**, que não tem canal de ajuda.
**Nota:** o conteúdo de `/ajuda` **duplica** `docs/user-guide/` em TSX (não é gerado do markdown).
Os dois precisam ser atualizados juntos, ou a duplicação vira divergência.
**Impacto se não resolver:** técnico e gestor descobrem os fluxos novos por tentativa e erro, e o
suporte volta para o gestor via WhatsApp.
**Esforço estimado:** S (copy) — M se for eliminar a duplicação renderizando o markdown.
**Quando idealmente resolver:** junto do onboarding da Wave (candidato a Sprint 17).

### 018 — Valores financeiros fixos no código (exigem deploy para mudar)
**Identificado em:** Sprint 16
**Onde:** `src/lib/payouts/calculate.ts` — `PAYOUT_IMPRODUTIVA_PADRAO = 15,00`,
`UNETVALE_IMPRODUTIVA_PADRAO_CENTAVOS = 1598`, `UNETVALE_NAO_PAGA_CENTAVOS = 2930`,
`PONTO_ADICIONAL_VALOR = 36`
**Por quê:** vieram de decisões pontuais (ADR-016 e a regra de improdutiva) validadas contra a
planilha da Wave. Tornar configurável por tenant custaria UI + migration + ADR, sem demanda ainda.
**Impacto se não resolver:** qualquer reajuste da Unetvale (ou um segundo tenant com outros
valores) vira mudança de código + deploy, em vez de configuração. Com um tenant só, é aceitável.
**Esforço estimado:** M — mover para `tenants.config` com fallback nas constantes atuais.
**Quando idealmente resolver:** quando a Unetvale reajustar, ou no onboarding do segundo tenant.

### 019 — `tallpa_owner` recebe notificações de todos os tenants
**Identificado em:** Sprint 16 (ADR-017)
**Onde:** `src/lib/notifications/notify.ts` — `notifyManagers`
**Por quê:** o operador Tallpa acompanha a operação junto com a Wave e precisava ver as
contestações; a consulta por tenant nunca o incluía (ele não tem `tenant_id`).
**Impacto se não resolver:** com um tenant é o comportamento desejado. Com Scooby como segundo
tenant, a sineta do Tallpa vira ruído — notificação de todos os tenants misturada.
**Esforço estimado:** S — filtro por tenant de interesse, ou agrupamento por tenant na sineta.
**Quando idealmente resolver:** antes do segundo tenant entrar.

### 020 — Payouts pagos sobre visitas com receita Unetvale R$ 0,00 (sucesso)
**Identificado em:** 2026-07-30, na investigação do suporte externo sem troca de drop
**Onde:** LPU ativa da Wave + `src/lib/payouts/calculate.ts`
**Por quê:** o corte por receita da Unetvale (ADR-015/016 e o threshold de suporte) trata R$ 0,00
como "receita desconhecida/não reembolsada" só no caminho das **improdutivas**. Em visitas com
**sucesso** e receita R$ 0,00 a LPU paga o valor cheio.
**Impacto se não resolver:** margem negativa silenciosa. Levantamento na base atual:
19 suportes externos com troca de drop e receita R$ 0,00 pagando R$ 120/R$ 135; e 4 visitas
"Roteador agregado à OS que não é de Suporte nem Cabeamento" com receita R$ 0,00 pagando R$ 30
pela regra de Suporte Interno. Não está claro se a receita zerada é falha da planilha (a Unetvale
ainda vai pagar) ou glosa real — a decisão é da Wave, não técnica.
**Esforço estimado:** S no código (o threshold já existe); o custo é a decisão de negócio.
**Quando idealmente resolver:** junto com a próxima revisão de LPU com o gestor.

### 021 — `finalidades_infra` só é editável por migration, e o match é exato
**Identificado em:** 2026-07-30 (terceira ocorrência do mesmo problema)
**Onde:** `tenants.config.finalidades_infra`, `src/lib/etl/ingestor.ts` (`isFinalidadeInfra`)
**Por quê:** a lista nasceu de uma decisão pontual da Wave (Sprint 12) e ficou na config do
tenant, escrita por migration. O match é exato (`trim + lower`).
**Impacto se não resolver:** cada variante de nome que a Unetvale emitir custa um ciclo de
deploy e só é notada quando alguém repara na fila "Sem regra" — já aconteceu 3x:
`Genérico` → `Infra Genérico` (0028) e `Troca de postes` → `Troca de Poste` (0033).
A falha é silenciosa: a OS não some da listagem, mas também não paga nada.
**Esforço estimado:** S para o alerta (upload avisar "finalidade nunca vista antes: X"),
M para a tela de gestão da lista pelo gestor.
**Quando idealmente resolver:** junto do onboarding da Wave — o alerta no upload sozinho já
elimina a descoberta tardia, e é o pedaço barato.

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

> **Correção de registro (24/07/2026):** o item "Query mensal do dashboard sem paginação" estava
> listado abaixo como resolvido, mas **não foi corrigido** — a query continua sem `range()`.
> Foi promovido para **[016](#016--dashboard-do-gestor-busca-visitas-do-mês-sem-paginação-corte-de-1000-do-postgrest)**,
> em "Itens em aberto".

## 2026-07-04 — Feedback de QA do gestor (Sprint 13): dashboard e interatividade

Anotado a partir do teste do usuário em produção, pós-Sprint 13. Candidatos a uma
**Sprint de Dashboard & Interatividade** (ver 00-roadmap.md).

**Situação (24/07/2026): D1, D2 e D3 foram entregues e verificados em produção em 04/07** — a
"frente B" do roadmap (cards responsivos, copy revisada e drill-down interativo via
[ADR-010](./architecture/ADR-010-dashboard-drilldown.md)). D4 também. O bloco fica aqui como
histórico do feedback.

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
