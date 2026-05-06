# CLAUDE.md — Instruções Operacionais

> Este arquivo é a **única fonte de verdade** para o Claude Code operar neste projeto.
> Toda regra abaixo é vinculante. Antes de propor qualquer mudança, releia as seções relevantes.

---

## 1. Identidade do projeto

**Nome:** Wave Ops Hub
**Cliente inicial:** Wave Telecom (`wave.tallpa.com.br`)
**Operadora:** Tallpa Solutions
**Tipo:** SaaS multi-tenant operacional

---

## 2. Antes de começar QUALQUER tarefa

Sempre, em ordem:

1. **Leia** [`docs/glossary.md`](./docs/glossary.md) se a tarefa toca regra de negócio
2. **Leia** o ADR relevante em [`docs/architecture/`](./docs/architecture/) se a tarefa toca arquitetura
3. **Identifique a sprint atual** em [`docs/sprints/`](./docs/sprints/) e confirme se a tarefa está dentro do escopo dessa sprint
4. **Se a tarefa NÃO está no escopo da sprint atual**, pare e pergunte ao usuário antes de seguir
5. **Se a tarefa exige decisão arquitetural não documentada**, proponha um ADR antes de codar

---

## 3. Stack travada (não trocar sem ADR novo)

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 20.x LTS |
| Package manager | pnpm | 9.x |
| Framework | Next.js | 15.x (App Router) |
| Linguagem | TypeScript | 5.x estrito |
| UI | React | 19.x |
| Estilo | Tailwind CSS | 3.x |
| Componentes base | shadcn/ui | última estável |
| Charts | Recharts | 2.x |
| Validação | Zod | 3.x |
| ORM | Drizzle | última estável |
| Backend | Supabase | última estável |
| Estado servidor | TanStack Query | 5.x |
| Testes unit | Vitest | última |
| Testes E2E | Playwright | última |

**Trocar qualquer item dessa tabela exige ADR novo aprovado.** Não use bibliotecas alternativas que façam o que essas já fazem (ex: não trocar Recharts por Chart.js, não trocar Drizzle por Prisma).

---

## 4. Convenções de código

### TypeScript
- `strict: true` — sem exceções
- **Zero `any`.** Se precisar, use `unknown` e refine
- Tipos de domínio em `src/types/`
- Schemas Zod ao lado dos tipos quando for input externo

### Nomenclatura
- Arquivos: `kebab-case.ts`, exceto componentes React (`PascalCase.tsx`)
- Funções: `camelCase`
- Componentes: `PascalCase`
- Tipos/interfaces: `PascalCase`
- Constantes: `UPPER_SNAKE_CASE`
- Hooks: `useNomeDoHook`
- Server Actions: `actionName` (sem prefixo, com `'use server'` no topo)

### Estrutura de componentes
```tsx
// 1. Imports (ordem: react → next → libs externas → internas → relativos → tipos)
// 2. Tipos locais
// 3. Constantes locais
// 4. Componente
// 5. Subcomponentes ou helpers (se forem só desse arquivo)
```

### Server vs Client
- **Server Components por padrão** (sem `'use client'`)
- `'use client'` SÓ quando precisar de hooks de estado, eventos do DOM ou bibliotecas que exigem cliente
- Buscar dados sempre em Server Components ou Server Actions
- Mutations sempre em Server Actions (NUNCA fetch direto pra `/api`)

### Imports
- Use `@/` para imports absolutos (configurado em `tsconfig.json`)
- Nunca importe de pastas privadas internas (ex: não importe de `lib/etl/internals/`)

---

## 5. Regras absolutas — NUNCA FAÇA

❌ **Não modificar schema de banco direto no painel Supabase.** Toda alteração é uma migration numerada em `supabase/migrations/`.

❌ **Não criar componentes que fujam do design system.** A referência visual viva é `public/dashboard-reference/dashboard-wave-abril-2026.html` e os tokens em `docs/visual-identity/tokens.md`.

❌ **Não usar libs alternativas para o que já está na stack.** Não trocar Recharts por Chart.js, não trocar Tailwind por styled-components, etc.

❌ **Não fazer `pnpm install <lib>` sem justificativa em ADR.** Toda nova dependência precisa estar listada no ADR correspondente.

❌ **Não burlar RLS.** Toda query no client passa por `supabase` autenticado. Apenas operações administrativas explícitas usam `supabase-admin` (service role) — e SEMPRE em Server Actions, nunca exposto ao cliente.

❌ **Não fazer cálculo de payout fora de `src/lib/payouts/`.** Toda lógica financeira é centralizada lá. Componentes consomem o resultado, não calculam.

❌ **Não fazer parsing de planilha fora de `src/lib/etl/`.** Mesma regra: lógica isolada, wrapper Server Action que apenas orquestra.

❌ **Não criar páginas/rotas fora da estrutura de grupos definida** em `src/app/`. Os grupos são `(public)`, `(admin)`, `(manager)`, `(technician)`. Nada fora disso.

