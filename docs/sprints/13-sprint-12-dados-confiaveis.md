# Sprint 12 — Dados Confiáveis (ETL, Vínculos e Guard Rails)

**Origem:** QA 02/07/2026 — itens M1, M4, M5, M6 + achado "720 sem regra"
**Duração estimada:** 3–4 sessões
**Status:** Planejada · depende da Sprint 11 concluída
**Regras de execução:** [`regras-de-execucao.md`](./regras-de-execucao.md)

---

## Objetivo

Fazer os dados que alimentam pagamentos serem confiáveis: encoding correto, técnicos
vinculados, regras LPU cobrindo as visitas reais, e decisões de aprovação protegidas.

## Contexto verificado (02/07/2026)

- Mojibake em produção: "InstalaÁ„o - Fibra - PF", "n„o - 01 fui no cliente..." em todas as
  telas que exibem dados de planilha. Regras LPU têm strings limpas ("Instalação - Fibra - PF")
  — divergência pode causar falso `no_rule_match`
- 433 de 602 visitas de junho (71,9%) sem `tecnico_id`; apenas 2 técnicos cadastrados;
  nomes de campo presentes na planilha ("WAVE - Douglas Ribeiro", "WAVE - Daniel Orlando Soares")
- 720 payouts `no_rule_match` globais (216 em junho); simulação LPU divergente (349) —
  números precisam ser reverificados pós-Sprint 11
- Aprovação em lote aceitou 2 visitas com motivo PENDENTE (sem categoria, valor "—") sem aviso
- Rejeição individual: um clique, sem confirmação, sem justificativa, sem undo

---

## Fases

### Fase A — Encoding no ETL + normalização dos dados existentes (M1)

1. **Diagnóstico primeiro (R3.3):** identificar no parser (`src/lib/etl/`) onde o encoding
   quebra — abrir a planilha real e comparar bytes ("ç" → "Á", "ã" → "„", "í" → "Ì" sugere
   CP1252 lido como Mac Roman)
2. Corrigir a leitura no parser + teste unitário com fixture contendo acentos
3. Migration de normalização dos dados já gravados (`service_visits.finalidade`,
   `resultado`, `reasons.motivo_original/normalizado` etc.) — numerada, com `UPDATE`
   reversível documentado e contagem antes/depois
4. Rodar recálculo de payouts após a normalização (dependência: Fase C da Sprint 11)

**DoD:** upload de planilha nova exibe acentos corretos · dados antigos normalizados
(query de amostragem sem mojibake) · nº de `no_rule_match` antes/depois anotado.

### Fase B — Vínculo assistido de técnicos (M4)

1. Verificar o que já existe: Sprint 2 entregou `linkTechnicianRaw` + `LinkTechnicianForm`
   (R2.1 — confirmar no código antes de criar do zero)
2. Listas (pagamentos, aprovação, dashboard): exibir o nome bruto da planilha + badge
   "não vinculado" em vez de "Sem técnico" genérico
3. Tela/fluxo "Vincular técnicos": nomes não vinculados agrupados, com ação
   "criar técnico a partir deste nome" ou "vincular a técnico existente"
4. Pós-upload: aviso com contagem de visitas sem vínculo + link para o fluxo
5. Unificar rótulo: eliminar a duplicidade "Sem técnico" × "Técnico desconhecido" (simulação)

**DoD:** zero telas exibindo "Sem técnico" quando a planilha traz nome · vincular os 2+
técnicos reais da Wave em produção · ranking do dashboard sem "Não vinculado" no topo
(ou com nomes brutos identificáveis).

### Fase C — Cobertura LPU: diagnóstico dos "sem regra" (herdado da Sprint 10-B)

1. Rodar o SQL de diagnóstico (agrupar `no_rule_match` por finalidade/atributos) — pós Fases A/B,
   os números mudam; usar os novos (R2.4)
2. Classificar causas: encoding (resolvido na Fase A) × atributos ausentes na visita
   (`tipo_atendimento`, `subterraneo_aereo`) × finalidade realmente sem regra
3. Decidir com o usuário (R5.2): regras fallback de menor prioridade por finalidade vs
   completar atributos no ETL vs ambos
