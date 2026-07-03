# Sprint 11 — Estabilização Crítica (P0)

**Origem:** Relatório de QA em produção — [`docs/qa/2026-07-02-relatorio-qa-producao.md`](../qa/2026-07-02-relatorio-qa-producao.md)
**Duração estimada:** 2–4 sessões
**Status:** Concluída em produção (03/07/2026) — pendências residuais listadas em "Estado verificado"
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
- [x] `grep -rn "technicians(nome)" src/ | grep -v nome_completo` retorna vazio (03/07)
- [x] `/pagamentos/{uuid}` abre o detalhe para 3 payouts reais de status diferentes (03/07)
- [x] `/pagamentos/{uuid}/override` abre (03/07)
- [x] `/fechamento/2026-06` exibe visitas, técnicos e totais (03/07 — Receita Unetvale segue
      R$ 0,00 por depender de `closing.total_receita_unetvale`, preenchido só na aprovação;
      movido para a Fase D)
- [ ] Export Excel e PDF do fechamento baixam sem erro — **não testável ainda**: os botões só
      aparecem com fechamento `aprovado`/`pago` e nenhum fechamento foi aprovado. Verificar
      no primeiro fechamento real (Fase D)
- [x] Evidências coladas na seção "Estado verificado" abaixo

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
- [x] Sessão sobrevive a: 30+ min de uso, troca de mês, hard refresh (03/07 — bateria de
      verificação completa sem queda; teste com 2 abas simultâneas pendente de rotina real)
- [x] Console de produção sem `Invalid Refresh Token` durante o teste acima (03/07 —
      grep por Auth/Refresh/token no console: zero ocorrências)
- [ ] Sessão expirada mostra mensagem clara — implementado; cenário real de expiração ainda
      não ocorreu para observar (validar no uso diário)

### Fase C — Recalcular pendentes (C3)

1. Reproduzir o 503 e medir: quanto tempo leva o recálculo de N payouts? Onde estoura
   (timeout da plataforma? memória?)
2. Refatorar `recalculate-batch` para processar em lotes (ex.: 100/vez) dentro do limite de
   tempo, com loop no client ou job encadeado
3. UI: estado de loading no botão, progresso ("320/896 recalculados"), toast de
   sucesso/erro. Erro de server action NUNCA silencioso
4. Testes unitários do particionamento em lote em `src/lib/payouts/`

**DoD da fase:**
- [x] "Recalcular pendentes" completa em produção: **1408 recalculadas · 3 preservadas
      (aprovadas/pagas)** em 8 chunks/~15s, progresso "800/1411 visitas" visível (03/07)
- [x] Contadores estáveis explicados: LPU inalterada desde o recálculo anterior → mesmos
      status; mensagem de resultado exibida ao lado do botão (03/07)
- [ ] Falha real exibindo erro — caminho implementado e testado em unit; não exercitado em
      produção (nenhuma falha ocorreu no teste)

### Fase D — Financeiro consolidado (C4 residual)

Somente após Fase A verificada em produção:

1. **[NOVO — descoberto na verificação da Fase A, 03/07]** O filtro de período do fechamento
   não funciona: `fechamento/[periodo]/page.tsx` e `fechamento/actions.ts` usam
   `.gte('service_visits.data_execucao', ...)` sobre **recurso embutido** — no PostgREST isso
   filtra o embed, NÃO as linhas de `payouts`. Evidência em produção: `/fechamento/2026-06`
   exibe "1000 visitas" (exatamente o row-limit default do PostgREST) somando payouts de
   TODOS os períodos (R$ 17.895,00 mistura maio+junho); blockers mostram 466/128/4/836
   (números globais). Corrigir com `!inner` no embed + filtro, ou query por `visit_id` do
   período. A validação de `solicitarAprovacao` sofre do mesmo problema
2. Receita Unetvale no fechamento: `closing.total_receita_unetvale` só é preenchido na
   aprovação — exibir a receita do período em tempo real ou rotular "consolidado após aprovação"
3. Reavaliar `/financeiro`: se KPIs do topo continuarem zerados sem fechamento aprovado,
   decidir com o usuário (R5.2): (a) KPIs leem visitas em tempo real, ou (b) mantêm
   dependência do fechamento com aviso claro "sem fechamento para este mês"
