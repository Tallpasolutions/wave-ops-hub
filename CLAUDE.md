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
4. **Leia e aplique** [`docs/sprints/regras-de-execucao.md`](./docs/sprints/regras-de-execucao.md) — regras anti-alucinação **vinculantes** para toda sessão, sprint ou fase: evidência antes de afirmação, grep completo antes de declarar bug corrigido, colunas de banco só do schema, DoD fechado apenas com verificação em produção
5. **Se a tarefa NÃO está no escopo da sprint atual**, pare e pergunte ao usuário antes de seguir
6. **Se a tarefa exige decisão arquitetural não documentada**, proponha um ADR antes de codar

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

## 5. Git Flow — obrigatório em produção

O projeto está **em produção** desde 2026-06-05. A branch `main` está protegida — qualquer push direto pode quebrar o sistema ao vivo.

### Regra absoluta

❌ **Não commitar nem fazer push direto em `main`.** Toda alteração de código passa por uma branch e PR, sem exceção.

### Fluxo obrigatório

```bash
# 1. Partir sempre do main atualizado
git checkout main && git pull origin main

# 2. Criar branch com nome descritivo
git checkout -b feat/nome-da-feature
# ou fix/descricao-do-bug
# ou chore/descricao
# ou docs/descricao

# 3. Desenvolver + commits na branch
git add <arquivos> && git commit -m "feat: ..."

# 4. Push da branch
git push origin feat/nome-da-feature

# 5. Abrir PR no GitHub → base: main
# 6. Revisar, aprovar e fazer merge pelo GitHub
```

### Convenção de nomes de branch

| Prefixo | Quando usar |
|---|---|
| `feat/` | Nova funcionalidade |
| `fix/` | Correção de bug |
| `chore/` | Manutenção, dependências, configuração |
| `docs/` | Somente documentação |
| `refactor/` | Refatoração sem mudança de comportamento |

### O que Claude faz nesse fluxo

Ao receber uma tarefa de código, Claude:
1. Cria a branch a partir de `main`
2. Desenvolve e commita na branch
3. Faz push da branch
4. Informa o nome da branch para o usuário abrir o PR no GitHub

Claude **nunca** faz push direto em `main` enquanto o projeto estiver em produção.

---

## 6. Regras absolutas — NUNCA FAÇA

❌ **Não commitar nem fazer push direto em `main` enquanto o projeto estiver em produção.** Todo código vai por branch + PR. Ver seção 5 — Git Flow.

❌ **Não modificar schema de banco direto no painel Supabase.** Toda alteração é uma migration numerada em `supabase/migrations/`.

❌ **Não criar componentes que fujam do design system.** A referência visual viva é `public/dashboard-reference/dashboard-wave-abril-2026.html` e os tokens em `docs/visual-identity/tokens.md`.

❌ **Não usar libs alternativas para o que já está na stack.** Não trocar Recharts por Chart.js, não trocar Tailwind por styled-components, etc.

❌ **Não fazer `pnpm install <lib>` sem justificativa em ADR.** Toda nova dependência precisa estar listada no ADR correspondente.

❌ **Não burlar RLS.** Toda query no client passa por `supabase` autenticado. Apenas operações administrativas explícitas usam `supabase-admin` (service role) — e SEMPRE em Server Actions, nunca exposto ao cliente.

❌ **Não fazer cálculo de payout fora de `src/lib/payouts/`.** Toda lógica financeira é centralizada lá. Componentes consomem o resultado, não calculam.

❌ **Não fazer parsing de planilha fora de `src/lib/etl/`.** Mesma regra: lógica isolada, wrapper Server Action que apenas orquestra.

❌ **Não criar páginas/rotas fora da estrutura de grupos definida** em `src/app/`. Os grupos são `(public)`, `(admin)`, `(manager)`, `(technician)` — mais `(dev)`, que existe só para as telas de diagnóstico locais e não recebe funcionalidade de produto. Nada fora disso.

❌ **Não reinventar primitivos.** Antes de criar um Button, Input, Card, Modal, etc — verifique `src/components/ui/`.

❌ **Não fazer queries em Client Components diretamente.** Use Server Components que passam dados como props, ou Server Actions com TanStack Query.

❌ **Não escrever lógica de domínio em componentes.** Componentes recebem dados prontos. Lógica fica em `src/lib/`.

❌ **Não criar mocks ou dados fake em produção.** Dados de teste vão em `supabase/seed.sql` ou em `tests/fixtures/`.

❌ **Não use emojis em código.** Apenas em copy de UI quando aprovado pela identidade visual.

❌ **Não comente código óbvio.** Comentários explicam **por quê**, nunca **o quê**. O código mostra o quê.

❌ **Não faça refactor "de oportunidade" enquanto resolve outra coisa.** Se viu algo pra melhorar fora do escopo da tarefa atual, anote em `docs/tech-debt.md` e siga.

