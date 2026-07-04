import type { SupabaseClient } from '@supabase/supabase-js'
import { parseXlsx } from './parser'
import { normalize } from './normalizer'
import { matchTechnician, matchReason } from './matchers'
import { computeContentHash } from './content-hash'
import type { TechnicianRef, ReasonRef } from './matchers'
import type { IngestResult, IngestCounts, IngestError, NormalizedRow } from './types'

async function markFailed(
  uploadId: string,
  error: string,
  errors: IngestError[],
  supabase: SupabaseClient,
): Promise<void> {
  await supabase
    .from('uploads')
    .update({
      status: 'failed',
      error_log: errors.length > 0 ? errors : [{ message: error }],
      processed_at: new Date().toISOString(),
    })
    .eq('id', uploadId)
}

// Chave única de uma visita — mesma lógica do índice único parcial do banco
function visitKey(
  osNum: number,
  dataExecucao: string,
  tecnicoId: string | null,
  tecnicoRaw: string | null,
): string {
  // Normaliza para ISO para garantir comparação consistente entre DB e input
  const d = new Date(dataExecucao).toISOString()
  return tecnicoId
    ? `${osNum}:${d}:${tecnicoId}`
    : `${osNum}:${d}:null:${tecnicoRaw ?? ''}`
}

function buildDbRow(row: NormalizedRow) {
  return {
    tenant_id: row.tenantId,
    os_num: row.osNum,
    upload_id: row.uploadId,
    data_execucao: row.dataExecucao.toISOString(),
    tecnico_id: row.tecnicoId,
    tecnico_raw: row.tecnicoRaw,
    reason_id: row.reasonId,
    finalidade: row.finalidade,
    tipo_atendimento: row.tipoAtendimento,
    cidade: row.cidade,
    sucesso: row.sucesso,
    improdutiva: row.improdutiva,
    valor_recebido_unetvale: row.valorRecebidoUnetvale,
    drop_usado: row.dropUsado,
    faixa_drop: row.faixaDrop,
    conectores_usados: row.conectoresUsados,
    condominio: row.condominio,
    subterraneo_aereo: row.subterraneaAereo,
    garantia: row.garantia,
    validada: row.validada,
    agregada: row.agregada,
    rejeitada: row.rejeitada,
    agendada: row.agendada,
    trocado_drop: row.trocadoDrop,
    motivo_troca: row.motivoTroca,
    outras_fibras: row.outrasFibras,
    quantas_fibras: row.quantasFibras,
    categoria_interna: row.categoriaInterna,
    cat1: row.cat1,
    cat2: row.cat2,
    cat3: row.cat3,
    explicacao_valor: row.explicacaoValor,
    observacoes: row.observacoes,
    num_tecnicos: row.numTecnicos,
    fora_escopo: row.foraEscopo,
    content_hash: row.contentHash,
  }
}

// Tamanho máximo por lote de insert e de updates paralelos
const BATCH_INSERT_SIZE = 200
const BATCH_UPDATE_CONCURRENCY = 30

