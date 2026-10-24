import { describe, expect, it } from "vitest";

import { problemaNaSecao } from "./secao";

const FRASE_DO_TITULO = "O título da seção não pode ficar em branco.";
const FRASE_DA_ORDEM = "A ordem precisa ser um número inteiro de 0 a 9999.";

describe("problemaNaSecao", () => {
  it("título e ordem válidos não têm problema", () => {
    expect(problemaNaSecao({ titulo: "Abordagem", ordem: 3 })).toBeNull();
  });

  it.each([0, 9999])("ordem %d (borda válida) passa", (ordem) => {
    expect(problemaNaSecao({ titulo: "Abordagem", ordem })).toBeNull();
  });

  it.each(["", "  ", "\n\t"])("título %j recusa com a frase do título", (titulo) => {
    expect(problemaNaSecao({ titulo, ordem: 0 })).toBe(FRASE_DO_TITULO);
  });

  it.each([-1, 10000, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "ordem %s recusa com a frase da ordem",
    (ordem) => {
      expect(problemaNaSecao({ titulo: "Abordagem", ordem })).toBe(FRASE_DA_ORDEM);
    },
  );

  it("título em branco vem antes da ordem inválida", () => {
    expect(problemaNaSecao({ titulo: " ", ordem: -1 })).toBe(FRASE_DO_TITULO);
  });
});
