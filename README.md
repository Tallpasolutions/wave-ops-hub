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

# 4. Rode migrations
pnpm db:push

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
pnpm db:generate      # Drizzle: gera migration de mudanças no schema
pnpm db:push          # Drizzle: aplica migrations
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

🟡 **Em PRD** — Especificação concluída, implementação pendente. Veja [`docs/sprints/00-roadmap.md`](./docs/sprints/00-roadmap.md).

---

Powered by [Tallpa Solutions](https://tallpa.com.br) · Inteligência Operacional · BI · Automação · ERPs Customizados
