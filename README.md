# Wave Ops Hub

Plataforma operacional multi-tenant para gestão de Ordens de Serviço, cálculo automático de pagamento de técnicos baseado em LPU (Lista de Preços Unitários) e visualização de indicadores em três níveis de acesso.

**Tenant inicial:** Wave Telecom (`wave.tallpa.com.br`)
**Operadora da plataforma:** Tallpa Solutions

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui + tokens próprios |
| Charts | Recharts |
| Backend | Supabase (Auth + Postgres + Storage) |
| ORM | Drizzle |
| Validação | Zod |
| Estado servidor | TanStack Query |
| ETL | Server Actions Next.js + lib `xlsx` |
| Hospedagem | Vercel (frontend) + Cloudflare (DNS) |
| Repositório | GitHub |
| Testes | Vitest (unit) + Playwright (E2E) |

---

## Documentação

Toda decisão estrutural deste projeto está documentada. **Antes de programar qualquer coisa, leia:**

1. [`CLAUDE.md`](./CLAUDE.md) — Instruções operacionais para Claude Code
2. [`AGENTS.md`](./AGENTS.md) — Instruções operacionais para Antigravity
3. [`docs/glossary.md`](./docs/glossary.md) — Vocabulário do domínio
4. [`docs/architecture/`](./docs/architecture/) — Architecture Decision Records (ADRs)
5. [`docs/sprints/`](./docs/sprints/) — Plano de execução sprint a sprint
6. [`docs/visual-identity/`](./docs/visual-identity/) — Tokens e regras visuais
7. [`docs/domain/`](./docs/domain/) — Regras de negócio detalhadas
8. [`docs/validation/`](./docs/validation/) — Checklists de validação cruzada (Gemini)

---

## Setup local

```bash
# 1. Clone e instale
git clone https://github.com/tallpa/wave-ops-hub.git
cd wave-ops-hub
pnpm install

# 2. Configure .env.local (copie do .env.example)
cp .env.example .env.local

# 3. Inicie Supabase local (opcional para dev offline)
pnpm supabase start

# 4. Aplique migrations manualmente via Supabase SQL Editor ou Supabase CLI
#    (pnpm db:push foi removido — veja seção "Comandos disponíveis")

# 5. Seed inicial
pnpm db:seed

# 6. Dev server
pnpm dev
```

App roda em `http://localhost:3000`. Para testar multi-tenant local, edite `/etc/hosts`:

```
127.0.0.1  wave.tallpa.local
127.0.0.1  admin.tallpa.local
```

E acesse `http://wave.tallpa.local:3000`.

---

## Comandos disponíveis

```bash
pnpm dev              # Next.js dev server
pnpm build            # Production build
pnpm start            # Production server
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest (unit)
pnpm test:e2e         # Playwright (E2E)
pnpm db:generate      # Drizzle: gera SQL sugerido a partir de mudanças no schema TS (revisar antes de usar)
# pnpm db:push — REMOVIDO PROPOSITALMENTE. O SQL em supabase/migrations/ é a fonte de verdade.
#                Aplique migrations manualmente via Supabase SQL Editor ou Supabase CLI.
pnpm db:seed          # Popula banco com dados iniciais
pnpm db:studio        # Drizzle Studio (UI do banco)
```

---

## Estrutura de pastas

```
wave-ops-hub/
├── .github/workflows/         # CI/CD
├── public/
│   ├── brands/                # Logos por tenant
│   │   ├── tallpa/
│   │   ├── wave/
│   │   └── _placeholder/
│   └── dashboard-reference/   # HTML de referência visual aprovado
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (public)/          # Login, recover password
│   │   ├── (admin)/           # Portal Tallpa (god mode)
│   │   ├── (manager)/         # Portal Wave Manager
│   │   ├── (technician)/      # Portal do Técnico
│   │   └── api/
│   ├── components/
│   │   ├── ui/                # Primitivos (Button, Card, Input)
│   │   ├── charts/            # Wrappers Recharts
│   │   ├── kpi/               # KPI cards reutilizáveis
│   │   └── domain/            # Componentes de negócio (OSCard, LPURuleEditor)
│   ├── lib/
│   │   ├── supabase/          # Clientes (server/client/admin)
│   │   ├── etl/               # Parser de planilha + match engine
│   │   ├── lpu/               # Motor de regras
│   │   ├── payouts/           # Cálculo de payouts
│   │   ├── auth/              # Helpers de role/permission
│   │   └── tenant/            # Resolução de tenant por subdomain
│   ├── db/
│   │   ├── schema/            # Schemas Drizzle por domínio
│   │   └── queries/           # Queries reutilizáveis tipadas
│   ├── hooks/
│   └── types/                 # Tipos TS compartilhados
├── supabase/
│   ├── migrations/            # SQL versionado
│   ├── policies/              # RLS policies
│   └── seed.sql               # Dados iniciais
├── docs/
│   ├── architecture/          # ADRs
│   ├── sprints/               # Plano sprint a sprint
│   ├── visual-identity/       # Tokens de design
│   ├── domain/                # Regras de negócio
│   ├── validation/            # Checklists Gemini
│   └── glossary.md
├── tests/
│   ├── unit/
│   └── e2e/
├── CLAUDE.md
├── AGENTS.md
├── README.md
└── package.json
```

---

## Status atual

🟢 **Em produção** desde 2026-06-05 (`wave.tallpa.com.br`). Última entrega: **Sprint 17 — App do
técnico** (PWA instalável + APK Android por sideload + notificação push com o app fechado).

Marcos principais já entregues:

- **Sprints 0–5** — stack, auth multi-tenant, ETL de planilha, motor de LPU, payouts/fechamento, os três portais.
- **Sprints 6–16** — estabilização, dados confiáveis, IQI + produtividade, precisão do payout e ciclo de conferência/contestação do técnico, notificações in-app em tempo real.
- **Sprint 17** — [App do técnico](./docs/sprints/18-sprint-17-app-tecnico.md): PWA (`manifest.ts` + `public/sw.js`), Web Push/VAPID ([ADR-018](./docs/architecture/ADR-018-push-app-fechado.md), `src/lib/push/`) e APK via TWA ([runbook](./docs/manual-steps/apk-tecnico-twa.md)).

Veja o roadmap completo e o histórico sprint a sprint em [`docs/sprints/`](./docs/sprints/).

---

Powered by [Tallpa Solutions](https://tallpa.com.br) · Inteligência Operacional · BI · Automação · ERPs Customizados