4. Implementar a decisão + "Recalcular pendentes"

**DoD:** `no_rule_match` reduzido a resíduo justificado (lista das finalidades restantes com
motivo documentado) · 4 payouts "Conflito" resolvidos ou explicados.

### Fase D — Guard rails de aprovação (M5 + M6)

1. Bloquear Aprovar (individual e lote) quando `categoria = pendente` — botão desabilitado
   com tooltip "Classifique o motivo primeiro" + link para `/motivos`
2. Rejeitar: dialog de confirmação com campo de justificativa (opcional ou obrigatória —
   confirmar com usuário) e resumo do que será rejeitado
3. Toast pós-ação (aprovada/rejeitada) com "Desfazer" quando reversível
4. Aprovação em lote: mesma regra de bloqueio + resumo ("aprovar 12 visitas de 3 técnicos,
   total R$ X")

**DoD:** impossível aprovar motivo pendente pela UI · rejeição pede confirmação ·
ações dão feedback visível · testes E2E do fluxo de aprovação atualizados.

---

## Fora do escopo

Período persistente, busca/paginação, perfil de técnico (Sprint 13) · cosméticos (Sprint 14).

## Checklist anti-alucinação da sprint

```text
[ ] Fase A: encoding diagnosticado com a planilha real antes de mexer no parser
[ ] Fase A: migration com contagem antes/depois colada no doc
[ ] Fase B: grep por linkTechnicianRaw/LinkTechnicianForm antes de criar algo novo
[ ] Fase C: SQL de diagnóstico rodado DEPOIS das fases A/B — não reusar os números do QA
[ ] Fase D: comportamento atual reproduzido em staging antes de alterar
[ ] Strings de planilha: normalizar antes de comparar (R6.5) em todo código novo
```

## Estado verificado

- **02/07/2026 — QA:** contexto acima registrado. Nenhuma fase iniciada.
- **03/07/2026 — Fase C: diagnóstico + exclusão de infra implementados**
  (branch `feat/sprint-12-exclusao-infra`) — **aguardando merge + migrations em produção**:
  - **Diagnóstico dos 248 "sem regra"** (SQL rodado pelo usuário + cruzamento com a planilha
    real): 100% são finalidade sem regra (nenhum é encoding/atributo). A coluna Z (explicação)
    é a receita Unetvale já calculada (base × 1,0654), não o payout — confirmou o modelo de
    margem. Os 248 se dividem em: infra (98), Venda Produto Externo (45), Troca de
    Equipamentos (32), Cabeamento/col-Z (73)
  - **Decisões da Wave:** infra (Projeto Infra, Manutenção Infra, Adequação de Rede, Massiva +
    Manutenção Programada, Ativação Infra, Troca de postes, Viabilidade Infra, Notificação
    Celesc, Genérico, Parcial) **não contabilizam em nada**; Venda Produto Externo = R$ 0;
    Troca de Equipamentos (+ de Local) = valor de Suporte Fibra
  - **ADR-008** (exclusão de infra): flag `service_visits.fora_escopo`, lista em
    `tenants.config.finalidades_infra`, exclusão em 2 camadas (não gera payout + filtro nas
    leituras que contabilizam)
  - **Migration 0013**: coluna `fora_escopo`, seed da config, backfill, remoção dos payouts
    de infra. ETL (`normalizer`/`ingestor`) marca `fora_escopo` no upload; `recalculate-batch`
    pula infra; filtros aplicados em dashboard, financeiro, fechamento, OSs, perfil de técnico,
    técnicos não vinculados, simulação e pagamentos (grep completo das 4 superfícies +
    payout-based auto-excluídas)
  - **Script `supabase/2026-07-lpu-finalidades-extras.sql`**: Venda Produto Externo R$ 0 +
    Troca de Equipamentos anexada às regras de Suporte Fibra (idempotente)
  - 114/114 testes · typecheck ✅ · lint ✅ · build ✅
  - **Passos em produção:** aplicar 0013 → aplicar o script de LPU → "Recalcular pendentes".
    Esperado: total de junho 602 → ~504, "sem regra" 248 → ~73 (só o grupo Cabeamento)
  - **Restante da Fase C (grupo Cabeamento):** match por explicação de valor (coluna Z) —
    exige ADR do motor de LPU; fica para sprint dedicada
- **03/07/2026 (noite) — Fase C VERIFICADA EM PRODUÇÃO** (migration 0013 + script LPU +
  recálculo aplicados pelo usuário):
  - 0013: **99 visitas marcadas `fora_escopo`**, 0 infra com payout travado
  - Script LPU: as 6 regras de Suporte Fibra estendidas com Troca de Equipamentos (+ de Local);
    regra Venda Produto Externo R$ 0 criada
  - Recálculo: **1309 recalculadas** (= 1408 − 99 infra puladas, confirma o skip do recalc)
  - **Dashboard junho: 602 → 545 OSs** (57 infra de junho removidas), sem NENHUMA finalidade
    de infra nos "Tipos de OS"; receita 60.313 → 59.408
  - **Pagamentos junho: sem regra → 31**, todos do grupo Cabeamento (Cabeamento/Segundo Ponto 23,
    Cabeamento Fibra 6, Instalação Condomínio 1, Retirada Condomínio 1). Troca de Equipamentos e
    Venda Produto Externo saíram dos sem-regra (casaram as regras novas — detalhe OS 569238:
    "Suporte Fibra Interno" R$ 30)
  - **Reconciliação (R2.4):** o "248 sem regra / 98 infra" da consulta original era GLOBAL
    (SQL sem filtro de período); junho tinha 57 infra → 602−57=545. As 99 `fora_escopo` se
    distribuem entre os meses. Números consistentes.
- **03/07/2026 — Fase D implementada** (branch `feat/sprint-12-guard-rails`) —
  **aguardando merge + verificação em produção**:
  - Guards no servidor (defesa em profundidade): `approveImprodutiva` e
    `bulkApproveImprodutivas` recusam payouts `pending_classification`; o lote reporta
    quantas foram ignoradas por motivo pendente
  - UI: botão Aprovar desabilitado para categoria PENDENTE com tooltip + link
    "Classificar →" para `/motivos`; barra de lote com resumo ("aprovar N (R$ X) · M com
    motivo pendente serão ignoradas")
  - Rejeição com confirmação inline explícita ("Confirmar R$ 0" / Cancelar) e
    **justificativa opcional** gravada em `override_motivo` + `override_by/at` (decisão:
    opcional para não travar o fluxo — trocar para obrigatória é 1 linha se o uso mostrar
    necessidade)
  - **Desfazer**: barra pós-ação ("OS #N aprovada/rejeitada · Desfazer") — nova action
    `undoImprodutivaDecision` limpa a decisão/override e recalcula a visita para restaurar
    o status verdadeiro; bloqueada se o payout já entrou em fechamento/pagamento
  - Bônus Fase B: fila de aprovação agora mostra nome bruto "(não vinculado)" em vez de "—"
  - 110/110 testes · typecheck ✅ · lint ✅ · build ✅
- **03/07/2026 — Fase B implementada** (branch `feat/sprint-12-vinculo-tecnicos`) —
  **aguardando merge + verificação em produção**:
  - Verificado o que já existia (R2.1): `linkTechnicianRaw` + `LinkTechnicianForm` da
    Sprint 2 cobrem o vínculo por upload — reaproveitados, não recriados
  - Novo `src/lib/format/tecnico.ts`: `tecnicoDisplayName()` (nome cadastrado > nome bruto
    da planilha + "(não vinculado)" > "Sem técnico") e `tecnicoGroupKey()` (não vinculados
    agrupam POR PESSOA pelo nome bruto, não num balde único). 7 testes
  - Aplicado em: pagamentos (lista/detalhe/override), motivos (sheet de visitas), dashboard
    (ranking, `tecnico_raw` no select), financeiro (por técnico), fechamento (grupos + exports
    PDF/Excel). Rótulos unificados; simulador: "Não vinculados (agrupados)"
  - Seção global "Técnicos da planilha sem vínculo" em `/equipe/tecnicos` (nomes agrupados
    com contagem, paginado via `fetchAllPages`), reusando `LinkTechnicianForm` (movido para
    `src/components/`, prop `returnPath`); action ganhou filtro explícito de `tenant_id`
  - Blocker do fechamento agora aponta para `/equipe/tecnicos` (antes: `/uploads`)
  - 110/110 testes · typecheck ✅ · lint ✅ · build ✅
  - **Verificar em prod:** ranking do dashboard com "Douglas Ribeiro (não vinculado)" etc.
    em vez de "Não vinculado" único · seção de vínculo listando os nomes reais · vincular
    os técnicos reais da Wave (ação do gestor via UI)
- **03/07/2026 — Fase A VERIFICADA EM PRODUÇÃO (dados):** migration 0012 aplicada via SQL
  Editor (v2 idempotente — a v1 falhou porque o editor executa statement a statement com
  autocommit e derrubava a temp table; `UPDATE service_visits` da execução parcial foi
  absorvido pela idempotência). Contagens DEPOIS: **0 / 0 / 0** (service_visits, reasons,
  service_orders). Verificação nas telas: `/motivos` e `/pagamentos` sem nenhum mojibake
  ("Não - 01 fui no cliente...", "Instalação - Fibra - PF", "Mudança Endereço Fibra").
  **Recálculo pós-reparo:** "1408 recalculadas · 3 preservadas" — **sem regra LPU:
  868 → 248 global (−71%); junho 349 → 123 (−65%)**; pendências críticas globais
  1000 (cap) → 416; junho agora: 415 Aguardando · 123 Sem regra · 61 Motivo pendente ·
  3 Aprovado. Motivo pendente global subiu 132 → 168: improdutivas cujo motivo reparado
  agora casa migraram de "sem regra" para o status correto.
  **Pendente para fechar a fase:** merge + deploy da branch (o reparo no parser ainda NÃO
  está em produção — upload feito antes do deploy voltaria a gravar mojibake) e teste com
  a próxima planilha real.
- **03/07/2026 — Fase A implementada** (branch `fix/sprint-12-encoding-etl`) —
  **aguardando aplicação da migration + verificação em produção**:
  - **Diagnóstico provado antes de codar (R3.3):** cadeia = bytes Latin-1/CP1252
    decodificados como **Mac Roman**. Script contra o corpus real do QA: 6/9 exatos +
    3/9 explicados (campos `motivo_normalizado` são `toLowerCase()` do mojibake:
    `"EndereÁo".toLowerCase()="endereáo"`). A corrupção JÁ VEM na planilha da Unetvale —
    o parser (.xlsx/UTF-8) apenas a preserva
  - Novo `src/lib/etl/encoding.ts`: `repairMojibake()` (inverso byte-exato da tabela Mac
    Roman) + `hasMojibake()` (indicador: „ ‚ · ou maiúscula acentuada após minúscula —
    PT legítimo "Água" não dispara). Bail-out conservador: char fora da tabela ou reparo
    virando controle → string original intacta
  - `parser.ts` aplica o reparo em todo valor string na ingestão — ponto único; reasons,
    match de técnico e visitas recebem texto limpo
  - **Migration `0012_fix_macroman_mojibake.sql`** (aplicar manualmente via SQL Editor):
    repara `service_visits` (8 colunas), `reasons` (com de-dup por UNIQUE tenant+motivo,
    reapontando visitas/payouts), `service_orders`, `technicians`; re-deriva
    `motivo_normalizado`; imprime contagens ANTES/DEPOIS (colar aqui — R2.4) e diagnóstico
    de `lpu_rules` com mojibake (LPU ativa é limpa, seed verificado)
  - 13 testes novos com o corpus real (103 total) · typecheck ✅ · lint ✅
  - **Passos de verificação:** aplicar 0012 → conferir contagens DEPOIS = 0 → "Recalcular
    pendentes" → conferir `no_rule_match` (esperado: cair — regras de Instalação/Mudança
    passam a casar) → telas sem "InstalaÁ„o"

## Definition of Done da sprint

- [ ] Fases A–D verificadas em produção
- [ ] typecheck · lint · test verdes · migrations numeradas e aplicadas via fluxo oficial
- [ ] Glossário atualizado se novos termos (ex.: "vínculo de técnico")
- [ ] `00-roadmap.md` atualizado
