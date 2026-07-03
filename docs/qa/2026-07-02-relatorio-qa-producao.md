# Relatório de QA em Produção — 02/07/2026

**Ambiente:** `https://wave.tallpa.com.br` (produção)
**Usuário de teste:** `teste@tallpa.com.br` (Gestor Wave, `tenant_manager`)
**Escopo:** login, dashboard, OSs, pagamentos, improdutivas/aprovação, LPU, motivos, equipe, técnicos, uploads, fechamento, financeiro, logout
**Método:** navegação sistemática com monitoramento de console, network e medição de tempos de carregamento

> **Mudanças de estado feitas em produção durante o teste** (auditoria):
> motivo "APR Impedida" classificado como *Falha do Sistema/Wave* (não paga);
> improdutiva #564250 aprovada; #567206 (falha cliente) rejeitada;
> #568740 e #567206 (sem tempo, ambas PENDENTE) aprovadas em lote.
> Badge de Aprovação: 332 → 328. O clique em "Recalcular pendentes" falhou (503) e não alterou nada.

---

## Seção 1 — Resumo executivo

**Estado geral:** base sólida — visual consistente, timeline de OSs correta, lógica de payout
na visita certa, fluxo de aprovação de improdutivas rápido, LPU legível. Porém o sistema está
**comprometido para o fluxo financeiro fim-a-fim**: o gestor aprova improdutivas, mas não
consegue auditar um pagamento (404), não consegue recalcular pendências (503), e o
fechamento/financeiro consolidado mostra tudo zerado. Somado ao bug de sessão que derruba o
usuário para o login, a experiência hoje é de um sistema instável, apesar de os dados
operacionais (dashboard, OSs) estarem ricos.

**Bugs por severidade:** 4 críticos · 9 moderados · 6 cosméticos

**3 melhorias de maior impacto:**

1. **Estabilizar a sessão** (refresh token race) — sem isso, qualquer outro fluxo é loteria
2. **Consertar a cadeia financeira**: detalhe de pagamento (404) + recalcular (503) + fechamento zerado
3. **Sanear o ETL**: corrigir encoding (mojibake) e criar vínculo automático/assistido de técnicos

---

## Seção 2 — Bugs encontrados

### Críticos

#### C1 · Sessão derrubada — "Invalid Refresh Token: Already Used"

- **URL:** global (observado em `/dashboard`)
- **O que acontece:** minutos após o login, o refresh de token do Supabase entra em corrida
  (duas requisições concorrentes renovam o mesmo token; a rotação invalida a sessão).
  Sintomas: área de conteúdo **totalmente preta** ao trocar o mês (sem erro, sem skeleton),
  depois qualquer navegação redireciona para `/login`, criando **loop de login**.
  Console: `AuthApiError: Invalid Refresh Token: Already Used` (2×).
- **Como reproduzir:** logar; manter o app aberto (ou 2 abas normais); navegar/trocar
  período após alguns minutos. Em aba anônima (sessão nova) funciona — confirma que é
  estado de token, não dados.
- **Impacto:** o gestor é expulso do sistema no meio do trabalho; na pior forma, não
  consegue nem voltar a entrar sem limpar cookies.
- **Correção sugerida:** revisar o padrão `@supabase/ssr` — refresh centralizado no
  middleware (`getUser()`), nunca em múltiplos clients concorrentes; revisar fallback de
  erro → login (padrão `redirect()` em try-catch documentado no CLAUDE.md) que mascara o erro real.

#### C2 · Detalhe de pagamento retorna 404 para todos os registros

- **URL:** `/pagamentos/{uuid}`
- **O que acontece:** clicar em "Detalhes →" em qualquer linha abre a rota (título da aba
  "Detalhe do Pagamento") mas renderiza "404 — Página Não Encontrada". Testado com 3
  pagamentos de status diferentes (Aguardando, Sem regra, Motivo pendente): **3/3 falham**.
- **Como reproduzir:** `/pagamentos?mes=2026-06` → clicar em qualquer "Detalhes →".
- **Impacto:** impossível auditar um pagamento individual — bloqueia o fluxo de revisão/aprovação.
- **Causa raiz confirmada no código (pós-relatório):**
  `src/app/(manager)/pagamentos/[id]/page.tsx:69` usa `technicians(nome)` — a coluna é
  `nome_completo`. PostgREST falha silenciosamente → `payout` null → `notFound()`.
  O hotfix da Sprint 10 corrigiu 3 arquivos, mas **6 ocorrências restaram**:
  `pagamentos/[id]/page.tsx`, `pagamentos/[id]/override/page.tsx`, `motivos/actions.ts`,
  `fechamento/[periodo]/page.tsx`, `fechamento/[periodo]/export/pdf/route.ts`,
  `fechamento/[periodo]/export/excel/route.ts`.

#### C3 · "Recalcular pendentes" falha com 503 sem nenhum feedback

