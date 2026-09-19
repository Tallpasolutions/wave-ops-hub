'use client'
import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { escalaDe } from '@/lib/supervisao'
import { responderItem } from '../../actions'
import { FotoUploader } from './FotoUploader'

export type ItemExec = {
  id: string
  ordem: number
  item_codigo: string | null
  item_titulo: string
  item_descricao: string | null
  item_tipo_resposta: string
  item_foto_obrigatoria: boolean
  resposta: string | null
  observacao: string | null
  fotos: number
}

type Props = { supervisaoId: string; item: ItemExec; editavel: boolean }

// Cada item salva sozinho, assim que respondido. Em campo o sinal cai, e salvar o formulário
// inteiro no fim faria perder tudo — aqui a perda máxima é um item (ADR-022: não há fila
// offline na v1).
export function ItemExecutor({ supervisaoId, item, editavel }: Props) {
  const [resposta, setResposta] = useState(item.resposta)
  const [observacao, setObservacao] = useState(item.observacao ?? '')
  const [salvando, startTransition] = useTransition()

  const escala = escalaDe(item.item_tipo_resposta)

  function responder(valor: string) {
    if (!editavel) return
    setResposta(valor) // otimista: o botão reage na hora, sem esperar a rede
    const dados = new FormData()
    dados.set('resposta', valor)
    dados.set('observacao', observacao)
    startTransition(async () => {
      await responderItem(supervisaoId, item.id, dados)
    })
  }

  function salvarObservacao() {
    if (!editavel || !resposta) return
    const dados = new FormData()
    dados.set('resposta', resposta)
    dados.set('observacao', observacao)
    startTransition(async () => {
      await responderItem(supervisaoId, item.id, dados)
    })
  }

  const pendente = resposta === null
  const faltaFoto = item.item_foto_obrigatoria && item.fotos === 0

  return (
    <div
      className={`rounded-xl border p-4 ${
        pendente || faltaFoto
          ? 'border-[var(--line)] bg-[var(--bg-1)]'
          : 'border-[rgba(46,230,168,0.18)] bg-[rgba(46,230,168,0.03)]'
      }`}
    >
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 font-mono text-xs text-[var(--text-3)]">
          {String(item.ordem).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text)]">{item.item_titulo}</p>
          {item.item_descricao && (
            <p className="mt-0.5 text-xs text-[var(--text-3)]">{item.item_descricao}</p>
          )}
        </div>
        {!pendente && !faltaFoto && (
          <Check size={16} className="mt-0.5 shrink-0 text-[var(--green)]" />
        )}
      </div>

      {/* Os rótulos vêm da escala do item: "Está usando" num item de uso, "Possui e em bom
          estado" num de posse. Alvos grandes porque é uso em celular, de pé, na rua. */}
      <div className="flex flex-wrap gap-2">
        {escala.opcoes.map((o) => {
          const ativo = resposta === o.valor
          return (
            <button
              key={o.valor}
              type="button"
              disabled={!editavel || salvando}
              onClick={() => responder(o.valor)}
              className={`min-h-[44px] flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                ativo
                  ? o.valor === 'conforme'
                    ? 'bg-[var(--green)] text-[#04120c]'
                    : o.valor === 'nao_se_aplica'
                      ? 'bg-white/15 text-[var(--text)]'
                      : 'bg-[var(--red)] text-white'
                  : 'bg-white/5 text-[var(--text-2)] active:bg-white/10'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {(item.item_foto_obrigatoria || item.fotos > 0 || resposta !== null) && (
        <div className="mt-3">
          <FotoUploader
            supervisaoId={supervisaoId}
            answerId={item.id}
            obrigatoria={item.item_foto_obrigatoria}
            quantidade={item.fotos}
            desabilitado={!editavel}
          />
        </div>
      )}

      {resposta !== null && editavel && (
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          onBlur={salvarObservacao}
          rows={2}
          placeholder="Observação (opcional)"
          className="mt-3 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--cyan)]"
        />
      )}

      {!editavel && item.observacao && (
        <p className="mt-2 text-xs text-[var(--text-2)]">{item.observacao}</p>
      )}
    </div>
  )
}
