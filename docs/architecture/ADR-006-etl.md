# ADR-006 — Estratégia de Ingestão (ETL)

**Status:** Aceito (atualizado 2026-05-31 — ver adendos de implementação)
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
  TipoAtendimento: z.enum(['Externo', 'Interno']).nullable().optional(), // ← ver adendo
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

A planilha usa nomes com encoding latino-1 garbled (`Usu·rio`, `TÈcnico`, etc.). **Não usamos chardet/iconv-lite** — arquivos XLSX são ZIP+XML e intrinsecamente UTF-8. Os headers garbled surgem quando o software que gerou a planilha original escreveu bytes latin-1 e o XLSX os re-embutiu sem conversão. A solução é mapear todas as variantes possíveis via `COLUMN_MAP`:

```typescript
// src/lib/etl/column-mapping.ts
export const COLUMN_MAP: Record<string, keyof RawRow> = {
  'Data': 'Data',
  'Inicio': 'Inicio',
  'OS': 'OS',
  'Usuario': 'Usuario',
  'Usuário': 'Usuario',
  'Usu·rio': 'Usuario',         // garbled latin-1
  'Tipo de atendimento': 'TipoAtendimento',
  'Tecnico': 'Tecnico',
  'Técnico': 'Tecnico',
  'TÈcnico': 'Tecnico',         // garbled latin-1
  // ... ~40 entradas no total cobrindo todas as variantes
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

## Adendos (Sprint 2, 2026-05-31)

### Split em dois Server Actions: `prepareUpload` + `processUpload`

O fluxo do ADR previa um único ponto de entrada no Server Action. Em implementação, foi dividido em dois:

1. **`prepareUpload(fileName, fileHash)`** — verificação de duplicata (pelo `file_hash` calculado no browser), criação do registro em `uploads`, retorno da signed URL para PUT direto no Storage. Roda **antes** do upload do arquivo.
2. **`processUpload(uploadId)`** — processamento ETL. Atualmente stub que marca `processing` e retorna `{ok:true}`. Será substituído em Etapa 4 pelo ingestor real.

Justificativa: separar a criação do registro da ingestão permite que o browser faça o PUT diretamente no Storage via signed URL sem passar pelo servidor Next.js (sem limite de payload do Server Action).

### File hash calculado no browser, não no servidor

O `file_hash` (SHA-256 do binário) é calculado **no browser** via `crypto.subtle.digest('SHA-256', arrayBuffer)` antes de chamar `prepareUpload`. Isso permite verificar duplicatas sem fazer upload do arquivo.

O servidor confia nesse hash — não recomputa. Isso é aceitável porque o hash serve apenas para deduplicação de upload, não como assinatura de integridade.

### `TipoAtendimento` tornado nullable no schema Zod

O ADR documentava `TipoAtendimento: z.enum(['Externo', 'Interno'])` (obrigatório). Em implementação, foi alterado para `.nullable().optional()` porque a planilha real da Wave pode ter esse campo vazio em algumas visitas. A coluna no banco aceita NULL. O normalizer converte valor inválido/ausente para `null`.

### Encoding via COLUMN_MAP, sem lib de detecção

O ADR mencionava "detecta o encoding" como possibilidade. Em implementação, confirmou-se que XLSX (ZIP+XML) é intrinsecamente UTF-8 — os headers garbled são bytes latin-1 embutidos incorretamente pelo software originador. Nenhuma lib de detecção foi necessária. O `COLUMN_MAP` cobre todas as variantes observadas na planilha real.

### `NormalizedRow` inclui `clienteUsuario` e `contrato`

Esses campos (`Usuario` e `Contrato` da planilha) pertencem à tabela `service_orders`, não `service_visits`. Foram incluídos em `NormalizedRow` para que a Etapa 4 possa criar/atualizar a `service_order` correspondente ao processar cada visita. Em `service_visits` esses campos não existem.

### Storage bucket em migration SQL separada

O bucket `uploads` e suas políticas RLS foram declarados em `supabase/migrations/0006_storage_bucket.sql` e **aplicados manualmente no Supabase SQL Editor (dev — 2026-05-31)**. Deve ser reaplicado em staging e produção quando esses ambientes forem criados. Path pattern: `<tenant_id>/<year>/<month>/<uuid>-<filename>`.

---

## Adendos (Sprint 5 — validação com planilha real, 2026-06-01)

### Ingestor reescrito: row-by-row → batch

O ingestor original em `ingestor.ts` usava `upsertVisit()` chamada sequencialmente para cada linha, gerando ~1700 round-trips ao Supabase para uma planilha de 857 linhas. Em produção, isso causava timeout do Server Action e o upload ficava travado em `processing` com contadores zerados.

**Abordagem reescrita:**
1. Uma query `SELECT` carrega todas as visitas existentes do tenant para o período em um único round-trip
2. As visitas são indexadas em um `Map` em memória pela chave `visitKey(osNum, dataExecucao, tecnicoId, tecnicoRaw)`
3. Cada linha da planilha é classificada em `toInsert` ou `toUpdate` por lookup no Map (sem IO)
4. `INSERT` em batches de 200 linhas (constante `BATCH_INSERT_SIZE`)
5. `UPDATE` em paralelo com concorrência máxima de 30 (constante `BATCH_UPDATE_CONCURRENCY`)

Resultado esperado: planilha de 857 linhas processa em 5–15 segundos em vez de minutos.

### `status: 'processing'` definido imediatamente ao iniciar

Antes de rodar o ingestor, `processUpload` marca o upload como `status = 'processing'`. Isso garante que:
- A UI do gestor mostra estado intermediário correto (não fica em `pending` eternamente)
- O Server Action de recuperação `reprocessUpload` pode detectar uploads travados

### Três ações de recuperação para uploads problemáticos

Em `src/app/(manager)/uploads/actions.ts`:

| Ação | Quando usar | O que faz |
|---|---|---|
| `rerunUpload(uploadId)` | Upload com erros de schema ou processamento | Baixa o arquivo do Storage e roda o ingestor completo novamente |
| `reprocessUpload(uploadId)` | Upload preso em `pending`/`processing`/`failed` mas visitas já foram inseridas | Conta visitas no banco e corrige `status`/contadores sem re-rodar o ingestor |
| `deleteUpload(uploadId)` | Upload com status `failed` que deve ser removido | Remove do Storage e da tabela `uploads` (apenas `failed` — nunca `success`) |

### Mapeamento de colunas: lookup case-insensitive com normalização

O `COLUMN_MAP` original usava lookup direto por string. Em produção, a planilha real da Wave tem:
- Colunas com `?` no final: `Sucesso?`, `Condomínio?`, `Possui outras fibras entrando?`
- Variantes com encoding garbled: `TÈcnico`, `ExplicaÁ„o do valor`, `ObservaÁıes`
- Nomes com capitalização diferente

**Solução implementada em `parser.ts`:**
```typescript
function normalizeKey(key: string): string {
  return key
    .replace(/ /g, ' ')   // non-breaking spaces → regular spaces
    .trim()
    .replace(/\?+$/, '')  // remove "?" no final
    .trim()
    .toLowerCase()
}