❌ **Não exponha service role key, JWT secret ou qualquer credencial em código client-side.** Toda chamada que precisa de elevação roda em Server Action.

❌ **Não rodar `pnpm db:push` neste projeto.** O SQL em `supabase/migrations/*.sql` é a fonte de verdade do schema do banco. Os schemas Drizzle existem APENAS para type safety em queries TypeScript. Para mudanças futuras de schema: criar nova migration SQL numerada (ex: `0002_add_xyz.sql`) e aplicar manualmente via Supabase SQL Editor ou Supabase CLI. O comando `pnpm db:generate` pode ser usado pra gerar sugestões de SQL a partir de mudanças no schema Drizzle, mas a saída deve ser revisada e movida manualmente para `supabase/migrations/`.

❌ **Não setar `updatedAt` manualmente em UPDATE queries.** O banco tem um trigger `set_updated_at()` que dispara automaticamente em todo UPDATE. Setar manualmente é redundante e pode mascarar bugs. Se precisar do timestamp atualizado após um UPDATE, use cláusula RETURNING ou faça SELECT depois.

❌ **Não referenciar colunas do banco com nomes errados.** Sempre use o snake_case exato definido em `supabase/migrations/0001_initial_schema.sql`. O campo do técnico é `tecnico_id` (português), NÃO `technician_id` (inglês). Erros de nome em queries Supabase/PostgREST falham **silenciosamente** — retornam resultado vazio sem nenhum erro visível.

❌ **Não comparar o campo `sucesso` com string literal direta.** O valor é armazenado exatamente como vem da planilha (`"Sim"`, `"Sim Instalado"`, variantes futuras). Sempre use o padrão:
```typescript
const isSuccess = (v: { sucesso: string | null }) =>
  v.sucesso?.trim().toLowerCase().startsWith('sim') ?? false
```
Comparar com `=== 'Sim'` perde variantes. Comparar com `=== 'sim'` nunca casa (banco preserva maiúscula).

❌ **Não colocar `redirect()` dentro de `try-catch` em Server Actions.** Em Next.js 15, `redirect()` lança um erro especial internamente. Se estiver dentro de um `try-catch`, o catch captura o erro e o `redirect()` não acontece — o Next.js então redireciona para a página de login como fallback. Padrão obrigatório:
```typescript
export async function minhaAction(id: string): Promise<void> {
  try {
    // operações
  } catch {
    // swallow — o redirect abaixo deve sempre executar
  }
  redirect('/destino')  // SEMPRE fora do try-catch
}
```
Também: `redirect` deve ser importado estaticamente no topo do arquivo (`import { redirect } from 'next/navigation'`), nunca dentro da função.

