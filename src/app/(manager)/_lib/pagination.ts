export const PAGE_SIZE = 50

export type PageInfo = {
  page: number // 1-based
  totalPages: number
  totalItems: number
  from: number // 1-based index do primeiro item da página (0 se vazio)
  to: number // 1-based index do último item da página
}

// Normaliza o número de página a partir do querystring (1-based, dentro dos limites).
export function parsePage(raw: string | undefined, totalPages: number): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return 1
  return Math.min(n, Math.max(1, totalPages))
}

// Fatia uma lista já ordenada/filtrada para a página pedida e devolve a info de paginação.
export function paginate<T>(items: T[], rawPage: string | undefined, size = PAGE_SIZE): {
  pageItems: T[]
  info: PageInfo
} {
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / size))
  const page = parsePage(rawPage, totalPages)
  const startIdx = (page - 1) * size
  const pageItems = items.slice(startIdx, startIdx + size)
  return {
    pageItems,
    info: {
      page,
      totalPages,
      totalItems,
      from: totalItems === 0 ? 0 : startIdx + 1,
      to: startIdx + pageItems.length,
    },
  }
}
