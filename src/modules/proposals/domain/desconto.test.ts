import { describe, expect, it } from "vitest";

import { desconto } from "./desconto";

describe("desconto", () => {
  it("R$ e fracao contra o catalogo", () => {
    expect(desconto(1000, 900)).toEqual({ reais: 100, fracao: 0.1 });
  });

  it("sem desconto", () => {
    expect(desconto(1000, 1000)).toEqual({ reais: 0, fracao: 0 });
  });

  it("acima do catalogo da negativo", () => {
    expect(desconto(1000, 1100)).toEqual({ reais: -100, fracao: -0.1 });
  });

  it("catalogo zero devolve so R$", () => {
    expect(desconto(0, 50)).toEqual({ reais: -50, fracao: null });
  });

  it("em centavos: 0,3 - 0,1 = 0,2 (nao 0,19999999999999998) e 333,33 - 300 = 33,33", () => {
    expect(desconto(0.3, 0.1).reais).toBe(0.2);
    expect(desconto(333.33, 300).reais).toBe(33.33);
    expect(desconto(333.33, 300).fracao).toBeCloseTo(0.09999, 5);
  });

  it("subtracao de reais em ponto flutuante nao vaza (19,99 - 9,99 = 10, nao 9,999999999999998)", () => {
    expect(desconto(19.99, 9.99).reais).toBe(10);
    expect(desconto(1.15, 1.1).reais).toBe(0.05);
  });
});
