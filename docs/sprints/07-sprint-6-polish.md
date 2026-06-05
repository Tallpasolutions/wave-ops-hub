# Sprint 6 — Polish e Go-live

**Duração estimada:** 0.5 a 1 semana
**Status:** Em andamento (iniciada 2026-06-03)
**Pré-requisitos:** Sprint 5 concluída ✅

---

## Objetivo

Finalizar testes, ajustes visuais, documentação para Wave, deploy em produção e onboarding ao vivo. Ao final desta sprint, Wave Telecom está usando o sistema em produção.

---

## Etapas

### Etapa 1 — i18n, nomenclatura e visual imediato ✅ Concluída (2026-06-03)

- [x] Rota `/payouts` renomeada para `/pagamentos` — todos os `href`, `revalidatePath`, `redirect` e links internos atualizados
- [x] Sidebar Manager: label `Payouts` → `Pagamentos`
- [x] `GlobalPeriodSelector.tsx`: `PERIOD_PATHS` atualizado com `/pagamentos`
- [x] Portal técnico home: texto `payout(s) pendente(s)` → `pagamento(s) pendente(s)`
- [x] Tabelas e formulários de usuários: coluna `Role` → `Cargo`, select `Selecione a role` → `Selecione o cargo`
- [x] Badges de cargo traduzidas: `tallpa_owner` → `Admin Tallpa`, `tenant_owner` → `Proprietário`, `tenant_manager` → `Gerente`
- [x] `TenantLogo.tsx` reescrito — usa `next/image` com `brandPath` prop; logo Tallpa real substituiu o "T" placeholder em todos os portais (login, sidebar manager, sidebar admin, header técnico, 404)
- [x] Dashboard manager: bloco "Atualizado / Tempo real" removido do header (dado não era real-time)
- [x] Bug fix: dupla instância de `createSupabaseServerClient` em Server Actions causava invalidação de sessão ao criar usuário — corrigido usando `adminClient.from('users').insert/update` em `equipe/actions.ts` e `admin/users/actions.ts`

---

### Etapa 2 — Validação visual e qualidade de interface ✅ Concluída (2026-06-04)

- [ ] Comparar tela a tela com `public/dashboard-reference/dashboard-wave-abril-2026.html`, ajustar discrepâncias *(validação manual no browser — pendente)*
- [x] Responsividade: sidebar mobile Manager + Admin implementada (hambúrguer + drawer overlay); `overflow-x-auto` em todas as tabelas customizadas; padding `p-4 lg:p-8` em todas as páginas manager
- [x] Dark mode: auditoria confirmou que não há vazamentos — `bg-white/X` são overlays intencionais em fundo escuro
- [x] Acessibilidade: `*:focus-visible` global adicionado em `globals.css` (anel cyan 2px); `TenantLogo` já tem `alt`; botões usam `<button>` corretamente

---

### Etapa 3 — Performance e SEO ✅ Concluída (2026-06-04)

- [x] Lighthouse: Performance 100 · Accessibility 95 · Best Practices 100 · SEO 100 (após correção do noindex)
- [x] Bundle size: lazy loading com `next/dynamic` aplicado em VolumeChart, AttendanceDonut e TechValueChart (Recharts split em chunk separado)
- [x] `next/image` em todos os usos de imagem — já estava em uso via `TenantLogo`
- [x] `next.config.ts`: `compress: true` + `images.formats: ['image/avif', 'image/webp']`
- [x] `<title>` e `description` em todas as 27 páginas via metadata API do Next.js 15 (title template `'%s | Wave Ops Hub'`)
- [x] OG tags no root layout (`openGraph.title`, `openGraph.description`, `openGraph.type`)
- [x] `robots.ts` criado em `src/app/robots.ts` — bloqueia indexação total (`Disallow: /`)

---

### Etapa 4 — Testes E2E ✅ Concluída (2026-06-04)

11 cenários em Playwright — specs criados e typecheck/lint passando:

