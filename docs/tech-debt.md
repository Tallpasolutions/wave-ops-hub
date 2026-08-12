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

### 017 — Ajuda in-app (`/ajuda`) está dois guias atrás da documentação
**Identificado em:** Sprint 16 (24/07) · **reconfirmado e ampliado em 03/08/2026**
**Onde:** `src/app/(manager)/ajuda/*` — sete páginas em TSX, escritas à mão
**Por quê:** `/ajuda` **duplica** `docs/user-guide/` em TSX (não é gerado do markdown), e só o
markdown vem sendo atualizado. Em 03/08 o repositório tem **9 guias** e a ajuda in-app tem **7**:

| Guia em `docs/user-guide/` | Existe em `/ajuda`? |
|---|---|
| 01 a 07 (primeiros passos, upload, LPU, motivos, fechamento, portal do técnico, FAQ) | ✅ |
| **08 — Produtividade e IQI** | ❌ |
| **09 — Valores especiais** | ❌ |

O 09 é o mais caro de faltar: é onde estão a ordem de precedência do cálculo, a regra de
**receita zerada** (ADR-020), as **alterações da Unetvale por OS de garantia** (ADR-021) e a
herança da LPU alternativa — tudo entregue entre 30/07 e 03/08. Somam-se as telas sem guia nenhum:
Homologação, Cabeamento, `/alteracoes` e a conferência/contestação do técnico.
**Impacto se não resolver:** o gestor não lê o repositório — ele lê `/ajuda`. Na prática, as
regras que mais geram dúvida de pagamento **não estão documentadas onde ele procura**, e o suporte
volta para o WhatsApp. Vale também para o técnico, que não tem canal de ajuda nenhum.
**Esforço estimado:** S para copiar os dois guias que faltam; M para eliminar a duplicação
renderizando o markdown (o que impede a divergência de voltar).
**Quando idealmente resolver:** junto do onboarding da Wave. É o maior débito de documentação
aberto hoje.

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

### 020 — Payouts pagos sobre visitas com receita Unetvale R$ 0,00 (sucesso) — RESOLVIDO 03/08
**Resolvido por:** [ADR-020](./architecture/ADR-020-receita-zerada-sem-repasse.md) — a decisão da
Wave (03/08/2026) foi "sem receita, sem repasse automático": sucesso com receita R$ 0,00 paga
R$ 0,00 e o técnico contesta pelo app. Mover para "Itens resolvidos" quando verificado em produção.

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

### 022 — Fechamento "pago" com a maioria dos payouts destravada
**Identificado em:** 2026-08-03, ao medir o alcance do ADR-020 e do vazamento entre LPUs
**Onde:** `monthly_closings` × `payouts.status`, `src/app/(manager)/fechamento/actions.ts`
**Por quê:** maio/2026 está com `monthly_closings.status = 'pago'`, mas dos seus payouts
**644 estão em `pending_review` e só 123 em `approved`** — e **nenhum payout no sistema inteiro
está `paid`**. `aprovarFechamento` marca `approved` só os payouts que existiam no momento da
aprovação, e `marcarComoPago` só promove a `paid` os que têm `closing_id` + `approved`. Visitas
que chegaram depois (re-upload) ficam de fora e nunca travam.
**Impacto se não resolver:** todo recálculo global reprocessa um período já pago e pode mudar o
valor do que a Wave já quitou, sem nenhum aviso — a divergência só aparece se alguém comparar o
relatório com o extrato. O botão "Recalcular pendentes" (`recalculatePendingPayoutsChunk`) varre o
tenant inteiro, sem filtro de período.
**Decisão de 03/08:** não travar por período; a proteção continua sendo por payout (contestado,
override do gestor, aprovado, pago). O item fica registrado porque a causa — payout novo em
período fechado — não foi resolvida.
**Esforço estimado:** S para reconciliar (promover a `approved`/`paid` os payouts órfãos de um
fechamento fechado); M para o fechamento passar a "adotar" visitas que chegam depois.
**Quando idealmente resolver:** antes do próximo fechamento mensal.

