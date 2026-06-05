'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/permissions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { run as runIngestor } from '@/lib/etl'
import type { IngestResult } from '@/lib/etl'
import { recalculatePendingPayouts } from '@/lib/payouts'

export type PrepareUploadResult =
  | { duplicate: true; uploadId: string }
  | { duplicate: false; uploadId: string; signedUrl: string }

export async function prepareUpload(
  fileName: string,
  fileHash: string,
): Promise<PrepareUploadResult> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (!user.tenantId) throw new Error('Usuário sem tenant vinculado')

  const supabase = await createSupabaseServerClient()

  const { data: existing } = await supabase
    .from('uploads')
    .select('id')
    .eq('tenant_id', user.tenantId)
    .eq('file_hash', fileHash)
    .maybeSingle()

  if (existing) {
    return { duplicate: true, uploadId: existing.id }
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const storagePath = `${user.tenantId}/${year}/${month}/${randomUUID()}-${fileName}`

  const { data: upload, error: insertError } = await supabase
    .from('uploads')
    .insert({
      tenant_id: user.tenantId,
      uploaded_by: user.id,
      file_name: fileName,
      file_hash: fileHash,
      storage_path: storagePath,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !upload) {
    throw new Error('Erro ao registrar upload')
  }

  // Admin client para criar signed URL — RLS de storage não bloqueia operação do servidor
  const admin = createSupabaseAdminClient()
  const { data: signedData, error: signedError } = await admin.storage
    .from('uploads')
    .createSignedUploadUrl(storagePath)

  if (signedError || !signedData) {
    await supabase.from('uploads').delete().eq('id', upload.id)
    throw new Error('Erro ao gerar URL de upload')
  }

  return { duplicate: false, uploadId: upload.id, signedUrl: signedData.signedUrl }
}

export async function processUpload(uploadId: string): Promise<IngestResult> {
  await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  const supabase = await createSupabaseServerClient()
  const admin = createSupabaseAdminClient()

  // 1. Busca o registro para obter storage_path e metadata do tenant
  const { data: upload, error: fetchError } = await supabase
    .from('uploads')
    .select('storage_path, tenant_id, uploaded_by')
    .eq('id', uploadId)
    .single()

  if (fetchError || !upload) throw new Error('Upload não encontrado')

  // 2. Baixa o arquivo do Storage (admin bypassa RLS — autenticação já verificada acima)
  const { data: blob, error: downloadError } = await admin.storage
    .from('uploads')
    .download(upload.storage_path)

  if (downloadError || !blob) {
    await supabase
      .from('uploads')
      .update({
        status: 'failed',
        error_log: [{ message: 'Arquivo não encontrado no Storage' }],
        processed_at: new Date().toISOString(),
      })
      .eq('id', uploadId)
    return { status: 'failed', error: 'Arquivo não encontrado no Storage' }
  }

  // 3. Marca como processing para dar visibilidade na UI
  await supabase.from('uploads').update({ status: 'processing' }).eq('id', uploadId)

  // 4. Converte Blob → Buffer e delega ao ingestor (com client autenticado para RLS por tenant)
  const buffer = Buffer.from(await blob.arrayBuffer())
  const result = await runIngestor(uploadId, buffer, upload.tenant_id, upload.uploaded_by, supabase)

  // 4. Recalcula payouts de todas as visitas pendentes do tenant após ingestão bem-sucedida
  if (result.status === 'success') {
    await recalculatePendingPayouts(upload.tenant_id, supabase)
  }

  return result
}

export async function rerunUpload(uploadId: string): Promise<void> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  const supabase = await createSupabaseServerClient()
  const admin = createSupabaseAdminClient()

  try {
    const { data: upload } = await supabase
      .from('uploads')
      .select('storage_path, tenant_id, uploaded_by, status')
      .eq('id', uploadId)
      .single()

    if (!upload || upload.tenant_id !== user.tenantId) throw new Error('Upload não encontrado')
    if (upload.status === 'duplicate') throw new Error('Uploads duplicados não podem ser reprocessados')

    await supabase.from('uploads').update({ status: 'processing' }).eq('id', uploadId)

    const { data: blob, error: downloadError } = await admin.storage
      .from('uploads')
      .download(upload.storage_path)

    if (downloadError || !blob) {
      await supabase
        .from('uploads')
        .update({ status: 'failed', error_log: [{ message: 'Arquivo não encontrado no Storage' }] })
        .eq('id', uploadId)
    } else {
      const buffer = Buffer.from(await blob.arrayBuffer())
      const result = await runIngestor(uploadId, buffer, upload.tenant_id, upload.uploaded_by ?? '', supabase)

      if (result.status === 'success' && user.tenantId) {
        await recalculatePendingPayouts(user.tenantId, supabase)
      }
    }
  } catch {
    // Erros são persistidos pelo ingestor via markFailed — não propagar para não perder o redirect
  }

  redirect('/uploads/' + uploadId)
}

