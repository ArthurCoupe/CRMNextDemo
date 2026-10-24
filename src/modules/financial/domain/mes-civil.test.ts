import { describe, expect, it } from "vitest";

import { hojeEmSaoPaulo, indiceDoMes, mesEAno, mesesDesde, primeiroDiaDoMes } from "./mes-civil";

describe("indiceDoMes", () => {
  it("é monotônico e espelha extract(year) * 12 + (mês - 1)", () => {
    expect(indiceDoMes("2026-01-01")).toBe(2026 * 12 + 0);
    expect(indiceDoMes("2026-12-31")).toBe(2026 * 12 + 11);
    expect(indiceDoMes("2027-01-01")).toBe(2027 * 12 + 0);
  });

  it("a virada de ano é UM passo, não onze", () => {
    const dezembro = indiceDoMes("2026-12-01");
    const janeiro = indiceDoMes("2027-01-01");
    expect(dezembro).not.toBeNull();
    expect(janeiro).not.toBeNull();
    expect((janeiro as number) - (dezembro as number)).toBe(1);
  });

  it("🔴 o dia é ignorado — o dia 1º e o dia 31 são o MESMO mês civil", () => {
    expect(indiceDoMes("2026-08-01")).toBe(indiceDoMes("2026-08-31"));
  });

  it("texto que não é data ISO devolve null, nunca zero", () => {
    for (const lixo of ["", "hoje", "2026-8-1", "01/08/2026", "2026-08", "abcd-ef-gh"]) {
      expect(indiceDoMes(lixo)).toBeNull();
    }
  });

  it("mês fora de 1..12 devolve null", () => {
    expect(indiceDoMes("2026-00-10")).toBeNull();
    expect(indiceDoMes("2026-13-10")).toBeNull();
  });
});

describe("mesEAno", () => {
  it("devolve MM/AAAA, preservando o zero à esquerda", () => {
    expect(mesEAno("2026-08-19")).toBe("08/2026");
    expect(mesEAno("2026-12-01")).toBe("12/2026");
  });

  it("entrada inválida devolve null", () => {
    expect(mesEAno("2026-8-19")).toBeNull();
  });
});

describe("mesesDesde", () => {
  it("mesmo mês é 0, não 1", () => {
    expect(mesesDesde("2026-08-01", "2026-08-31")).toBe(0);
  });

  it("conta meses civis, não dias", () => {
    expect(mesesDesde("2026-01-31", "2026-02-01")).toBe(1);
    expect(mesesDesde("2026-01-01", "2026-12-01")).toBe(11);
    expect(mesesDesde("2026-01-01", "2027-01-01")).toBe(12);
  });

  it("referência anterior ao início é negativa — não é clampada em zero", () => {
    expect(mesesDesde("2026-08-01", "2026-05-01")).toBe(-3);
  });

  it("qualquer ponta inválida devolve null", () => {
    expect(mesesDesde("lixo", "2026-08-01")).toBeNull();
    expect(mesesDesde("2026-08-01", "lixo")).toBeNull();
  });
});

describe("primeiroDiaDoMes", () => {
  it("é o inverso de indiceDoMes para todo mês de um intervalo de 5 anos", () => {
    for (let ano = 2024; ano <= 2028; ano++) {
      for (let mes = 1; mes <= 12; mes++) {
        const iso = `${ano}-${String(mes).padStart(2, "0")}-01`;
        const indice = indiceDoMes(iso);
        expect(indice).not.toBeNull();
        expect(primeiroDiaDoMes(indice as number)).toBe(iso);
      }
    }
  });

  it("preenche com zero à esquerda — o formato é o que o Postgres aceita", () => {
    expect(primeiroDiaDoMes(2026 * 12 + 0)).toBe("2026-01-01");
    expect(primeiroDiaDoMes(2026 * 12 + 8)).toBe("2026-09-01");
  });
});

describe("hojeEmSaoPaulo", () => {
  it("delega para todaySP e devolve YYYY-MM-DD", () => {
    const hoje = hojeEmSaoPaulo();
    expect(hoje).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(indiceDoMes(hoje)).not.toBeNull();
  });
});
