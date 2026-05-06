# ADR-001 — Stack Tecnológica

**Status:** Aceito
**Data:** 2026-05-05
**Decisores:** Jhoni Cleyton (Tallpa)

---

## Contexto

Wave Ops Hub é uma plataforma SaaS multi-tenant para gestão operacional de empresas que executam serviços técnicos em campo (instalação, manutenção, suporte). O sistema precisa servir três personas (admin Tallpa, gestor cliente, técnico) com regras de negócio complexas (LPU, payouts) e capacidade de ingestão de planilhas.

A stack precisa balancear:
- Velocidade de desenvolvimento solo (Tallpa é pequena, dev solo na fase inicial)
- Coerência com outros projetos Tallpa (`tallpa-core`, `noxcom`)
- Custo operacional baixo (ideal < $50/mês na fase inicial)
- Capacidade de escalar pra múltiplos tenants
- Type safety end-to-end

---

## Decisão

### Frontend: Next.js 15 (App Router) + React 19 + TypeScript

**Por quê:**
- App Router permite Server Components, reduzindo JS no cliente
- Server Actions eliminam necessidade de API REST manual
- Multi-tenancy resolvida elegantemente via middleware e route groups
- Mesmo stack do `tallpa-core` — reaproveita conhecimento e padrões

**Considerado e rejeitado:**
- **Remix** — menos maturidade no ecossistema brasileiro, sem ganho relevante para o caso
- **SvelteKit** — Jhoni domina React; trocar paradigma não compensa
- **SPA puro (Vite + React)** — perderia SSR, SEO de marketing pages, e Server Actions

### Estilo: Tailwind CSS + shadcn/ui + tokens próprios

**Por quê:**
- Tailwind elimina arquivo CSS gigante e dor de naming
- shadcn/ui dá componentes prontos copiando para o projeto (não é dependência) — controle total
- Tokens em CSS vars permitem temas por tenant no futuro

**Considerado e rejeitado:**
- **styled-components / emotion** — runtime overhead, integração ruim com RSC
- **Material UI / Chakra** — bundle pesado, customização visual limitada para a identidade Tallpa

### Charts: Recharts

**Por quê:**
- Componentes React nativos — integração natural com RSC
- Suporte adequado a SVG customização (alinhado com identidade visual Tallpa)
- Já validado no `tallpa-core`

**Considerado e rejeitado:**
- **Chart.js** — usado no protótipo HTML, mas é canvas (não SVG); integração React menos elegante
- **D3 puro** — overkill para o caso, curva de aprendizado alta

### Backend: Supabase (Postgres + Auth + Storage)

**Por quê:**
- Postgres real (não pseudo-banco) com RLS nativo — segurança por linha multi-tenant trivial
- Auth completo pronto (signup, login, recuperação, magic link)
- Storage para planilhas com URL assinada e webhook de eventos
- Integração natural com Vercel
- Pricing previsível ($25/mês plano Pro)

**Considerado e rejeitado:**
- **Firebase** — Firestore não é relacional, RLS menos potente, dor pra reportes complexos
- **PocketBase** — single binary, ótimo para projetos pequenos, mas falta robustez para produção crítica
- **Backend próprio (Node + Postgres)** — mais infra para manter, sem ganho real

### ORM: Drizzle

**Por quê:**
- Type-safe end-to-end (schema TS gera tipos)
- Próximo ao SQL real (sem mágica) — melhor pra debug
- Migrations versionadas em arquivos
- Performance superior ao Prisma em queries complexas

**Considerado e rejeitado:**
- **Prisma** — runtime mais lento, abstrai demais, menos compatível com edge runtime
- **TypeORM** — legacy, menos manutenção
- **SQL puro** — sem type safety, perde produtividade

### Hospedagem: Vercel + Cloudflare

**Por quê:**
- Vercel é o lugar natural pra Next.js (deploy zero-config, edge network)
- Cloudflare já é usado pelo domínio `tallpa.com.br` — mantém DNS num lugar só
- Wildcard `*.tallpa.com.br` no Cloudflare aponta para Vercel — multi-tenant trivial

**Considerado e rejeitado:**
- **Self-host (VPS)** — mais infra para manter, sem ganho
- **Netlify** — Next.js roda melhor na Vercel (compatibilidade total)
- **Cloudflare Pages** — Server Actions têm suporte limitado fora do edge

### Linguagem de cálculo de ETL: TypeScript no Next.js

**Por quê:**
- Volume de dados é tranquilo (centenas a milhares de linhas/mês)
- Lib `xlsx` ou `exceljs` em TS faz parser sem problemas
- Mantém um único codebase — Claude Code raciocina melhor sobre tudo num lugar
- Zero infra extra (sem worker Python externo)
- Lógica isolada em `src/lib/etl/` permite migrar para Edge Function ou worker Python no futuro sem refactor de chamadas

**Considerado e rejeitado:**
- **Worker Python (Railway/Fly)** — mais infra, mais custo, mais um deploy. Faz sentido só se ETL ficar muito complexo
- **Supabase Edge Functions (Deno)** — viável, mas separa código em outro runtime; melhor manter unificado por enquanto
- **Cliente-side parsing** — riscos de segurança (planilha pode ter dados sensíveis), sem audit trail confiável

### Validação: Zod

**Por quê:**
- De facto standard no ecossistema TS
- Inferência de tipos a partir de schemas
- Integração nativa com Server Actions e formulários

### Estado servidor: TanStack Query (apenas onde RSC não basta)

**Por quê:**
- A maior parte do app usa Server Components — não precisa de estado de servidor no cliente
- Onde precisa (filtros interativos, polling), TanStack Query é o padrão

### Testes: Vitest (unit) + Playwright (E2E)

**Por quê:**
- Vitest é mais rápido e moderno que Jest, integração nativa com Vite/Next
- Playwright cobre E2E real em browser (cross-browser, visual regression)
- Foco em testar **lógica de domínio** (payouts, ETL, LPU) e **fluxos críticos** (upload → cálculo → fechamento). Não testar componentes triviais.

---

## Consequências

### Positivas
- Stack coerente, moderna, type-safe end-to-end
- Custo operacional inicial < $50/mês ($20 Vercel Pro + $25 Supabase Pro + domínio)
- Velocidade alta para single dev
- Reaproveitamento de conhecimento dos outros projetos Tallpa

### Negativas / Trade-offs aceitos
- Lock-in moderado em Vercel (Server Actions são padrão Next, mas otimizados pra Vercel)
- Lock-in em Supabase (RLS e funções são específicas)
- ETL em TS limita capacidade caso volume cresça muito (mitigação: lógica isolada em `lib/etl/` permite migrar)

---

## Revisão futura

Esta decisão pode ser revisada se:
- Volume de OSs ultrapassar 100k/mês (revisitar runtime de ETL)
- Mais de 50 tenants ativos (revisitar arquitetura multi-tenant)
- Requisitos de compliance forçarem self-hosted (revisitar Supabase)
