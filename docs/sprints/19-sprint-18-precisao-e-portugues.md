# Sprint 18 — Precisão de pagamento, IQI e português integral

**Período:** 2026-07-30 em diante
**Status:** 🟡 Fase 0 concluída (aguardando aplicação em produção) · Fases 1–3 planejadas
**Origem:** Auditoria de uma OS de suporte que pagava R$ 120 (30/07), que descobriu três frentes
distintas — precisão do cálculo, coleta do IQI parada há 9 dias e linguagem técnica vazando para
a tela do gestor.
**Regras de execução:** [`regras-de-execucao.md`](./regras-de-execucao.md)

---

## Fase 0 — Precisão do pagamento (CONCLUÍDA, aguardando produção)

Três correções nascidas da mesma investigação. Todas com evidência colhida no banco de produção.

### 0.1 — Suporte externo sem troca de drop pagava 4x o devido

**Sintoma:** OS 574486 (Suporte Fibra, Brusque) pagava R$ 120 sobre uma receita da Unetvale de
R$ 64,46 — margem negativa de R$ 55,54.

**Causa:** as regras "Suporte Fibra Aéreo/Subterrâneo Externo" (R$ 120 / R$ 135) casam por
`tipoAtendimento` + `subterraneaAereo` e foram desenhadas para o suporte **com troca de drop**
(receita ~R$ 206 / ~R$ 232). O suporte **simples** (`"Suporte | 50 * 1.1"`, receita R$ 64,46)
casava as mesmas regras quando a planilha o trazia como Externo com o meio preenchido. A LPU não
tinha como distinguir os dois casos pelos campos que usava.

**Correção:** threshold por receita da Unetvale — quatro regras de prioridade 500 (Aéreo/Subterrâneo
× com/sem venda atrelada), faixa R$ 40–150, pagando R$ 30 / R$ 45. Sem mudança de código:
`valorRecebidoUnetvale` já era condição do motor.

| Evidência | Valor |
|---|---|
| Visitas de suporte com sucesso analisadas | 728 |
| Afetadas (todas `pending_review`, sem override, nenhuma paga) | 3 |
| Diferença acumulada | R$ 285 |
| Casos de regressão validados no motor de match | 12 (3 alvo + 9 preservados) |