// NORMALIZED_MAP é construído uma vez ao carregar o módulo
const NORMALIZED_MAP: Map<string, keyof RawRow> = new Map(
  Object.entries(COLUMN_MAP).map(([k, v]) => [normalizeKey(k), v]),
)
```

O `parser.ts` usa `NORMALIZED_MAP` ao mapear headers, não o `COLUMN_MAP` diretamente. Isso elimina falhas silenciosas por case ou `?` no final.

### Nomes de colunas reais da planilha Wave (validados em abril/2026)

Adições ao `COLUMN_MAP` descobertas na validação:

```typescript
'Cat 1': 'Cat1',                                 // com espaço (não 'Cat1')
'Cat 2': 'Cat2',
'Cat 3': 'Cat3',
'TÈcnicos': 'NumTecnicos',                       // número de técnicos, garbled
'ExplicaÁ„o do valor': 'ExplicacaoValor',        // garbled latin-1
'Faixa de drop': 'FaixaDrop',                    // com artigo "de"
'ObservaÁıes': 'Observacoes',                    // garbled
'Subterr‚neo/AÈreo': 'SubterraneoAereo',         // garbled
'Possui outras fibras entrando': 'OutrasFibras',  // texto completo sem "?"
'Motivo troca': 'MotivoTroca',
```

### Schema Zod: `Cidade` e `Valor` tornados nullable/com default

O schema original tinha:
```typescript
Cidade: z.string(),          // obrigatório — falha em rows sem cidade
Valor: z.coerce.number(),    // falha com célula vazia ou "-"
```

**Corrigido para:**
```typescript
Cidade: z.string().nullable().optional(),
Valor: z.preprocess(
  (v) => {
    if (v === null || v === undefined || v === '' || v === '-') return 0
    const n = Number(v)
    return isNaN(n) ? 0 : n
  },
  z.number().default(0),
),
```

A planilha real tem linhas sem cidade (improdutivas) e células de valor vazias ou com traço.

### `sucesso` e comparação case-sensitive

O campo `Sucesso` da planilha vem com letra maiúscula: `"Sim"`, `"Sim Instalado"`, `"Não"`, etc. **Toda comparação de sucesso no código deve usar:**
```typescript
const isSuccess = (v: { sucesso: string | null }) =>
  v.sucesso?.trim().toLowerCase().startsWith('sim') ?? false
