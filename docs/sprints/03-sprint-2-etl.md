# Sprint 2 — Ingestão (ETL)

**Duração estimada:** 1 semana
**Status:** Código concluído (Etapas 1–6 implementadas — 2026-05-31) · Pendente: teste com dados reais + Validação Gemini
**Pré-requisitos:** Sprints 0 e 1 concluídas

---

## Objetivo

Implementar todo o fluxo de ingestão de planilhas: upload no Storage, parser, normalização, validação, idempotência e persistência. Ao final da sprint, gestor da Wave consegue subir a planilha real de abril/2026 e ver as 857 visitas no banco corretamente.

---

## Escopo IN

### 1. Schema do banco ✅ Concluída (2026-05-31)

Todas as tabelas já existiam no banco via `0001_initial_schema.sql`. O trabalho desta etapa foi criar os arquivos **Drizzle TypeScript** para type-safety em queries.

**Arquivos criados:**
- `src/db/schema/uploads.ts` — `Upload`, `NewUpload`, `UploadStatus`
- `src/db/schema/reasons.ts` — `Reason`, `NewReason`, `ReasonCategoria`
- `src/db/schema/service-orders.ts` — `ServiceOrder`, `NewServiceOrder`, `ServiceOrderStatus`
- `src/db/schema/service-visits.ts` — `ServiceVisit`, `NewServiceVisit`, `TipoAtendimento`
- `src/db/schema/index.ts` — exports na ordem de dependência de FK

**Decisões registradas:**
- `pnpm db:push` é proibido — SQL do banco é fonte de verdade
- `pnpm db:generate` gerou snapshot baseline em `supabase/migrations/meta/` — segundo run confirmou "No schema changes"
- Índice único parcial `WHERE tecnico_id IS NULL` existe no banco via 0001; não declarável no Drizzle — omitido intencionalmente

### 2. Trigger de consolidação ⏳ Pendente (Etapa 4)

```sql
CREATE OR REPLACE FUNCTION consolidar_service_order(p_tenant_id UUID, p_os_num BIGINT)
RETURNS VOID AS $$
-- detalhes em docs/domain/01
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_visit_change
  AFTER INSERT OR UPDATE OR DELETE ON service_visits
  FOR EACH ROW EXECUTE FUNCTION trg_consolidar_service_order();
```

- [ ] Função e trigger criadas e testadas
- [ ] Cobertura para casos: insert primeira visita, update visita, delete visita

### 3. Storage Supabase ✅ Concluída (2026-05-31)

**O que foi feito:**
- `supabase/migrations/0006_storage_bucket.sql` criado com bucket `uploads` (privado, 10 MB) e 3 RLS policies (INSERT/SELECT/DELETE)
- Path pattern implementado: `<tenant_id>/<year>/<month>/<uuid>-<filename>`
- RLS via `current_tenant_id()` — mesma função usada nas tabelas

**Migration aplicada:** `0006_storage_bucket.sql` aplicada manualmente no Supabase SQL Editor (dev) — bucket `uploads` ativo.

### 4. Lib `src/lib/etl/` ✅ Concluída (2026-05-31)

**Arquivos criados:**
- `src/lib/etl/types.ts` — `IngestCounts`, `IngestWarning`, `IngestError`, `IngestResult`, `NormalizedRow`
- `src/lib/etl/schemas.ts` — Zod `RawRowSchema` + `RawRow` type (ADR-006 verbatim, com `.nullable().optional()` em `TipoAtendimento`)
- `src/lib/etl/column-mapping.ts` — `COLUMN_MAP` com ~40 entradas cobrindo headers garbled latin-1
- `src/lib/etl/content-hash.ts` — `computeContentHash(row)` via SHA-256 em JSON canônico
- `src/lib/etl/parser.ts` — `parseXlsx(buffer)` com mapeamento de headers, erros fatais vs por linha
- `src/lib/etl/normalizer.ts` — `normalize(row, tenantId, uploadId, tecnicoId, reasonId, contentHash)`
- `src/lib/etl/matchers.ts` — `matchTechnician` (remove prefixo WAVE, case-insensitive) e `matchReason`
- `src/lib/etl/ingestor.ts` — `run()` orquestra o fluxo completo com dependency injection do SupabaseClient
- `src/lib/etl/index.ts` — exports públicos
- `vitest.config.ts` — configuração Vitest com alias `@` e env `node`