Migration [`0032`](../../supabase/migrations/0032_lpu_suporte_externo_sem_troca_drop.sql) ·
detalhes em [`docs/domain/05-regras-especiais.md`](../domain/05-regras-especiais.md) ·
PR [#45](https://github.com/Tallpasolutions/wave-ops-hub/pull/45) (mergeado).

**Verificado em produção (30/07):** migration aplicada + "Recalcular pendentes" → OS 574486,
558063 e 559731 em R$ 30, com a regra nova. A visita de 19/05 da OS 559731 seguiu em R$ 135
(teve troca de drop real, receita R$ 0,00 — ver tech-debt 020).

**Calibragem da faixa** (contra os dados reais, não por estética):
- **Dentro:** suporte simples (64,46) · condomínio sem troca de fibra (64,46) · retenção sem
  troca (106,54) · troca de equipamento de local (109,87)
- **Fora:** troca de drop (206,26 / 232,04 / 247,51 / 278,45 / 412,52) · improdutivas (15,98 e 0,00)
- **Piso de R$ 40 deliberado:** preserva as 19 externas *com* troca de drop e receita R$ 0,00

### 0.2 — "Troca de Poste" não casava a lista de infra

**Sintoma:** 3 OSs de Troca de Poste apareciam como "Sem regra" em `/pagamentos`.

**Causa:** a 0013 gravou `"Troca de postes"` (plural, como saiu da ata da decisão da Wave); a
planilha emite `"Troca de Poste"` (singular). O match é exato (`trim + lower`) → nunca casou, e
as visitas ficaram com `fora_escopo = false`. A coluna Z confirma que são infra: *"OS infra feita
por terceirizada"*.

**Correção:** migration [`0033`](../../supabase/migrations/0033_finalidade_troca_de_poste_infra.sql)
acrescenta a variante, refaz o backfill e remove os payouts (padrão da 0013).

> **Terceira ocorrência do mesmo padrão** (0013 → 0028 → 0033): a lista nasce do que o gestor
> **fala**, o match é contra o que a planilha **emite**. Falha em silêncio — a OS não some da
> listagem e também não paga. Ver [tech-debt 021](../tech-debt.md).

### 0.3 — Contestação respondida sem ajuste ficava destravada no recálculo

**Sintoma potencial (não chegou a causar perda):** `resolverContestacao` só gravava `override_by`
quando a Wave **alterava** o valor. Ao analisar e **manter** o valor, o payout voltava a `pending`
sem marca de decisão manual — e `recalculate-batch` trava apenas
`approved`/`paid`/`contestado`/`override_by`. Um "Recalcular pendentes" posterior sobrescreveria o
valor recém-confirmado ao técnico, desfazendo a conferência em silêncio.

Com a conferência da Wave em andamento e contestação contínua, esse era o caminho mais provável de
perda de trabalho já feito: toda mudança de regra da LPU exige um recálculo.

**Correção:** `override_by`/`override_at`/`override_motivo` gravados nos dois casos.
`valor_override` segue só quando o valor muda — preenchê-lo apenas para travar esconderia a quebra
do acréscimo de domingo/feriado na tela do técnico (ADR-011) e exibiria uma linha "Override"
redundante. Migration [`0034`](../../supabase/migrations/0034_trava_contestacoes_resolvidas_sem_ajuste.sql)
aplica a mesma trava às 5 contestações já resolvidas sem ajuste.

**Contrapartida aceita:** payouts com contestação respondida deixam de acompanhar correções de
regra automaticamente; para reprocessar de propósito, limpar `override_by` antes. Registrado no
adendo do [ADR-013](../architecture/ADR-013-aprovacao-contestacao-tecnico.md).

### Estado da Fase 0

| Item | Código | Migration | Produção |
|---|---|---|---|
| 0.1 suporte sem troca de drop | ✅ PR #45 mergeado | 0032 | ✅ **verificado** |
| 0.2 Troca de Poste | ✅ branch `fix/troca-de-poste-fora-escopo` | 0033 | ⏳ aplicar |
| 0.3 trava de contestação | ✅ mesma branch | 0034 | ⏳ aplicar + deploy |

240/240 testes · typecheck ✅ · lint ✅

---

## Fase 1 — IQI: a coleta está parada há 9 dias

### Diagnóstico (evidência colhida em 30/07)

O botão "Sincronizar IQI" **dispara** corretamente o workflow do GitHub Actions. O que falha é a
coleta, e ela falha sempre no mesmo ponto:

```
Error: Tenant 'wave' não encontrado: Invalid API key
    at runIqiCollection (src/lib/iqi/collector.ts:116)
```

| Evidência | Dado |
|---|---|
| Runs do workflow examinados | 26 |
| Falhas | 24 |
| **Último sucesso** | **2026-07-22 14:32 UTC** |
| Secrets `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` regravados em | **2026-07-23 00:21** |
| Snapshots em `iqi_snapshots` | 45, **todos com `synced_at` de 21/07** |

A correlação é direta: funcionava até 22/07, os secrets foram regravados em 23/07 e **toda**
execução desde então falha na primeira chamada ao Supabase. A chave de serviço gravada no GitHub
está inválida — provavelmente colada com espaço/quebra de linha, ou trocada pela chave `anon`.
O scraping da Unetvale nem chega a ser tentado.

> A data que "permanece a mesma" na tela é 21/07 porque é literalmente o último dado gravado.

### 1.1 — Correção imediata (ação do usuário, não do assistente)

Regravar o secret no GitHub — `Settings → Secrets and variables → Actions`:

- `SUPABASE_SERVICE_ROLE_KEY` = a **service_role** do projeto (Supabase → Settings → API), sem
  espaços nem quebra de linha
- `NEXT_PUBLIC_SUPABASE_URL` = a URL do projeto, **sem barra no final**

Validar disparando o workflow pela aba Actions e conferindo que o run fica verde. Definir secrets é
manuseio de credencial: o assistente não faz.

### 1.2 — A UI mente quando a coleta falha

`sincronizarIqi` ([actions.ts:44](../../src/app/(manager)/produtividade/actions.ts)) considera
sucesso o HTTP 204 do `workflow_dispatch` — que significa apenas "o disparo foi aceito", não "a
coleta funcionou". Por isso a mensagem verde apareceu 24 vezes enquanto nada era coletado.

**Proposta:** trocar a promessa por verificação do efeito.

| Item | Mudança |
|---|---|
| Mensagem | De "atualizam em cerca de 1 minuto — recarregue a página" para "Sincronização iniciada…" sem prazo inventado |
| Feedback | O botão passa a consultar `max(synced_at)` de `iqi_snapshots` a cada ~5s (até ~3 min). Mudou → "IQI atualizado" e revalida a tela. Não mudou no prazo → "A coleta não concluiu. Veja o histórico de execuções." |
| Tela | Exibir **sempre** "Última sincronização: <data>", com destaque visual quando passar de 48h (a coleta é 2x/dia) |

Verificar o efeito (`synced_at` mudou) em vez da intenção (disparo aceito) é mais honesto e não
depende de token extra do GitHub.

### 1.3 — Falha silenciosa por 9 dias

Ninguém soube das 24 falhas. Duas saídas, da mais barata para a mais completa:

1. **Indicador de dado velho na tela** (parte do item 1.2) — resolve a descoberta tardia com o
   menor custo
2. **Notificação ao gestor** quando a coleta falhar: passo `if: failure()` no workflow chamando um
   endpoint que usa `notify.ts` (o mesmo ponto único que já entrega in-app + push, ADR-017/018)

**Recomendação:** fazer o 1 junto com o 1.2 e avaliar o 2 depois — sem o indicador, qualquer
alerta novo só duplica ruído.

### DoD da Fase 1
- [ ] Um run do workflow verde, com `iqi_snapshots.synced_at` do dia
- [ ] Botão mostrando resultado real (sucesso confirmado ou falha explícita), verificado com a
      coleta funcionando e com ela quebrada de propósito
- [ ] "Última sincronização" visível em `/produtividade`

---

## Fase 2 — Português integral na interface

**Pedido do usuário, reafirmado:** nenhum termo em inglês deve chegar ao gestor ou ao técnico. Já
foi pedido antes para `payout` → **pagamento**, mas sobraram telas.

### O que foi encontrado

**a) Mapas de tradução de status duplicados por tela** — a causa da inconsistência. Cada tela
traduz por conta própria, e o que não está no mapa cai num fallback que mostra o termo cru:

