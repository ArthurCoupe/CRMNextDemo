import { describe, expect, it } from "vitest";

import { brl, compactBrl, pct, plural } from "./format";

const semNbsp = (s: string) => s.normalize("NFKC");

describe("brl", () => {
  it("R$ 1.000,00 — sempre com as 2 casas", () => {
    expect(semNbsp(brl(1000))).toBe("R$ 1.000,00");
  });

  it("corta a 3ª casa: 10827.583 -> R$ 10.827,58", () => {
    expect(semNbsp(brl(10827.583))).toBe("R$ 10.827,58");
  });

  it("nulo e undefined viram R$ 0,00, nunca NaN", () => {
    expect(semNbsp(brl(null))).toBe("R$ 0,00");
    expect(semNbsp(brl(undefined))).toBe("R$ 0,00");
  });

  it("🔴 nunca devolve 3 casas decimais — o bug que motivou o módulo", () => {
    const casos = [1524.5833333333333, 0.005, 999.999, 1 / 3, 12327.001];
    for (let i = 0; i < 500; i++) casos.push(Math.random() * 1_000_000);

    for (const v of casos) {
      const decimais = semNbsp(brl(v)).split(",")[1];
      expect(decimais, `brl(${v})`).toHaveLength(2);
    }
  });
});

describe("pct", () => {
  it("recebe fração: 0.153 -> 15,3%", () => {
    expect(semNbsp(pct(0.153))).toBe("15,3%");
  });

  it("nulo vira 0%", () => {
    expect(semNbsp(pct(null))).toBe("0%");
  });
});

describe("compactBrl", () => {
  it("compacta para card: 12.300 -> R$ 12,3 mil", () => {
    expect(semNbsp(compactBrl(12300))).toBe("R$ 12,3 mil");
  });

  it("milhões: 1.230.000 -> R$ 1,2 mi", () => {
    expect(semNbsp(compactBrl(1230000))).toBe("R$ 1,2 mi");
  });
});

describe("plural", () => {
  it("1 leva o singular; 0 e 2+ levam o plural", () => {
    expect(plural(1, "oportunidade", "oportunidades")).toBe("1 oportunidade");
    expect(plural(0, "erro", "erros")).toBe("0 erros");
    expect(plural(3, "nova", "novas")).toBe("3 novas");
  });
});
