# Sprint 7 — ETL & Dados Essenciais

**Duração estimada:** 0.5 a 1 semana
**Status:** Em andamento (iniciada 2026-06-29)
**Pré-requisitos:** Sprint 6 concluída ✅ (sistema em produção desde 2026-06-05)

---

## Objetivo

Corrigir problemas de qualidade de dados que afetam a correlação entre visitas e regras LPU.
Estas melhorias emergiram da reunião pós-go-live com a Wave Telecom e são necessárias para que
as regras LPU possam ser configuradas e disparadas corretamente com os dados reais da planilha.

---

## Subtarefas descartadas (já implementadas)

- **7-A (SubterraneoAereo):** 100% done — COLUMN_MAP, Drizzle schema, normalizer e ingestor já cobrem.
- **7-B ETL pipeline (ExplicacaoValor):** 100% done — campo existe na migration 0001, Drizzle, normalizer e ingestor.
- **7-D Técnicos não vinculados (link existing):** 100% done — seção já existe em `/uploads/[id]` com `LinkTechnicianForm`.

---

## Etapas

### Etapa 1 — Normalização de acentos no matching de técnicos

**Arquivo:** `src/lib/etl/matchers.ts`

**Problema:** `matchTechnician` usa `toLowerCase()` mas não normaliza acentos. Se o técnico está
cadastrado como "José Silva" e a planilha manda "Jose Silva", o match falha silenciosamente
— a visita fica com `tecnico_id = null` e o payout não é calculado.

**Solução:** Adicionar `normalizeStr()` que remove diacríticos antes de comparar.

---

### Etapa 2 — Exibir `explicacao_valor` no detalhe da visita

**Arquivo:** `src/app/(manager)/visitas/[id]/page.tsx`

**Problema:** O campo `explicacao_valor` já está no banco (migration 0001), no Drizzle schema
e no ingestor, mas não está sendo exibido na UI do detalhe da visita.

**Solução:** Adicionar linha na seção "Financeiro" da página de detalhe.

---

### Etapa 3 — Botão "Cadastrar novo técnico" no form de vinculação

**Arquivo:** `src/app/(manager)/uploads/[id]/LinkTechnicianForm.tsx`
**Arquivo:** Página de criação de técnico (suporte a `?nome=`)

**Problema:** O form de técnicos não vinculados permite vincular a um técnico existente,
mas não oferece caminho direto para cadastrar um técnico novo quando o profissional ainda
não está no sistema.

**Solução:** Link "Cadastrar novo técnico →" que pré-preenche o nome na página de criação.

---

### Etapa 4 — Combobox de finalidades reais no criador de regra LPU

**Arquivos:**
- `src/app/(manager)/lpu/actions.ts`
- `src/app/(manager)/lpu/[id]/rules/new/_components/CreateRuleForm.tsx`

**Problema:** O campo `finalidade` no criador de regra LPU é texto livre. O gestor precisa
digitar exatamente como a planilha registra — qualquer divergência faz a regra nunca casar.
Idem para `cidade`.

**Solução:** Combobox com as finalidades/cidades reais do banco (permite também digitar livremente).

---

## Definition of Done

- [ ] Técnico "Jose Silva" (sem acento) casa com cadastro "José Silva" no sistema
- [ ] Campo `explicacao_valor` visível no detalhe da visita (quando preenchido)
- [ ] Na tela de upload, técnico não vinculado tem link para criar novo técnico com nome pré-preenchido
- [ ] Campo `finalidade` no criador de regra LPU mostra combobox com valores reais da planilha
- [ ] `pnpm typecheck` sem erros
- [ ] `pnpm lint` sem erros
- [ ] `pnpm test` passa (66+ testes)
