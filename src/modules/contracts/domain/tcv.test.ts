import { describe, expect, it } from "vitest";

import type { Contrato } from "./contract";
import { contaParaTcv, somarTcv, somarTcvPorLinhaDeNegocio } from "./tcv";

function contrato(over: Partial<Contrato> = {}): Contrato {
  return {
    id: "c1",
    clienteId: "cl1",
    nome: "Projeto",
    tipo: "tcv",
    linhaDeNegocio: "sistemas",
    valorMensal: null,
    valorTotal: 12327,
    mesesDeCobranca: 3,
    cobrancaAtiva: true,
    inicio: "2026-01-01",
    fim: null,
    firme: true,
    status: "active",
    ...over,
  };
}

describe("contaParaTcv", () => {
  it("aceita tcv ativo com cobrança ativa", () => {
    expect(contaParaTcv(contrato())).toBe(true);
  });

  it("recusa mensalidade", () => {
    expect(contaParaTcv(contrato({ tipo: "mrr", valorTotal: null, valorMensal: 1000 }))).toBe(
      false,
    );
  });

  it("recusa cancelado", () => {
    expect(contaParaTcv(contrato({ status: "cancelled" }))).toBe(false);
  });

  it("recusa com a cobrança suspensa", () => {
    expect(contaParaTcv(contrato({ cobrancaAtiva: false }))).toBe(false);
  });
});

describe("somarTcv", () => {
  it("soma só os que contam", () => {
    const total = somarTcv([
      contrato({ id: "a", valorTotal: 12327 }),
      contrato({ id: "b", valorTotal: 24637 }),
      contrato({ id: "c", valorTotal: 999, status: "cancelled" }),
      contrato({ id: "d", valorTotal: 999, cobrancaAtiva: false }),
      contrato({ id: "e", tipo: "mrr", valorTotal: null, valorMensal: 1000 }),
    ]);
    expect(total).toBe(36964);
  });

  it("lista vazia soma zero", () => {
    expect(somarTcv([])).toBe(0);
  });

  it("não erra por ponto flutuante", () => {
    expect(
      somarTcv([contrato({ id: "a", valorTotal: 0.1 }), contrato({ id: "b", valorTotal: 0.2 })]),
    ).toBe(0.3);
  });

  it("ignora por completo o valor de mensalidades", () => {
    const soMensalidades = [
      contrato({ id: "a", tipo: "mrr", valorTotal: null, valorMensal: 1524.58 }),
      contrato({ id: "b", tipo: "mrr", valorTotal: null, valorMensal: 2500 }),
    ];
    expect(somarTcv(soMensalidades)).toBe(0);
  });

  it("nunca mensaliza — TCV é o total contratado, não o total dividido", () => {
    const projeto = contrato({ valorTotal: 12000, mesesDeCobranca: 12 });
    expect(somarTcv([projeto])).toBe(12000);
    expect(somarTcv([projeto])).not.toBe(1000);
  });
});

describe("somarTcvPorLinhaDeNegocio", () => {
  it("reconhece TCV na BU Demanda", () => {
    const total = somarTcvPorLinhaDeNegocio([
      contrato({ id: "a", linhaDeNegocio: "sistemas", valorTotal: 24637 }),
      contrato({ id: "b", linhaDeNegocio: "demanda", valorTotal: 5000 }),
    ]);
    expect(total).toEqual({ demanda: 5000, sistemas: 24637, compartilhado: 0 });
  });

  it("zera as linhas sem contrato", () => {
    expect(somarTcvPorLinhaDeNegocio([])).toEqual({
      demanda: 0,
      sistemas: 0,
      compartilhado: 0,
    });
  });
});
