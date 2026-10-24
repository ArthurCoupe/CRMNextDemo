import { describe, expect, it } from "vitest";

import { iniciais } from "./iniciais";

describe("iniciais", () => {
  it("primeira e última do nome completo", () => {
    expect(iniciais("Augusto Conceição")).toBe("AC");
  });

  it("nome composto usa a PRIMEIRA e a ÚLTIMA, não as duas primeiras", () => {
    expect(iniciais("Ana Paula Souza")).toBe("AS");
    expect(iniciais("Ana Paula Lima")).toBe("AL");
  });

  it("nome de uma palavra devolve uma letra", () => {
    expect(iniciais("Madonna")).toBe("M");
  });

  it("sempre maiúsculas, mesmo com o nome em caixa baixa", () => {
    expect(iniciais("júlio vinicius")).toBe("JV");
  });

  it("espaço em excesso não vira inicial vazia", () => {
    expect(iniciais("  Marina   Silva  ")).toBe("MS");
  });

  it("nome vazio devolve o mesmo `?` que o card mostrava antes", () => {
    expect(iniciais("")).toBe("?");
    expect(iniciais("   ")).toBe("?");
  });
});