### 023 — Classificações de cabeamento com ponto adicional na chave são linhas mortas
**Identificado em:** 2026-08-03, ao mapear as chaves usadas pelos técnicos da SEM AUXILIAR
**Onde:** `cabeamento_classifications` (tenant Wave), 3 linhas
**Por quê:** desde o ADR-016 o `normalizeExplicacao` **remove** o modificador de pontos da chave
(o ponto virou acréscimo separado). As linhas `Cabeamento (+73 * 1 ponto(s) adicional(is))` = 76,
`Cabeamento (+73 * 2 ponto(s) adicional(is))` = 106 e `Cabeamento agregado (+73 * 1 ponto(s)
adicional(is))` = 76 nunca mais podem casar nenhuma visita. A migration 0026 foi criada para
apagá-las, mas elas continuam na base.
**Impacto se não resolver:** baixo hoje — chave morta não paga errado, só polui. O risco é de
leitura: quem abre `/cabeamento` vê valores de ponto que não valem mais e pode reeditar por cima
achando que estão em uso.
**Esforço estimado:** XS (um DELETE, com conferência de que nenhuma visita normaliza para essas
chaves — já verificado em 03/08).
**Quando idealmente resolver:** junto da próxima migration que tocar classificações.

### 024 — "Configuração de Roteador Externo" paga R$ 0 na tabela padrão
**Identificado em:** 2026-08-03, ao corrigir a OS 572037 (migration 0039)
**Onde:** regra "Configuração de Roteador (não repassada ao técnico)" da LPU Wave 2026 — Revisada
**Por quê:** a regra vem do seed e diz R$ 0. Mas o mesmo serviço, quando chega pela finalidade
"Venda Produto Externo" com a coluna Z `Roteador | 50 ...`, paga **R$ 30** desde o ADR-016 — que
é posterior ao seed e resolve o roteador antes da LPU. Ou seja: o mesmo trabalho tem dois valores
na tabela padrão, conforme a finalidade que a Unetvale escolher emitir. A SEM AUXILIAR passou a
pagar R$ 30 (0039) por decisão explícita da Wave; a padrão ficou como estava.
**Impacto se não resolver:** **zero hoje** — não existe nenhuma visita com essa finalidade de
técnico da tabela padrão (verificado em 03/08: 1 visita na base inteira, e é da SEM AUXILIAR).
Vira problema na primeira que aparecer, e vai aparecer como "técnico não recebeu", não como erro.
**Esforço estimado:** XS (uma linha de migration) — o custo é a decisão da Wave sobre o valor.
**Quando idealmente resolver:** na próxima revisão de LPU com o gestor, ou assim que surgir a
primeira visita dessas num técnico da padrão.

