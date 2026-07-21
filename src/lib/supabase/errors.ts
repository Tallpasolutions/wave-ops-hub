// Violação de unique do Postgres (SQLSTATE 23505). Usado no ETL (re-upload de linha
// já ingerida) e no vínculo de técnico (linha nula que duplica uma visita já atribuída).
export function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '23505' || /duplicate key value/i.test(error.message ?? '')
}
