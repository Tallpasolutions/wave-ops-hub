# Domínio 01 — Ordens de Serviço e Visitas

> Este documento detalha as regras de negócio em torno das duas entidades centrais do sistema. Para a decisão arquitetural, ver [ADR-003](../architecture/ADR-003-os-visit-modeling.md). Para vocabulário, ver [glossário](../glossary.md).

---

## Entidade `service_order` (Ordem de Serviço)

### O que é
A demanda registrada pelo cliente da Wave junto à operadora (Unetvale). Cada OS tem um número único (`os_num`) atribuído pela Unetvale.

### Campos do banco

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK interna |
| `tenant_id` | UUID | FK tenants |
| `os_num` | BIGINT | Número da OS (chave da Unetvale) |
| `inicio_sistema` | TIMESTAMPTZ | Quando a OS foi criada na Unetvale |
| `cliente_usuario` | TEXT | Identificação do cliente final |
| `contrato` | TEXT | Número de contrato |
| `finalidade` | TEXT | Tipo de OS (Suporte Fibra, Instalação, etc.) |
| `cidade` | TEXT | Cidade do atendimento |
| `condominio` | BOOLEAN | Se é condomínio |
| `cat1`, `cat2`, `cat3` | TEXT | Categorias de problema |
| `status_consolidado` | TEXT | `aberta` \| `em_andamento` \| `resolvida` \| `cancelada` |
| `data_resolucao` | TIMESTAMPTZ | Data da visita que resolveu (NULL se não resolvida) |
| `total_visitas` | INTEGER | Count derivado |
| `tentativas_ate_sucesso` | INTEGER | 1 = primeira visita resolveu, 5 = quinta resolveu, NULL = não resolvida |
| `custo_total` | NUMERIC | Soma de payouts das visitas |
| `receita_total` | NUMERIC | Soma de `valor_recebido_unetvale` das visitas |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

**PK lógica:** `(tenant_id, os_num)` — unique constraint.

### Lifecycle

```
[criada na ingestão da 1a visita]
        ↓
   aberta (sem visita ainda) — caso raro, só se houver registro pré-criação
        ↓
   em_andamento (1+ visita, nenhuma com sucesso)
        ↓
   resolvida (alguma visita com sucesso=Sim)
```

**Cancelada** é raro — caso a Unetvale ou Wave decidam descontinuar a OS antes de resolver. Marcação manual pelo gestor.

### Triggers de consolidação

A função `consolidar_service_order(tenant_id, os_num)` recalcula todos os campos derivados a partir das visitas. É chamada automaticamente:

- Após INSERT em `service_visits`
- Após UPDATE em `service_visits` (apenas se campos relevantes mudaram)
- Após DELETE em `service_visits`

Implementada como trigger Postgres em `supabase/migrations/`.

---

## Entidade `service_visit` (Visita)

### O que é
Cada execução individual de uma OS por um técnico em um momento específico. **Cada linha da planilha é uma visita.**

### Campos do banco

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK interna |
| `tenant_id` | UUID | FK tenants |
| `os_num` | BIGINT | FK lógica para service_orders (composta com tenant_id) |
| `upload_id` | UUID | Qual upload trouxe esta visita |
| `data_execucao` | TIMESTAMPTZ | Coluna `Data` da planilha (quando técnico atuou) |
| `tecnico_id` | UUID | FK technicians (NULL se não bateu match) |
| `tecnico_raw` | TEXT | Nome bruto da planilha (preservado pra auditoria) |
| `finalidade` | TEXT | Replicado de service_orders (snapshot) |
| `tipo_atendimento` | TEXT | `Externo` \| `Interno` |
| `cidade` | TEXT | |
| `sucesso` | TEXT | `Sim` ou string do motivo de não-conclusão |
| `reason_id` | UUID | FK reasons (NULL se sucesso=Sim) |
| `improdutiva` | BOOLEAN | Marcação da Wave |
| `valor_recebido_unetvale` | NUMERIC | Coluna `Valor` da planilha |
| `drop_usado` | NUMERIC | Metragem de drop (quando aplicável) |
| `faixa_drop` | TEXT | |
| `conectores_usados` | INTEGER | |
| `condominio` | BOOLEAN | |
| `subterraneo_aereo` | TEXT | |
| `garantia` | BOOLEAN | |
| `validada` | BOOLEAN | |
| `agregada` | BOOLEAN | |
| `rejeitada` | BOOLEAN | |
| `agendada` | BOOLEAN | |
| `trocado_drop` | BOOLEAN | |
| `motivo_troca` | TEXT | |
| `outras_fibras` | BOOLEAN | |
| `quantas_fibras` | INTEGER | |
| `categoria_interna` | TEXT | |
| `cat1`, `cat2`, `cat3` | TEXT | |
| `explicacao_valor` | TEXT | |
| `observacoes` | TEXT | |
| `content_hash` | TEXT | SHA-256 dos campos relevantes |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

