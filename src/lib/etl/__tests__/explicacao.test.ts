import { describe, expect, it } from "vitest";
import { normalizeExplicacao } from "../explicacao";

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

  it("preserva o modificador de pontos (distingue o payout)", () => {
    expect(
      normalizeExplicacao(
        "Cabeamento | 88 (+73 * 1 ponto(s) adicional(is)) (Reajuste +6,54% fevereiro/2025)",
      ),
    ).toBe("Cabeamento (+73 * 1 ponto(s) adicional(is))");
    expect(
      normalizeExplicacao(
        "Cabeamento agregado | 73 (+73 * 1 ponto(s) adicional(is)) (Reajuste +6,54% fevereiro/2025)",
      ),
    ).toBe("Cabeamento agregado (+73 * 1 ponto(s) adicional(is))");
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
