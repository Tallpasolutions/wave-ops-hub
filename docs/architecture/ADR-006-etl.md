# ADR-006 — Estratégia de Ingestão (ETL)

**Status:** Aceito
**Data:** 2026-05-05
**Decisores:** Jhoni Cleyton (Tallpa)

---

## Contexto

A Wave exporta mensalmente uma planilha XLSX com todas as visitas do mês. O sistema precisa:
1. Receber a planilha sem fricção
2. Validar formato e conteúdo
3. Normalizar dados (encoding, formatos de data, nomes de técnicos)
4. Detectar período pela própria planilha (não pelo nome do arquivo)
5. Aplicar idempotência (re-uploads não duplicam)
6. Auditar mudanças
7. Disparar consolidação de OSs e cálculo de payouts
8. Reportar resultado claro pro usuário

---

## Decisão

### Onde executa
**Server Actions do Next.js**, com lógica isolada em `src/lib/etl/`. Justificativa completa em [ADR-001](./ADR-001-stack.md).

### Lib de parsing
**`xlsx`** (SheetJS) — biblioteca canônica em JS, parser confiável, ativa há mais de 10 anos.

Não usaremos `exceljs` (mais lenta) nem `node-xlsx` (wrapper desatualizado).

### Fluxo

```
1. Usuário escolhe arquivo no upload UI
2. Cliente sobe para Supabase Storage (bucket por tenant)
3. Cliente chama Server Action `processUpload(uploadId)`
4. Server Action:
   a. Baixa arquivo do Storage
   b. Calcula file_hash (SHA-256 do binário)
   c. Verifica se já existe upload com mesmo file_hash → retorna "já processado"
   d. Cria registro em `uploads` com status = 'processing'
   e. Parser XLSX → array de rows
   f. Validação de schema (Zod)
   g. Normalização (encoding, datas, nomes)
   h. Para cada row → idempotente upsert (insert/update/skip)
   i. Trigger consolida service_orders afetadas
   j. Recálculo de payouts dos períodos afetados
   k. Atualiza `uploads` com status = 'success' + contadores
5. Cliente recebe resultado e exibe sumário
```

### Tabela `uploads`

```sql
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed', 'duplicate')),
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
```

### Schema Zod da planilha

```typescript
// src/lib/etl/schemas.ts
import { z } from 'zod';

export const RawRowSchema = z.object({
  Data: z.coerce.date(),
  Inicio: z.coerce.date(),
  OS: z.coerce.number().int().positive(),
  Usuario: z.string().nullable().optional(),
  Contrato: z.string().nullable().optional(),
  Finalidade: z.string(),
  Massiva: z.string().nullable().optional(),
  TipoAtendimento: z.enum(['Externo', 'Interno']),
  Cat1: z.string().nullable().optional(),
  Cat2: z.string().nullable().optional(),
  Cat3: z.string().nullable().optional(),
  Cidade: z.string(),
  Condominio: z.string().nullable().optional(),
  Sucesso: z.string(),
  Improdutiva: z.string().nullable().optional(),
  Agendada: z.string().nullable().optional(),
  TrocadoDrop: z.string().nullable().optional(),
  MotivoTroca: z.string().nullable().optional(),
  SubterraneoAereo: z.string().nullable().optional(),
  Agregada: z.string().nullable().optional(),
  Rejeitada: z.string().nullable().optional(),
  NumTecnicos: z.coerce.number().int().nullable().optional(),
  Validada: z.string().nullable().optional(),
  Garantia: z.string().nullable().optional(),
  Valor: z.coerce.number(),
  ExplicacaoValor: z.string().nullable().optional(),
  DropUsado: z.coerce.number().nullable().optional(),
  FaixaDrop: z.string().nullable().optional(),
  ConectoresUsados: z.coerce.number().nullable().optional(),
  Observacoes: z.string().nullable().optional(),
  CategoriaInterna: z.string().nullable().optional(),
  OutrasFibras: z.string().nullable().optional(),
  QuantasFibras: z.coerce.number().nullable().optional(),
  Tecnico: z.string(), // ex: "WAVE - Douglas Ribeiro"
});

export type RawRow = z.infer<typeof RawRowSchema>;
```

### Mapeamento de colunas

A planilha usa nomes com encoding latino-1 (`Usu·rio`, `T cnicos`, etc.). O parser detecta o encoding e converte para UTF-8, depois mapeia para nomes canônicos:

```typescript
// src/lib/etl/column-mapping.ts
export const COLUMN_MAP: Record<string, keyof RawRow> = {
  'Data': 'Data',
  'Inicio': 'Inicio',
  'OS': 'OS',
  'Usu·rio': 'Usuario',
  'Usuário': 'Usuario',
  // ... todas as variações
  'Tipo de atendimento': 'TipoAtendimento',
  'TÈcnico': 'Tecnico',
  'Técnico': 'Tecnico',
  // ...
};
```

### Detecção de período

```typescript
const dates = rows.map(r => r.Data);
const periodoInicio = new Date(Math.min(...dates.map(d => d.getTime())));
const periodoFim = new Date(Math.max(...dates.map(d => d.getTime())));
```

Salvo em `uploads.periodo_inicio` e `uploads.periodo_fim`.

### Match de técnico

```typescript
function matchTechnician(rawName: string, technicians: Technician[]): Technician | null {
  // 1. Remove prefixo "WAVE - "
  const cleanName = rawName.replace(/^WAVE\s*-\s*/i, '').trim();

  // 2. Match exato pelo nome completo
  const exactMatch = technicians.find(t =>
    t.nomeCompleto.toLowerCase() === cleanName.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  // 3. Sem match → null (visita fica com tecnico_id = null)
  return null;
}
```

Se não dá match, a visita é salva com `tecnico_id = NULL` e `tecnico_raw = "<nome bruto>"`. O gestor é notificado pra cadastrar o técnico ou vincular manualmente.

### Match de motivo

Mesma lógica:

```typescript
function matchReason(rawSuccess: string, reasons: Reason[]): Reason | null {
  // Se sucesso é "Sim", não tem motivo de não-conclusão
  if (rawSuccess.startsWith('Sim')) return null;

  const exactMatch = reasons.find(r => r.motivoOriginal === rawSuccess);
  if (exactMatch) return exactMatch;

  return null;
}
```

Se não dá match, **cria um novo registro automaticamente** em `reasons` com `categoria = 'pendente_classificacao'` e notifica o gestor.

### Idempotência por content hash

```typescript
function computeContentHash(row: RawRow): string {
  const canonical = JSON.stringify({
    data: row.Data.toISOString(),
    inicio: row.Inicio.toISOString(),
    os: row.OS,
    finalidade: row.Finalidade,
    tecnico: row.Tecnico,
    sucesso: row.Sucesso,
    improdutiva: row.Improdutiva ?? null,
    valor: row.Valor,
    cidade: row.Cidade,
    // ... outros campos relevantes
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}
```

### Upload duplicado (mesmo arquivo binário)

Se `file_hash` já existe em `uploads`:
- Retorna imediatamente `{ status: 'duplicate', uploadId: <existing> }`
- UI mostra: "Este arquivo já foi processado em DD/MM. Resultado:"

### Tratamento de erros

- **Erro de schema** (planilha sem coluna esperada) → upload `failed`, error_log com lista de problemas
- **Erro em uma linha específica** (data inválida em uma linha) → contador `erros++`, linha pulada, mas processo continua
- **Erro fatal** (banco inacessível) → upload `failed`, retry manual disponível

### Notificações pós-ingestão

Após processamento, sistema notifica em UI:

```
Upload concluído em 4.2s
857 linhas processadas
  • 23 visitas novas
  • 5 visitas atualizadas
  • 829 visitas inalteradas
  • 0 erros

⚠️ 2 técnicos não vinculados:
  - "Pedro Silva Santos" — [vincular]
  - "Maria Pereira" — [vincular]

⚠️ 1 motivo novo precisa classificação:
  - "Cliente sem energia elétrica" — [classificar]
```

---

## Considerados e rejeitados

### Edge Function como gatilho automático no upload do Storage
**Rejeitado para o MVP.** Adiciona complexidade de runtime separado e debug fica em dois lugares. Server Action chamada pelo cliente após upload é suficiente. Pode migrar depois.

### Worker Python externo
**Rejeitado.** Volume e complexidade não justificam. Detalhes em ADR-001.

---

## Consequências

### Positivas
- Lógica de ETL isolada e testável (`src/lib/etl/`)
- Idempotência garantida em duas camadas (file_hash + content_hash)
- Auditoria completa de cada upload
- Lista clara de problemas para o gestor resolver

### Negativas / Trade-offs
- Volumes muito grandes (>10k linhas) podem exceder timeout de Server Action (mitigação: upload é assíncrono, cliente faz polling de status; se virar problema, migra para Edge Function ou worker)
- Match de técnico/motivo por string é frágil (mitigação: cadastro manual + revisão; código_unetvale quando existir)