```

Comparação direta `=== 'Sim'` não captura `"Sim Instalado"` e similares. Comparação `=== 'sim'` (lowercase) nunca casa porque o valor armazenado preserva o case original da planilha. Ver detalhe em `docs/domain/01-os-e-visitas.md`.

### Nomes de colunas do banco: usar exatamente o snake_case do schema

Quando referenciar colunas do banco em queries TypeScript (Supabase client), usar o nome exato conforme definido em `0001_initial_schema.sql`. O campo do técnico é `tecnico_id` (não `technician_id`, não `technicianId`). Erros de nome silenciosos causam queries que retornam resultados vazios sem erro visível.

---

## Adendos (2026-07-19 — canonicalização de `subterraneo_aereo`)

### Derivação e canonicalização do meio (Aéreo/Subterrâneo)

As regras da LPU fazem **match exato** por `subterraneo_aereo` (Aéreo vs Subterrâneo definem preços diferentes). Duas falhas deixavam visitas de sucesso "sem regra de LPU" (payout R$ 0, travando o fechamento):

1. **Mojibake não reparado na coluna.** O valor chegava `"AÈreo"` em vez de `"Aéreo"`. O detector de mojibake (`src/lib/etl/encoding.ts`, `hasMojibake`) só dispara quando há **letra minúscula antes** do caractere acentuado corrompido (ex.: `"instalaÁ„o"`); palavra iniciada em maiúscula (`"Aéreo"`) passa batido. `"AÈreo" ≠ "Aéreo"` → nenhuma regra casa.
2. **Coluna vazia** — o meio existia só no texto livre `explicacao_valor` (`"... troca de drop aérea ..."`).

**Correção** (`src/lib/etl/normalizer.ts`, `deriveSubterraneoAereo`): o normalizer passa o valor da coluna por uma normalização accent/encoding-insensitive (`NFD` + strip de acentos + `includes('aere'|'subterr')`), que canonicaliza `"AÈreo" → "Aéreo"`; se a coluna não resolver, deriva o meio da `explicacao_valor`. Retorna sempre o valor canônico (`"Aéreo"`/`"Subterrâneo"`) ou `null`.

```typescript
subterraneaAereo:
  deriveSubterraneoAereo(row.SubterraneoAereo) ?? deriveSubterraneoAereo(row.ExplicacaoValor),
```

Escopo consciente: **não** mexemos no detector geral de mojibake (`hasMojibake`) para não arriscar falsos-positivos em texto legítimo em maiúsculas — a canonicalização é feita só no campo controlado `subterraneo_aereo` (vocabulário de 2 valores). Se outros campos com maiúscula inicial apresentarem o mesmo problema, reavaliar `hasMojibake`.

Reparo dos dados já gravados: migrations `0017` (deriva vazios) e `0018` (canonicaliza mojibake + vazios). Após aplicar, rodar "Recalcular pendentes".

### Finalidades "não repassadas ao técnico" → regra LPU R$ 0

Quando a Unetvale paga a Wave por um serviço mas o técnico **não** recebe (ex.: "Venda Produto Externo", "Configuração de Roteador"), o tratamento correto é uma **regra de LPU com payout fixo R$ 0** para aquela finalidade — não override manual. A regra deixa a visita "com regra" (não bloqueia o fechamento) e é **robusta ao recálculo** (diferente do override, que era preservado mas cujo status já foi motivo de bug — ver `docs/domain/03-payout.md`).

---

## Adendos (2026-07-14 — parse de valor monetário sensível a locale)

### Bug de produção: valores inflados ×100

O parser lê o xlsx com `raw: false` (`src/lib/etl/parser.ts`), então **todo valor chega como
string já formatada pelo SheetJS — que formata em locale US**: vírgula = milhar, ponto = decimal.
A versão anterior de `parseBrNumber` assumia pt-BR e tratava todo ponto como separador de milhar,
removendo-o: `"24100.10"` virava **2410010** — cem vezes o valor real, silenciosamente.

**Decisão:** `src/lib/etl/number.ts` passa a **detectar o separador decimal pelo último símbolo**
presente na string:

- BR `"24.100,10"` → a vírgula vem por último → decimal = `,` → `24100.10`
- US `"24,100.10"` → o ponto vem por último → decimal = `.` → `24100.10`
- Só ponto: desambigua por contagem de dígitos (exatamente 3 após o ponto = milhar), preservando
  `"1.000"` → `1000` do comportamento pt-BR.

**Consequência operacional:** a correção vale na ingestão. **Visitas ingeridas antes da correção
mantêm o valor errado no banco** — exigem re-upload da planilha do período (julho/2026 foi o mês
afetado). Não há migration de backfill: o valor correto só existe na planilha de origem.

**Lição para o futuro:** com `raw: false`, nenhum número da planilha é número — todos são strings
em locale que não controlamos. Qualquer campo numérico novo passa por `parseBrNumber`, nunca por
`Number()` direto.

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