- **URL:** `/pagamentos`
- **O que acontece:** o clique dispara um Server Action (POST) que retorna **HTTP 503**;
  a UI não mostra loading, erro ou toast — para o usuário, o botão "não faz nada".
  Os contadores (896/720/172/4) permanecem.
- **Como reproduzir:** `/pagamentos` → "Recalcular pendentes" → observar Network.
- **Impacto:** o caminho de correção que o próprio painel de pendências recomenda está quebrado.
- **Hipótese:** timeout de função serverless ao recalcular 896 pagamentos numa requisição;
  precisa de processamento em lote/fila + estado de progresso.

#### C4 · Fechamento e KPIs do Financeiro zerados apesar de haver dados

- **URL:** `/fechamento`, `/fechamento/2026-06`, `/financeiro`
- **O que acontece:** fechamentos de maio e junho mostram R$ 0,00 / 0 visitas / "Nenhum
  payout elegível" — inclusive **Receita Unetvale R$ 0,00**, sendo que junho tem
  R$ 60.313,95. No `/financeiro`, os 4 KPIs do topo e o "Comparativo — últimos 6 meses"
  ficam zerados **na mesma tela** em que a tabela "Por finalidade" soma R$ 60 mil.
  O botão "Solicitar aprovação" fica ativo sobre o vazio.
- **Como reproduzir:** `/fechamento` → "Ver detalhes" junho; `/financeiro?mes=2026-06`.
- **Impacto:** o fechamento mensal — objetivo final do produto — não funciona.
- **Causa raiz provável (pós-relatório):** mesma do C2 — `technicians(nome)` em
  `fechamento/[periodo]/page.tsx:89` derruba a query silenciosamente.

### Moderados

| # | Bug | Detalhe |
|---|---|---|
| M1 | Mojibake de encoding em todos os dados de planilha | "InstalaÁ„o - Fibra - PF", "n„o - endereáo n„o encontrado" em dashboard, OSs, pagamentos, motivos e financeiro. Pode causar falso "sem regra": regras LPU têm strings limpas, visitas têm strings corrompidas. Corrigir leitura no ETL (`src/lib/etl/`) + migration de normalização dos dados gravados. |
| M2 | Contagens inconsistentes entre telas | Dashboard: "602 OSs / 450 sucesso"; página OSs: "516 / 444" (dashboard conta **visitas** e rotula OSs). Simulação LPU jun: 349 sem regra / 0 conflito / 63 pendentes; Pagamentos jun: 216 / 4 / 65. |
| M3 | Ticket médio não bate com nenhuma conta | R$ 129,88 exibido; 60.313,95 ÷ 602 = 100,19; ÷ 450 = 134,03. Definir fórmula e documentar. |
| M4 | 72% das visitas sem técnico vinculado | Só 2 técnicos cadastrados; nomes de campo ("WAVE - Douglas Ribeiro") sem `tecnico_id`. Ranking liderado por "Não vinculado" (R$ 42 mil); pagamentos devidos a "Sem técnico". Na simulação, dois rótulos para o mesmo caso ("Sem técnico" e "Técnico desconhecido"). |
| M5 | Aprovação de improdutiva com motivo PENDENTE permitida | Linhas sem categoria (valor "—") têm Aprovar/Rejeitar ativos; lote aceita sem aviso. Se a categoria define se paga, aprovar antes de classificar cria pagamento indefinido. |
| M6 | Rejeição sem confirmação, justificativa ou desfazer | Um clique remove a linha definitivamente. Risco de misclick em decisão financeira. |
| M7 | Filtro de período não persiste; default é o mês atual vazio | Toda página abre em "julho de 2026" (dia 2, sem dados). Chip clicado durante carregamento é ignorado (exige 2 cliques). |
| M8 | Chips de período em telas que os ignoram | Aprovação ("todos os períodos") e detalhe de OS mostram chip aceso sem efeito. Aprovação não tem filtro de período. |
| M9 | "Último acesso" sempre "—" na Equipe | Inclusive para o usuário logado no momento. |

### Cosméticos

| # | Bug | Detalhe |
|---|---|---|
| S1 | "0" órfão no card de visita | Quando receita da visita = 0, um "0" solto aparece no lugar do bloco "Receita Unetvale" (padrão `{valor && <Comp/>}`). Visto em `/oss/569195`. |
| S2 | Resumo Executivo pula numeração | Itens 01, 02, 04 (sem 03). |
| S3 | Eixo X do gráfico omite dias sem dados | Junho pula o dia 13, distorcendo a série temporal. |
| S4 | Títulos inconsistentes | Menu "Dashboard" × header "Ordens de Serviço"; abas com título genérico "Painel do Gestor"; "FALHA CLIENTE" × "Falha Cliente" × "Falha do Cliente". |
| S5 | LPU histórica "Rascunho" com vigência encerrada | 01/01→01/06 — estados contraditórios. |
| S6 | Upload "812 / 0 / 0 · Concluído" sem explicação | 0 inseridas = deduplicação de re-envio, mas parece falha. Header "LINHAS / INS / ERROS" críptico. |