### 025 — Reemissão da Unetvale cria visita duplicada e ninguém é avisado
**Identificado em:** 2026-08-03, pela OS 572894 (3 visitas onde a planilha tinha 2)
**Onde:** `src/lib/etl/ingestor.ts` (chave natural) + `UNIQUE (tenant_id, os_num, data_execucao, tecnico_id)`
**Por quê:** quando a Unetvale corrige o pagamento de uma OS, ela reemite a linha carimbando o
**horário do ajuste** na coluna de data de execução. A chave natural inclui o timestamp → o
ingestor insere em vez de atualizar, e a mesma execução vira duas visitas, duas receitas e dois
payouts. A 0040 limpou as 3 ocorrências existentes, mas **nada impede a próxima**.
**Por que não trocar a chave para o dia:** apagaria visitas reais — a OS 568170 tem duas execuções
com sucesso do mesmo técnico no mesmo dia (10:03 e 10:51), ambas na mesma planilha. Ver o adendo
do [ADR-003](./architecture/ADR-003-os-visit-modeling.md#onde-a-idempotência-falha-reemissão-com-horário-trocado-adendo-de-03082026).
**Impacto se não resolver:** payout pago duas vezes pela mesma execução, em silêncio. Foram
R$ 160 em um único upload. Só apareceu porque o gestor estranhou a receita de uma OS.
**Desenho proposto (avisar, não mesclar):** no fim da ingestão, procurar grupos
`(os_num, tecnico_id, dia)` com 2+ visitas de sucesso onde pelo menos uma veio de um upload
anterior; devolver a lista em `IngestWarning` (o tipo já existe em `src/lib/etl/types.ts`) e
exibir no detalhe do upload — hoje **nenhuma tela consome `IngestWarning`**, então esse é o
primeiro consumidor. Mesclar automaticamente está descartado: uma segunda visita real reportada
com atraso tem a mesma assinatura.
**Query da varredura** (é a Conferência 3 da 0040):
```sql
SELECT os_num, tecnico_id, data_execucao::date AS dia, count(*),
       array_agg(data_execucao::time ORDER BY data_execucao)
FROM service_visits WHERE lower(btrim(sucesso)) LIKE 'sim%'
GROUP BY os_num, tecnico_id, data_execucao::date HAVING count(*) > 1;
```
**Esforço estimado:** S para a detecção + M para a tela do upload consumir `IngestWarning`.
**Quando idealmente resolver:** antes do próximo fechamento — o risco é dinheiro pago em dobro.

### 026 — As regras "em garantia (não paga)" da LPU SEM AUXILIAR são letra morta
**Identificado em:** 2026-08-03, ao investigar como detectar OSs de garantia (ADR-021)
**Onde:** LPU "LPU Wave — SEM AUXILIAR", regras `Instalação em garantia (não paga)` e
`Suporte em garantia (não paga)` (prioridade 900, `{"garantia": true}`, migration 0036)
**Por quê:** as regras casam pelo campo `garantia` da visita, e **a Unetvale nunca preenche essa
coluna**: das 2.345 visitas do tenant, todas estão com `garantia = false` e nenhuma com `true`
(verificado em 03/08). As duas regras nunca casaram nada desde que foram criadas.
**Impacto se não resolver:** o "não paga em garantia" que a Wave definiu na planilha da SEM
AUXILIAR **não está valendo** — uma instalação refeita em garantia paga valor cheio. Não é
regressão (nunca funcionou), mas é uma decisão de negócio que o sistema não está cumprindo, e
ninguém tem como perceber porque a regra existe e parece ativa na tela da LPU.
**Caminho possível:** o sinal real de garantia é o texto da observação da Unetvale (`abertura da
OS de garantia`) — o mesmo que o ADR-021 já detecta. Mas atenção: a observação marca a OS **cuja
receita foi reduzida**, e não a OS de garantia em si; são coisas diferentes e usar uma pela outra
pagaria errado. Antes de codar, mapear com o gestor o que a Wave chama de "OS em garantia".
**Esforço estimado:** XS para remover as regras mortas; M para fazer a regra valer de verdade —
e o custo real é a definição de domínio, não o código.
**Quando idealmente resolver:** na próxima revisão de LPU com o gestor.

### 027 — Actions do `iqi-cron.yml` ainda em Node 20 (o runner já força Node 24)
**Identificado em:** 2026-08-04, ao investigar as falhas do cron do IQI
**Onde:** `.github/workflows/iqi-cron.yml` — `actions/checkout@v4`, `actions/setup-node@v4`,
`pnpm/action-setup@v3`
**Por quê:** as três actions declaram runtime Node 20, que o GitHub depreciou. Hoje o runner as
força a rodar em Node 24 e emite só um warning por execução — não foi a causa das falhas do cron
(essa era o timeout do endpoint da Unetvale), e subir as versões junto teria misturado escopos.
**Impacto se não resolver:** quando o GitHub remover o fallback, as três actions param de rodar e
o cron do IQI quebra de novo — desta vez sem nem chegar ao script.
**Esforço estimado pra resolver:** XS — subir para `checkout@v5`, `setup-node@v5`,
`action-setup@v4` e disparar o workflow uma vez para conferir.
**Quando idealmente resolver:** na próxima manutenção de CI, antes que o warning vire erro.

### 028 — "Reset senha" do `/admin/users` (Tallpa) ainda usa `generateLink` e não faz nada
**Identificado em:** 2026-08-12, ao corrigir o mesmo botão na aba Equipe
**Onde:** `src/app/(admin)/admin/users/actions.ts` — `sendPasswordReset`
**Por quê:** `auth.admin.generateLink` **gera** o link de recuperação e o devolve na resposta, mas
não dispara e-mail nenhum. O retorno é descartado, então o clique não produz efeito visível algum.
A aba Equipe (gestores e técnicos) migrou para definição de senha na própria tela; o painel Tallpa
ficou de fora por ser outra área e outro público (`tallpa_owner`).
**Impacto se não resolver:** o Tallpa owner segue com um botão que aparenta funcionar e não
funciona — e não tem como devolver acesso a um gestor travado sem ir ao painel do Supabase.
**Esforço estimado pra resolver:** XS — reusar `adminSetUserPassword` (`src/lib/auth/set-password.ts`)
e o `SetPasswordDialog`, ajustando o escopo de tenant (o painel admin é cross-tenant).
**Quando idealmente resolver:** na próxima passada pelo painel Tallpa.

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
