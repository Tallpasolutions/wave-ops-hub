# Sprint 13 — UX e Consistência

**Origem:** QA 02/07/2026 — itens M2, M3, M7, M8 + melhorias UX 1, 5, 6, 7 e visuais
**Duração estimada:** 3 sessões
**Status:** Planejada · depende das Sprints 11–12
**Regras de execução:** [`regras-de-execucao.md`](./regras-de-execucao.md)

---

## Objetivo

O gestor encontra o que procura, os números batem entre telas, e o período trabalha a favor
dele — não contra.

## Contexto verificado (02/07/2026)

- Toda página abre em "julho de 2026" (mês atual, vazio no dia 2); filtro de mês se perde a
  cada navegação; chip clicado durante carregamento é ignorado (exigiu 2 cliques no teste)
- Dashboard "602 OSs" (na verdade, visitas) × página OSs "516 OSs" (OSs reais) — mesmo mês
- Ticket médio R$ 129,88 não corresponde a 60.313,95÷602 (100,19) nem ÷450 (134,03)
- `/pagamentos` renderiza 602 linhas de uma vez; sem busca por nº de OS em nenhuma lista
- `GlobalPeriodSelector` já existe (`src/app/(manager)/_components/GlobalPeriodSelector.tsx`)
  e persiste via querystring — o problema é o default e a perda do parâmetro entre rotas
- Perfil de técnico `/equipe/tecnicos/[id]` **já existe** (Sprint 5); a listagem não linka
- Aprovação em lote não tem "Rejeitar selecionadas"; chips de período aparecem em telas que
  os ignoram (aprovação, detalhe de OS)

---

## Fases

### Fase A — Período inteligente (M7 + M8)

1. Default = **último mês com dados** do tenant (não o mês corrente); implementar no
   `GlobalPeriodSelector`/layout — investigar o componente existente antes (R2.1)
2. Persistir `?mes=` na navegação entre rotas do manager (link-aware ou contexto)
3. Ocultar os chips nas telas em que o período não se aplica (aprovação, detalhes)
4. Aprovação: adicionar filtro de período próprio (a tela hoje é "todos os períodos")
5. Corrigir clique em chip durante carregamento (garantir interatividade ou estado disabled visível)

**DoD:** abrir qualquer tela no dia 1º do mês mostra dados do último mês com movimento ·
navegar Dashboard → OSs → Pagamentos preserva o mês · nenhuma tela exibe chip inerte.

### Fase B — Números que batem (M2 + M3)

1. Definir com o usuário (R5.2) a métrica canônica de cada card: "OSs" = OSs distintas;
   "Visitas" = linhas de planilha — e rotular cada card corretamente
2. Corrigir o dashboard (hoje rotula visitas como OSs) e alinhar com a página OSs
3. Ticket médio: definir fórmula única, documentar no glossário, exibir tooltip na UI
4. Alinhar contadores de pendências: simulação LPU × pagamentos × painel global devem usar a
   mesma definição (ou rotular o escopo: "todas as competências" × "junho")

**DoD:** para junho/2026, dashboard, /oss e /pagamentos exibem números reconciliáveis entre
si (tabela de reconciliação colada no doc) · fórmula do ticket médio no glossário.

### Fase C — Encontrar e agir (busca, paginação, lote, perfil)

1. Busca por nº de OS em `/oss` e `/pagamentos` (server-side, via querystring)
2. Paginação server-side (50/página) nas tabelas de pagamentos, OSs e listas da simulação
3. "Rejeitar selecionadas" na aprovação em lote (com a confirmação da Sprint 12 Fase D)
4. Linkar a listagem de técnicos ao perfil existente `/equipe/tecnicos/[id]`; verificar se o
   perfil renderiza com dados reais (a rota existe, mas nunca foi testada em produção — R2.1)
5. Aumentar a área de clique dos checkboxes de seleção (célula inteira clicável)

**DoD:** localizar OS 569020 pela busca em <5s · tabelas paginadas sem regressão de filtros ·
rejeição em lote funcional · perfil de técnico acessível por clique e renderizando.

### Fase D — Taxonomia e linguagem (visuais do QA §4)

1. Rótulo único de categoria em toda a UI ("Falha do Cliente" — badge, filtro, formulário)
2. Motivo normalizado limpo nas listas e no dashboard (o campo já existe em `reasons`)
3. Painel de pendências de pagamentos: rotular escopo global ("todas as competências")
4. Títulos de página: header do dashboard, `<title>` específico por rota

**DoD:** screenshot das telas afetadas antes/depois no PR · zero strings brutas de motivo
visíveis nas listas principais.

---

## Fora do escopo