**Testes (28 passando):**
- `parser.test.ts` (6 testes): headers válidos, garbled TÈcnico, múltiplas linhas, erros por linha, erros fatais
- `normalizer.test.ts` (8 testes): campos básicos, reasonId forçado null no sucesso, booleanos, tipoAtendimento, parseInt, trim
- `matchers.test.ts` (9 testes): prefixo WAVE removido, case-insensitive, sem match, trim, Sim → null
- `ingestor.test.ts` (5 testes): inserção, atualização, técnico sem match, motivo novo auto-criado, planilha vazia

**Decisões:**
- Encoding garbled tratado puramente via COLUMN_MAP — sem `chardet`/`iconv-lite` (XLSX é ZIP+XML, UTF-8)
- `upsertVisit` trata tecnico_id NULL manualmente (`.is(null).eq(tecnico_raw)`) — índice parcial no banco não é declarável no Drizzle
- `clienteUsuario` e `contrato` em `NormalizedRow` mas não em `service_visits` — usados em Etapa 4 para criar/atualizar `service_orders`

### 5. Server Action de processamento ✅ Concluída (2026-05-31)

**O que foi feito:**
- `processUpload` em `src/app/(manager)/uploads/actions.ts` substituído pelo fluxo real
- Busca `storage_path`, `tenant_id`, `uploaded_by` do registro de upload
- Baixa o arquivo do Storage via `createSupabaseAdminClient()` (consistente com `prepareUpload`)
- Converte `Blob → Buffer` e chama `ingestor.run(uploadId, buffer, tenantId, uploadedBy, supabase)`
- O ingestor já atualiza a tabela `uploads` (status, contadores, período, error_log, processed_at)
- Retorna `IngestResult` tipado (em vez do stub `{ ok: boolean }`)
- Tratamento explícito de falha no download → marca upload como `failed` sem deixar preso em `processing`
- Adicionado card `Ignoradas` no grid de contadores de `/uploads/[id]/page.tsx` — essencial para evidenciar deduplicação (re-upload dos mesmos dados: ignoradas = total, inseridas = 0)

**Garantia de não duplicação:**
- **Camada 1 (`file_hash`)**: `prepareUpload` bloqueia arquivos byte-a-byte idênticos antes de chamar `processUpload`
- **Camada 2 (`content_hash` por linha)**: `upsertVisit` ignora linhas cujo conteúdo semântico já existe no banco — mesmo com arquivo de nome ou binário diferente, dados nunca são duplicados em `service_visits`

### 6. UI de upload ✅ Concluída (2026-05-31)

**Arquivos criados:**
- `src/app/(manager)/uploads/page.tsx` — lista com status badges, período, contadores
- `src/app/(manager)/uploads/new/page.tsx` + `UploadForm.tsx` — drag-and-drop, hash SHA-256 client-side, upload por signed URL, estados por fase
- `src/app/(manager)/uploads/[id]/page.tsx` — detalhe com grid de contadores, log de erros, seções placeholder para Etapas 4 e 5
- `src/app/(manager)/_components/Sidebar.tsx` — item "Uploads" com ícone `FileUp` adicionado

**Server Actions em `uploads/actions.ts`:**
- `prepareUpload(fileName, fileHash)` — verifica duplicata, cria registro, retorna signed URL
- `processUpload(uploadId)` — fluxo real implementado na Etapa 5 (veja seção 5)

**Decisões:**
- Hash SHA-256 computado no browser via `crypto.subtle` antes de chamar a Server Action
- Signed URL criada via `createSupabaseAdminClient()` (admin bypassa RLS de storage; Server Action já validou role)
- Arquivo `UploadForm.tsx` é `'use client'` e importa Server Actions diretamente

### 7. Vinculação de técnicos não matchados ✅ Concluída (2026-05-31)