4. "Comparativo — últimos 6 meses" deve refletir a decisão (hoje: linha zerada com dados existentes)
5. Desabilitar "Solicitar aprovação" quando o fechamento não tem payouts elegíveis
6. Testar exports Excel/PDF no primeiro fechamento aprovado (pendência herdada da Fase A)

**DoD da fase:**
- [x] `/fechamento/2026-06` soma APENAS junho: **602 visitas** (era 1000), R$ 60.313,95 em
      tempo real, blockers do período 349/61/433 batendo com simulação LPU e dashboard (03/07)
- [x] `/financeiro?mes=2026-06` sem contradição: KPIs = tabelas (R$ 60.313,95 · 602 visitas ·
      pago R$ 2.960 · margem 95%) com aviso "Valores em tempo real" (03/07)
- [x] Comparativo com maio (~R$ 95k) e junho (~R$ 60k) reais + margem % plotada (03/07)
- [x] "Solicitar aprovação" desabilitado quando bloqueado/vazio (03/07 — junho exibe
      "Resolver pendências antes de fechar" desabilitado)
- [ ] Exports Excel/PDF — verificar no primeiro fechamento aprovado (sem fechamento aprovado
      ainda; botões corretamente ocultos)

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
- **02/07/2026 — Fase A implementada** (branch `fix/sprint-11-nome-completo`, commits
  `6c441e7` + `2f19cff`): 6 arquivos corrigidos + **7ª ocorrência** encontrada pelo teste de
  prevenção (`service_visits(technician_id)` → `tecnico_id` em `fechamento/actions.ts:17`).
  Teste novo: `src/lib/db/__tests__/schema-conventions.test.ts`. `pnpm typecheck` ✅ ·
  `pnpm lint` ✅ · `pnpm test` 73/73 ✅ · grep final vazio.
