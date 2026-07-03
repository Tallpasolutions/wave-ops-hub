# Sprint 11 — Estabilização Crítica (P0)

**Origem:** Relatório de QA em produção — [`docs/qa/2026-07-02-relatorio-qa-producao.md`](../qa/2026-07-02-relatorio-qa-producao.md)
**Duração estimada:** 2–4 sessões
**Status:** Planejada
**Regras de execução:** [`regras-de-execucao.md`](./regras-de-execucao.md) — leitura obrigatória a cada sessão

---

## Objetivo

Eliminar os 4 bugs críticos que tornam o fluxo financeiro inoperante e a sessão instável.
Nada além disso entra nesta sprint.

## Contexto verificado (02/07/2026)

- **C2 e C4 têm a mesma causa raiz já localizada:** `technicians(nome)` (coluna correta:
  `nome_completo`) em 6 arquivos. Verificado com
  `grep -rn "technicians(nome)" src/ | grep -v nome_completo`:
  1. `src/app/(manager)/pagamentos/[id]/page.tsx:69`
  2. `src/app/(manager)/pagamentos/[id]/override/page.tsx:26`
  3. `src/app/(manager)/motivos/actions.ts:30`
  4. `src/app/(manager)/fechamento/[periodo]/page.tsx:89`
  5. `src/app/(manager)/fechamento/[periodo]/export/pdf/route.ts:35`
  6. `src/app/(manager)/fechamento/[periodo]/export/excel/route.ts:35`
- **C1:** console de produção registrou `AuthApiError: Invalid Refresh Token: Already Used` (2×)
  seguido de tela preta e loop de login.
- **C3:** POST do Server Action "Recalcular pendentes" retornou **503** em produção, sem
  qualquer feedback na UI. 896 payouts pendentes no momento do teste.

---

## Fases

### Fase A — Varredura `technicians(nome)` → `nome_completo` (corrige C2 + C4)

**Escopo:** os 6 arquivos listados acima + revalidação do padrão inteiro.

1. `grep -rn "technicians(nome)" src/` — confirmar a lista atual (pode ter mudado)
2. Corrigir todas as ocorrências para `technicians(nome_completo)` e ajustar os tipos/JSX que
   consomem o campo
3. Adicionar tratamento do campo `error` em cada query alterada (log com contexto)
4. **Prevenção de regressão:** criar teste (ou script de CI simples) que falha se
   `technicians(nome)` sem `_completo` reaparecer em `src/`

**DoD da fase (verificar em produção pós-deploy):**
- [ ] `grep -rn "technicians(nome)" src/ | grep -v nome_completo` retorna vazio
- [ ] `/pagamentos/{uuid}` abre o detalhe para 3 payouts reais de status diferentes
- [ ] `/pagamentos/{uuid}/override` abre
- [ ] `/fechamento/2026-06` exibe visitas, técnicos e Receita Unetvale > R$ 0
- [ ] Export Excel e PDF do fechamento baixam sem erro
- [ ] Evidências coladas na seção "Estado verificado" abaixo

### Fase B — Sessão Supabase (C1)

1. **Reproduzir/evidenciar primeiro** (R3.3): revisar `src/middleware.ts` e todos os pontos
   que criam client Supabase (`createServerClient` / `createBrowserClient`) — mapear quem
   pode disparar refresh concorrente
2. Centralizar o refresh no middleware (`supabase.auth.getUser()` no middleware, cookies
   propagados corretamente na response), conforme padrão oficial `@supabase/ssr`
3. Client browser: garantir instância única (singleton) e sem auto-refresh concorrente com o servidor
4. Tratar sessão inválida com redirect limpo para `/login?expired=1` + mensagem "Sessão
   expirada" — nunca tela preta
5. Revisar fallbacks `redirect()` que mascaram erro de renderização (padrão CLAUDE.md §6)

**DoD da fase:**
- [ ] Sessão sobrevive a: 30+ min de uso, troca de mês, 2 abas simultâneas, hard refresh
- [ ] Console de produção sem `Invalid Refresh Token` durante o teste acima
- [ ] Sessão expirada mostra mensagem clara, não tela preta nem loop

### Fase C — Recalcular pendentes (C3)

1. Reproduzir o 503 e medir: quanto tempo leva o recálculo de N payouts? Onde estoura
   (timeout da plataforma? memória?)
2. Refatorar `recalculate-batch` para processar em lotes (ex.: 100/vez) dentro do limite de
   tempo, com loop no client ou job encadeado
3. UI: estado de loading no botão, progresso ("320/896 recalculados"), toast de
   sucesso/erro. Erro de server action NUNCA silencioso
4. Testes unitários do particionamento em lote em `src/lib/payouts/`

**DoD da fase:**
- [ ] "Recalcular pendentes" completa em produção com os ~896 payouts reais sem 503
- [ ] Contadores de pendências mudam após o recálculo (ou mensagem explica por que não)
- [ ] Falha simulada exibe toast de erro

### Fase D — Financeiro consolidado (C4 residual)

Somente após Fase A verificada em produção:

1. Reavaliar `/financeiro`: se KPIs do topo continuarem zerados sem fechamento aprovado,
   decidir com o usuário (R5.2): (a) KPIs leem visitas em tempo real, ou (b) mantêm
   dependência do fechamento com aviso claro "sem fechamento para este mês"
2. "Comparativo — últimos 6 meses" deve refletir a decisão (hoje: linha zerada com dados existentes)
3. Desabilitar "Solicitar aprovação" quando o fechamento não tem payouts elegíveis

**DoD da fase:**
- [ ] `/financeiro?mes=2026-06` sem contradição interna (KPIs × tabela por finalidade)
- [ ] Comparativo mostra maio e junho com valores reais
- [ ] "Solicitar aprovação" desabilitado (com explicação) quando vazio

---

## Fora do escopo desta sprint

Encoding/mojibake (Sprint 12) · vínculo de técnicos (Sprint 12) · guard rails de aprovação
(Sprint 12) · período persistente (Sprint 13) · paginação (Sprint 13) · cosméticos (Sprint 14).
Qualquer achado novo → `docs/tech-debt.md`.

## Checklist anti-alucinação da sprint

```text
[ ] Fase A: grep rodado NA SESSÃO antes e depois — lista de arquivos pode ter mudado
[ ] Fase A: cada uma das 6 telas/rotas testada em produção após deploy (não inferir da 1ª)
[ ] Fase B: causa confirmada com console/network antes de refatorar auth
[ ] Fase C: 503 reproduzido e medido antes de escolher tamanho de lote
[ ] Fase D: só inicia após Fase A verificada em produção (o fechamento pode "se consertar" sozinho)
[ ] Nenhum DoD marcado sem evidência colada em "Estado verificado"
```

## Estado verificado

> Atualizar a cada fase concluída: data, evidência (comando + saída, URL testada, print).

- **02/07/2026 — QA:** bugs C1–C4 reproduzidos em produção; grep das 6 ocorrências rodado
  (lista no Contexto acima). Nenhuma fase iniciada.

## Definition of Done da sprint

- [ ] Fases A–D com DoD completo e verificado **em produção**
- [ ] `pnpm typecheck` · `pnpm lint` · `pnpm test` verdes (nº de testes anotado)
- [ ] PRs mergeados via fluxo branch → PR → main (CLAUDE.md §5)
- [ ] `00-roadmap.md` atualizado com status
- [ ] Reteste dos cenários do QA original (seções C1–C4 do relatório) sem regressão
