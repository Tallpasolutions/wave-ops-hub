# Domínio 02 — LPU e Motivos de Não-Conclusão

> Decisão arquitetural em [ADR-004](../architecture/ADR-004-lpu-rule-engine.md). Este documento detalha o modelo de negócio.

---

## LPU — Lista de Preços Unitários

### O que é
A LPU define **quanto a Wave paga ao técnico** por cada visita, conforme características da visita. É uma estrutura **versionada** (uma LPU substitui outra a partir de uma data) e **com prioridades** (regras mais específicas vencem regras genéricas).

### Estrutura

```
lpus
├── id
├── tenant_id
├── nome                    "LPU Wave 2026"
├── vigencia_inicio         2026-01-01
├── vigencia_fim            NULL (vigente)
├── ativa                   true
└── rules
    ├── prioridade          200
    ├── conditions          { finalidade: "Suporte Fibra", tipo_atendimento: "Externo", sucesso: "Sim" }
    ├── payout              { type: "fixed", value: 80.00 }
    └── description         "Suporte Fibra Externo - Sucesso"
```

### Vigência

Apenas **uma LPU pode estar `ativa = true`** ao mesmo tempo dentro de um mesmo tenant (constraint via trigger). Para substituir:

1. Cliente cria nova LPU com `vigencia_inicio` futura
2. Sistema fecha automaticamente a LPU anterior (`vigencia_fim = nova.vigencia_inicio - 1 day`)
3. Cálculos retroativos usam a LPU vigente em `data_execucao` da visita

### Versionamento

Toda alteração em `lpu_rules` (criar, editar, desativar) gera registro em `lpu_rules_audit`. Mudar uma regra **NÃO** recalcula payouts já aprovados — apenas afeta payouts futuros e os pendentes.

Para forçar recálculo retroativo, usuário usa botão "Recalcular payouts pendentes" — só funciona em payouts não aprovados ainda.

---

## Tipos de payout suportados

### `fixed` — Valor fixo
```json
{
  "type": "fixed",
  "value": 80.00
}
```
Mais comum. Usado para a maioria das regras simples.

### `formula` — Fórmula com base + adicional
```json
{
  "type": "formula",
  "base": 50.00,
  "additional": {
    "field": "drop_usado",
    "rate_per_unit": 0.30
  }
}
```
Calcula: `50.00 + (drop_usado × 0.30)`. Usado quando o pagamento varia com metragem, número de conectores, etc.

### `percentage_of_revenue` — % da receita Unetvale
```json
{
  "type": "percentage_of_revenue",
  "percentage": 60
}
```
Calcula: `valor_recebido_unetvale × 0.60`. Útil se a regra do cliente for "técnico recebe 60% do que a Wave recebe da Unetvale".

### `tiered` — Faixas (futuro, não no MVP)
```json
{
  "type": "tiered",
  "field": "drop_usado",
  "tiers": [
    { "max": 50, "value": 30 },
    { "max": 100, "value": 60 },
    { "max": null, "value": 100 }
  ]
}
```
Não implementado no MVP — adicionado se necessário.

---

## Cálculo de prioridade automática

Quando o usuário salva uma regra sem definir prioridade explícita, o sistema calcula:

```
prioridade = count(keys(conditions)) × 100
```

Exemplo:
- `{finalidade, tipo_atendimento}` → 200
- `{finalidade}` → 100
- `{finalidade, tipo_atendimento, cidade}` → 300

O usuário pode sobrescrever digitando um número manual no formulário.

### Empate de prioridade

Se duas regras ativas têm a mesma prioridade e ambas casam com a visita, é um **erro de configuração**. O sistema:
- Salva a visita com `payout_id = NULL` e `payout_status = 'conflict'`
- Notifica o gestor com link para resolver

---

## Motivos de Não-Conclusão

### O que é
Cada visita com `sucesso != 'Sim'` tem um **motivo**. Olhando os dados reais da planilha:

```
Cliente ausente
Sem tempo
Chuva no local
OS criada incorreta
APR Impedida
Sem viabilidade (Unetvale)
Sem viabilidade (cliente vai resolver)
Endereço não encontrado
Cliente reagendou
Em ligação - cliente reagendou
Quer reagendar
... (outros)
```