❌ **Não reinventar primitivos.** Antes de criar um Button, Input, Card, Modal, etc — verifique `src/components/ui/`.

❌ **Não fazer queries em Client Components diretamente.** Use Server Components que passam dados como props, ou Server Actions com TanStack Query.

❌ **Não escrever lógica de domínio em componentes.** Componentes recebem dados prontos. Lógica fica em `src/lib/`.

❌ **Não criar mocks ou dados fake em produção.** Dados de teste vão em `supabase/seed.sql` ou em `tests/fixtures/`.

❌ **Não use emojis em código.** Apenas em copy de UI quando aprovado pela identidade visual.

❌ **Não comente código óbvio.** Comentários explicam **por quê**, nunca **o quê**. O código mostra o quê.

❌ **Não faça refactor "de oportunidade" enquanto resolve outra coisa.** Se viu algo pra melhorar fora do escopo da tarefa atual, anote em `docs/tech-debt.md` e siga.

❌ **Não exponha service role key, JWT secret ou qualquer credencial em código client-side.** Toda chamada que precisa de elevação roda em Server Action.

---

## 6. Sempre faça

✅ **Roda `pnpm typecheck` e `pnpm lint` antes de declarar uma tarefa concluída.**

✅ **Escreve testes para lógica de domínio** (`lib/payouts/`, `lib/etl/`, `lib/lpu/`). Componentes não precisam de teste unitário — testes E2E cobrem.

✅ **Atualiza o ADR ou cria novo** se mudou alguma decisão arquitetural.

✅ **Atualiza o glossário** se introduziu novo termo de domínio.

✅ **Roda `pnpm db:generate`** sempre que mudar schema Drizzle, e commita a migration gerada.

✅ **Usa Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `style:`.

✅ **Pequenos commits frequentes.** Um commit = uma mudança lógica.

✅ **Ao terminar uma sprint, atualiza o `docs/sprints/NN-nome.md`** marcando como concluída e listando o que ficou pra próxima.

---

## 7. Glossário rápido (versão completa em `docs/glossary.md`)

| Termo | Significado |
|---|---|
| **OS** | Ordem de Serviço — entidade de negócio identificada por `os_num` (chave da Unetvale) |
| **Visita** | Cada execução individual de uma OS por um técnico (uma linha da planilha) |
| **Tenant** | Cliente da plataforma (Wave, Scooby, etc.) |
| **LPU** | Lista de Preços Unitários — regras de quanto pagar ao técnico por visita |
| **Payout** | Valor calculado a pagar ao técnico por uma visita específica |
| **Deixado na mesa** | Valor potencial de payout perdido por falha atribuível ao técnico |
| **Improdutiva** | Visita executada sem sucesso (motivo varia) |
| **Match engine** | Algoritmo que encontra a regra LPU aplicável a uma visita |
| **Fechamento** | Consolidação mensal dos payouts pra aprovação e pagamento |

---

## 8. Domínio crítico — leia antes de mexer

### Modelagem de OSs e Visitas
Uma OS pode ter **N visitas**. Cada linha da planilha = uma visita. Chave natural da visita: `(tenant_id, os_num, data_execucao, tecnico_id)`. Detalhes em [`docs/domain/01-os-e-visitas.md`](./docs/domain/01-os-e-visitas.md).

### Cálculo de payout
Apenas o técnico da última visita com sucesso recebe o valor de serviço. Improdutivas pagam conforme política do motivo. "Deixado na mesa" só conta motivos categorizados como `falha_tecnico`. Detalhes em [`docs/domain/03-payout.md`](./docs/domain/03-payout.md).

### Multi-tenant
Resolução por subdomínio em middleware. Toda tabela tem `tenant_id`. RLS por tenant. Detalhes em [`docs/architecture/ADR-002-multi-tenant.md`](./docs/architecture/ADR-002-multi-tenant.md).

---

## 9. Quando estiver em dúvida

1. **Se a dúvida é arquitetural** — leia ADRs relevantes. Se não há ADR, pare e proponha um.
2. **Se a dúvida é de domínio** — leia `docs/domain/`. Se não está claro, pergunte ao usuário com opções concretas.
3. **Se a dúvida é visual** — abra `public/dashboard-reference/dashboard-wave-abril-2026.html` e siga aquele padrão.
4. **Se a dúvida é "vale a pena fazer X agora?"** — consulte a sprint atual. Fora do escopo = não.

---

## 10. Validação cruzada com Gemini

Para cada sprint, o plano de implementação é validado pelo Gemini antes do início da execução. Use o checklist em [`docs/validation/gemini-checklist.md`](./docs/validation/gemini-checklist.md).

O fluxo é:

1. Claude Code propõe o plano detalhado da sprint
2. Usuário copia o plano e cola no Gemini junto com o checklist
3. Gemini retorna pontos de atenção
4. Claude Code revisa e ajusta o plano
5. Só então começa a execução
