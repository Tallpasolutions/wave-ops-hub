-- Bucket privado para planilhas XLSX, limite 10 MB por arquivo.
-- Aplicar manualmente via Supabase SQL Editor — não usar db:push.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  false,
  10485760,
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS: cada tenant acessa apenas sua própria pasta (<tenant_id>/ano/mes/arquivo).
-- current_tenant_id() lê do JWT — funciona em storage policies igual às tabelas.
CREATE POLICY "uploads_tenant_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = (current_tenant_id())::text
  );

CREATE POLICY "uploads_tenant_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = (current_tenant_id())::text
  );

CREATE POLICY "uploads_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = (current_tenant_id())::text
  );
