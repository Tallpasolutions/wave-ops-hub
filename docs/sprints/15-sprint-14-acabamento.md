# Sprint 14 — Acabamento Visual e Telemetria

**Origem:** QA 02/07/2026 — item M9 + cosméticos S1–S6
**Duração estimada:** 1–2 sessões
**Status:** Planejada · depende das Sprints 11–13
**Regras de execução:** [`regras-de-execucao.md`](./regras-de-execucao.md)

---

## Objetivo

Fechar as pontas soltas visuais e de credibilidade apontadas pelo QA. Sprint curta, itens
pequenos e independentes — ideal para ser executada em paralelo com validações das anteriores.

## Itens (todos verificados em produção em 02/07/2026)

### A — Telemetria de acesso (M9)

**Estado real verificado (04/07, R1.2):** a coluna `users.ultimo_acesso` **já existe** (migration 0001)
e é **lida** em 3 telas (`/equipe`, `/equipe/supervisores`, `(admin)/admin/users`), mas **nunca é
escrita** em lugar nenhum do código → sempre exibe "—". O dado real já existe no Supabase Auth
(`auth.users.last_sign_in_at`, populado automaticamente a cada login). Não é preciso criar coluna
nem write path.

1. Ler `last_sign_in_at` do Auth via admin client (`auth.admin.listUsers`, paginado) — helper
   reutilizável em `src/lib/auth/last-access.ts`
2. Exibir nas 3 telas que já têm a coluna morta (`/equipe`, `/equipe/supervisores`, `/admin/users`)
3. `ultimo_acesso` (coluna morta) fica como está — dropá-la é migration fora do escopo; anotar em
   tech-debt se valer

**DoD:** "Último acesso" preenchido para o usuário logado após um login novo (verificado em `/equipe`).

### B — Cosméticos de renderização

| Item | Bug | Correção |
|---|---|---|
| S1 | "0" órfão no card de visita quando receita = 0 (`/oss/569195`) | Trocar `{valor && <Comp/>}` por ternário; exibir "R$ 0,00" |
| S2 | Resumo Executivo pula numeração (01, 02, 04) | Numerar pela posição renderizada, não pelo índice da fonte |
| S3 | Eixo X omite dias sem dados (junho sem dia 13) | Preencher série com dias zerados no range do mês |

**DoD:** os 3 casos reproduzidos no QA renderizando corretamente (mesmas URLs).

### C — Consistência de textos e estados

| Item | Bug | Correção |
|---|---|---|
| ~~S4~~ | ~~Header do dashboard "Ordens de Serviço"; `<title>` genérico em subpáginas~~ | **RESOLVIDO na Sprint 13 Fase D** — header virou "Visão Geral"; `<title>` específico adicionado nas 12 sub-rotas. (Se o gestor preferir "Painel Operacional" no header, é só trocar 1 linha.) |
| S5 | LPU histórica com status "Rascunho" e vigência encerrada | Definir estados válidos (rascunho sem vigência; encerrada ≠ rascunho) e corrigir o registro existente |
| S6 | Upload "812 / 0 / 0 · Concluído" parece falha | Rotular colunas ("Linhas · Inseridas · Erros") + linha explicativa "812 duplicadas ignoradas (re-envio)" |

**DoD:** screenshots antes/depois no PR; upload de teste re-enviado exibe a explicação de duplicatas.

---

## Fora do escopo

Qualquer item novo descoberto durante a execução → `docs/tech-debt.md` (R5.1).

## Checklist anti-alucinação da sprint

```text
[ ] Cada item começa reproduzindo o bug na URL registrada no QA
[ ] Item A: verificar auth.users.last_sign_in_at antes de criar migration
[ ] Item S5: confirmar com o usuário a semântica de status de LPU antes de alterar dados
[ ] Screenshots antes/depois anexados ao PR
```

## Estado verificado

- **02/07/2026 — QA:** itens registrados com URLs de reprodução. Nenhum iniciado.
- **04/07/2026 — Fase A CONCLUÍDA e verificada em produção** (branch `feat/sprint-14-ultimo-acesso`,
  mergeada). A coluna `users.ultimo_acesso` era lida em 3 telas mas nunca escrita → sempre "—".
  Solução: helper `src/lib/auth/last-access.ts` lê `auth.users.last_sign_in_at` via
  `auth.admin.listUsers` (paginado) — sem migration nem write path. Ligado em `/equipe`,
  `/equipe/supervisores` e `(admin)/admin/users`. **Verificação no navegador (`/equipe`):** coluna
  "Último acesso" com timestamps reais — usuário logado (Gestor Wave) exibe `04/07/2026, 13:48`
  (login do dia, com hora), demais usuários com datas/horas próprias. `/equipe/supervisores` sem
  supervisores → empty state OK (helper trata lista vazia sem chamar o Auth).