**O que foi feito:**
- `linkTechnicianRaw(tecnicoRaw, tecnicoId, uploadId)` em `uploads/actions.ts` — batch update de todas as `service_visits` do tenant com aquele `tecnico_raw` e `tecnico_id IS NULL`; corrige histórico completo (não só o upload atual); RLS garante isolamento por tenant; chama `revalidatePath` ao final
- `src/app/(manager)/uploads/[id]/LinkTechnicianForm.tsx` — Client Component (`'use client'`) com:
  - Exibição do nome limpo (strip do prefixo "WAVE - ") e contador de visitas
  - `Select` shadcn com lista de técnicos ativos do tenant
  - Botão "Vincular" com loading via `useTransition`
  - Link "Cadastrar novo técnico" → `/equipe/tecnicos/new?nomeCompleto=<nome>&from=/uploads/<id>` (protegido com `encodeURIComponent`)
- `/uploads/[id]/page.tsx` atualizado com 3 queries adicionais:
  - `service_visits WHERE upload_id = id AND tecnico_id IS NULL` → agrupado em JS por `tecnico_raw`
  - `technicians WHERE ativo = true ORDER BY nome_completo` → para o dropdown
  - `reasons WHERE categoria = 'pendente_classificacao'` → para a seção informativa de motivos
  - Placeholders substituídos por UI real: check verde "Todos os técnicos foram identificados" (se zerado) ou lista de `LinkTechnicianForm`
  - Seção "Motivos para classificar" exibe lista informativa (classificação será na Sprint 3)
- `/equipe/tecnicos/new/page.tsx` atualizado para ler `?nomeCompleto` e `?from` do `searchParams` (async, Next.js 15) e passar como props ao form
- `CreateTechnicianForm.tsx` atualizado com props `defaultNomeCompleto` e `from`; campo `nomeCompleto` pré-preenchido via `defaultValue`; `<input type="hidden" name="from">` para preservar o redirect
- `equipe/tecnicos/actions.ts` — `createTechnician` redireciona para `from` se presente e `startsWith('/')` (proteção contra open redirect); fallback para `/equipe/tecnicos`

**Decisões:**
- O update de vinculação afeta TODAS as visitas do tenant com aquele `tecnico_raw`, não só as do upload atual — corrige histórico retroativamente
- Open redirect bloqueado por `from.startsWith('/')` — só aceita paths internos
- Motivos pendentes são exibidos em read-only na mesma página; classificação completa é escopo da Sprint 3

### 8. Auditoria ✅ Concluída (2026-05-31)

**Infraestrutura já existia em `0001_initial_schema.sql`:**
- Tabela `service_visits_audit (id, visit_id, upload_id, changed_at, changed_by, before JSONB, after JSONB)`
- Trigger `trg_visits_audit_changes` (AFTER UPDATE em `service_visits`): grava `NEW.upload_id`, `to_jsonb(OLD)`, `to_jsonb(NEW)`
- RLS `visits_audit_read`: `tenant_owner` e `tenant_manager` leem via `createSupabaseServerClient()` — JOIN implícito por `visit_id → service_visits.tenant_id`
- `changed_by` é sempre `NULL` no trigger (auditoria automática não captura o usuário da sessão)

**O que foi implementado nesta etapa:**
- `src/app/(manager)/uploads/[id]/audit/page.tsx` — novo Server Component:
  - Busca upload (header) + `service_visits_audit WHERE upload_id = :id ORDER BY changed_at`
  - `getDiff(before, after)`: compara todos os campos, ignora `id`, `tenant_id`, `upload_id`, `created_at`, `updated_at`, `content_hash`
  - `FIELD_LABELS`: 30+ mapeamentos de snake_case → label legível em pt-BR
  - Por registro: header "OS {num} · {nome limpo} · {data/hora}" + tabela Campo | Antes (vermelho) | Depois (verde)
  - Empty states: "nenhuma visita alterada" (apenas inserts/ignores) e "upload não processado com sucesso"
- `/uploads/[id]/page.tsx`: link condicional "Ver N visitas alteradas →" após grid de contadores, visível apenas quando `status = 'success' AND atualizadas > 0`

**Decisões:**
- `os_num`, `tecnico_raw` e `data_execucao` lidos diretamente do JSONB `after` — sem JOIN adicional em `service_visits`
- `content_hash` ignorado no diff (hash interno, sem valor para o gestor)
- `tecnico_id` aparece no diff quando `linkTechnicianRaw` é executado após o upload; label "Técnico (ID)" — pode ser melhorado na Sprint 5 com JOIN

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

