# AGENTS.md — Instruções para Antigravity

> Este arquivo orienta o Antigravity neste projeto. As regras são compatíveis e complementares ao [`CLAUDE.md`](./CLAUDE.md). Quando houver conflito aparente, **`CLAUDE.md` prevalece** porque é a fonte canônica.

---

## Princípio operacional

Antigravity opera neste projeto em modo **assistivo, não autônomo**. Não execute mudanças amplas (refactor, mudança de stack, criação de novas pastas top-level) sem confirmação explícita.

---

## Fluxo recomendado

1. **Antes de qualquer ação** — leia `CLAUDE.md`, o glossário e a sprint atual.
2. **Para tarefas pequenas** (bug fix, ajuste visual) — execute direto, mas commite separado.
3. **Para features novas** — primeiro proponha um plano em texto, espere aprovação, depois execute.
4. **Para mudanças de schema** — gere migration via `pnpm db:generate`, NUNCA edite SQL diretamente.

---

## Diferenças relevantes em relação ao Claude Code

- Antigravity é usado em momentos exploratórios ou de revisão visual rápida.
- Para implementações profundas (ETL, motor de regras LPU, cálculo de payout), priorize o Claude Code.
- Antigravity pode ser usado para gerar componentes visuais a partir de descrições — desde que sigam os tokens em `docs/visual-identity/`.

---

## Proibições idênticas ao CLAUDE.md

Aplicam-se todas as proibições da seção 5 do `CLAUDE.md`. Não há exceções por agente.

---

## Quando há conflito

Se o usuário pedir algo que parece conflitar com `CLAUDE.md`:

1. Aponte o ponto específico do `CLAUDE.md` que parece ser violado
2. Pergunte se a intenção é **alterar a regra** (criar ADR novo) ou **fazer uma exceção pontual** (não recomendado)
3. Não execute até resolução