❌ **Não alterar a ordem de precedência de `buildPayoutUpsert` sem ADR.** A função tem saídas antecipadas (improdutiva por receita → 29,30 → homologação → Venda Produto Externo → cabeamento → LPU) e a ordem **é** a decisão de domínio: homologação precede a LPU porque a finalidade da Unetvale ("Instalação - Fibra") casaria instalação real e pagaria 3x o correto. A ordem está documentada em [`docs/domain/03-payout.md`](./docs/domain/03-payout.md#ordem-de-precedência-do-cálculo) — leia antes de inserir qualquer regra nova.

❌ **Não destravar payouts no recálculo.** `recalculate-batch.ts` pula `approved`, `paid`, `contestado` e qualquer payout com `override_by`. Reprocessar um `contestado` apaga o status enquanto a contestação segue aberta em `payout_contestacoes` — inconsistência silenciosa. Ver [ADR-013](./docs/architecture/ADR-013-aprovacao-contestacao-tecnico.md).

❌ **Não inserir em `notifications` direto.** Notificações que cruzam usuários (técnico ↔ gestores) passam por `src/lib/notifications/notify.ts` (service role, `server-only`), que resolve `users.id` a partir de `technician_id` — são entidades diferentes, e confundi-las faz a notificação sumir sem erro. Ver [ADR-017](./docs/architecture/ADR-017-notificacoes-realtime.md).

❌ **Não assinar canal Realtime sem autenticar a conexão.** Chame `supabase.realtime.setAuth(access_token)` **antes** do `subscribe()` e reaplique em `onAuthStateChange`. Sem isso a conexão é anônima, `auth.uid()` é nulo, a RLS não casa e o Postgres **não entrega os eventos** — sem nenhum erro visível.

❌ **Não mover a coleta do IQI para a Vercel.** A Unetvale bloqueia os IPs de datacenter da Vercel — 100% timeout. A coleta roda no runner do GitHub Actions (`scripts/collect-iqi.ts` + `.github/workflows/iqi-cron.yml`); a Server Action apenas dispara o workflow. Ver [ADR-012](./docs/architecture/ADR-012-iqi-ingestao-scraping.md).

---

## 6. Sempre faça

✅ **Roda `pnpm typecheck` e `pnpm lint` antes de declarar uma tarefa concluída.**

✅ **Escreve testes para lógica de domínio** (`lib/payouts/`, `lib/etl/`, `lib/lpu/`). Componentes não precisam de teste unitário — testes E2E cobrem.

✅ **Atualiza o ADR ou cria novo** se mudou alguma decisão arquitetural.

✅ **Atualiza o glossário** se introduziu novo termo de domínio.

✅ **Roda `pnpm db:generate`** sempre que mudar schema Drizzle, e commita a migration gerada.

✅ **Cria branch antes de qualquer alteração de código.** `git checkout -b feat/nome` a partir de `main` atualizado. Ver seção 5.

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
| **Contestação** | Técnico discorda da pontuação de uma OS; trava o payout e bloqueia a aprovação do fechamento até a Wave resolver |
| **Conferência** | Etapa em que cada técnico aprova ou contesta o próprio período, entre "Solicitar aprovação" e a aprovação da Wave |
| **Coluna Z** | `explicacao_valor` da planilha — descreve o serviço real quando a finalidade é ambígua (homologação, pontos adicionais, cabeamento) |
| **IQI** | Índice de reincidência **calculado pela Unetvale**, raspado e persistido em `iqi_snapshots`; sempre "as-of" a última sincronização |
| **Pontos (`pts`)** | Como os valores de payout aparecem no painel do técnico (mesmo número, sem símbolo de moeda) |

---

## 8. Domínio crítico — leia antes de mexer

### Modelagem de OSs e Visitas
Uma OS pode ter **N visitas**. Cada linha da planilha = uma visita. Chave natural da visita: `(tenant_id, os_num, data_execucao, tecnico_id)`. Detalhes em [`docs/domain/01-os-e-visitas.md`](./docs/domain/01-os-e-visitas.md).

### Cálculo de payout
Apenas o técnico da última visita com sucesso recebe o valor de serviço. Improdutivas pagam conforme política do motivo. "Deixado na mesa" só conta motivos categorizados como `falha_tecnico`.

**A LPU não é o único caminho.** `buildPayoutUpsert` decide por saídas antecipadas — improdutiva por receita da Unetvale, R$ 29,30, homologação (ADR-015), Venda Produto Externo e cabeamento (ADR-009) precedem o motor de LPU; depois incidem pontos adicionais (ADR-016) e o acréscimo de domingo/feriado (ADR-011). A LPU aplicável ainda é resolvida por técnico (ADR-014). A ordem completa está em [`docs/domain/03-payout.md`](./docs/domain/03-payout.md#ordem-de-precedência-do-cálculo) — **leia antes de tocar em qualquer regra financeira**.

### Conferência e contestação do técnico
Entre "Solicitar aprovação" e a aprovação da Wave, cada técnico aprova ou contesta seu período. Contestação aberta trava o payout (`contestado`) e bloqueia a aprovação do fechamento. Detalhes em [`ADR-013`](./docs/architecture/ADR-013-aprovacao-contestacao-tecnico.md).

### Multi-tenant
Resolução por subdomínio em middleware. Toda tabela tem `tenant_id`. RLS por tenant. Detalhes em [`docs/architecture/ADR-002-multi-tenant.md`](./docs/architecture/ADR-002-multi-tenant.md).

---

## 9. Quando estiver em dúvida

1. **Se a dúvida é arquitetural** — leia ADRs relevantes. Se não há ADR, pare e proponha um.
2. **Se a dúvida é de domínio** — leia `docs/domain/`. Se não está claro, pergunte ao usuário com opções concretas.
3. **Se a dúvida é visual** — abra `public/dashboard-reference/dashboard-wave-abril-2026.html` e siga aquele padrão.
4. **Se a dúvida é "vale a pena fazer X agora?"** — consulte a sprint atual. Fora do escopo = não.

---

## 10. Idioma de comunicação

**Toda comunicação com o usuário é em português brasileiro.** Isso inclui: respostas no chat, resumos de tarefas, descrições de erros, mensagens de commit, comentários em PRs, e qualquer texto que o usuário veja diretamente.

Código usa inglês (nomes de variáveis, funções, tipos, constantes, comentários técnicos internos) — esse é o padrão da stack. Mas tudo que o Claude escreve para o usuário ler é em PT-BR, sem exceção.

---

## 11. Validação cruzada com Gemini

Para cada sprint, o plano de implementação é validado pelo Gemini antes do início da execução. Use o checklist em [`docs/validation/gemini-checklist.md`](./docs/validation/gemini-checklist.md).

O fluxo é:

1. Claude Code propõe o plano detalhado da sprint
2. Usuário copia o plano e cola no Gemini junto com o checklist
3. Gemini retorna pontos de atenção
4. Claude Code revisa e ajusta o plano
5. Só então começa a execução