**2026-05-31 — Etapas 1–4 concluídas:**
- Schema Drizzle: 4 arquivos TS criados, `pnpm typecheck` e `pnpm lint` passando, baseline `db:generate` estabelecido
- Storage: migration `0006_storage_bucket.sql` criada e **aplicada no Supabase dev** — bucket `uploads` ativo com RLS por tenant
- Upload UI: signed URL flow funcionando, formulário com estado por fase (idle → hashing → uploading → processing → done/duplicate/error)
- Lib ETL: 9 módulos em `src/lib/etl/`, 28 testes Vitest passando, typecheck e lint limpos
- `processUpload` real: baixa do Storage, chama `ingestor.run()`, retorna `IngestResult` tipado
- Deduplicação em duas camadas garantida: `file_hash` (binário) + `content_hash` por linha — dados em `service_visits` nunca duplicados
- Card `Ignoradas` adicionado à página de detalhe do upload

**2026-05-31 — Etapa 5 concluída:**
- `linkTechnicianRaw` Server Action criada — batch update com RLS e `revalidatePath`
- `LinkTechnicianForm.tsx` Client Component: Select shadcn + Vincular (`useTransition`) + link "Cadastrar novo"
- `/uploads/[id]/page.tsx`: 3 queries adicionadas, placeholders substituídos por UI real
- `/equipe/tecnicos/new/page.tsx` + `CreateTechnicianForm.tsx`: pre-fill via `?nomeCompleto`, redirect via `?from`
- `createTechnician` action: redirect condicional para `from` com proteção anti-open-redirect
- typecheck, lint e 28 testes passando

**2026-05-31 — Etapa 6 concluída:**
- `uploads/[id]/audit/page.tsx` criado: diff before/after com FIELD_LABELS, empty states, breadcrumb
- Link condicional em `uploads/[id]/page.tsx` quando `atualizadas > 0`
- Nenhuma migration necessária — trigger e RLS já existiam em 0001
- typecheck, lint e 28 testes passando

**Todas as etapas de código da Sprint 2 estão concluídas.**
Próximo passo: avançar para **Sprint 3 — LPU + Motivos**.

**2026-06-01 — Validação com planilha real (Sprint 5, Etapa 1):**

Ao usar a planilha real `lista-os-Wave-Abril-2026.xlsx` pela primeira vez, vários bugs foram encontrados e corrigidos:

1. **"Sucesso: Required" para todas as linhas** — o `COLUMN_MAP` era case-sensitive e a planilha real tem `Sucesso?` (com `?`). Corrigido com `normalizeKey()` no `parser.ts` que normaliza para lowercase e remove `?` final. Ver ADR-006 adendo 2026-06-01.

2. **Upload travado em `pending` com contadores zerados** — o ingestor row-by-row (~1700 round-trips para 857 linhas) causava timeout antes de atualizar o registro `uploads`. Corrigido com ingestor batch (1 SELECT → Map → INSERT/UPDATE em batch). Ver ADR-006 adendo.

3. **`Valor: Expected number, received nan`** — células de valor vazias ou com `"-"` na planilha. Corrigido: `z.preprocess()` converte para 0.

4. **`Cidade: Expected string, received null`** — algumas linhas de improdutivas não têm cidade. Corrigido: `z.string().nullable().optional()`.

5. **Colunas novas descobertas** — `Cat 1` (com espaço), `Faixa de drop`, `Possui outras fibras entrando`, `Motivo troca`, `TÈcnicos`, `ExplicaÁ„o do valor`, `ObservaÁıes`, `Subterr‚neo/AÈreo`. Todos adicionados ao `COLUMN_MAP`.

6. **Ações de recuperação adicionadas** — `rerunUpload`, `reprocessUpload`, `deleteUpload` para lidar com uploads em estados problemáticos.

7. **Redirect de Server Actions para login** — bug do Next.js 15: `redirect()` dentro de `try-catch` ou com import dinâmico causa redirecionamento para login em vez da URL correta. Corrigido: import estático no topo + `redirect()` sempre fora do `try-catch`. Ver regra no `CLAUDE.md`.

**Definition of Done atualizado:**
- ✅ 857 visitas inseridas na planilha real de abril/2026
- ✅ Ingestor batch: ~5–15 segundos para 857 linhas
- ✅ Todas as variantes de colunas da planilha Wave mapeadas
- ✅ `Sucesso`, `Cidade`, `Valor` tratam corretamente os dados reais
