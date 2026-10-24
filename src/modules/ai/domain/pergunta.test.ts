import { describe, expect, it } from "vitest";

import { contagemDaPergunta, perguntaLongaDemais, TETO_DA_PERGUNTA } from "./pergunta";

describe("teto da pergunta (AI-3)", () => {
  it("no teto passa; um a mais devolve a frase com os dois números formatados", () => {
    expect(perguntaLongaDemais(TETO_DA_PERGUNTA)).toBeNull();
    expect(perguntaLongaDemais(TETO_DA_PERGUNTA + 1)).toBe(
      "A pergunta tem 8.001 caracteres; o máximo é 8.000.",
    );
  });

  it("o contador usa o separador de milhar da casa", () => {
    expect(contagemDaPergunta(0)).toBe("0 / 8.000");
    expect(contagemDaPergunta(10_000)).toBe("10.000 / 8.000");
  });
});
