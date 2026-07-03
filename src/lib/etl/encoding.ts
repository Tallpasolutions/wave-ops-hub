// As planilhas da Unetvale chegam com texto corrompido por uma cadeia de encoding:
// bytes Latin-1/CP1252 decodificados como Mac Roman ("Instalação" → "InstalaÁ„o").
// Diagnóstico provado contra o corpus real do QA de 02/07/2026 (9/9 strings) —
// ver docs/sprints/13-sprint-12-dados-confiaveis.md, Fase A.
// O reparo inverte a cadeia: cada char volta ao byte Mac Roman e é relido como Latin-1.
// A migration 0012 aplica a MESMA transformação nos dados já gravados.

// Tabela oficial Mac Roman para os bytes 0x80–0xFF
const MAC_ROMAN_HIGH: number[] = [
  0x00c4, 0x00c5, 0x00c7, 0x00c9, 0x00d1, 0x00d6, 0x00dc, 0x00e1,
  0x00e0, 0x00e2, 0x00e4, 0x00e3, 0x00e5, 0x00e7, 0x00e9, 0x00e8,
  0x00ea, 0x00eb, 0x00ed, 0x00ec, 0x00ee, 0x00ef, 0x00f1, 0x00f3,
  0x00f2, 0x00f4, 0x00f6, 0x00f5, 0x00fa, 0x00f9, 0x00fb, 0x00fc,
  0x2020, 0x00b0, 0x00a2, 0x00a3, 0x00a7, 0x2022, 0x00b6, 0x00df,
  0x00ae, 0x00a9, 0x2122, 0x00b4, 0x00a8, 0x2260, 0x00c6, 0x00d8,
  0x221e, 0x00b1, 0x2264, 0x2265, 0x00a5, 0x00b5, 0x2202, 0x2211,
  0x220f, 0x03c0, 0x222b, 0x00aa, 0x00ba, 0x03a9, 0x00e6, 0x00f8,
  0x00bf, 0x00a1, 0x00ac, 0x221a, 0x0192, 0x2248, 0x2206, 0x00ab,
  0x00bb, 0x2026, 0x00a0, 0x00c0, 0x00c3, 0x00d5, 0x0152, 0x0153,
  0x2013, 0x2014, 0x201c, 0x201d, 0x2018, 0x2019, 0x00f7, 0x25ca,
  0x00ff, 0x0178, 0x2044, 0x20ac, 0x2039, 0x203a, 0xfb01, 0xfb02,
  0x2021, 0x00b7, 0x201a, 0x201e, 0x2030, 0x00c2, 0x00ca, 0x00c1,
  0x00cb, 0x00c8, 0x00cd, 0x00ce, 0x00cf, 0x00cc, 0x00d3, 0x00d4,
  0xf8ff, 0x00d2, 0x00da, 0x00db, 0x00d9, 0x0131, 0x02c6, 0x02dc,
  0x00af, 0x02d8, 0x02d9, 0x02da, 0x00b8, 0x02dd, 0x02db, 0x02c7,
]

// codepoint Mac Roman → byte original
const MAC_ROMAN_INVERSE = new Map<number, number>(
  MAC_ROMAN_HIGH.map((cp, i) => [cp, i + 0x80]),
)

// Sinais inequívocos de mojibake: pontuação tipográfica no meio de palavras („ ‚ ·)
// ou maiúscula acentuada logo após minúscula ("InstalaÁ„o", "CondomÌnio", "tÈcnico").
// Texto PT legítimo com acento no início de palavra ("Água") NÃO dispara o reparo.
const MOJIBAKE_INDICATOR = /[„‚·]|[a-zçãõáéíóúâêô][ÀÁÂÃÄÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ]/

export function hasMojibake(value: string): boolean {
  return MOJIBAKE_INDICATOR.test(value)
}

// Repara uma string corrompida. Conservador: se qualquer char não-ASCII não pertencer
// à tabela Mac Roman, ou se o reparo produzir um char de controle (byte 0x80–0x9F,
// impossível em texto real), devolve a string original intacta.
export function repairMojibake(value: string): string {
  if (!hasMojibake(value)) return value

  let out = ''
  for (const ch of value) {
    const cp = ch.codePointAt(0)!
    if (cp < 0x80) {
      out += ch
      continue
    }
    const byte = MAC_ROMAN_INVERSE.get(cp)
    if (byte === undefined || byte < 0xa0) return value
    out += String.fromCharCode(byte)
  }
  return out
}
