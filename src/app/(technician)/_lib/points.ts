// Fórmula ÚNICA dos "pontos" do técnico = o payout dele, com a mesma base/status do
// "A pagar" do painel do gestor (perfil do técnico). Home e histórico importam daqui para
// os números baterem entre si e com o gestor.

export const PAID_STATUSES: string[] = [
  'approved',
  'paid',
  'override',
  'pending_review',
  'pending',
]

export function payoutValor(p: {
  valor_override?: number | null
  valor_calculado?: number | null
}): number {
  return p.valor_override !== null && p.valor_override !== undefined
    ? Number(p.valor_override)
    : Number(p.valor_calculado ?? 0)
}