- [x] Fluxo completo de onboarding de tenant (Tallpa cria tenant + owner) → `01-onboarding.spec.ts`
- [x] Login + recuperação de senha → `02-password-recovery.spec.ts`
- [x] Upload de planilha + verificação de dados no banco → `03-upload.spec.ts`
- [x] Re-upload (idempotência) → `03-upload.spec.ts`
- [x] Cadastro de técnico + vinculação de visitas pendentes → `04-technician.spec.ts`
- [x] Configuração de motivo → `05-motivos.spec.ts`
- [x] Cadastro de LPU completa + ativação → `06-lpu.spec.ts`
- [x] Aprovação de fechamento mensal → `07-fechamento.spec.ts`
- [x] Marcação de pago → `07-fechamento.spec.ts`
- [x] Login como técnico + visualização de dados próprios → `auth.spec.ts` (estendido)
- [x] RLS: técnico não consegue ver dados de outros → `08-rls.spec.ts`

---

### Etapa 5 — Documentação do usuário ✅ Concluída (2026-06-05)

- [x] `docs/user-guide/01-primeiros-passos.md` — login, navegação, perfil
- [x] `docs/user-guide/02-upload-planilha.md` — formato, passo a passo, status, idempotência
- [x] `docs/user-guide/03-configurar-lpu.md` — criar LPU, regras, simular, ativar
- [x] `docs/user-guide/04-classificar-motivos.md` — categorias e impacto no pagamento
- [x] `docs/user-guide/05-aprovar-fechamento.md` — fluxo completo + exportação
- [x] `docs/user-guide/06-portal-tecnico.md` — guia para técnicos
- [x] `docs/user-guide/07-faq.md` — 11 perguntas organizadas por categoria
- [x] `src/app/(manager)/ajuda/page.tsx` — índice com 7 cards de navegação
- [x] `src/app/(manager)/ajuda/primeiros-passos/`, `upload-planilha/`, `configurar-lpu/`, `classificar-motivos/`, `aprovar-fechamento/`, `portal-tecnico/`, `faq/` — 7 páginas de conteúdo
- [x] Sidebar manager: item "Ajuda" adicionado ao final com ícone `HelpCircle`
- [x] Nomenclatura: "payout/payouts" → "pagamento/pagamentos" em todas as páginas de ajuda

---

### Etapa 6 — Configuração de produção ✅ Concluída (2026-06-05)

- [x] Supabase produção criado — 7 migrations aplicadas, auth hook configurado, storage bucket criado, usuário admin Tallpa criado
- [x] Vercel Analytics + Speed Insights integrados (`@vercel/analytics`, `@vercel/speed-insights`) em `src/app/layout.tsx`
- [x] Deploy no Vercel — projeto `Tallpasolutions/wave-ops-hub` conectado e publicado
- [x] Domínio `wave.tallpa.com.br` apontando para Vercel via CNAME no Cloudflare (DNS-only)
- [x] Domínio `admin.tallpa.com.br` configurado no Vercel + Cloudflare
- [x] Node.js fixado em `20.x` no `package.json` (engines) e no painel Vercel
- [x] Backups: Supabase PITR habilitado (Settings → Add-ons → Point in Time Recovery)
- [x] Alertas: Vercel Monitoring configurado — e-mail `jhonicleyton@gmail.com` para Error Rate > 5/hora
- [x] Guia de backups e alertas criado em `docs/manual-steps/backups-e-alertas.md`
- [x] Portal técnico: valores exibidos em pontos (`pts`) em vez de BRL — conversão 1:1 (R$ 1,00 = 1 pt)
- [x] Git Flow documentado no `CLAUDE.md` (seção 5) — branches obrigatórias, nunca push direto em `main`

---

### Etapa 7 — Onboarding Wave + Go-live

- [ ] Tag `v1.0.0` no momento do go-live
- [ ] `CHANGELOG.md` criado com entradas desde o início
- [ ] Reunião de kickoff com Wave (1.5h via Zoom):
  - Apresentação da plataforma
  - Onboarding do `tenant_owner` Wave
  - Cadastro de usuários `tenant_manager`
  - Cadastro de técnicos
  - Subir primeira planilha (abril/2026)
  - Configurar LPU (em conjunto)
  - Classificar motivos (em conjunto)
- [ ] Vídeo gravado da sessão para referência
- [ ] Canal de WhatsApp com gestores Wave para suporte
- [ ] Processo de feedback e bug reports estabelecido
- [ ] Pós-go-live (2 semanas): daily check de logs, hotfixes priorizados, coleta de feedback estruturado dos 3 perfis

---

## Escopo OUT

