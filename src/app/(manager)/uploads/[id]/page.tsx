import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Detalhe do Upload' }
import type { UploadStatus } from '@/db/schema'
import { LinkTechnicianForm } from '@/components/LinkTechnicianForm'
import { PendingSubmitButton } from '@/components/PendingSubmitButton'
import { deleteUpload, reprocessUpload, rerunUpload, recalculateUploadPayouts } from '../actions'

export const dynamic = 'force-dynamic'

type UploadDetail = {
  id: string
  file_name: string
  status: UploadStatus
  periodo_inicio: string | null
  periodo_fim: string | null
  total_linhas: number
  inseridas: number
  atualizadas: number
  ignoradas: number
  erros: number
  error_log: unknown
  uploaded_at: string
  processed_at: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function StatusBadge({ status }: { status: UploadStatus }) {
  const config: Record<UploadStatus, { label: string; className: string }> = {
    pending: {
      label: 'Pendente',
      className: 'bg-[rgba(255,184,0,0.12)] text-[#ffb800]',
    },
    processing: {
      label: 'Processando',
      className: 'bg-[rgba(30,107,255,0.12)] text-[var(--blue)]',
    },
    success: {
      label: 'Concluído',
      className: 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]',
    },
    failed: {
      label: 'Erro',
      className: 'bg-[rgba(255,84,112,0.13)] text-[var(--red)]',
    },
    duplicate: {
      label: 'Duplicado',
      className: 'bg-white/5 text-[var(--text-3)]',
    },
  }
  const { label, className } = config[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  )
}

function CountCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
        {label}
      </p>
      <p
        className={`font-display text-3xl font-bold ${
          highlight && value > 0 ? 'text-[var(--red)]' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default async function UploadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()
  const { data: upload } = await supabase
    .from('uploads')
    .select(
      'id, file_name, status, periodo_inicio, periodo_fim, total_linhas, inseridas, atualizadas, ignoradas, erros, error_log, uploaded_at, processed_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (!upload) notFound()

  const u = upload as UploadDetail
  if ((upload as { tenant_id?: string }).tenant_id && (upload as { tenant_id?: string }).tenant_id !== user.tenantId) {
    notFound()
  }

  const errorEntries = Array.isArray(u.error_log)
    ? (u.error_log as unknown[])
    : u.error_log
      ? [u.error_log]
      : []

  // O log é gravado pelo ETL como IngestError ({ row, field?, message }), mas a falha geral
  // do upload grava só { message }. Normaliza para a lista da tela em vez de despejar o JSON:
  // linha e motivo é o que o gestor precisa para corrigir a planilha.
  const errosLegiveis = errorEntries.map((entry) => {
    const e = (entry ?? {}) as { row?: unknown; field?: unknown; message?: unknown }
    return {
      linha: typeof e.row === 'number' ? e.row : null,
      campo: typeof e.field === 'string' ? e.field : null,
      mensagem:
        typeof e.message === 'string' && e.message.trim() !== ''
          ? e.message
          : 'Erro sem descrição registrada.',
    }
  })

  // Visitas sem técnico vinculado neste upload
  const { data: unmatchedRows } = await supabase
    .from('service_visits')
    .select('tecnico_raw')
    .eq('upload_id', id)
    .is('tecnico_id', null)

  const unmatchedMap = new Map<string, number>()
  for (const row of unmatchedRows ?? []) {
    if (row.tecnico_raw)
      unmatchedMap.set(row.tecnico_raw, (unmatchedMap.get(row.tecnico_raw) ?? 0) + 1)
  }
  const unmatched = Array.from(unmatchedMap.entries()).map(([raw, count]) => ({ raw, count }))

  // Técnicos ativos para o dropdown
  const { data: technicians } = await supabase
    .from('technicians')
    .select('id, nome_completo')
    .eq('ativo', true)
    .order('nome_completo')

  // Motivos pendentes de classificação (informativo — Sprint 3 classifica)
  const { data: pendingReasons } = await supabase
    .from('reasons')
    .select('id, motivo_original')
    .eq('categoria', 'pendente_classificacao')
    .order('motivo_original')

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <Link
          href="/uploads"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Uploads
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--text)]">
              {u.file_name}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              Enviado em {formatDate(u.uploaded_at)}
              {u.processed_at && ` · Processado em ${formatDate(u.processed_at)}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={u.status} />
            {/* Recalcular payouts: sempre disponível em uploads com sucesso */}
            {u.status === 'success' && (
              <form action={recalculateUploadPayouts.bind(null, u.id)}>
                <PendingSubmitButton
                  pendingLabel="Recalculando…"
                  className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--bg-3)]"
                >
                  Recalcular payouts
                </PendingSubmitButton>
              </form>
            )}
            {/* Reprocessar via ingestor: re-baixa o arquivo do Storage e re-parseia com
                o código atual. Disponível também em uploads com sucesso — é o único
                caminho para reingerir após uma correção no parser (o reenvio do mesmo
                arquivo é bloqueado pelo dedup de file_hash em prepareUpload). */}
            {(u.erros > 0 ||
              u.status === 'success' ||
              u.status === 'pending' ||
              u.status === 'processing' ||
              u.status === 'failed') &&
              u.status !== 'duplicate' && (
                <form action={rerunUpload.bind(null, u.id)}>
                  <PendingSubmitButton
                    pendingLabel="Reprocessando…"
                    className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--bg-3)]"
                  >
                    Reprocessar
                  </PendingSubmitButton>
                </form>
              )}
            {/* Corrigir contadores: pendente/processing sem arquivo no storage */}
            {(u.status === 'pending' || u.status === 'processing') && (
              <form action={reprocessUpload.bind(null, u.id)}>
                <PendingSubmitButton
                  pendingLabel="Corrigindo…"
                  className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-3)] transition-colors hover:bg-[var(--bg-3)]"
                >
                  Corrigir status
                </PendingSubmitButton>
              </form>
            )}
            {u.status === 'failed' && (
              <form action={deleteUpload.bind(null, u.id)}>
                <PendingSubmitButton
                  pendingLabel="Excluindo…"
                  className="rounded-lg border border-[rgba(255,84,112,0.3)] bg-[rgba(255,84,112,0.08)] px-3 py-1.5 text-xs font-semibold text-[var(--red)] transition-colors hover:bg-[rgba(255,84,112,0.15)]"
                >
                  Excluir
                </PendingSubmitButton>
              </form>
            )}
          </div>
        </div>

        {(u.periodo_inicio || u.periodo_fim) && (
          <p className="mt-2 font-mono text-sm text-[var(--text-2)]">
            Período: {formatDate(u.periodo_inicio)} – {formatDate(u.periodo_fim)}
          </p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <CountCard label="Total de linhas" value={u.total_linhas} />
        <CountCard label="Inseridas" value={u.inseridas} />
        <CountCard label="Atualizadas" value={u.atualizadas} />
        <CountCard label="Ignoradas" value={u.ignoradas} />
        <CountCard label="Erros" value={u.erros} highlight />
      </div>

      {u.status === 'success' && u.inseridas === 0 && u.ignoradas > 0 && (
        <div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 text-sm text-[var(--text-2)]">
          Todas as {u.ignoradas} linhas já existiam no banco — nada novo foi inserido. Normalmente
          é re-envio da mesma planilha (deduplicação por conteúdo), não uma falha.
        </div>
      )}

      {u.status === 'success' && u.atualizadas > 0 && (
        <div className="mb-6 flex justify-end">
          <Link
            href={`/uploads/${id}/audit`}
            className="text-xs text-[var(--blue)] underline-offset-2 hover:underline"
          >
            Ver {u.atualizadas} {u.atualizadas === 1 ? 'visita alterada' : 'visitas alteradas'} →
          </Link>
        </div>
      )}

      {errosLegiveis.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
            {errosLegiveis.length === 1
              ? '1 linha com erro'
              : `${errosLegiveis.length} linhas com erro`}
          </h2>
          <div className="overflow-hidden rounded-xl border border-[rgba(255,84,112,0.2)] bg-[var(--bg-1)]">
            <ul className="divide-y divide-[var(--line)]">
              {errosLegiveis.map((e, i) => (
                <li key={i} className="flex gap-3 px-4 py-2.5 text-sm">
                  {e.linha !== null && (
                    <span className="shrink-0 font-mono text-[var(--text-3)]">
                      Linha {e.linha}
                    </span>
                  )}
                  <span className="text-[var(--red)]">
                    {e.campo && (
                      <span className="text-[var(--text-3)]">{e.campo}: </span>
                    )}
                    {e.mensagem}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Técnicos não vinculados</h2>

          {unmatched.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-[var(--green)]">
              <CheckCircle2 size={16} />
              Todos os técnicos foram identificados
            </div>
          ) : (
            <div>
              {unmatched.map((item) => (
                <LinkTechnicianForm
                  key={item.raw}
                  tecnicoRaw={item.raw}
                  visitCount={item.count}
                  technicians={technicians ?? []}
                  returnPath={`/uploads/${id}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Motivos para classificar</h2>

          {(pendingReasons ?? []).length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-[var(--green)]">
              <CheckCircle2 size={16} />
              Nenhum motivo pendente de classificação
            </div>
          ) : (
            <div>
              <p className="mb-3 text-xs text-[var(--text-3)]">
                Estes motivos foram criados automaticamente durante o processamento e precisam de classificação.
                A categorização estará disponível na Sprint 3 — Motivos.
              </p>
              <ul className="space-y-1">
                {(pendingReasons ?? []).map((r) => (
                  <li key={r.id} className="text-sm text-[var(--text-2)]">
                    {r.motivo_original}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
