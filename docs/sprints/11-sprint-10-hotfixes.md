# Sprint 10 — Hotfixes + LPU Wave + Processo

**Duração:** 1 sessão (2026-07-02)
**Status:** Em andamento 🔄
**Branch:** `fix/sprint-10-hotfixes` → PR pendente

---

## Contexto

Três bugs críticos detectados após go-live de Sprint 9. Todos com a mesma causa raiz:
`technicians(nome)` em queries PostgREST — coluna não existe (`nome_completo` é o nome correto).
Erros PostgREST são silenciosos: retornam `data: null` sem erro visível no código.

Problema adicional de processo: commits foram diretamente para `main` em vez de branch + PR.
Esta sprint reestabelece o fluxo correto e corrige os bugs.

---

## Etapas

### 10-A — Hotfixes (concluído ✅)

**Branch:** `fix/sprint-10-hotfixes`

**Bug A — `technicians.nome` → `nome_completo` (3 arquivos):**

| Arquivo | Efeito da correção |
|---|---|
| `src/app/(manager)/improdutivas/page.tsx` | Restaura ~332 improdutivas pendentes de aprovação |
| `src/app/(manager)/pagamentos/page.tsx` | Restaura pagamentos de junho/2026 na tabela principal |
| `src/app/(manager)/oss/[osNum]/page.tsx` | Corrige 404 ao acessar detalhe de OS |

**Bug B — `.order()` syntax em improdutivas:**
- `src/app/(manager)/improdutivas/page.tsx` linha 39: usa `referencedTable` corretamente

**Bug C — `detectConflicts` falsos positivos:**
- `src/lib/lpu/conflicts.ts`: reescrito para verificar sobreposição real de condições
- Regras com `agregada: false` vs `agregada: true` na mesma prioridade não são mais flagadas
- 2 novos testes em `conflicts.test.ts` (71 testes total, todos passando)

**Resultado:** `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` 71/71 ✅

> ⚠️ **Correção pós-QA (02/07/2026):** a varredura do Bug A foi **incompleta** — o QA em
> produção encontrou **6 ocorrências restantes** de `technicians(nome)`
> (`pagamentos/[id]`, `pagamentos/[id]/override`, `motivos/actions.ts`,
> `fechamento/[periodo]` + exports PDF/Excel), que mantêm o 404 do detalhe de pagamento e o
> fechamento zerado em produção. A correção completa está na
> [Sprint 11 — Fase A](./12-sprint-11-estabilizacao.md). Este caso originou a regra R3.1 das
> [Regras de Execução](./regras-de-execucao.md): bug de padrão exige grep completo.

---

### 10-B — LPU Wave (pendente — aguarda diagnóstico)

Após merge do 10-A:

1. Ativar "LPU Wave 2026 — Revisada" em `/lpu` (criada via seed `supabase/seed-wave-lpu-2026-revisada.sql`)
2. Rodar SQL de diagnóstico no Supabase para entender os 720 `no_rule_match`:

```sql
SELECT sv.finalidade, sv.tipo_atendimento, sv.subterraneo_aereo, sv.condominio, sv.agregada,
       COUNT(*) AS total
FROM service_visits sv
JOIN payouts p ON p.visit_id = sv.id
WHERE p.tenant_id = (SELECT id FROM tenants WHERE dominio_custom ILIKE '%wave%' LIMIT 1)
  AND p.status = 'no_rule_match'
GROUP BY sv.finalidade, sv.tipo_atendimento, sv.subterraneo_aereo, sv.condominio, sv.agregada
ORDER BY total DESC;
```

3. Com base no resultado: adicionar regras faltantes via UI ou SQL seed atualizado
4. Clicar "Recalcular pendentes" em `/pagamentos`

---

## Definition of Done

- [ ] PR `fix/sprint-10-hotfixes` mergeado em `main`
- [ ] Aprovação de Improdutivas exibe as pendentes (~332)
- [ ] Pagamentos exibe pagamentos de junho/2026
- [ ] `/oss/569020` abre sem 404
- [ ] "Ver visitas ↓" em Pagamentos funciona
- [ ] LPU Wave ativa e `no_rule_match` reduzido significativamente
- [ ] Diagnóstico SQL rodado e resultado analisado

---

## Roadmap pós-Sprint 10

**Substituído em 02/07/2026** pelo ciclo de estabilização definido a partir do
[Relatório de QA em produção](../qa/2026-07-02-relatorio-qa-producao.md):
Sprints 11–14 em [`00-roadmap.md`](./00-roadmap.md). Os temas anteriores
(LPU Phase 2, feriados, onboarding, contestação, notificações) foram remapeados para as
Sprints 15–19. A etapa **10-B** desta sprint (LPU Wave + diagnóstico `no_rule_match` +
recalcular) foi absorvida pelas Sprints 11 (Fase C) e 12 (Fase C).