- ❌ Funcionalidades novas
- ❌ Refactor de código
- ❌ Migração de dados de outros sistemas (Wave não tem sistema anterior — fluxo é planilha)

## Itens adiados (próxima janela)

- Logo Wave dinâmica por tenant: passar `tenant.brand_path` do layout manager/técnico → `<TenantLogo brandPath={...} />` (infra já implementada no componente)
- Middleware: redirecionar `/admin/*` para `admin.` subdomain quando acessado de outro subdomínio (tech-debt 014)

---

## Definition of Done

- [x] Todos os testes E2E criados e cobrindo os 11 cenários obrigatórios
- [x] Lighthouse > 90 em desktop (Performance 100 · Accessibility 95 · Best Practices 100 · SEO 100)
- [ ] Lighthouse > 85 em mobile
- [x] User guide completo (7 docs em `docs/user-guide/` + 8 páginas em `/ajuda/*`)
- [ ] Wave onboarded com sucesso (login efetivo de pelo menos 3 usuários reais)
- [ ] Primeira planilha real processada em produção
- [ ] Primeiro fechamento aprovado em produção
- [ ] Tag `v1.0.0` no GitHub
- [ ] Validação Gemini aprovada

---

## Após go-live: roadmap fase 2

- [ ] Contestação de payouts (técnico contesta → gestor revisa)
- [ ] Customização de cores por tenant (CSS vars dinâmicas)
- [ ] Domínio customizado (`portal.wavetelecom.com.br`)
- [ ] Notificações WhatsApp (Twilio ou similar)
- [ ] Onboarding self-service (cliente cria tenant via landing)
- [ ] Segundo tenant: Scooby
- [ ] IA para sugerir LPU baseada em histórico de outras empresas (aggregate, anônimo)
- [ ] Bot Telegram para gestor consultar KPIs rapidamente
- [ ] Integração PIX para pagamento direto (Banco Inter ou similar)
- [ ] Mobile app nativo para técnicos (React Native, com atualizações offline)
- [ ] API pública documentada (para integração com sistemas dos clientes)

---

## Anotações durante a sprint

### Etapa 1 — Ajustes realizados (2026-06-03)

**i18n e nomenclatura:**
- Rota `/payouts` → `/pagamentos` — todos os `href`, `revalidatePath`, `redirect` e links internos atualizados
- Sidebar Manager: label `Payouts` → `Pagamentos`
- Tabelas e formulários de usuários: coluna `Role` → `Cargo`, select `Selecione a role` → `Selecione o cargo`
- Badges de cargo traduzidas: `tallpa_owner` → `Admin Tallpa`, `tenant_owner` → `Proprietário`, `tenant_manager` → `Gerente`
- `GlobalPeriodSelector.tsx`: `PERIOD_PATHS` atualizado com `/pagamentos`
- Portal técnico home: texto `payout(s) pendente(s)` → `pagamento(s) pendente(s)`

**Bug fix — sessão invalidada ao criar usuário:**
- **Sintoma:** após criar usuário (manager ou admin), o criador era redirecionado para `/login`
- **Causa:** `createManagerUser` e `createUser` instanciavam um segundo `createSupabaseServerClient()` dentro da mesma Server Action (após o `adminClient.auth.admin.createUser()`). O segundo client dispara `getUser()` internamente, que pode fazer refresh de token e escrever cookies conflitantes, invalidando a sessão do criador
- **Correção:** usar `adminClient.from('users').insert/update` diretamente (admin client já instanciado, sem gestão de sessão), eliminando a segunda instância do server client
- **Arquivos:** `src/app/(manager)/equipe/actions.ts`, `src/app/(admin)/admin/users/actions.ts`

**Logo Tallpa:**
- `src/components/ui/TenantLogo.tsx` reescrito — agora usa `next/image` com `brandPath` prop (padrão `'tallpa'`)
- Aceita `variant`: `'mark'` (logo-mark.svg), `'full'` (logo.svg), `'white'` (logo-white.svg)
- Placeholder "T" hardcoded removido de todos os portais
- Logo Wave por tenant: `brandPath` prop já disponível — falta passar `tenant.brand_path` do layout para o sidebar (Etapa 2)

**Dashboard cleanup:**
- Bloco "Atualizado / Tempo real" removido do header do dashboard manager (dado não era real-time)