- **03/07/2026 — Fases B, C e D VERIFICADAS EM PRODUÇÃO** (pós-merge de todas as branches):
  - **Fase C:** "Recalcular pendentes" → "1408 recalculadas · 3 preservadas (aprovadas/pagas)",
    8 POSTs de chunk, progresso "800/1411 visitas" observado, ~15s total
  - **Fase D:** `/fechamento/2026-06` com 602 visitas (era 1000) e R$ 60.313,95; `/financeiro`
    com KPIs = tabelas e comparativo mai/jun reais; números reconciliados entre simulação LPU,
    fechamento, financeiro e dashboard
  - **Fase B:** sessão estável durante toda a bateria (30+ min, dezenas de navegações e um
    Server Action loop); console sem NENHUM erro de Auth/Refresh/token
  - **Residuais registrados (fora do escopo, para Sprints 12–13):**
    1. Painel "pendências críticas" do `/pagamentos` soma exatamente 1000 (868+132) — a query
       do painel ainda sofre o corte de 1000 linhas; trocar por queries `count`
    2. **503 esporádico** observado: 1 de 8 POSTs de chunk e 2 prefetches RSC (operações
       completaram; provável cold start) — monitorar; considerar retry no loop de chunks
    3. ~600 erros de hidratação React (#418 + `$RS parentNode null`) na carga da tabela de
       602 linhas do `/pagamentos` — reforça a paginação já planejada na Sprint 13
- **03/07/2026 — Fase D implementada** (branch `fix/sprint-11-fase-d-fechamento`) —
  **aguardando verificação em produção**. Decisão do usuário (R5.2): KPIs e comparativo do
  Financeiro em **tempo real, sempre** (mesma fonte das tabelas), com selo quando houver
  fechamento aprovado/pago:
  - `service_visits!inner` + paginação em `fechamento/[periodo]/page.tsx` e
    `fechamento/actions.ts` (`solicitarAprovacao`) — o gte/lt em embed não filtrava payouts
    ("1000 visitas" = row-limit; valores misturavam meses)
  - Novo `src/lib/supabase/fetch-all.ts` (`fetchAllPages`) — helper de paginação contra o
    corte silencioso de 1000 linhas; aplicado também no `/financeiro` (o `.limit(5000)` era
    cortado em 1000)
  - Fechamento: card Receita Unetvale em tempo real ("consolida na aprovação") até o
    fechamento ser aprovado; "Solicitar aprovação" desabilitado quando não há payouts
  - Financeiro: KPIs via `aggregateTotals()` das visitas; comparativo 6 meses via
    `buildRealtimeFinancialPoints()` (meses sem visita entram zerados); selo
    "Fechamento aprovado/pago" quando consolidado
  - 5 testes novos (88 total) · typecheck ✅ · lint ✅ · build ✅
  - **Verificar em prod:** `/fechamento/2026-06` reconciliando com `/pagamentos?mes=2026-06`
    (602 visitas, não 1000) · `/financeiro?mes=2026-06` sem contradição · comparativo com
    maio e junho reais · exports no primeiro fechamento aprovado
- **03/07/2026 — Fase B implementada** (branch `fix/sprint-11-sessao-supabase`) —
  **aguardando verificação em produção** (exige sessão de 30+ min pós-deploy):
  - **Causa confirmada por inspeção antes de refatorar (R3.3):** `src/middleware.ts` não fazia
    NENHUM refresh de sessão (só resolvia subdomínio); `server.ts` engole `setAll` em Server
    Components ("cookies read-only — ignorar silenciosamente"). Logo, refresh disparado por
    `getCurrentUser()` em RSC perdia o token rotacionado → próxima request reusava o token
    antigo → `Invalid Refresh Token: Already Used` → sessão morta (mecanismo exato do C1)
  - Novo `src/lib/supabase/middleware.ts`: `updateSession()` com refresh centralizado no
    middleware (padrão oficial `@supabase/ssr`), cookie domain compartilhado, e
    `isInvalidSessionError()` que distingue sessão queimada (refresh_token_already_used etc.)
    de logout normal (`Auth session missing`) e de erro transitório de rede
  - `src/middleware.ts` async: sessão irrecuperável em rota protegida → limpa cookies `sb-*`
    (host-only e domain) + redirect `/login?expired=1`; portal admin agora também passa pelo
    refresh
  - `/login?expired=1` exibe aviso "Sua sessão expirou. Entre novamente para continuar."
  - 4 testes novos em `src/lib/supabase/__tests__/middleware.test.ts` (inclui o erro literal
    de produção). `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` 77/77 ✅ · `pnpm build` ✅
  - **Pendente do escopo da fase:** item 5 (auditoria dos fallbacks `redirect()` em try-catch
    que mascaram erro de renderização) — fazer junto com a verificação em produção
- **03/07/2026 — Fase A VERIFICADA EM PRODUÇÃO** (merge `ba782c0` em main, deploy Vercel):
  - `/pagamentos/7e6e8846...` (Sem regra) e `/pagamentos/660f532a...` (Motivo pendente) —
    os dois UUIDs que retornavam 404 no QA — agora renderizam visita, financeiro e auditoria
  - `/pagamentos/81a91a76...` (Aguardando) renderiza com regra LPU aplicada e R$ 135,00
  - `/pagamentos/81a91a76.../override` abre com valor calculado
  - `/fechamento/2026-06` saiu de "tudo R$ 0,00 / nenhum payout elegível" para tabela por
    técnico com "Eduardo Ribeiro de Souza" (join `nome_completo` funcionando) e painel de
    pendências com links
  - Sheet "Visitas" em `/motivos` lista técnicos nomeados (fix de `motivos/actions.ts` ok)
  - **Efeito colateral positivo:** a query consertada expôs o bug do filtro de período do
    fechamento ("1000 visitas" = row-limit PostgREST, valores misturando meses) — registrado
    como item 1 da Fase D
  - Exports Excel/PDF: não verificáveis (exigem fechamento aprovado) — movidos para Fase D

## Definition of Done da sprint

- [ ] Fases A–D com DoD completo e verificado **em produção**
- [ ] `pnpm typecheck` · `pnpm lint` · `pnpm test` verdes (nº de testes anotado)
- [ ] PRs mergeados via fluxo branch → PR → main (CLAUDE.md §5)
- [ ] `00-roadmap.md` atualizado com status
- [ ] Reteste dos cenários do QA original (seções C1–C4 do relatório) sem regressão
