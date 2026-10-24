import { describe, expect, it } from "vitest";

import {
  codigoTotpValido,
  normalizarCodigoTotp,
  precisaDeSegundoFator,
  situacaoDoSegundoFator,
} from "./mfa";

describe("C21 · precisaDeSegundoFator", () => {
  it("so quando a conta exige aal2 e a sessao ainda nao esta la", () => {
    expect(precisaDeSegundoFator("aal1", "aal2")).toBe(true);
    expect(precisaDeSegundoFator("aal2", "aal2")).toBe(false);
    expect(precisaDeSegundoFator("aal1", "aal1")).toBe(false);
    expect(precisaDeSegundoFator(null, null)).toBe(false);
    expect(precisaDeSegundoFator(null, "aal2")).toBe(true);
  });
});

describe("C21 · codigo TOTP", () => {
  it("6 digitos, com ou sem espaco", () => {
    expect(codigoTotpValido("123456")).toBe(true);
    expect(codigoTotpValido("123 456")).toBe(true);
    expect(codigoTotpValido("12345")).toBe(false);
    expect(codigoTotpValido("12345a")).toBe(false);
    expect(normalizarCodigoTotp("123 456")).toBe("123456");
  });
});

describe("C21 · situacaoDoSegundoFator", () => {
  it("sem fator verificado: pede cadastro, qualquer que seja o nivel", () => {
    expect(situacaoDoSegundoFator(false, "aal1", "aal1")).toBe("sem-fator");
    expect(situacaoDoSegundoFator(false, "aal2", "aal2")).toBe("sem-fator");
  });
  it("com fator e sessao aal1 que exige aal2: falta o codigo", () => {
    expect(situacaoDoSegundoFator(true, "aal1", "aal2")).toBe("falta-codigo");
  });
  it("com fator e sessao aal2: ok", () => {
    expect(situacaoDoSegundoFator(true, "aal2", "aal2")).toBe("ok");
  });
});
