import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type AuditRecord = {
  id: string
  visit_id: string
  changed_at: string
  before: Record<string, unknown>
  after: Record<string, unknown>
}

const IGNORED_FIELDS = new Set([
  'id',
  'tenant_id',
  'upload_id',
  'created_at',
  'updated_at',
  'content_hash',
])

const FIELD_LABELS: Record<string, string> = {
  os_num: 'OS',
  data_execucao: 'Data de execução',
  tecnico_id: 'Técnico (ID)',
  tecnico_raw: 'Técnico (nome bruto)',
  reason_id: 'Motivo (ID)',
  sucesso: 'Sucesso',
  improdutiva: 'Improdutiva',
  valor_recebido_unetvale: 'Valor recebido',
  finalidade: 'Finalidade',
  tipo_atendimento: 'Tipo de atendimento',
  cidade: 'Cidade',
  garantia: 'Garantia',
  validada: 'Validada',
  agregada: 'Agregada',
  rejeitada: 'Rejeitada',
  agendada: 'Agendada',
  trocado_drop: 'Trocado drop',
  outras_fibras: 'Outras fibras',
  drop_usado: 'Drop usado',
  faixa_drop: 'Faixa de drop',
  conectores_usados: 'Conectores usados',
  observacoes: 'Observações',
  explicacao_valor: 'Explicação do valor',
  num_tecnicos: 'Nº de técnicos',
  condominio: 'Condomínio',
  subterraneo_aereo: 'Subterrâneo/Aéreo',
  motivo_troca: 'Motivo de troca',
  cat1: 'Categoria 1',
  cat2: 'Categoria 2',
  cat3: 'Categoria 3',
  categoria_interna: 'Categoria interna',
  quantas_fibras: 'Qtd. de fibras',
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  return String(v)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function getDiff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: { field: string; label: string; before: unknown; after: unknown }[] = []
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of allKeys) {
    if (IGNORED_FIELDS.has(key)) continue
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.push({
        field: key,
        label: FIELD_LABELS[key] ?? key,
        before: before[key],
        after: after[key],
      })
    }
  }
  return changes
}

export default async function UploadAuditPage({
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
    .select('id, file_name, status, atualizadas')
    .eq('id', id)
    .maybeSingle()

  if (!upload) notFound()

  const { data: rawRecords } = await supabase
    .from('service_visits_audit')
    .select('id, visit_id, changed_at, before, after')
    .eq('upload_id', id)
    .order('changed_at')

  const auditRecords = (rawRecords ?? []) as AuditRecord[]

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <Link
          href={`/uploads/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          {upload.file_name}
        </Link>

        <h1 className="font-display text-2xl font-bold text-[var(--text)]">
          Histórico de mudanças
        </h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          {upload.file_name}
        </p>
      </div>

      {upload.status !== 'success' ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-6">
          <p className="text-sm text-[var(--text-3)]">
            Auditoria disponível apenas para uploads processados com sucesso.
          </p>
        </div>
      ) : auditRecords.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-6">
          <p className="mb-1 text-sm font-medium text-[var(--text)]">
            Nenhuma visita foi alterada neste upload.
          </p>
          <p className="text-sm text-[var(--text-3)]">
            Todas as linhas foram inseridas pela primeira vez ou já existiam com o mesmo conteúdo.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-3)]">
            {auditRecords.length} {auditRecords.length === 1 ? 'visita alterada' : 'visitas alteradas'}
          </p>

          {auditRecords.map((record) => {
            const after = record.after
            const before = record.before
            const diff = getDiff(before, after)

            const osNum = after.os_num ?? before.os_num
            const tecnicoRaw = String(after.tecnico_raw ?? before.tecnico_raw ?? '—')
            const cleanName = tecnicoRaw.replace(/^WAVE\s*-\s*/i, '').trim()

            if (diff.length === 0) return null

            return (
              <div
                key={record.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
                  <div>
                    <span className="font-mono text-sm font-semibold text-[var(--text)]">
                      OS {String(osNum)}
                    </span>
                    <span className="mx-2 text-[var(--text-3)]">·</span>
                    <span className="text-sm text-[var(--text-2)]">{cleanName}</span>
                  </div>
                  <span className="text-xs text-[var(--text-3)]">
                    {formatDate(record.changed_at)}
                  </span>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg)]">
                      <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                        Campo
                      </th>
                      <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                        Antes
                      </th>
                      <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                        Depois
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.map((change) => (
                      <tr
                        key={change.field}
                        className="border-b border-[var(--line)] last:border-0"
                      >
                        <td className="px-5 py-2.5 text-[var(--text-3)]">{change.label}</td>
                        <td className="px-5 py-2.5 font-mono text-[var(--red)]">
                          {formatValue(change.before)}
                        </td>
                        <td className="px-5 py-2.5 font-mono text-[var(--green)]">
                          {formatValue(change.after)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
