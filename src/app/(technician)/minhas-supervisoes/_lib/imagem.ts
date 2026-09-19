// Redução da foto ANTES do envio, no próprio navegador.
//
// Sem isso o módulo não funciona em campo: a câmera de um celular atual produz de 3 a 8 MB
// por foto, e o supervisor está em 4G, muitas vezes ruim. Reduzir para ~1600px e reencodar em
// JPEG derruba para algo em torno de 300–600 KB.
//
// Efeito colateral útil: o canvas decodifica HEIC no Safari e o que sai é sempre JPEG, então
// o iPhone deixa de enviar um formato que o bucket não aceita.
//
// Usa só API nativa — nenhuma dependência nova, que o CLAUDE.md §3 condiciona a ADR.

const LADO_MAXIMO = 1600
const QUALIDADE = 0.82

export interface FotoReduzida {
  blob: Blob
  nome: string
  tipo: string
  bytes: number
}

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem'))
    }
    img.src = url
  })
}

export async function reduzirFoto(arquivo: File): Promise<FotoReduzida> {
  const img = await carregarImagem(arquivo)

  const maior = Math.max(img.width, img.height)
  const escala = maior > LADO_MAXIMO ? LADO_MAXIMO / maior : 1
  const largura = Math.round(img.width * escala)
  const altura = Math.round(img.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem')
  ctx.drawImage(img, 0, 0, largura, altura)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALIDADE),
  )
  if (!blob) throw new Error('Não foi possível processar a imagem')

  // Extensão sempre .jpg: o que sai do canvas é JPEG, qualquer que fosse a entrada.
  const base = arquivo.name.replace(/\.[^.]+$/, '') || 'foto'
  return { blob, nome: `${base}.jpg`, tipo: 'image/jpeg', bytes: blob.size }
}
