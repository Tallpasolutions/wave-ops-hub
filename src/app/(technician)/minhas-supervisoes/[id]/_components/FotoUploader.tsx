'use client'
import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { reduzirFoto } from '../../_lib/imagem'
import { prepararFoto, confirmarFoto } from '../../actions'

type Props = {
  supervisaoId: string
  answerId: string | null
  obrigatoria?: boolean
  quantidade: number
  desabilitado?: boolean
}

export function FotoUploader({
  supervisaoId,
  answerId,
  obrigatoria = false,
  quantidade,
  desabilitado = false,
}: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function enviar(arquivo: File) {
    setErro(null)
    setEnviando(true)
    try {
      // Reduz ANTES de pedir a URL: se a imagem for ilegível, falha aqui sem deixar linha
      // órfã no banco.
      const foto = await reduzirFoto(arquivo)

      const preparo = await prepararFoto(
        supervisaoId,
        answerId,
        foto.nome,
        foto.tipo,
        foto.bytes,
      )
      if (preparo.error || !preparo.signedUrl || !preparo.fotoId) {
        setErro(preparo.error ?? 'Não foi possível enviar a foto.')
        return
      }

      // O arquivo vai DIRETO para o Storage, sem passar pela Server Action — mesmo fluxo do
      // upload de planilha.
      const resposta = await fetch(preparo.signedUrl, {
        method: 'PUT',
        body: foto.blob,
        headers: { 'Content-Type': foto.tipo },
      })
      if (!resposta.ok) {
        setErro('O envio falhou. Verifique o sinal e tente de novo.')
        return
      }

      // Só agora a foto passa a existir para as telas: `uploaded_em` é o que toda leitura
      // filtra.
      await confirmarFoto(supervisaoId, preparo.fotoId)
      startTransition(() => {})
    } catch {
      setErro('Não foi possível processar a foto. Tente outra.')
    } finally {
      setEnviando(false)
      if (input.current) input.current.value = ''
    }
  }

  const precisaDeFoto = obrigatoria && quantidade === 0

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void enviar(f)
        }}
      />

      <button
        type="button"
        disabled={desabilitado || enviando}
        onClick={() => input.current?.click()}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
          precisaDeFoto
            ? 'bg-[rgba(255,84,112,0.12)] text-[var(--red)]'
            : 'bg-white/5 text-[var(--text-2)]'
        }`}
      >
        {enviando ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        {enviando
          ? 'Enviando…'
          : quantidade > 0
            ? `${quantidade} foto${quantidade > 1 ? 's' : ''}`
            : obrigatoria
              ? 'Foto obrigatória'
              : 'Anexar foto'}
      </button>

      {erro && <p className="text-xs text-[var(--red)]">{erro}</p>}
    </div>
  )
}