**Constraint de idempotência:**
```sql
UNIQUE (tenant_id, os_num, data_execucao, tecnico_id)
```

⚠️ **Atenção ao caso `tecnico_id IS NULL`:** UNIQUE no Postgres permite múltiplos NULLs. Para prevenir duplicatas onde o técnico não bateu match, adicionamos:

```sql
CREATE UNIQUE INDEX idx_visit_unique_no_match
  ON service_visits(tenant_id, os_num, data_execucao, tecnico_raw)
  WHERE tecnico_id IS NULL;
```

### Relação com OS

Não há FK formal para `service_orders` — a relação é por `(tenant_id, os_num)`. Isso porque uma visita pode ser inserida antes da consolidação criar o registro em `service_orders` (a consolidação roda no trigger AFTER INSERT). A integridade é garantida por código + trigger.

---

## Múltiplas visitas para a mesma OS

Padrão real observado na planilha de abril/2026:
- 733 OSs únicas
- 857 visitas
- 98 OSs com >1 visita
- OS campeã com 5 visitas (OS 550295)

### Implicações

**Para métricas operacionais:**
- "Total de OSs" ≠ "Total de visitas"
- "Taxa de resolução de OSs" = OSs com `status_consolidado = resolvida` / total de OSs
- "Taxa de sucesso por visita" = visitas com `sucesso=Sim` / total de visitas
- **Estas são métricas diferentes e ambas devem aparecer nos dashboards** com nomenclatura clara.

**Para payouts:**
- A regra "só quem finaliza recebe" significa: o técnico da última visita com `sucesso=Sim` recebe o payout do serviço
- Visitas anteriores recebem apenas payout de improdutiva (se aplicável pelo motivo)

**Para o painel do técnico:**
- "Suas OSs" pode confundir — usar **"Suas visitas"** ou **"Seus atendimentos"**
- "Deixado na mesa" considera somente visitas com motivo `falha_tecnico`

---

## Estados problemáticos e como tratar

### Visita sem técnico vinculado (`tecnico_id IS NULL`)
**Acontece quando:** o nome na planilha não bate com nenhum técnico cadastrado.
**Tratamento:** visita é salva, mas não recebe payout. Gestor é notificado para cadastrar/vincular.
**UI:** lista "Visitas pendentes de vinculação" no painel do gestor.

### Visita sem motivo classificado (`reason_id IS NULL` e `sucesso != 'Sim'`)
**Acontece quando:** o motivo de não-conclusão é novo (não cadastrado).
**Tratamento:** sistema cria automaticamente `reasons` com `categoria='pendente_classificacao'`. Visita fica com payout zero até classificação.
**UI:** lista "Motivos pendentes de classificação".

### Visita sem regra LPU aplicável (`payout_id IS NULL`)
**Acontece quando:** o match engine não encontra nenhuma regra que case com a visita.
**Tratamento:** visita não tem payout calculado. Gestor é notificado.
**UI:** lista "Visitas sem regra de pagamento" — exige ação (criar regra ou marcar exceção manual).

### OS com visitas duplicadas (raro, mas possível)
Se a Unetvale exportar a mesma visita duas vezes em planilhas diferentes (sobreposição de períodos), a constraint UNIQUE bloqueia. Sistema retorna `skipped++` no contador.

### Visita de mês anterior aparecendo em planilha nova
**Acontece quando:** Wave exporta um range que inclui mês anterior. Sistema processa normalmente, atualiza `service_orders` daquele mês, recalcula payouts daquele mês. Não bloqueia.

---

## Tabela de auditoria

Toda mudança em `service_visits` (UPDATE) gera registro em `service_visits_audit`:

```sql
CREATE TABLE service_visits_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES service_visits(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES uploads(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES users(id), -- NULL se foi automático via upload
  before JSONB NOT NULL,
  after JSONB NOT NULL
);
```

---

## Indices e performance

```sql
CREATE INDEX idx_visits_tenant_data ON service_visits(tenant_id, data_execucao);
CREATE INDEX idx_visits_tenant_tecnico ON service_visits(tenant_id, tecnico_id);
CREATE INDEX idx_visits_tenant_os ON service_visits(tenant_id, os_num);
CREATE INDEX idx_visits_status ON service_visits(tenant_id, sucesso);
```

Volumes esperados na fase inicial:
- Wave: ~900 visitas/mês = ~11k/ano
- 5 tenants similares: ~55k/ano

Postgres aguenta tranquilamente. Particionamento por tenant ou por ano só vira tema acima de 1M de linhas.
