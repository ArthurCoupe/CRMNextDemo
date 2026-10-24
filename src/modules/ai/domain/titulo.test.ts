import { describe, expect, it } from "vitest";

import { erroDoTitulo, LIMITE_DO_TITULO } from "./titulo";

describe("erroDoTitulo (A1.6)", () => {
  it("o limite é o mesmo corte da conversa nova (60)", () => {
    expect(LIMITE_DO_TITULO).toBe(60);
  });

  it.each(["", "   ", "\t\n"])("em branco %j recusa", (texto) => {
    expect(erroDoTitulo(texto)).toBe("O nome da conversa não pode ficar em branco.");
  });

  it("61 caracteres recusa com a contagem", () => {
    expect(erroDoTitulo("x".repeat(61))).toBe(
      "O nome da conversa tem 61 caracteres; o máximo é 60.",
    );
  });

  it("60 caracteres passam", () => {
    expect(erroDoTitulo("x".repeat(60))).toBeNull();
  });

  it("espaço nas pontas não conta", () => {
    expect(erroDoTitulo(`  ${"x".repeat(60)}  `)).toBeNull();
  });
});
