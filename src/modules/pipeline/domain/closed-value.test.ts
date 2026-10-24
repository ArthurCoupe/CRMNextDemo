import { describe, expect, it } from "vitest";

import { partesDoValorFechado, temValorFechado } from "./closed-value";

const semNbsp = (partes: readonly string[]) => partes.map((p) => p.normalize("NFKC"));

describe("partesDoValorFechado — as duas grandezas nunca viram uma", () => {
  it("o cenário que motivou a migration 20260801173936", () => {
    const partes = partesDoValorFechado({ mrr: 2000, tcv: 30000 });

    expect(semNbsp(partes)).toEqual(["R$ 2.000,00/mês", "R$ 30.000,00"]);

    expect(partes.join(" ")).not.toContain("32.000");
  });

  it("o sufixo /mês só no MRR — é o que distingue fluxo de estoque na tela", () => {
    expect(semNbsp(partesDoValorFechado({ mrr: 2000, tcv: null }))).toEqual(["R$ 2.000,00/mês"]);
    expect(semNbsp(partesDoValorFechado({ mrr: null, tcv: 30000 }))).toEqual(["R$ 30.000,00"]);
  });

  it("zero não é parcela — o trigger grava 0, não nulo, para o tipo ausente", () => {
    expect(semNbsp(partesDoValorFechado({ mrr: 2000, tcv: 0 }))).toEqual(["R$ 2.000,00/mês"]);
    expect(semNbsp(partesDoValorFechado({ mrr: 0, tcv: 30000 }))).toEqual(["R$ 30.000,00"]);
    expect(partesDoValorFechado({ mrr: 0, tcv: 0 })).toEqual([]);
  });

  it("oportunidade sem contrato registrado não devolve parcela nenhuma", () => {
    expect(partesDoValorFechado({ mrr: null, tcv: null })).toEqual([]);
  });

  it("centavos passam por brl(), sem formatação manual (§4.4)", () => {
    expect(semNbsp(partesDoValorFechado({ mrr: 1234.5, tcv: null }))).toEqual(["R$ 1.234,50/mês"]);
  });
});

describe("temValorFechado", () => {
  it("distingue 'fechou e registrou' de 'fechou e o contrato não entrou'", () => {
    expect(temValorFechado({ mrr: 2000, tcv: null })).toBe(true);
    expect(temValorFechado({ mrr: null, tcv: 30000 })).toBe(true);
    expect(temValorFechado({ mrr: null, tcv: null })).toBe(false);
    expect(temValorFechado({ mrr: 0, tcv: 0 })).toBe(false);
  });
});
