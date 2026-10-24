import { describe, expect, it } from "vitest";

import {
  formatarMinutosUteis,
  seloDoPrimeiroContato,
  situacaoDoPrimeiroContato,
} from "./primeiro-contato";

const VENCE = "2026-01-05T13:05:00Z";

describe("situacaoDoPrimeiroContato", () => {
  it("sem prazo: sem selo", () => {
    expect(
      situacaoDoPrimeiroContato({ venceEm: null, primeiroToqueEm: null }, new Date(VENCE)),
    ).toBe("sem_selo");
  });

  it("já tocado: sem selo, mesmo depois do vencimento", () => {
    expect(
      situacaoDoPrimeiroContato(
        { venceEm: VENCE, primeiroToqueEm: "2026-01-05T13:30:00Z" },
        new Date("2026-01-06T15:00:00Z"),
      ),
    ).toBe("sem_selo");
  });

  it("🔴 no instante exato do vencimento ainda está no prazo; um milissegundo depois, atrasado", () => {
    const contato = { venceEm: VENCE, primeiroToqueEm: null };
    expect(situacaoDoPrimeiroContato(contato, new Date(VENCE))).toBe("no_prazo");
    expect(situacaoDoPrimeiroContato(contato, new Date(Date.parse(VENCE) + 1))).toBe("atrasado");
  });

  it("vencimento malformado: sem selo, nunca 'atrasado' por acidente", () => {
    expect(
      situacaoDoPrimeiroContato({ venceEm: "banana", primeiroToqueEm: null }, new Date(VENCE)),
    ).toBe("sem_selo");
  });
});

describe("seloDoPrimeiroContato", () => {
  it("no prazo: 'até' e sem cor de erro", () => {
    expect(
      seloDoPrimeiroContato(
        { venceEm: VENCE, primeiroToqueEm: null },
        new Date("2026-01-05T13:00:00Z"),
      ),
    ).toEqual({ texto: "1º contato até 10:05", atrasado: false });
  });

  it("atrasado: 'atrasado desde' e cor de erro", () => {
    expect(
      seloDoPrimeiroContato(
        { venceEm: VENCE, primeiroToqueEm: null },
        new Date("2026-01-05T13:06:00Z"),
      ),
    ).toEqual({ texto: "1º contato atrasado desde 10:05", atrasado: true });
  });

  it("vencimento noutro dia leva o dia: 'até seg 09:05'", () => {
    expect(
      seloDoPrimeiroContato(
        { venceEm: "2026-01-12T12:05:00Z", primeiroToqueEm: null },
        new Date("2026-01-10T15:00:00Z"),
      )?.texto,
    ).toBe("1º contato até seg 09:05");
  });

  it("sem selo devolve null", () => {
    expect(
      seloDoPrimeiroContato({ venceEm: null, primeiroToqueEm: null }, new Date(VENCE)),
    ).toBeNull();
  });
});

describe("formatarMinutosUteis", () => {
  it.each([
    [0, "0 min"],
    [45, "45 min"],
    [60, "1 h"],
    [80, "1 h 20 min"],
    [540, "9 h"],
  ])("%i → %s", (minutos, texto) => {
    expect(formatarMinutosUteis(minutos)).toBe(texto);
  });
});