export async function reprocessUpload(uploadId: string): Promise<void> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  const supabase = await createSupabaseServerClient()

  try {
    const { data: upload } = await supabase
      .from('uploads')
      .select('tenant_id, status')
      .eq('id', uploadId)
      .single()

    if (!upload || upload.tenant_id !== user.tenantId) throw new Error('Upload não encontrado')
    if (!['pending', 'processing', 'failed'].includes(upload.status as string))
      throw new Error('Só é possível reprocessar uploads pendentes ou com erro')

    const { count: totalInseridas } = await supabase
      .from('service_visits')
      .select('*', { count: 'exact', head: true })
      .eq('upload_id', uploadId)

    const { data: periodos } = await supabase
      .from('service_visits')
      .select('data_execucao')
      .eq('upload_id', uploadId)
      .order('data_execucao', { ascending: true })

    const allDates = (periodos ?? []).map((r) => r.data_execucao as string).filter(Boolean)
    const periodoInicio = allDates[0]?.split('T')[0] ?? null
    const periodoFim = allDates[allDates.length - 1]?.split('T')[0] ?? null
    const inseridas = totalInseridas ?? 0

    await supabase
      .from('uploads')
      .update({
        status: inseridas > 0 ? 'success' : 'failed',
        total_linhas: inseridas,
        inseridas,
        atualizadas: 0,
        ignoradas: 0,
        erros: inseridas > 0 ? 0 : 1,
        error_log: inseridas > 0 ? null : [{ message: 'Nenhuma visita encontrada após reprocessamento' }],
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        processed_at: new Date().toISOString(),
      })
      .eq('id', uploadId)

    if (inseridas > 0 && user.tenantId) {
      await recalculatePendingPayouts(user.tenantId, supabase)
    }
  } catch {
    // Não propagar — redirect deve sempre executar
  }

  redirect('/uploads/' + uploadId)
}

export async function deleteUpload(uploadId: string): Promise<void> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  const supabase = await createSupabaseServerClient()
  const admin = createSupabaseAdminClient()

  try {
    const { data: upload, error: fetchError } = await supabase
      .from('uploads')
      .select('id, storage_path, tenant_id, status')
      .eq('id', uploadId)
      .single()

    if (fetchError || !upload) throw new Error('Upload não encontrado')
    if (upload.tenant_id !== user.tenantId) throw new Error('Acesso negado')
    if (upload.status !== 'failed') throw new Error('Só é possível excluir uploads com erro')

    await admin.storage.from('uploads').remove([upload.storage_path])
    await supabase.from('uploads').delete().eq('id', uploadId)
  } catch {
    // Não propagar — redirect deve sempre executar
  }

  redirect('/uploads')
}

export async function linkTechnicianRaw(
  tecnicoRaw: string,
  tecnicoId: string,
  uploadId: string,
): Promise<{ error?: string }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from('service_visits')
    .update({ tecnico_id: tecnicoId })
    .is('tecnico_id', null)
    .eq('tecnico_raw', tecnicoRaw)

  if (error) return { error: 'Erro ao vincular técnico.' }

  // Recalcula payouts das visitas recém-vinculadas
  if (user.tenantId) {
    await recalculatePendingPayouts(user.tenantId, supabase)
  }

  revalidatePath('/uploads/' + uploadId)
  return {}
}
