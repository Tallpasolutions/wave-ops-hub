import { TRANSICOES, type StatusSupervisao } from '@/lib/supervisao'

// Filtros da lista de supervisões, lidos e escritos na URL.
//
// Deliberadamente NÃO usam o seletor global de período (ADR-022): a data relevante aqui é
// `data_agendada`, não `data_execucao`, e o seletor global é alimentado só por
// `service_visits`. Acoplar os dois faria o gestor achar que o mês do topo filtra
// supervisões — e ele não filtra.

export const STATUS_VALIDOS = Object.keys(TRANSICOES) as StatusSupervisao[]

export interface FiltrosSupervisao {
  status: StatusSupervisao | null
  tecnicoId: string | null
  supervisorId: string | null
  de: string | null // "AAAA-MM-DD"
  ate: string | null
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

function primeiro(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v
  return s && s.trim() ? s.trim() : null
}

function comoData(v: string | string[] | undefined): string | null {
  const s = primeiro(v)
  return s && DATA_ISO.test(s) ? s : null
}

// Valor inválido na URL é IGNORADO, não vira erro: a URL é editável pelo usuário e por link
// antigo, e uma tela de erro por querystring torta seria pior que mostrar tudo.
export function parseFiltros(
  searchParams: Record<string, string | string[] | undefined>,
): FiltrosSupervisao {
  const status = primeiro(searchParams.status)
  const de = comoData(searchParams.de)
  const ate = comoData(searchParams.ate)

  return {
    status: status && STATUS_VALIDOS.includes(status as StatusSupervisao)
      ? (status as StatusSupervisao)
      : null,
    tecnicoId: primeiro(searchParams.tecnico),
    supervisorId: primeiro(searchParams.supervisor),
    // Intervalo invertido: trata como não informado em vez de devolver lista vazia sem
    // explicação — o gestor veria "nenhuma supervisão" e acharia que não há dado.
    de: de && ate && de > ate ? null : de,
    ate: de && ate && de > ate ? null : ate,
  }
}

export function temFiltroAtivo(f: FiltrosSupervisao): boolean {
  return Object.values(f).some((v) => v !== null)
}

// Monta a querystring preservando os filtros atuais e trocando um deles. É o que permite
// combinar filtros sem que um limpe o outro.
export function urlComFiltro(
  f: FiltrosSupervisao,
  chave: keyof FiltrosSupervisao,
  valor: string | null,
): string {
  const params = new URLSearchParams()
  const mapa: Record<keyof FiltrosSupervisao, string> = {
    status: 'status',
    tecnicoId: 'tecnico',
    supervisorId: 'supervisor',
    de: 'de',
    ate: 'ate',
  }

  for (const k of Object.keys(mapa) as (keyof FiltrosSupervisao)[]) {
    const v = k === chave ? valor : f[k]
    if (v) params.set(mapa[k], v)
  }

  const qs = params.toString()
  return qs ? `/supervisoes?${qs}` : '/supervisoes'
}
