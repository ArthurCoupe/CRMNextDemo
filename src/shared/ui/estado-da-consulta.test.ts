import { describe, expect, it } from "vitest";

import { estadoDaConsulta, piorEstado } from "./estado-da-consulta";

describe("estadoDaConsulta — erro é um estado, não um vazio", () => {
  it("query em erro é 'erro', mesmo com isPending false", () => {
    expect(estadoDaConsulta({ isError: true, isPending: false })).toBe("erro");
  });

  it("erro VENCE carregando quando os dois são verdadeiros", () => {
    expect(estadoDaConsulta({ isError: true, isPending: true })).toBe("erro");
  });

  it("carregando sem erro é 'carregando'", () => {
    expect(estadoDaConsulta({ isError: false, isPending: true })).toBe("carregando");
  });

  it("sucesso é 'pronto' — o único estado em que o dado significa algo", () => {
    expect(estadoDaConsulta({ isError: false, isPending: false })).toBe("pronto");
  });
});

describe("piorEstado — uma seção que lê várias consultas", () => {
  it("um erro entre prontos contamina a seção inteira", () => {
    expect(piorEstado("pronto", "erro")).toBe("erro");
  });

  it("erro vence carregando", () => {
    expect(piorEstado("carregando", "erro")).toBe("erro");
    expect(piorEstado("erro", "carregando")).toBe("erro");
  });

  it("carregando vence pronto", () => {
    expect(piorEstado("pronto", "carregando")).toBe("carregando");
  });

  it("todas prontas é pronto", () => {
    expect(piorEstado("pronto", "pronto", "pronto")).toBe("pronto");
  });

  it("sem consultas é pronto — não há nada que possa estar errado", () => {
    expect(piorEstado()).toBe("pronto");
  });
});
