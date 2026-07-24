# ADR-011 — Acréscimo de 15% em domingos e feriados no payout

**Status:** Proposto (aguardando validação Gemini — CLAUDE.md §11)
**Data:** 2026-07-04
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** Roadmap Sprint 16. A LPU da Wave tem a regra "Execução de serviços aos domingos e
feriados (15% a mais)", que ainda não estava no motor de payout.

---

## Contexto

O técnico recebe +15% sobre o valor do serviço quando a execução cai em **domingo ou feriado**.
Hoje o motor de payout (`calculatePayout` → `applyPayoutFormula`) calcula o valor pela LPU (ou
pela classificação de Cabeamento) e ignora a data — o acréscimo nunca era aplicado.

Decisão do usuário (04/07): o acréscimo vale **só para execuções com sucesso** (valor da LPU ou
da classificação de Cabeamento). Improdutivas — mesmo as que pagam valor fixo — **não** ganham o
acréscimo (não houve execução de serviço).

---

## Decisões

### 1. Multiplicador pós-cálculo em `buildPayoutUpsert` (motor de LPU intacto)

O acréscimo é aplicado sobre o `valorCalculado` **depois** do cálculo base, num ponto único
(`buildPayoutUpsert`, payouts lib), que cobre tanto o valor da LPU quanto o da classificação de
Cabeamento (ADR-009). O motor de match/`applyPayoutFormula` (ADR-004) **não muda**.

Aplica quando, e somente quando: a visita teve **sucesso** (`sucesso` começa com "sim"), tem
`valorCalculado > 0`, e cai em **domingo ou feriado**. `valorCalculado = base × (1 + pct/100)`.

### 2. Domingo/feriado pela data da visita, timezone-safe e consistente

A dimensão de data usa `data_execucao.slice(0,10)` ("YYYY-MM-DD") — a **mesma convenção** que o
resto do app (aggregate, período). Domingo = dia-da-semana da data via `Date.UTC(...).getUTCDay()`
(determinístico, sem depender do fuso do servidor). Feriado = a data está na lista configurada.
Helper puro e testado em `src/lib/payouts/feriado.ts`.

### 3. Feriados e percentual na config do tenant (data-driven)

`tenants.config.feriados`: array de datas "YYYY-MM-DD" mantido pelo gestor (mesmo padrão do
`finalidades_infra` do ADR-008). `tenants.config.feriado_acrescimo_pct`: número (default 15).
A regra de **domingo** funciona sem lista nenhuma; a de **feriado** ativa conforme as datas
cadastradas. A lista de feriados (nacionais + SC + específicos da operação) é fornecida pelo
gestor e semeada por migration/SQL.

### 4. Fora do escopo v1

- UI de gestão de feriados (adicionar/remover datas pela tela) — por ora é seed/SQL. Anotar em
  tech-debt.
- Meio-feriado / feriado municipal com regra diferente. Sábado não entra (a regra é domingo+feriado).
- Recalcular retroativamente é o fluxo normal de "Recalcular pendentes" (não altera approved/paid).

---

## Alternativas consideradas

- **Aplicar no motor de LPU (`applyPayoutFormula`)** — rejeitado: o acréscimo é uma política de
  pagamento sobre o resultado, não uma regra de match; misturar quebraria a separação do ADR-004
  e não cobriria o Cabeamento (que não passa pelo motor).
- **Calcular feriados no código (base na Páscoa)** — rejeitado por ora: feriados móveis + estaduais
  + específicos da Unetvale variam; lista explícita na config é simples, auditável e sob controle
  do gestor.

---

## Consequências

- Execuções em domingo/feriado passam a pagar 15% a mais — pagamento fica correto conforme a LPU.
- Toque cirúrgico: helper puro + um multiplicador em `buildPayoutUpsert` + `data_execucao` no
  SimVisit + config carregada no `recalculate-batch`. Motor de LPU e improdutivas intactos.
- Dependência operacional: o gestor fornece a lista de feriados; sem ela, só domingos ganham o
  acréscimo (comportamento seguro — não inventa feriado).

---

## Plano de implementação (fases)

1. **Helper `feriado.ts`** (puro + testes): `isDomingoOuFeriado(dataExecucao, feriados)` e
   `aplicarAcrescimo(valor, pct)`.
2. **Cálculo:** `data_execucao` no SimVisit; multiplicador em `buildPayoutUpsert` (sucesso +
   domingo/feriado); `recalculate-batch` carrega `feriados`/`pct` da config e passa ao build.
3. **Migration 0016:** seed `feriado_acrescimo_pct=15` + `feriados` (lista do gestor).
4. **Verificação em produção:** uma visita de domingo (e uma de feriado) com sucesso paga base×1,15;
   improdutiva no mesmo dia não muda; recalcular e reconciliar em /pagamentos.

**DoD:** payout de execução com sucesso em domingo/feriado = valor × 1,15, verificado em produção;
improdutivas inalteradas.

---

## Adendo (2026-07-24) — retirada não recebe o acréscimo

**Decisão do gestor:** o +15% de domingo/feriado **não** se aplica a OSs de **retirada**.

Escopo confirmado: **toda** retirada — cobre a finalidade `Retirada` (que paga pela LPU) e
`Retirada Condomínio` (que paga pela classificação de cabeamento, ADR-009). O critério é o prefixo
da finalidade normalizada (`trim().toLowerCase().startsWith("retirada")`), então futuras variantes
("Retirada ...") já entram na exceção.

**Implementação:** a exclusão entra no **mesmo portão** que já decide o acréscimo
(`aplicaAcrescimo` em `buildPayoutUpsert`), que gateia o helper `comAcrescimo`. Como `comAcrescimo`
é aplicado em **todos** os caminhos de sucesso (LPU, cabeamento, homologação, Venda Produto
Externo), basta `!isRetirada` no portão para a exceção valer em todos eles — sem tocar no motor de
LPU nem nas saídas antecipadas. Nenhuma migration: é regra de código, não de dado.

**Verificação:** cobertura em `calculate.test.ts` (retirada LPU e Retirada Condomínio em domingo →
sem acréscimo; retirada em dia útil → valor normal). Em produção, recalcular um período com
retirada em domingo/feriado e confirmar que o valor **não** foi multiplicado.
