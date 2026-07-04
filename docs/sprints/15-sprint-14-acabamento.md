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

## Definition of Done da sprint

- [ ] Itens A–C verificados em produção
- [ ] typecheck · lint · test verdes
- [ ] `00-roadmap.md` atualizado — QA de regressão completo do relatório de 02/07 refeito
      ao final desta sprint (fecha o ciclo do QA)
