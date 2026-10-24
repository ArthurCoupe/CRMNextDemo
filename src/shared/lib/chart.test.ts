import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CHART_COLORS_CLARO, CHART_COLORS_ESCURO, chartColor, paletaDoTema } from "./chart";

function tokensDoBloco(css: string, seletor: string): string[] {
  const abre = css.indexOf(`\n${seletor} {`);
  expect(abre, `a regra ${seletor} não abre em nenhuma linha de styles.css`).toBeGreaterThan(-1);
  const bloco = css.slice(abre, css.indexOf("\n}", abre));
  return [1, 2, 3, 4, 5].map((n) => {
    const achado = new RegExp(`--chart-${n}:\\s*(#[0-9a-fA-F]{6})`).exec(bloco);
    expect(achado, `--chart-${n} não encontrado no bloco ${seletor}`).not.toBeNull();
    return achado![1].toLowerCase();
  });
}

const css = readFileSync("src/styles.css", "utf8");

describe("a paleta acompanha os tokens do CSS", () => {
  it("o tema escuro é o bloco `:root`", () => {
    expect(CHART_COLORS_ESCURO.map((c) => c.toLowerCase())).toEqual(tokensDoBloco(css, ":root"));
  });

  it("o tema claro é o bloco `.light`", () => {
    expect(CHART_COLORS_CLARO.map((c) => c.toLowerCase())).toEqual(tokensDoBloco(css, ".light"));
  });

  it("as duas paletas são diferentes em TODAS as cinco posições", () => {
    CHART_COLORS_ESCURO.forEach((escuro, i) => {
      expect(escuro).not.toBe(CHART_COLORS_CLARO[i]);
    });
  });

  it("nenhum valor é `oklch` ou `var()` — o SVG precisa do literal", () => {
    [...CHART_COLORS_ESCURO, ...CHART_COLORS_CLARO].forEach((cor) => {
      expect(cor).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe("chartColor", () => {
  it("escolhe pela paleta do tema, não por uma paleta só", () => {
    expect(chartColor(0, "dark")).toBe("#2e8fff");
    expect(chartColor(0, "light")).toBe("#0074d9");
  });

  it("é circular — a série 6 volta ao começo", () => {
    expect(chartColor(5, "dark")).toBe(chartColor(0, "dark"));
    expect(chartColor(11, "light")).toBe(chartColor(1, "light"));
  });

  it("índice negativo continua dentro da paleta", () => {
    expect(chartColor(-1, "dark")).toBe("#a78bfa");
    expect(chartColor(-6, "light")).toBe("#7c5cd6");
  });
});

describe("paletaDoTema", () => {
  it("dark é o padrão do sistema, e é o que o tipo permite além de light", () => {
    expect(paletaDoTema("dark")).toBe(CHART_COLORS_ESCURO);
    expect(paletaDoTema("light")).toBe(CHART_COLORS_CLARO);
  });
});
