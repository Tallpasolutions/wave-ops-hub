# ADR-011 — Acréscimo de 15% em domingos e feriados no payout

**Status:** Aceito (implementado e em produção; ver "Estado da implementação" no fim)
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

## Estado da implementação (revisado em 2026-07-24)

**Implementado e em produção.** O helper `src/lib/payouts/feriado.ts` e o multiplicador em
`buildPayoutUpsert` estão ativos; a migration 0016 semeou `feriado_acrescimo_pct = 15` e criou
`config.feriados` (lista vazia, preservando o que já existisse).

O acréscimo incide sobre o valor **já com** o ponto adicional da coluna Z
([ADR-016](./ADR-016-ajustes-coluna-z.md)) e vale para os caminhos de LPU, classificação de
cabeamento (ADR-009), homologação (ADR-015) e Venda Produto Externo — nunca para improdutiva.

**Pendência operacional (não é código):** a migration deixou `config.feriados` vazia e não houve
migration posterior semeando datas. Enquanto a lista de feriados (SC/Unetvale) não for cadastrada,
apenas domingos recebem o acréscimo — comportamento seguro por desenho: o sistema não inventa
feriado. Conferir o estado real com:

```sql
SELECT config -> 'feriados' FROM tenants WHERE slug = 'wave';
```