---

## Seção 3 — Melhorias de UX

1. **Período inteligente e persistente** — default = último mês com dados; persistir `?mes=` entre páginas.
2. **Nome bruto do técnico não vinculado + ação de vincular** — exibir "WAVE - Douglas Ribeiro · não vinculado" com botão "Vincular"; pós-upload, sugerir vínculos por nome.
3. **Guard rails na aprovação** — bloquear (ou exigir confirmação para) aprovar sem categoria; modal com motivo na rejeição; toast com "Desfazer".
4. **Feedback de ações assíncronas** — loading no botão, toasts de sucesso/erro, progresso para operações longas.
5. **Busca por nº de OS e paginação** — campo de busca por `os_num` + paginação/virtualização (tabelas hoje renderizam 602 linhas de uma vez).
6. **Perfil de técnico acessível** — a rota `/equipe/tecnicos/[id]` **já existe** (Sprint 5); falta o link na listagem.
7. **Rejeição em lote** — barra de seleção só oferece "Aprovar selecionadas".

## Seção 4 — Melhorias visuais

- Unificar taxonomia de categorias (um único rótulo "Falha do Cliente") e um único rótulo para técnico não vinculado.
- Exibir motivo normalizado limpo em vez da string bruta nas listas e no dashboard.
- Alvos de clique maiores (checkboxes de 16px falham cliques — reproduzido no teste).
- Diferenciar escopo global × mensal no painel de pendências (896 global × 602 do mês).
- Consistência de título de página (header e `<title>` por página).

## Seção 5 — Performance

Nenhuma página estourou 2s em condições normais — TTFB 90–1030ms, load completo ~1,0–1,3s,
navegações SPA ~1–3s. Pontos de atenção:

| Ponto | Hipótese | Sugestão |
|---|---|---|
| "Recalcular pendentes" → 503 | Timeout serverless (896 payouts numa request) | Lotes (ex.: 100/vez) ou job assíncrono com progresso |
| Tabelas de 602 linhas sem paginação | Payload RSC e DOM grandes; degrada com meses maiores | Paginação server-side ou virtualização |
| Tela preta na troca de mês (sessão degradada) | Falha de RSC sem error boundary visível | Error boundary com mensagem + retry |

## Seção 6 — Plano de implementação

O plano foi convertido em sprints — ver [`docs/sprints/00-roadmap.md`](../sprints/00-roadmap.md)
(Sprints 11–14) e os arquivos `docs/sprints/12-sprint-11-*.md` a `15-sprint-14-*.md`.

| # | Item | Tipo | Esforço | Impacto | Sprint |
|---|---|---|---|---|---|
| 1 | Corrigir refresh de sessão Supabase (C1) | Bug crítico | M | Altíssimo | 11 |
| 2 | Varredura `technicians(nome)` → `nome_completo` — corrige C2 e C4 | Bug crítico | S | Altíssimo | 11 |
| 3 | Recalcular pendentes em lotes + feedback de erro (C3) | Bug crítico | M | Alto | 11 |
| 4 | Fechamento/Financeiro: verificação pós-fix + KPIs lendo visitas (C4) | Bug crítico | S–M | Alto | 11 |
| 5 | Encoding no ETL + migration de normalização (M1) | Bug | M | Alto | 12 |
| 6 | Vínculo assistido de técnicos pós-upload (M4) | Feature | M | Alto | 12 |
| 7 | Guard rails de aprovação (M5/M6) | UX | S | Alto | 12 |
| 8 | Diagnóstico + regras fallback p/ 720 "sem regra" | Dados | M | Alto | 12 |
| 9 | Período persistente + default último mês com dados (M7/M8) | UX | S | Médio-alto | 13 |
| 10 | Unificar contagens e fórmula do ticket médio (M2/M3) | Bug | S | Médio | 13 |
| 11 | Busca por OS + paginação | UX/Perf | M | Médio | 13 |
| 12 | Link para perfil do técnico existente | UX | S | Médio | 13 |
| 13 | Rejeição em lote | Feature | S | Médio | 13 |
| 14 | Taxonomia única + motivo normalizado nas listas | Visual | S | Médio | 13 |
| 15 | Último acesso na Equipe (M9) | Bug | S | Baixo | 14 |
| 16 | Cosméticos S1–S6 | Visual | S | Baixo | 14 |

*Esforço: S < 1 dia · M = 1–3 dias.*

**Achado bônus:** a lista "sem regra" da simulação mostra visitas "Suporte Fibra" com
resultado "Sim" que não casam regra alguma — as regras exigem `tipoAtendimento` /
`subterraneaAereo` que a visita não tem preenchido. Além do encoding, **há visitas sem os
atributos que as regras exigem** — vale regra fallback de menor prioridade por finalidade.