export async function run(
  uploadId: string,
  buffer: Buffer,
  tenantId: string,
  _uploadedBy: string,
  supabase: SupabaseClient,
): Promise<IngestResult> {
  try {
    // 1. Parse
    const { rows, errors: parseErrors } = parseXlsx(buffer)

    if (rows.length === 0) {
      await markFailed(
        uploadId,
        'Planilha inválida: nenhuma linha pôde ser processada',
        parseErrors,
        supabase,
      )
      return {
        status: 'failed',
        error: 'Planilha inválida: nenhuma linha pôde ser processada',
        errors: parseErrors,
      }
    }

    // 2. Detecta período
    const timestamps = rows.map((r) => r.Data.getTime())
    const periodoInicio = new Date(Math.min(...timestamps)).toISOString().split('T')[0]!
    const periodoFim = new Date(Math.max(...timestamps)).toISOString().split('T')[0]!

    // 3. Carrega referências do banco em paralelo (uma única rodada de queries)
    const [techRes, reasonRes, existingRes, tenantRes] = await Promise.all([
      supabase
        .from('technicians')
        .select('id, nome_completo')
        .eq('tenant_id', tenantId)
        .eq('ativo', true),
      supabase
        .from('reasons')
        .select('id, motivo_original')
        .eq('tenant_id', tenantId),
      // Carrega TODAS as visitas do período de uma vez — elimina 1 SELECT por linha
      supabase
        .from('service_visits')
        .select('id, content_hash, os_num, data_execucao, tecnico_id, tecnico_raw')
        .eq('tenant_id', tenantId)
        .gte('data_execucao', periodoInicio)
        .lte('data_execucao', periodoFim + 'T23:59:59.999Z'),
      supabase.from('tenants').select('config').eq('id', tenantId).single(),
    ])

    const techList: TechnicianRef[] = techRes.data ?? []
    const reasonList: ReasonRef[] = reasonRes.data ?? []

    // Finalidades de infra do tenant (ADR-008) — normalizadas para match tolerante
    const tenantConfig = (tenantRes.data?.config ?? {}) as { finalidades_infra?: unknown }
    const infraSet = new Set(
      (Array.isArray(tenantConfig.finalidades_infra) ? tenantConfig.finalidades_infra : [])
        .filter((f): f is string => typeof f === 'string')
        .map((f) => f.trim().toLowerCase()),
    )

    // Mapa em memória: chave → { id, content_hash }
    type ExistingVisit = { id: string; content_hash: string }
    const existingMap = new Map<string, ExistingVisit>()
    for (const v of existingRes.data ?? []) {
      const k = visitKey(
        v.os_num as number,
        v.data_execucao as string,
        v.tecnico_id as string | null,
        v.tecnico_raw as string | null,
      )
      existingMap.set(k, { id: v.id as string, content_hash: v.content_hash as string })
    }

    // 4. Processa cada linha — apenas lógica de matching (sem IO por linha)
    const counts: IngestCounts = {
      inseridas: 0,
      atualizadas: 0,
      ignoradas: 0,
      erros: parseErrors.length,
    }
    const unmatchedTechnicians = new Set<string>()
    const newReasons: string[] = []
    const rowErrors: IngestError[] = [...parseErrors]

    const toInsert: ReturnType<typeof buildDbRow>[] = []
    const toUpdate: Array<{ id: string; data: ReturnType<typeof buildDbRow> }> = []

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i]!
      try {
        // Match técnico (em memória)
        const tecnico = matchTechnician(rawRow.Tecnico, techList)
        if (!tecnico) unmatchedTechnicians.add(rawRow.Tecnico.trim())

        // Match / auto-cria motivo (único IO por NOVO motivo único, não por linha)
        let reasonId: string | null = null
        if (!rawRow.Sucesso.trim().toLowerCase().startsWith('sim')) {
          const reason = matchReason(rawRow.Sucesso, reasonList)
          if (reason) {
            reasonId = reason.id
          } else {
            const motivoTrimmed = rawRow.Sucesso.trim()
            const { data: newReason } = await supabase
              .from('reasons')
              .insert({
                tenant_id: tenantId,
                motivo_original: motivoTrimmed,
                motivo_normalizado: motivoTrimmed.toLowerCase(),
                categoria: 'pendente_classificacao',
                paga_improdutiva: false,
              })
              .select('id, motivo_original')
              .single()

            if (newReason) {
              reasonId = newReason.id
              reasonList.push(newReason as ReasonRef)
              newReasons.push(motivoTrimmed)
            }
          }
        }

        const contentHash = computeContentHash(rawRow)
        const normalized = normalize(rawRow, tenantId, uploadId, tecnico?.id ?? null, reasonId, contentHash, infraSet)
        const dbRow = buildDbRow(normalized)

        const key = visitKey(
          normalized.osNum,
          normalized.dataExecucao.toISOString(),
          normalized.tecnicoId,
          normalized.tecnicoRaw,
        )
        const existing = existingMap.get(key)

        if (!existing) {
          toInsert.push(dbRow)
          counts.inseridas++
        } else if (existing.content_hash !== contentHash) {
          toUpdate.push({ id: existing.id, data: dbRow })
          counts.atualizadas++
        } else {
          counts.ignoradas++
        }
      } catch (err) {
        counts.erros++
        rowErrors.push({
          row: i + 2,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // 5. Persiste em batch — INSERT em lotes, UPDATE em paralelo

    // INSERTs em lotes de BATCH_INSERT_SIZE
    for (let i = 0; i < toInsert.length; i += BATCH_INSERT_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_INSERT_SIZE)
      const { error } = await supabase.from('service_visits').insert(chunk)
      if (error) {
        // Falha no batch: registra como erros individuais mas continua
        for (let j = 0; j < chunk.length; j++) {
          counts.erros++
          counts.inseridas--
          rowErrors.push({ row: i + j + 2, message: `Insert falhou: ${error.message}` })
        }
      }
    }

    // UPDATEs em paralelo (concorrência limitada)
    for (let i = 0; i < toUpdate.length; i += BATCH_UPDATE_CONCURRENCY) {
      const chunk = toUpdate.slice(i, i + BATCH_UPDATE_CONCURRENCY)
      await Promise.all(
        chunk.map(({ id, data }) => supabase.from('service_visits').update(data).eq('id', id)),
      )
    }

    // 6. Atualiza registro de upload com resultado
    await supabase
      .from('uploads')
      .update({
        status: 'success',
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        total_linhas: rows.length + parseErrors.length,
        inseridas: counts.inseridas,
        atualizadas: counts.atualizadas,
        ignoradas: counts.ignoradas,
        erros: counts.erros,
        error_log: rowErrors.length > 0 ? rowErrors : null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', uploadId)

    return {
      status: 'success',
      counts,
      warnings: {
        unmatchedTechnicians: Array.from(unmatchedTechnicians),
        newReasons,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    await markFailed(uploadId, message, [], supabase)
    return { status: 'failed', error: message }
  }
}
