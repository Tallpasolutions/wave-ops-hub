import { describe, expect, it } from "vitest";
import { normalizeExplicacao, isHomologacao, parsePontosAdicionais } from "../explicacao";

// Amostras reais de produção (coluna Z de visitas de Cabeamento — ADR-009).
describe("normalizeExplicacao", () => {
  it("remove valor-base e reajuste, mantém o serviço", () => {
    expect(
      normalizeExplicacao("Cabeamento agregado | 73 (Reajuste +6,54% fevereiro/2025)"),
    ).toBe("Cabeamento agregado");
    expect(normalizeExplicacao("Cabeamento | 88 (Reajuste +6,54% fevereiro/2025)")).toBe(
      "Cabeamento",
    );
  });

  it("remove multiplicador inline e o reajuste geral", () => {
    expect(
      normalizeExplicacao(
        "Cabeamento fibra aérea | 176 * 1.1 (+10% reajuste geral em 09/2019) (Reajuste +6,54% fevereiro/2025)",
      ),
    ).toBe("Cabeamento fibra aérea");
    expect(
      normalizeExplicacao(
        "Cabeamento fibra subterrênea | 198 * 1.1 (+10% reajuste geral em 09/2019) (Reajuste +6,54% fevereiro/2025)",
      ),
    ).toBe("Cabeamento fibra subterrênea");
  });

  // ADR-016: o modificador de pontos SAI da chave (vira acréscimo uniforme). As variantes
  // com ponto colapsam na chave-base.
  it("remove o modificador de pontos → chave-base (ADR-016)", () => {
    expect(
      normalizeExplicacao(
        "Cabeamento | 88 (+73 * 1 ponto(s) adicional(is)) (Reajuste +6,54% fevereiro/2025)",
      ),
    ).toBe("Cabeamento");
    expect(
      normalizeExplicacao(
        "Cabeamento agregado | 73 (+73 * 2 ponto(s) adicional(is)) (Reajuste +6,54% fevereiro/2025)",
      ),
    ).toBe("Cabeamento agregado");
  });

  it("serviço com decimal e frase longa", () => {
    expect(
      normalizeExplicacao(
        "Cabeamento do segundo cliente ou ftta de um condomínio | 96.80 (Reajuste +6,54% fevereiro/2025)",
      ),
    ).toBe("Cabeamento do segundo cliente ou ftta de um condomínio");
  });

  it("mesmo serviço → mesma chave (agrupa); vazio/nulo → string vazia", () => {
    const a = normalizeExplicacao("Cabeamento agregado | 73 (Reajuste +6,54% fevereiro/2025)");
    const b = normalizeExplicacao("Cabeamento agregado | 73 (Reajuste +6,54% fevereiro/2025)");
    expect(a).toBe(b);
    // improdutiva: só o reajuste, sem serviço
    expect(normalizeExplicacao("(Reajuste +6,54% fevereiro/2025)")).toBe("");
    expect(normalizeExplicacao(null)).toBe("");
    expect(normalizeExplicacao(undefined)).toBe("");
  });
});

// ADR-015: detecção de homologação pela coluna Z.
describe("isHomologacao", () => {
  it("reconhece homologação base e com ponto adicional", () => {
    expect(isHomologacao("Homologação | 60.50 (Reajuste +6,54% fevereiro/2025)")).toBe(true);
    expect(
      isHomologacao(
        "Homologação | 60.50 (+73 * 1 ponto(s) adicional(is)) (Reajuste +6,54% fevereiro/2025)",
      ),
    ).toBe(true);
  });

  it("tolera caixa e acento", () => {
    expect(isHomologacao("  homologacao | 60.50")).toBe(true);
    expect(isHomologacao("HOMOLOGAÇÃO")).toBe(true);
  });

  it("não confunde com outros serviços nem com nulo", () => {
    expect(isHomologacao("Cabeamento agregado | 73")).toBe(false);
    expect(isHomologacao("Instalação | 120")).toBe(false);
    expect(isHomologacao(null)).toBe(false);
    expect(isHomologacao(undefined)).toBe(false);
    expect(isHomologacao("")).toBe(false);
  });
});

// ADR-016: contagem de pontos adicionais na coluna Z.
describe("parsePontosAdicionais", () => {
  it("extrai N do modificador de pontos", () => {
    expect(
      parsePontosAdicionais(
        "Instalação nova | 180 (subterrâneo) * 1.1 (+73 * 1 ponto(s) adicional(is)) (Reajuste +6,54% fevereiro/2025)",
      ),
    ).toBe(1);
    expect(
      parsePontosAdicionais("Cabeamento | 88 (+73 * 2 ponto(s) adicional(is)) (Reajuste ...)"),
    ).toBe(2);
  });

  it("retorna 0 sem o modificador ou com entrada vazia", () => {
    expect(parsePontosAdicionais("Instalação nova | 160 (aéreo) (Reajuste ...)")).toBe(0);
    expect(parsePontosAdicionais(null)).toBe(0);
    expect(parsePontosAdicionais(undefined)).toBe(0);
    expect(parsePontosAdicionais("")).toBe(0);
  });
});
