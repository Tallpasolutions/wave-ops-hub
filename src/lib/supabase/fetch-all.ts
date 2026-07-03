// O PostgREST corta resultados em 1000 linhas silenciosamente — queries "sem limite"
// (ou com .limit() acima disso) retornam dados incompletos sem nenhum erro.
// Este helper pagina via .range() até esgotar. O builder passado DEVE ter .order()
// estável (ex: por id), senão páginas podem repetir/pular linhas.
const PAGE_SIZE = 1000

type PageResult<T> = { data: T[] | null; error: { message: string } | null }

export async function fetchAllPages<T>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ rows: T[]; error: { message: string } | null }> {
  const rows: T[] = []
  let from = 0

  for (;;) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1)
    if (error) return { rows, error }
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return { rows, error: null }
    from += PAGE_SIZE
  }
}
