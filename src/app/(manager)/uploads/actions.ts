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
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { isUniqueViolation } from '@/lib/supabase/errors'
import type { SupabaseClient } from '@supabase/supabase-js'

// Recalcula APENAS os payouts das visitas deste upload (escopo por upload_id).
// Recalcular o tenant inteiro numa única invocação estoura o timeout/503 — e no
// reprocessar isso matava a Server Action antes do redirect, deixando a tela com
// os erros antigos.
async function recalcUploadVisits(
  uploadId: string,
  tenantId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { rows } = await fetchAllPages<{ id: string }>((from, to) =>
    supabase
      .from('service_visits')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('upload_id', uploadId)
      .order('id')
      .range(from, to),
  )
  const visitIds = rows.map((r) => r.id)
  if (visitIds.length > 0) {
    await recalculatePendingPayouts(tenantId, supabase, { visitIds })
  }
}

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

  // 4. Recalcula payouts das visitas deste upload após ingestão bem-sucedida (escopo).
  if (result.status === 'success') {
    await recalcUploadVisits(uploadId, upload.tenant_id, supabase)
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

    // Limpa o error_log antigo já ao iniciar — se o reprocesso concluir sem erros,
    // a tela não deve continuar mostrando os erros da tentativa anterior.
    await supabase
      .from('uploads')
      .update({ status: 'processing', error_log: null })
      .eq('id', uploadId)

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
        await recalcUploadVisits(uploadId, user.tenantId, supabase)
      }
    }
  } catch {
    // Erros são persistidos pelo ingestor via markFailed — não propagar para não perder o redirect
  }

  revalidatePath('/uploads/' + uploadId)
  revalidatePath('/uploads')
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

export async function recalculateUploadPayouts(uploadId: string): Promise<void> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (!user.tenantId) throw new Error('Usuário sem tenant')

  const supabase = await createSupabaseServerClient()

  const { data: upload } = await supabase
    .from('uploads')
    .select('periodo_inicio, periodo_fim')
    .eq('id', uploadId)
    .single()

  if (!upload?.periodo_inicio) {
    redirect('/uploads/' + uploadId)
  }

  const periodo = upload.periodo_inicio.slice(0, 7)
  await recalculatePendingPayouts(user.tenantId, supabase, { periodo })

  redirect('/uploads/' + uploadId)
}

// returnPath: rota a revalidar após o vínculo — usado tanto no detalhe do upload
// ('/uploads/<id>') quanto na seção global de vínculo ('/equipe/tecnicos').
export async function linkTechnicianRaw(
  tecnicoRaw: string,
  tecnicoId: string,
  returnPath: string,
): Promise<{ error?: string }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (!user.tenantId) return { error: 'Usuário sem tenant.' }
  const supabase = await createSupabaseServerClient()

  // 1. Carrega as visitas não vinculadas com aquele nome cru.
  const { data: pendentes, error: loadError } = await supabase
    .from('service_visits')
    .select('id')
    .eq('tenant_id', user.tenantId)
    .is('tecnico_id', null)
    .eq('tecnico_raw', tecnicoRaw)

  if (loadError) return { error: 'Erro ao carregar visitas para vínculo.' }
  if ((pendentes ?? []).length === 0) {
    revalidatePath(returnPath)
    return {}
  }

  // 2. Vincula uma a uma. Um UPDATE em lote falhava por completo quando UMA linha nula
  //    colidia com a unique (tenant, os_num, data_execucao, tecnico_id) — cenário comum:
  //    a visita já foi atribuída a este técnico e a linha nula é uma duplicata criada por
  //    re-upload. Nesse caso a linha nula é redundante e é removida (o payout dela, se
  //    existir, é nulo — cascata segura). Só erros reais abortam.
  const visitIds: string[] = []
  for (const v of pendentes ?? []) {
    const id = v.id as string
    const { error: upError } = await supabase
      .from('service_visits')
      .update({ tecnico_id: tecnicoId })
      .eq('id', id)

    if (!upError) {
      visitIds.push(id)
    } else if (isUniqueViolation(upError)) {
      await supabase.from('service_visits').delete().eq('id', id)
    } else {
      return { error: 'Erro ao vincular técnico.' }
    }
  }

  if (visitIds.length === 0) {
    revalidatePath(returnPath)
    return {}
  }

  // 3. Corrige o technician_id dos payouts dessas visitas — inclusive os já
  //    approved/paid (o recálculo preserva/pula esses, então sem este UPDATE o
  //    fechamento continuaria acusando "sem técnico"). É correção de associação,
  //    não de valor/status.
  await supabase.from('payouts').update({ technician_id: tecnicoId }).in('visit_id', visitIds)

  // 4. Recalcula APENAS as visitas vinculadas (escopo por visitIds). O recálculo do
  //    tenant inteiro numa única invocação estourava o timeout — daí o erro ao vincular.
  try {
    await recalculatePendingPayouts(user.tenantId, supabase, { visitIds })
  } catch {
    // O vínculo (passos 1-2) já está gravado; falha no recálculo de valor não deve
    // derrubar a ação. Um "Recalcular pendentes" posterior conserta o valor.
  }

  revalidatePath(returnPath)
  return {}
}