| Arquivo | Situação |
|---|---|
| `pagamentos/page.tsx:31` | mapa próprio |
| `pagamentos/[id]/page.tsx:25` | **outro** mapa, com rótulos diferentes para o mesmo status |
| `motivos/_components/OsListSheet.tsx:24` | terceiro mapa, com fallback `?? v.payoutStatus` → vaza `pending_review` |

**b) `override` na interface** — `OverridePayoutForm.tsx:42` ("Motivo do override"),
`pagamentos/[id]/page.tsx:191` (linha "Override" e "Motivo do override").

**c) Nomes de coluna crus nas telas de auditoria** — `FIELD_LABELS` duplicado em
`visitas/[id]/page.tsx:17` e `uploads/[id]/audit/page.tsx:37`, ambos com fallback `?? key`. Campos
fora do mapa aparecem como `subterraneo_aereo`, `explicacao_valor`, `lpu_rule_id`.

**d) Termos técnicos que viraram vocabulário da tela** — "LPU" e "OS" ficam (são o vocabulário da
Wave); "payout", "override", "status" cru, "batch", "upload" precisam de decisão caso a caso.

### Proposta

1. **Fonte única de rótulos**, seguindo o precedente da Sprint 13 (`src/lib/reasons/categoria.ts`)
   e de `lpu/_lib/status.ts`:
   - `src/lib/labels/payout-status.ts` — status do pagamento
   - `src/lib/labels/campos.ts` — nomes de campo das telas de auditoria
   Ambos **sem fallback silencioso**: campo desconhecido é erro de tipo, não texto cru na tela.
