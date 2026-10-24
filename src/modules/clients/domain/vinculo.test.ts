import { describe, expect, it } from "vitest";

import { rotuloDaGanha } from "./vinculo";

describe("rotuloDaGanha", () => {
  it("nome e o dia do ganho em São Paulo, para diferenciar nomes iguais", () => {
    expect(
      rotuloDaGanha({
        id: "opp-1",
        nome: "Acme",
        contatoNome: null,
        contatoEmail: null,
        contatoTelefone: null,
        segmento: null,
        nicho: null,
        ganhaEm: "2026-10-07T02:00:00Z",
      }),
    ).toBe("Acme, ganha em 06/10/2026");
  });
});
