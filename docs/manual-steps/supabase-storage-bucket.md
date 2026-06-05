# Criar bucket de Storage no Supabase

> **Status: ✅ Aplicado no ambiente dev (2026-05-31)**

## O que esse passo faz

Aplica a migration `0006_storage_bucket.sql` que cria o bucket privado `uploads` e suas 3 políticas RLS. Sem isso, o fluxo de upload de planilhas falha com erro de acesso negado ao Storage.

---

## Quando executar

Antes de testar a funcionalidade de upload de planilhas pela primeira vez em cada ambiente (dev ✅, staging ⏳, produção ⏳).

---

## Pré-requisito

Migrations 0001–0005 já devem estar aplicadas no ambiente (Auth Hook e GRANTs precisam existir para as políticas referenciarem `current_tenant_id()`).

---

## Como aplicar

1. Acesse [supabase.com](https://supabase.com) → seu projeto
2. Menu lateral: **SQL Editor** → **New query**
3. Cole o conteúdo completo de `supabase/migrations/0006_storage_bucket.sql`
4. Clique em **Run**

---

## O que a migration cria

```sql
-- Bucket privado, 10 MB por arquivo, aceita apenas XLSX
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads', 'uploads', false,
  10485760,  -- 10 MB
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);

-- RLS: tenant pode inserir no seu path
CREATE POLICY "tenant can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

-- RLS: tenant pode ler seus próprios arquivos
CREATE POLICY "tenant can read own uploads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

-- RLS: tenant pode deletar seus próprios arquivos
CREATE POLICY "tenant can delete own uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );
```

**Path pattern dos arquivos:** `<tenant_id>/<year>/<month>/<uuid>-<filename>`

---

## Verificar se funcionou

No SQL Editor:

```sql
-- Verificar que o bucket existe
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'uploads';
-- Deve retornar 1 linha

-- Verificar as políticas RLS
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname LIKE '%upload%';
-- Deve retornar 3 linhas
```

---

## Troubleshooting

**Erro `relation "storage.buckets" does not exist`**
- A extensão de Storage não está habilitada no projeto Supabase. Ir em **Project Settings → Extensions** e habilitar `storage`.

**Erro `function current_tenant_id() does not exist`**
- As migrations 0001–0005 não foram aplicadas. Aplicar na ordem antes desta.

**Upload falha com `new row violates row-level security policy`**
- Verificar se o `tenant_id` do usuário logado corresponde ao primeiro segmento do path (`storage.foldername(name)[1]`). O `prepareUpload` Server Action monta o path com o `tenantId` do JWT — verificar se o Auth Hook está ativo.
