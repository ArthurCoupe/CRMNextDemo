import { describe, expect, it } from "vitest";

import {
  celulasDeMrr,
  celulasDeTcv,
  linhasDeFaturamento,
  linhasForaDaMatriz,
  totalDeCaixa,
  LINHAS_DA_MATRIZ,
  type LinhaDeMrrPorUnidade,
  type LinhaDeReceitaPorFrente,
  type LinhaDeTcvPorUnidade,
} from "./receita";

const MRR_MEDIDO: readonly LinhaDeMrrPorUnidade[] = [
  { bu: "demanda", mrr_total: 1000, mrr_firme: 1000, contratos: 1 },
];
const TCV_MEDIDO: readonly LinhaDeTcvPorUnidade[] = [
  { bu: "sistemas", tcv_total: 9000, projetos: 1 },
];
const FRENTES_MEDIDAS: readonly LinhaDeReceitaPorFrente[] = [
  { front: "sistemas", bu: "sistemas", mrr_mensal: 0, tcv_total: 9000, caixa_mes: 3000 },
  { front: "trafego", bu: "demanda", mrr_mensal: 1000, tcv_total: 0, caixa_mes: 1000 },
];

describe("celulasDeMrr — a matriz tem sempre as duas células", () => {
  it("devolve as duas linhas de negócio mesmo quando só uma tem contrato", () => {
    const celulas = celulasDeMrr(MRR_MEDIDO);

    expect(celulas).toHaveLength(2);
    expect(celulas.map((c) => c.linhaDeNegocio)).toEqual(["demanda", "sistemas"]);
  });

  it("preenche com zero a BU sem contrato, em vez de omitir o card", () => {
    const [demanda, sistemas] = celulasDeMrr(MRR_MEDIDO);

    expect(demanda).toEqual({
      linhaDeNegocio: "demanda",
      total: 1000,
      firme: 1000,
      contratos: 1,
    });
    expect(sistemas).toEqual({
      linhaDeNegocio: "sistemas",
      total: 0,
      firme: 0,
      contratos: 0,
    });
  });

  it("entrada vazia produz as duas células zeradas, não um array vazio", () => {
    expect(celulasDeMrr([])).toEqual([
      { linhaDeNegocio: "demanda", total: 0, firme: 0, contratos: 0 },
      { linhaDeNegocio: "sistemas", total: 0, firme: 0, contratos: 0 },
    ]);
  });

  it("trata nulo do banco como zero", () => {
    const celulas = celulasDeMrr([
      { bu: "sistemas", mrr_total: null, mrr_firme: null, contratos: null },
    ]);

    expect(celulas[1]).toEqual({
      linhaDeNegocio: "sistemas",
      total: 0,
      firme: 0,
      contratos: 0,
    });
  });

  it("a parcela firme é subconjunto do total, nunca somada a ele", () => {
    const [demanda] = celulasDeMrr([
      { bu: "demanda", mrr_total: 3000, mrr_firme: 1200, contratos: 3 },
    ]);

    expect(demanda.firme).toBeLessThanOrEqual(demanda.total);
    expect(demanda.total).toBe(3000);
  });
});

describe("celulasDeTcv — a quarta célula da matriz existe", () => {
  it("MRR de Sistemas e TCV de Sistemas convivem: as 4 células são independentes", () => {
    const mrr = celulasDeMrr([{ bu: "sistemas", mrr_total: 750, mrr_firme: 0, contratos: 1 }]);
    const tcv = celulasDeTcv([{ bu: "sistemas", tcv_total: 24637, projetos: 1 }]);

    expect(mrr[1]).toMatchObject({ linhaDeNegocio: "sistemas", total: 750 });
    expect(tcv[1]).toMatchObject({ linhaDeNegocio: "sistemas", total: 24637 });
  });

  it("preenche com zero a BU sem projeto", () => {
    const [demanda, sistemas] = celulasDeTcv(TCV_MEDIDO);

    expect(demanda).toEqual({ linhaDeNegocio: "demanda", total: 0, projetos: 0 });
    expect(sistemas).toEqual({ linhaDeNegocio: "sistemas", total: 9000, projetos: 1 });
  });
});

describe("linhasForaDaMatriz — dinheiro não some em silêncio", () => {
  it("não acusa nada quando só vêm as duas linhas conhecidas", () => {
    expect(linhasForaDaMatriz(MRR_MEDIDO)).toEqual([]);
    expect(linhasForaDaMatriz(TCV_MEDIDO)).toEqual([]);
  });

  it("acusa a BU que a matriz descartaria", () => {
    const fora = linhasForaDaMatriz([...MRR_MEDIDO, { bu: "compartilhado" }]);

    expect(fora).toEqual(["compartilhado"]);
  });

  it("não repete a mesma BU desconhecida duas vezes", () => {
    expect(linhasForaDaMatriz([{ bu: "compartilhado" }, { bu: "compartilhado" }])).toEqual([
      "compartilhado",
    ]);
  });
});

describe("linhasDeFaturamento — três medidas, ordem do catálogo", () => {
  it("ordena pelas frentes do catálogo, não pela ordem do banco", () => {
    expect(linhasDeFaturamento(FRENTES_MEDIDAS).map((l) => l.frente)).toEqual([
      "trafego",
      "sistemas",
    ]);
  });

  it("mantém as três medidas separadas, com os nomes que dizem a grandeza", () => {
    const [trafego] = linhasDeFaturamento(FRENTES_MEDIDAS);

    expect(trafego).toEqual({
      frente: "trafego",
      linhaDeNegocio: "demanda",
      mrrMensal: 1000,
      tcvTotal: 0,
      caixaMes: 1000,
    });
  });

  it("a frente de projeto tem TCV alto e caixa menor — são grandezas diferentes", () => {
    const sistemas = linhasDeFaturamento(FRENTES_MEDIDAS).find((l) => l.frente === "sistemas");

    expect(sistemas?.tcvTotal).toBe(9000);
    expect(sistemas?.caixaMes).toBe(3000);
  });

  it("não inventa linha para frente sem contrato", () => {
    expect(linhasDeFaturamento(FRENTES_MEDIDAS)).toHaveLength(2);
  });

  it("trata nulo do banco como zero", () => {
    const [linha] = linhasDeFaturamento([
      { front: "comercial", bu: "demanda", mrr_mensal: null, tcv_total: null, caixa_mes: null },
    ]);

    expect(linha).toMatchObject({ mrrMensal: 0, tcvTotal: 0, caixaMes: 0 });
  });
});

describe("totalDeCaixa — a única soma autorizada", () => {
  it("soma o caixa do mês entre frentes", () => {
    expect(totalDeCaixa(linhasDeFaturamento(FRENTES_MEDIDAS))).toBe(4000);
  });

  it("o total NÃO é a soma de mrrMensal com tcvTotal", () => {
    const linhas = linhasDeFaturamento(FRENTES_MEDIDAS);
    const somaProibida = linhas.reduce((s, l) => s + l.mrrMensal + l.tcvTotal, 0);

    expect(somaProibida).toBe(10000);
    expect(totalDeCaixa(linhas)).toBe(4000);
    expect(totalDeCaixa(linhas)).not.toBe(somaProibida);
  });

  it("lista vazia soma zero", () => {
    expect(totalDeCaixa([])).toBe(0);
  });
});

describe("LINHAS_DA_MATRIZ", () => {
  it("são exatamente as duas que a constraint do banco permite em contracts", () => {
    expect(LINHAS_DA_MATRIZ).toEqual(["demanda", "sistemas"]);
  });
});
