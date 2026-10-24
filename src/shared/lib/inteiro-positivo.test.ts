import { describe, expect, it } from "vitest";

import { inteiroPositivoOuNulo } from "./inteiro-positivo";

describe("inteiroPositivoOuNulo", () => {
  it.each(["", "   "])("%j é ausência (null)", (texto) => {
    expect(inteiroPositivoOuNulo(texto)).toBeNull();
  });

  it.each([
    ["12", 12],
    [" 12 ", 12],
  ])("%j é o número %d", (texto, esperado) => {
    expect(inteiroPositivoOuNulo(texto)).toBe(esperado);
  });

  it.each(["0", "-1", "2.5", "12e", "1-", "abc"])("%j é inválido (undefined)", (texto) => {
    expect(inteiroPositivoOuNulo(texto)).toBeUndefined();
  });
});
