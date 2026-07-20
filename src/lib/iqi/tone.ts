// Classificação visual do IQI (% de reincidência) — menor é melhor.
// Faixas alinhadas ao design system (verde/ciano/âmbar/vermelho). Compartilhado
// entre a tela gerencial e o app do técnico.

export type IqiLevel = 'bom' | 'ok' | 'atencao' | 'critico'

export interface IqiTone {
  level: IqiLevel
  label: string
  /** Cor do texto (variável CSS do tema). */
  fg: string
  /** Cor de fundo do badge. */
  bg: string
}

export function iqiLevel(pct: number): IqiLevel {
  if (pct <= 10) return 'bom'
  if (pct <= 20) return 'ok'
  if (pct <= 30) return 'atencao'
  return 'critico'
}

const TONES: Record<IqiLevel, IqiTone> = {
  bom: { level: 'bom', label: 'Bom', fg: 'var(--green)', bg: 'rgba(46,230,168,0.12)' },
  ok: { level: 'ok', label: 'Ok', fg: 'var(--cyan)', bg: 'rgba(0,212,255,0.12)' },
  atencao: { level: 'atencao', label: 'Atenção', fg: 'var(--amber)', bg: 'rgba(255,181,71,0.12)' },
  critico: { level: 'critico', label: 'Crítico', fg: 'var(--red)', bg: 'rgba(255,84,112,0.13)' },
}

export function iqiTone(pct: number): IqiTone {
  return TONES[iqiLevel(pct)]
}