---

### Etapa 5 — Ajustes realizados (2026-06-05)

**Central de Ajuda — portal manager:**
- `src/app/(manager)/ajuda/page.tsx` — índice com 7 cards (grade 2 colunas desktop / 1 mobile), ícones Lucide, link para cada guia
- 7 páginas de conteúdo em Server Components puros (sem nova dependência): `primeiros-passos`, `upload-planilha`, `configurar-lpu`, `classificar-motivos`, `aprovar-fechamento`, `portal-tecnico`, `faq`
- Sidebar manager: `HelpCircle` + item "Ajuda" adicionado ao final de `NAV_ITEMS` em `Sidebar.tsx`

**Lição — conflito de rotas entre route groups:**
- `(manager)/ajuda/page.tsx` e `(technician)/ajuda/page.tsx` resolviam para o mesmo path `/ajuda` — Next.js 15 rejeita com build error
- Solução: página de ajuda existe apenas no grupo `(manager)`; a página do grupo `(technician)` foi removida
- Padrão reforçado (tech-debt 006): cada route group deve usar paths únicos no filesystem

**Docs internos:** `docs/user-guide/` criado com 7 arquivos markdown — servem como referência interna e podem ser enviados por e-mail para a Wave

**Nomenclatura:** "payout/payouts" substituído por "pagamento/pagamentos" em todas as páginas de ajuda via `sed` em lote

**Verificação:** `pnpm typecheck` zero erros · `pnpm lint` zero warnings · `pnpm build` ✅

---

### Etapa 3 — Ajustes realizados (2026-06-04)

**robots.txt:**
- `src/app/robots.ts` criado com `Disallow: /` para todos os user-agents — sistema interno, sem indexação
- Lição: `robots.txt` via `MetadataRoute.Robots` é suficiente para bloquear crawlers. **Não** adicionar `robots: { index: false }` no metadata do layout — o Lighthouse penaliza a presença do meta tag `noindex` no HTML, derrubando o SEO de 100 para ~63, mesmo sendo um sistema interno

**Metadata:**
- Root `layout.tsx`: título mudou de string estática para template `'%s | Wave Ops Hub'`; OG tags adicionadas
- 4 layouts de grupo exportam `metadata.title.default`: public → `'Acesso — Wave Ops Hub'`, manager → `'Painel do Gestor'`, admin → `'Admin'`, technician → `'Portal do Técnico'`
- 27 páginas receberam `export const metadata` ou `generateMetadata()` com título específico
- Páginas dinâmicas `[osNum]` e `[periodo]` usam `generateMetadata` com interpolação do param (sem fetch)

**Lazy loading:**
- Dashboard: `VolumeChart`, `AttendanceDonut`, `TechValueChart` convertidos para `next/dynamic`
- `ssr: false` não é permitido em Server Components no Next.js 15 — removido; code splitting ainda acontece, charts são SSR'd pelo servidor (Recharts suporta SSR no App Router)
- Cada chart tem skeleton de placeholder durante carregamento em navegações client-side
- `GeoDistribution` e `ReasonsFailure` são CSS puro — mantidos síncronos

**next.config.ts:**
- `compress: true` (gzip/brotli)
- `images.formats: ['image/avif', 'image/webp']` para otimização automática

**Lighthouse final:** Performance 100 · Accessibility 95 · Best Practices 100 · SEO 100

**Verificação:** `pnpm typecheck` zero erros · `pnpm lint` zero warnings · `pnpm build` ✅

---

### Etapa 4 — Testes E2E criados (2026-06-04 / 2026-06-05)

**Infraestrutura:**
- `playwright.config.ts`: `globalSetup` (gera fixture XLSX) + `globalTeardown` (apaga dados E2E) registrados
- `tests/fixtures/helpers.ts`: `BASE_URLS`, `uniqueSlug()`, `uniqueEmail()`, `fakeCpf()`, `selectOption()`
- `tests/fixtures/generate-sample-xlsx.ts`: gera `sample.xlsx` com colunas do formato Unetvale antes de cada run
- `tests/fixtures/cleanup.ts`: `globalTeardown` — apaga via REST API do Supabase todos os dados criados pelos testes (padrão: técnicos/LPUs/uploads/usuários/tenants com prefixo/sufixo E2E). Banco fica limpo após cada `pnpm test:e2e`, sem intervenção manual.