### Categorias

Cada motivo cai em uma de 4 categorias (configurável pelo gestor):

| Categoria | Descrição | Default paga improdutiva? | Conta como "deixado na mesa"? |
|---|---|---|---|
| `falha_tecnico` | Falha atribuível ao técnico | Não (R$ 0) | Sim |
| `falha_cliente` | Cliente impediu execução | Sim | Não |
| `forca_maior` | Eventos incontroláveis | Sim | Não |
| `falha_sistema` | Erro Unetvale/Wave/sistema | Sim | Não |
| `pendente_classificacao` | Motivo novo, ainda não classificado | Não calcula | Não |

### Política de pagamento por motivo

```sql
CREATE TABLE reasons (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  motivo_original TEXT NOT NULL,           -- "Não - 01 Fui no cliente mas ele não estava em casa"
  motivo_normalizado TEXT NOT NULL,        -- "Cliente ausente"
  categoria TEXT NOT NULL,
  paga_improdutiva BOOLEAN NOT NULL DEFAULT false,
  valor_improdutiva NUMERIC(10, 2),        -- NULL = aplica regra LPU; valor = override fixo
  observacao TEXT,
  UNIQUE (tenant_id, motivo_original)
);
```

### Tela de configuração de motivos

```
┌────────────────────────────────────────────────────────────────────┐
│ Política de Motivos de Não-Conclusão                               │
├────────────────────────────────────────────────────────────────────┤
│ Motivo Original (Unetvale)         Categoria          Paga? Valor  │
│ ─────────────────────────────────  ──────────────────  ─────  ──── │
│ Cliente ausente                    Falha cliente       ✓     R$ 15 │
│ Sem tempo                          Falha técnico       ✗     —     │
│ Chuva no local                     Força maior         ✓     R$ 25 │
│ OS criada incorreta                Falha sistema       ✓     R$ 25 │
│ APR Impedida                       Falha sistema       ✓     R$ 25 │
│ Endereço não encontrado            Falha técnico       ✗     —     │
│ Cliente reagendou                  Falha cliente       ✓     R$ 15 │
│                                                                     │
│ ⚠️  Pendentes de classificação:                                    │
│ Cliente sem energia                [Classificar]                   │
└────────────────────────────────────────────────────────────────────┘
```

### Auto-criação de motivos

Quando um motivo aparece na ingestão e não está cadastrado:

1. Sistema cria registro com `categoria='pendente_classificacao'`, `paga_improdutiva=false`
2. Visita é salva com `reason_id` apontando para esse registro
3. Payout dessa visita fica `pending_review`
4. Notificação aparece no painel do gestor

Após classificação manual, sistema oferece "Recalcular payouts afetados".

---

## Cálculo final de payout por visita