- **04/07/2026 — Fase B CONCLUÍDA e verificada em produção** (branch `feat/sprint-14-cosmeticos`,
  mergeada). Cosméticos S1/S2/S3:
  - **S1** `/oss/[osNum]`: `{valor && …}` renderizava "0" órfão quando receita=0 (o número 0 é
    falsy e o React imprime o 0). Trocado por `!= null` → exibe "R$ 0,00". Varredura R3.1: nenhum
    outro guard numérico com o padrão. **Verificado em `/oss/569195`:** card mostra
    "Receita Unetvale · R$ 0,00", sem "0" solto.
  - **S2** Resumo Executivo: números eram hardcoded (01–04) com itens condicionais + `filter` →
    item oculto deixava buraco (01, 02, 04). Agora numera pela posição pós-filtro. **Verificado:**
    junho renderiza 01, 02, 03, 04 em sequência.
  - **S3** eixo X do volume diário pulava dias sem visita. `aggregate` recebe `periodStart` e
    preenche todos os dias do mês com zeros (chaves por string, timezone-safe; +2 testes).
    **Verificado:** junho mostra "30 DIAS" com o eixo 01…13…30 completo (o dia 13 que o QA viu
    sumido está presente).
  - Nota: no mês corrente, dias futuros aparecem zerados até o fim do mês (consistente com
    "range do mês"; ajustável para cortar em "hoje" se o gestor preferir).
- **04/07/2026 — Fase C implementada** (branch `feat/sprint-14-estados-textos`, mergeada
  `577aead`). Estados e textos S5/S6:
  - **S5** LPU: a `StatusBadge` só tinha 2 estados → qualquer LPU não-ativa (inclusive a
    encerrada) virava "Rascunho" (visto em prod: LPU-Unetvale, vigência 01/01→01/06, marcada
    "Rascunho"). Decisão do usuário (R5.2): rótulo **"Encerrada"**. Novo helper
    `lpu/_lib/status.ts` `lpuStatus(ativa, vigenciaFim)` deriva **Ativa / Encerrada / Rascunho**
    dos campos existentes — **sem alterar dados** (a encerrada já tem `vigencia_fim`; rascunho =
    criada e nunca ativada). Ligado na lista e no detalhe (R3.1). +4 testes.
  - **S6** Upload: a lista mostrava `Linhas/Ins/Erros` = "812 / 0 / 0" sem `ignoradas` → um
    re-envio (tudo duplicado) parecia falha. Agora coluna "Linhas / Inseridas / Ignoradas /
    Erros" + hint "já existiam (re-envio)"; e banner no detalhe quando `inseridas=0 & ignoradas>0`.
  - 143 testes · typecheck ✅ · lint ✅ · build ✅
  - **Verificar em prod (pós-deploy):** `/lpu` → LPU-Unetvale como "Encerrada" (não "Rascunho");
    `/uploads` → contadores com ignoradas + explicação do re-envio.
- **04/07/2026 — Fase C VERIFICADA EM PRODUÇÃO** (mergeada, `577aead`; navegador):
  - **S5** `/lpu` → LPU-Unetvale exibe **"Encerrada"** (era "Rascunho"); a ativa segue "Ativa" ✓
  - **S6** `/uploads` → cabeçalho "LINHAS / INSERIDAS / IGNORADAS / ERROS"; upload de maio (o
    "812/0/0" do QA) agora **"812 / 0 / 812 / 0 · já existiam (re-envio)"** ✓
  - **Sprint 14 FECHADA.**
- **04/07/2026 — QA de regressão do relatório 02/07 (produção):** varredura sem regressões:
  - Dashboard: header "Visão Geral", cards Total de OSs × Visitas, ticket médio, Resumo Executivo
    01–04 em sequência, eixo do volume com todos os dias (S2/S3 da Sprint 14) ✓
  - Taxonomia unificada em `/motivos` e `/improdutivas` ("Falha do Cliente") ✓
  - `/financeiro` com números reais (maio R$ 93.547,26 / 767 visitas / pago R$ 50.640), encoding
    limpo (sem mojibake) ✓ · `/fechamento/2026-05` detalhe em tempo real reconciliando com
    financeiro e perfil (Douglas R$ 11.090) ✓ · perfil de técnico renderizando (fix Sprint 13) ✓
  - Join de técnicos (`nome_completo`) OK em todas as telas de dinheiro → o 404/zeramento da
    Sprint 11 não voltou ✓ · último acesso real em `/equipe` ✓
  - **Observação menor (não-regressão, pré-existente):** na *lista* `/fechamento`, o card de um
    fechamento "Aberto" mostra R$ 0,00 / 0 visitas (snapshot não-consolidado), enquanto o detalhe
    é tempo real. Candidato a polimento (mostrar tempo real ou "não consolidado" no card).

## Definition of Done da sprint

- [x] Itens A–C verificados em produção (A/B em 04/07; C em 04/07 pós-merge)
- [x] typecheck · lint · test verdes (143 testes)
- [x] `00-roadmap.md` atualizado · **QA de regressão do relatório 02/07 refeito** — sem regressões
      (ciclo do QA fechado)