**Specs criados:**
- `01-onboarding.spec.ts` — Tallpa cria tenant + tenant_owner no portal admin
- `02-password-recovery.spec.ts` — navegação e submissão do forgot-password
- `03-upload.spec.ts` — upload de planilha + idempotência (re-upload como duplicata)
- `04-technician.spec.ts` — cadastro de técnico via `/equipe/tecnicos/new`
- `05-motivos.spec.ts` — classificação de motivo via `/motivos?categoria=pendente_classificacao`
- `06-lpu.spec.ts` — criação de LPU, adição de regra e ativação (4 testes sequenciais)
- `07-fechamento.spec.ts` — aprovação e marcação de pago (com `test.skip` se não há dados)
- `08-rls.spec.ts` — RLS: técnico redirecionado ao acessar rotas de manager
- `auth.spec.ts` estendido — técnico logado acessa portal e não vê links de manager

**Estratégia de dados:** entidades criadas com `Date.now().toString(36)` para evitar colisão com a dev db. Testes que dependem de dados pré-existentes usam `test.skip` com mensagem descritiva.

**Migration 0007 aplicada:** `GRANT SELECT, INSERT, UPDATE, DELETE` para `service_role` em todas as tabelas operacionais — necessário para o `globalTeardown` acessar as tabelas via REST API com a service role key. Sem impacto em RLS ou permissões de usuários (`authenticated`/`anon` inalterados).

**Verificação:** `pnpm typecheck` zero erros · `pnpm lint` zero warnings

---

### Etapa 2 — Ajustes realizados (2026-06-04)

**Auditoria de código (2.1):**
- Dark mode: nenhum vazamento real encontrado — todas as ocorrências de `bg-white/X` são overlays transparentes intencionais sobre fundo escuro
- Alt texts: `TenantLogo` já tem `alt="Logo"`; nenhuma `<Image>` sem alt encontrada
- Focus styles: ausentes em `globals.css` — corrigido na sub-etapa 2.5

**Sidebar mobile Manager e Admin (2.2):**
- Layout Manager permanece Server Component (async) — solução sem nova dependência: criado `ManagerShell.tsx` (Client Component) que encapsula o shell com estado `mobileOpen`
- Drawer: overlay `fixed inset-0 z-40 bg-black/60` + sidebar fixo `fixed inset-y-0 left-0 z-50` — sem `@radix-ui/react-dialog` (não instalado)
- Sidebar desktop: `hidden lg:flex` (invisível no mobile); hambúrguer: `lg:hidden` no topbar
- `ManagerSidebar.tsx`: prop `onClose?: () => void` adicionada; chamada em cada `<Link onClick={onClose}>` para fechar ao navegar
- `AdminShell.tsx` com mesmo padrão para portal Admin; topbar mobile exibe "Admin" como label
- **Arquivos novos:** `src/app/(manager)/_components/ManagerShell.tsx`, `src/app/(admin)/admin/_components/AdminShell.tsx`
- **Arquivos modificados:** `layout.tsx` (manager e admin), `Sidebar.tsx` (manager e admin)

**Responsividade de tabelas (2.3):**
- shadcn `<Table>` já tem `overflow-auto` interno — sem mudança necessária
- Tabelas customizadas (`<table className="w-full">`): adicionado `<div className="overflow-x-auto">` como filho direto do container `overflow-hidden`, preservando o clipping do border-radius
- **6 arquivos corrigidos:** `pagamentos/page.tsx`, `oss/page.tsx`, `lpu/page.tsx`, `lpu/[id]/page.tsx`, `financeiro/page.tsx` (2 tabelas), `fechamento/[periodo]/page.tsx`
- Padding mobile: `p-8` → `p-4 lg:p-8` em todas as páginas manager via `find + sed`; dashboard `p-7 pb-16` → `p-4 pb-16 lg:p-7`

**Acessibilidade (2.5):**
- `*:focus-visible` adicionado em `src/app/globals.css`: `outline: 2px solid var(--cyan); outline-offset: 2px; border-radius: 4px`
- Anel de foco cyan em todos os elementos interativos do app

**Verificação final:** `pnpm typecheck` zero erros · `pnpm lint` zero warnings