> **Este pseudocódigo descreve apenas o caminho da LPU** (`calculatePayout`, o motor de regras).
> Ele **não é** o cálculo completo do payout: várias famílias de serviço são resolvidas **antes**
> de chegar aqui — improdutiva por receita da Unetvale, R$ 29,30, homologação, Venda Produto
> Externo e cabeamento — e, depois, incidem pontos adicionais e o acréscimo de domingo/feriado.
> A visão completa está em
> [`03-payout.md` → Ordem de precedência](./03-payout.md#ordem-de-precedência-do-cálculo).
>
> Além disso, **qual LPU** entra aqui depende do técnico: quem estiver vinculado a uma tabela
> alternativa (ex.: "SEM AUXILIAR") casa as regras dela —
> [ADR-014](../architecture/ADR-014-lpu-por-tecnico.md).

Pseudocódigo:

```python
def calculate_payout(visit, lpu, reasons):
    # 1. Visita com sucesso → aplica match engine na LPU
    if visit.sucesso == 'Sim':
        rule = match_engine(visit, lpu.rules)
        if not rule:
            return PayoutResult(value=None, status='no_rule_match')
        return PayoutResult(
            value=apply_payout_formula(rule.payout, visit),
            rule_id=rule.id,
            status='pending'
        )

    # 2. Visita sem sucesso → consulta política do motivo
    reason = reasons.get(visit.reason_id)
    if not reason or reason.categoria == 'pendente_classificacao':
        return PayoutResult(value=None, status='pending_classification')

    if not reason.paga_improdutiva:
        return PayoutResult(value=0, status='pending')

    # 3. Improdutiva paga
    if reason.valor_improdutiva is not None:
        # Override fixo
        return PayoutResult(value=reason.valor_improdutiva, status='pending')

    # 4. Fallback: aplica match engine procurando regra de improdutiva
    visit_copy = visit.with_field('sucesso', 'Improdutiva')
    rule = match_engine(visit_copy, lpu.rules)
    if not rule:
        return PayoutResult(value=None, status='no_rule_match')
    return PayoutResult(
        value=apply_payout_formula(rule.payout, visit),
        rule_id=rule.id,
        status='pending'
    )
```

---

## Cálculo de "deixado na mesa"

Apenas para visitas com:
- `sucesso != 'Sim'`
- `reason.categoria == 'falha_tecnico'`

Fórmula:
```python
def deixado_na_mesa(visit, lpu):
    if visit.sucesso == 'Sim':
        return 0
    if visit.reason.categoria != 'falha_tecnico':
        return 0

    # Simula: e se a visita tivesse dado certo?
    visit_simulated = visit.with_field('sucesso', 'Sim')
    rule = match_engine(visit_simulated, lpu.rules)
    if not rule:
        return 0

    valor_potencial = apply_payout_formula(rule.payout, visit_simulated)
    valor_recebido = visit.payout.value or 0  # geralmente 0 em falha técnica

    return max(0, valor_potencial - valor_recebido)
```

Apresentação:
- **Painel técnico** mostra valor agregado mensal: "R$ 2.180 deixados na mesa em abril"
- Detalhamento por OS quando o técnico clica
- Mostra apenas se `tenant.config.show_money_on_technician_panel = true` (configurável pelo gestor)

---

## Atribuição de payout em OSs com múltiplas visitas

Regra confirmada: **Apenas o técnico da última visita com `sucesso=Sim` recebe o payout de serviço.**

Exemplo OS 550295:

| Ordem | Técnico | Sucesso? | Motivo | Categoria | Payout | Deixado na mesa |
|---|---|---|---|---|---|---|
| 1 | Carlos | Não | Endereço não encontrado | falha_tecnico | R$ 0 | R$ 100* |
| 2 | Juliano | Não | Cliente ausente | falha_cliente | R$ 15 | R$ 0 |
| 3 | Jean | Não | APR impedida | falha_sistema | R$ 25 | R$ 0 |
| 4 | Jean | Não | APR impedida | falha_sistema | R$ 25 | R$ 0 |
| 5 | Jean | **Sim** | — | — | **R$ 100** | R$ 0 |

\* O "deixado na mesa" do Carlos só aparece se o sistema simular: "se Carlos tivesse achado o endereço, qual regra LPU teria aplicado?". A regra hipotética é Suporte/Instalação Externa Sucesso, e ela paga R$ 100. Como Carlos recebeu R$ 0 (falha técnica), deixou R$ 100 na mesa.

**Total recebido pelos técnicos nesta OS:** R$ 165
**Receita Wave (Unetvale):** R$ 206,26
**Margem:** R$ 41,26 (20%)

---

## Tela de simulação de LPU

Antes de o gestor ativar uma LPU nova/alterada:

```
┌─────────────────────────────────────────────────────────────┐
│ Simulação de LPU Rascunho                                   │
│ Aplicada nas 857 visitas de abril/2026                     │
├─────────────────────────────────────────────────────────────┤
│  ✓ 823 visitas com regra encontrada                         │
│  ⚠ 34 visitas sem regra aplicável → revisar                 │
│                                                              │
│  Total estimado a pagar: R$ 62.180,00                       │
│  Receita total Unetvale: R$ 87.869,47                       │
│  Margem estimada:        R$ 25.689,47 (29,2%)               │
│                                                              │
│  Distribuição por técnico:                                  │
│  - Douglas Ribeiro: R$ 14.250 (190 visitas)                │
│  - Daniel Soares:   R$ 11.890 (147 visitas)                │
│  ...                                                         │
│                                                              │
│  [Ver visitas sem regra]  [Ajustar LPU]  [Ativar LPU]      │
└─────────────────────────────────────────────────────────────┘
```