Cosméticos S1–S6 e "último acesso" (Sprint 14) · notificações e contestação (roadmap pós-14).

## Checklist anti-alucinação da sprint

```text
[ ] Fase A: ler GlobalPeriodSelector.tsx antes de propor solução (componente já existe)
[ ] Fase B: decisão de métrica canônica confirmada com o usuário ANTES de alterar cards
[ ] Fase B: tabela de reconciliação gerada com queries reais, não de memória
[ ] Fase C: testar /equipe/tecnicos/[id] com id real antes de linkar (rota nunca verificada)
[ ] Fase D: grep por todos os pontos que renderizam categoria antes de "unificar"
```

## Estado verificado

- **02/07/2026 — QA:** contexto acima registrado. Nenhuma fase iniciada.
- **04/07/2026 — Sprint 12 fechada:** técnicos reais vinculados em produção (11 cadastrados,
  seção "sem vínculo" vazia, dashboard sem "Não vinculado"). INFRA WAVE com OS operacional =
  pagam (decisão do usuário, sem exclusão por técnico).
- **04/07/2026 — Fase A implementada** (branch `feat/sprint-13-periodo-inteligente`) —
  **aguardando merge + verificação em produção**:
  - Investiguei o que existia (R2.1): `GlobalPeriodSelector` usava mês corrente como default
    e opções hardcoded de 6 meses; navegação pela sidebar perdia `?mes=`;
    `startsWith('/oss')` fazia o chip aparecer inerte nos detalhes
  - Novo `_lib/period-server.ts`: `getDataRange` (min/max de visitas in-scope, cache/request),
    `getAvailablePeriods` e `getEffectivePeriod` (precedência: URL > cookie > último mês com
    dados > mês corrente)
  - `_lib/period.ts`: `isValidMes`, `generateMonthRange`, `PERIODO_COOKIE` (puros, client-safe)
  - Selector: recebe `availablePeriods`/`effectiveMes` do layout; seta cookie na escolha
    (persiste entre rotas sem threadar `?mes=`); match EXATO de path (some o chip em detalhes);
    `useTransition` + opacity para o clique-durante-carregamento
  - 4 telas (dashboard, oss, financeiro, pagamentos) usam `getEffectivePeriod`.
    `improdutivas` mantém "todos os períodos" (é fila de aprovação — default não deve ocultar
    backlog; o chip global serve de filtro opcional)
  - 9 testes novos dos helpers puros (123 total) · typecheck ✅ · lint ✅ · build ✅
  - **Verificar em prod:** abrir /dashboard sem `?mes=` → cai em junho (último com dados);
    escolher maio → navegar para /oss pela sidebar preserva maio; nenhum chip em /oss/&lt;num&gt;
- **04/07/2026 — Fase A VERIFICADA + fix de persistência** (commit `e7b31f4`): o cookie
  sozinho não persistia (Router Cache servia /oss prefetchado no default). Sidebar passou a
  carregar `?mes=` atual nos links de período (URLs distintas = sem staleness). Confirmado
  pelo usuário: dashboard→maio→OSs mantém maio.
- **04/07/2026 — Fase B implementada** (branch `feat/sprint-13-numeros-batem`) —
  **aguardando merge + verificação em produção**. Decisão do usuário: **dois cards separados**
  (OSs distintas + Visitas); ticket médio = receita ÷ OSs.
  - `aggregate.ts`: novo `totalOss` (contagem de `os_num` distintos) + `ossPorDia`;
    `ticketMedio` agora = receita total ÷ OSs distintas (antes: receita_finalizadas ÷
    nº_finalizadas — não batia com nada)
  - Dashboard: card "Total de OSs" (distintas) + novo card "Visitas" (atendimentos); ticket
    médio rotulado "receita ÷ OSs"; pills de taxa/improdutividade corrigidos de "OSs" → "visitas"
    (contavam visitas). Grid 6 → 7 colunas
  - **M2 §4 + resíduo da Sprint 11:** painel de pendências trocado por queries `count`
    (exatas, sem o corte de 1000) e rotulado "· todas as competências" (é global, não do mês)
  - Glossário: "Ticket médio por OS" e as métricas de volume (OSs × Visitas) documentados
  - 3 testes novos (126 total) · typecheck ✅ · lint ✅ · build ✅
  - **Verificar em prod:** reconciliar dashboard (Total de OSs) com /oss e /pagamentos para
    junho (colar tabela de reconciliação aqui)

## Definition of Done da sprint

- [ ] Fases A–D verificadas em produção
- [ ] typecheck · lint · test verdes · E2E dos fluxos alterados atualizados
- [ ] Glossário atualizado (ticket médio, OSs × visitas)
- [ ] `00-roadmap.md` atualizado
