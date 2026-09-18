// Parecer final do supervisor (ADR-022). É o julgamento de quem esteve em campo, INDEPENDENTE
// da nota: uma supervisão pode ter nota alta e parecer com ressalva. A nota mede o checklist;
// o parecer mede a visita.
//
// Só o tipo e a lista vivem aqui. Os rótulos em português estão em src/lib/labels/supervisao.ts,
// que é a fonte única da interface — mapa de rótulo espalhado por tela é a causa raiz
// documentada de termo técnico vazar para a Wave.

export const PARECERES = [
  'aprovado',
  'aprovado_com_ressalvas',
  'reprovado',
  'reciclagem_recomendada',
] as const

export type ParecerFinal = (typeof PARECERES)[number]

export function isParecerValido(valor: unknown): valor is ParecerFinal {
  return typeof valor === 'string' && (PARECERES as readonly string[]).includes(valor)
}