2. **Trocar `override` por "ajuste manual"** em toda a interface (o nome da coluna no banco não
   muda — é vocabulário interno).
3. **Teste de regressão** varrendo `.tsx` por uma lista negra de termos em inglês em texto visível,
   no mesmo espírito do `schema-conventions.test.ts`. É o que impede a terceira reincidência —
   sem ele, a próxima tela nova volta a vazar.

### Decisão que preciso de você

O glossário da Wave mantém **"payout"** como termo de domínio em `docs/glossary.md` e no CLAUDE.md.
A troca vale só para o que o usuário lê na tela, ou você quer renomear também no código e na
documentação? Recomendo **só a interface**: renomear o código toca ~40 arquivos, o banco
(`payouts`, `valor_override`) e todos os ADRs, com risco alto e zero ganho para quem usa o sistema.

---

## Fase 3 — Tirar código e log da interface

**Pedido do usuário:** "Isso não é visualmente legal para a Wave."

| Onde | O que aparece hoje | Proposta |
|---|---|---|
| `visitas/[id]/page.tsx:286` | JSON da regra de LPU (`{"type":"fixed","value":20}`) | "Valor fixo de R$ 20,00" |
| `pagamentos/[id]/page.tsx:230,236` | JSON de `conditions` **e** de `payout` | Frase legível: "Retirada · valor fixo de R$ 20,00"; condições como lista ("Finalidade: Retirada") |
| `uploads/[id]/page.tsx:260` | JSON dos erros de importação | Lista de erros com linha e motivo |
| `visitas/[id]`, `uploads/[id]/audit` | `before`/`after` com nomes de coluna crus | Usa a fonte única da Fase 2 |

A formatação legível de uma regra é lógica de domínio, não de componente: entra em
`src/lib/lpu/format.ts` (`formatPayout`, `formatConditions`), com teste unitário. As telas passam a
consumir texto pronto.

`(dev)/dev/components/ComponentsDemo.tsx` **fica como está** — é tela de diagnóstico local, não
recebe funcionalidade de produto (CLAUDE.md §6).

### DoD da Fase 3
- [ ] Nenhum `<pre>` com JSON nas rotas `(manager)` e `(technician)`
- [ ] Regra de LPU legível em `/visitas/[id]` e `/pagamentos/[id]`
- [ ] Erros de upload em lista legível
- [ ] Testes de `formatPayout`/`formatConditions` cobrindo os três tipos de payout
      (`fixed`, `formula`, `percentage_of_revenue`)

---

## Ordem sugerida

1. **Aplicar 0033 e 0034** (Fase 0 fechada) — o dinheiro é o que importa primeiro
2. **Regravar o secret do IQI** (1.1) — desbloqueia dado parado há 9 dias, custa 2 minutos
3. **Fase 3** — maior ganho visível por esforço, escopo fechado, sem decisão pendente
4. **Fase 2** — depende da sua decisão sobre o alcance da renomeação
5. **1.2 e 1.3** — depois que a coleta estiver comprovadamente verde

---

## Estado verificado

- **30/07/2026 — Fase 0.1 VERIFICADA EM PRODUÇÃO:** migration 0032 aplicada pelo usuário +
  "Recalcular pendentes". As 3 visitas em R$ 30 com a regra "sem troca de drop". LPU ativa foi de
  14 → 18 regras, todas `ativa = true`.
- **30/07/2026 — Fases 0.2 e 0.3 implementadas**, branch `fix/troca-de-poste-fora-escopo`:
  aguardando merge, aplicação de 0033/0034 e deploy.
- **30/07/2026 — Fase 1 diagnosticada**, não corrigida: causa raiz é o secret
  `SUPABASE_SERVICE_ROLE_KEY` do GitHub Actions, inválido desde 23/07. Correção depende do usuário.
