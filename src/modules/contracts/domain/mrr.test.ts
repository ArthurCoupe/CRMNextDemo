import { describe, expect, it } from "vitest";

import type { Contrato } from "./contract";
import { contaParaMrr, somarMrr, somarMrrPorLinhaDeNegocio } from "./mrr";

function contrato(over: Partial<Contrato> = {}): Contrato {
  return {
    id: "c1",
    clienteId: "cl1",
    nome: "Contrato",
    tipo: "mrr",
    linhaDeNegocio: "demanda",
    valorMensal: 1000,
    valorTotal: null,
    mesesDeCobranca: null,
    cobrancaAtiva: true,
    inicio: "2026-01-01",
    fim: null,
    firme: true,
    status: "active",
    ...over,
  };
}

describe("contaParaMrr", () => {
  it("aceita mrr ativo com cobrança ativa", () => {
    expect(contaParaMrr(contrato())).toBe(true);
  });

  it("recusa contrato de projeto", () => {
    expect(contaParaMrr(contrato({ tipo: "tcv", valorMensal: null, valorTotal: 9000 }))).toBe(
      false,
    );
  });

  it("recusa cancelado", () => {
    expect(contaParaMrr(contrato({ status: "cancelled" }))).toBe(false);
  });

  it("recusa com a cobrança suspensa", () => {
    expect(contaParaMrr(contrato({ cobrancaAtiva: false }))).toBe(false);
  });

  it("aceita pausado quando a cobrança continua ativa", () => {
    expect(contaParaMrr(contrato({ status: "paused", cobrancaAtiva: true }))).toBe(true);
  });

  it("aceita encerrado que ainda tem cobrança ativa", () => {
    expect(contaParaMrr(contrato({ status: "finished", cobrancaAtiva: true }))).toBe(true);
  });
});

describe("paridade com private.fn_contrato_fatura_em (mrr) — 6 casos medidos contra o banco", () => {
  const MES = "2026-09";
  const CASOS = [
    {
      nome: "end 20/06 — encerrado antes do mês",
      inicio: "2026-01-01",
      fim: "2026-06-20",
      esperado: false,
    },
    { nome: "sem fim — entra todo mês", inicio: "2026-01-01", fim: null, esperado: true },
    { nome: "start 01/10 — ainda não começou", inicio: "2026-10-01", fim: null, esperado: false },
    {
      nome: "end 01/09 — o mês do fim conta, inclusive",
      inicio: "2026-01-01",
      fim: "2026-09-01",
      esperado: true,
    },
    {
      nome: "start 30/09 — começou no mês, mesmo no último dia",
      inicio: "2026-09-30",
      fim: null,
      esperado: true,
    },
    {
      nome: "end 31/08 — último dia do mês anterior não alcança setembro",
      inicio: "2026-01-01",
      fim: "2026-08-31",
      esperado: false,
    },
  ] as const;

  for (const caso of CASOS) {
    it(caso.nome, () => {
      expect(contaParaMrr(contrato({ inicio: caso.inicio, fim: caso.fim }), MES)).toBe(
        caso.esperado,
      );
    });
  }

  it("a soma aplica a mesma janela", () => {
    expect(
      somarMrr(
        [
          contrato({ id: "a", valorMensal: 2000, fim: "2026-06-20" }),
          contrato({ id: "b", valorMensal: 500 }),
          contrato({ id: "c", valorMensal: 300, inicio: "2026-10-01" }),
        ],
        MES,
      ),
    ).toBe(500);
  });
});

describe("somarMrr", () => {
  it("soma só os que contam", () => {
    const total = somarMrr([
      contrato({ id: "a", valorMensal: 1524.58 }),
      contrato({ id: "b", valorMensal: 1000 }),
      contrato({ id: "c", valorMensal: 999, status: "cancelled" }),
      contrato({ id: "d", valorMensal: 999, cobrancaAtiva: false }),
      contrato({ id: "e", tipo: "tcv", valorMensal: null, valorTotal: 12327 }),
    ]);
    expect(total).toBe(2524.58);
  });

  it("lista vazia soma zero", () => {
    expect(somarMrr([])).toBe(0);
  });

  it("não erra por ponto flutuante", () => {
    const total = somarMrr([
      contrato({ id: "a", valorMensal: 0.1 }),
      contrato({ id: "b", valorMensal: 0.2 }),
    ]);
    expect(total).toBe(0.3);
  });

  it("ignora por completo o valor de contratos de projeto", () => {
    const soProjetos = [
      contrato({ id: "a", tipo: "tcv", valorMensal: null, valorTotal: 12000, mesesDeCobranca: 12 }),
      contrato({ id: "b", tipo: "tcv", valorMensal: null, valorTotal: 24637, mesesDeCobranca: 3 }),
    ];
    expect(somarMrr(soProjetos)).toBe(0);
  });
});

describe("somarMrrPorLinhaDeNegocio", () => {
  it("reconhece MRR na BU Sistemas — a plataforma mensal", () => {
    const total = somarMrrPorLinhaDeNegocio([
      contrato({ id: "a", linhaDeNegocio: "demanda", valorMensal: 1197 }),
      contrato({ id: "b", linhaDeNegocio: "demanda", valorMensal: 797 }),
      contrato({ id: "c", linhaDeNegocio: "sistemas", valorMensal: 750 }),
    ]);

    expect(total).toEqual({ demanda: 1994, sistemas: 750, compartilhado: 0 });
  });

  it("zera as linhas sem contrato", () => {
    expect(somarMrrPorLinhaDeNegocio([])).toEqual({
      demanda: 0,
      sistemas: 0,
      compartilhado: 0,
    });
  });

  it("aplica os mesmos filtros da soma total", () => {
    const total = somarMrrPorLinhaDeNegocio([
      contrato({ id: "a", linhaDeNegocio: "sistemas", valorMensal: 750 }),
      contrato({ id: "b", linhaDeNegocio: "sistemas", valorMensal: 999, status: "cancelled" }),
      contrato({ id: "c", linhaDeNegocio: "sistemas", valorMensal: 999, cobrancaAtiva: false }),
    ]);
    expect(total.sistemas).toBe(750);
  });
});
