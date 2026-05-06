# Sprint 2 — Ingestão (ETL)

**Duração estimada:** 1 semana
**Status:** Pendente
**Pré-requisitos:** Sprints 0 e 1 concluídas

---

## Objetivo

Implementar todo o fluxo de ingestão de planilhas: upload no Storage, parser, normalização, validação, idempotência e persistência. Ao final da sprint, gestor da Wave consegue subir a planilha real de abril/2026 e ver as 857 visitas no banco corretamente.

---

## Escopo IN

### 1. Schema do banco

Adicionar tabelas:

```sql
-- service_orders (consolidação de OSs)
CREATE TABLE service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  os_num BIGINT NOT NULL,
  inicio_sistema TIMESTAMPTZ,
  cliente_usuario TEXT,
  contrato TEXT,
  finalidade TEXT,
  cidade TEXT,
  condominio BOOLEAN DEFAULT false,
  cat1 TEXT, cat2 TEXT, cat3 TEXT,
  status_consolidado TEXT NOT NULL DEFAULT 'em_andamento',
  data_resolucao TIMESTAMPTZ,
  total_visitas INTEGER NOT NULL DEFAULT 0,
  tentativas_ate_sucesso INTEGER,
  custo_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  receita_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, os_num)
);

-- service_visits (cada linha da planilha)
CREATE TABLE service_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  os_num BIGINT NOT NULL,
  upload_id UUID REFERENCES uploads(id),
  data_execucao TIMESTAMPTZ NOT NULL,
  tecnico_id UUID REFERENCES technicians(id),
  tecnico_raw TEXT NOT NULL,
  -- ... (todos os campos descritos em docs/domain/01)
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, os_num, data_execucao, tecnico_id)
);

-- uploads
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL,
  periodo_inicio DATE,
  periodo_fim DATE,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  inseridas INTEGER NOT NULL DEFAULT 0,
  atualizadas INTEGER NOT NULL DEFAULT 0,
  ignoradas INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  error_log JSONB,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (tenant_id, file_hash)
);

-- service_visits_audit
CREATE TABLE service_visits_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES service_visits(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES uploads(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES users(id),
  before JSONB NOT NULL,
  after JSONB NOT NULL
);
```

- [ ] Migration aplicada em dev e staging
- [ ] RLS aplicada em todas as novas tabelas
- [ ] Índices criados (ver `docs/domain/01-os-e-visitas.md`)

### 2. Trigger de consolidação

```sql
CREATE OR REPLACE FUNCTION consolidar_service_order(p_tenant_id UUID, p_os_num BIGINT)
RETURNS VOID AS $$
-- detalhes em docs/domain/01
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_consolidar_service_order()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM consolidar_service_order(
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.os_num, OLD.os_num)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_visit_change
  AFTER INSERT OR UPDATE OR DELETE ON service_visits
  FOR EACH ROW EXECUTE FUNCTION trg_consolidar_service_order();
```

- [ ] Função e trigger criadas e testadas
- [ ] Cobertura para casos: insert primeira visita, update visita, delete visita

### 3. Storage Supabase

- [ ] Bucket `uploads` configurado no Sprint 0 — verificar
- [ ] Path pattern: `<tenant_id>/<year>/<month>/<file_name>`
- [ ] RLS no bucket: cada tenant só vê seus arquivos
- [ ] Rota de upload via Supabase SDK direto do cliente (URL assinada)

### 4. Lib `src/lib/etl/`

Estrutura:

```
src/lib/etl/
├── index.ts              # API pública (apenas exports)
├── types.ts              # tipos compartilhados
├── schemas.ts            # Zod schemas
├── column-mapping.ts     # alias de colunas com encoding latino-1
├── parser.ts             # XLSX → array de RawRow
├── normalizer.ts         # RawRow → NormalizedRow (datas, strings, números)
├── matchers.ts           # match-tecnico, match-motivo
├── content-hash.ts       # SHA-256 do row
├── ingestor.ts           # orquestra todo o fluxo (entrada do Server Action)
└── __tests__/            # testes Vitest
    ├── parser.test.ts
    ├── normalizer.test.ts
    ├── matchers.test.ts
    └── ingestor.test.ts
```

- [ ] Implementar todos os módulos
- [ ] Testes unit cobrindo: planilha real abril/2026 (fixture), edge cases (data inválida, técnico ausente, motivo novo, sobreposição de períodos)

### 5. Server Action de processamento

```typescript
// src/app/(manager)/uploads/actions.ts
'use server';

export async function processUpload(uploadId: string) {
  const user = await requireRole(['tenant_owner', 'tenant_manager', 'tallpa_owner']);
  // ... orquestra ingest pipeline
}
```

- [ ] Action recebe `uploadId`, baixa do Storage, calcula hash, processa
- [ ] Retorna `{ status, counts, errors, warnings }`

### 6. UI de upload

- [ ] `/uploads` — lista uploads recentes, com status (success/processing/failed/duplicate), contadores
- [ ] `/uploads/new` — drag-and-drop ou file input, sobe pro Storage, chama Server Action, mostra progresso
- [ ] `/uploads/[id]` — detalhes do upload: contadores, lista de erros, lista de pendências (técnicos não vinculados, motivos pendentes)
- [ ] Botão "Reprocessar" em uploads com erro

### 7. Cadastro de técnicos com fluxo de vinculação

- [ ] Quando upload tem visitas com `tecnico_id IS NULL`, mostrar lista de nomes pendentes
- [ ] Botão "Vincular este nome ao técnico Cadastrado X" → atualiza visitas em batch
- [ ] Botão "Cadastrar novo técnico com este nome" → abre form pré-preenchido

### 8. Auditoria

- [ ] Trigger automático em `service_visits` para `service_visits_audit`
- [ ] Tela `/uploads/[id]/audit` mostra mudanças entre uploads (visitas que mudaram)

---

## Escopo OUT

- ❌ Cálculo de payouts (Sprint 4)
- ❌ Configuração de motivos com categoria (Sprint 3)
- ❌ Dashboard executivo com KPIs (Sprint 5)
- ❌ Edge Function como gatilho automático (futuro)
- ❌ Suporte a CSV (apenas XLSX no MVP)
- ❌ Preview de planilha antes de processar

---

## Definition of Done

- [ ] Upload da planilha real `lista-os-Wave-Abril-2026.xlsx` resulta em:
  - 1 registro em `uploads` com status `success`
  - 857 registros em `service_visits` (idempotente)
  - 733 registros em `service_orders` (consolidado correto)
  - Status `resolvida` para OSs com sucesso
  - Status `em_andamento` para OSs sem sucesso ainda
  - `total_visitas`, `tentativas_ate_sucesso`, `data_resolucao` preenchidos corretamente
- [ ] Re-upload do mesmo arquivo retorna `status='duplicate'` em <500ms
- [ ] Edição manual de uma linha + re-upload registra entrada em `service_visits_audit`
- [ ] Lint, typecheck, build, testes passando
- [ ] Validação Gemini aprovada

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Encoding latino-1 da planilha pode quebrar parsing | Alto | Detectar encoding via lib `chardet` ou tentar múltiplos; fallback para latin1 |
| Trigger de consolidação pode ser lento com muitos inserts | Médio | Considerar deferred trigger ou recálculo em batch ao final do upload |
| Server Action timeout (10s no Vercel free, 60s pro) com 1k+ linhas | Alto | Migrar para Edge Function se necessário; processar em chunks |
| Match de técnico por nome falha com acentos/espaços | Alto | Normalizar (lowercase, remove diacríticos, trim) antes do match |

---

## Anotações pós-sprint

_(preencher ao concluir)_
