import { describe, expect, it } from "vitest";

import {
  brutoDoMes,
  calcularLiquido,
  interpretarPercentual,
  parcelasParaGravar,
  percentualVariavel,
  type BaseDoLiquido,
  type ConfiguracaoFiscal,
  type TabelaDeParcelamento,
  type TaxasDoMeio,
} from "./fiscal";

const CONFIG: ConfiguracaoFiscal = {
  aliquotaPct: 6,
  provisoria: false,
  fonte: "Tabela de exemplo",
};

const TABELA: TabelaDeParcelamento = new Map([
  [1, 3.3],
  [2, 4.1],
  [3, 4.9],
  [4, 5.7],
  [5, 6.5],
  [6, 7.3],
  [7, 8.1],
  [8, 8.9],
  [9, 9.7],
  [10, 10.5],
  [11, 11.3],
  [12, 12.1],
]);

const PIX: TaxasDoMeio = {
  meio: "pix",
  taxaFixa: 1.0,
  percentualVariavel: 0.99,
  parcelavel: false,
  liquidacao: "D+0",
};
const CREDITO: TaxasDoMeio = {
  meio: "credito",
  taxaFixa: 2.0,
  percentualVariavel: 0,
  parcelavel: true,
  liquidacao: "D+1",
};
const TRANSFERENCIA: TaxasDoMeio = {
  meio: "transferencia",
  taxaFixa: 0,
  percentualVariavel: 0,
  parcelavel: false,
  liquidacao: "D+0",
};

const mrr = (
  valor: number,
  meio: BaseDoLiquido["meioDePagamento"],
  parcelas: number | null = null,
): BaseDoLiquido => ({
  tipo: "mrr",
  valorMensal: valor,
  valorTotal: null,
  mesesDeCobranca: null,
  meioDePagamento: meio,
  parcelas,
});

const tcv = (
  total: number,
  meses: number,
  meio: BaseDoLiquido["meioDePagamento"],
  parcelas: number | null = null,
): BaseDoLiquido => ({
  tipo: "tcv",
  valorMensal: null,
  valorTotal: total,
  mesesDeCobranca: meses,
  meioDePagamento: meio,
  parcelas,
});

const CASOS: ReadonlyArray<{
  nome: string;
  base: BaseDoLiquido;
  taxas: TaxasDoMeio;
  view: {
    bruto: number;
    imposto: number;
    taxaVariavel: number;
    taxaFixa: number;
    liquido: number;
    pct: number;
  };
}> = [
  {
    nome: "1 · TCV 12.000 em 3x no crédito — critério de aceite do prompt",
    base: tcv(12000, 3, "credito", 3),
    taxas: CREDITO,
    view: {
      bruto: 4000,
      imposto: 240,
      taxaVariavel: 196,
      taxaFixa: 2,
      liquido: 3562,
      pct: 4.9,
    },
  },
  {
    nome: "2 · MRR 2.000 no Pix — critério de aceite do prompt",
    base: mrr(2000, "pix"),
    taxas: PIX,
    view: {
      bruto: 2000,
      imposto: 120,
      taxaVariavel: 19.8,
      taxaFixa: 1,
      liquido: 1859.2,
      pct: 0.99,
    },
  },
  {
    nome: "3 · TCV 12.327 em 10x no crédito",
    base: tcv(12327, 10, "credito", 10),
    taxas: CREDITO,
    view: {
      bruto: 1232.7,
      imposto: 73.96,
      taxaVariavel: 129.43,
      taxaFixa: 2,
      liquido: 1027.31,
      pct: 10.5,
    },
  },
  {
    nome: "4 · MRR 1.000 por transferência — sem taxa nenhuma",
    base: mrr(1000, "transferencia"),
    taxas: TRANSFERENCIA,
    view: { bruto: 1000, imposto: 60, taxaVariavel: 0, taxaFixa: 0, liquido: 940, pct: 0 },
  },
  {
    nome: "5 · TCV 9.000 em 3 meses por transferência",
    base: tcv(9000, 3, "transferencia"),
    taxas: TRANSFERENCIA,
    view: { bruto: 3000, imposto: 180, taxaVariavel: 0, taxaFixa: 0, liquido: 2820, pct: 0 },
  },
  {
    nome: "6 · MRR 4.400 em 12x — a taxa mais cara da tabela",
    base: mrr(4400, "credito", 12),
    taxas: CREDITO,
    view: {
      bruto: 4400,
      imposto: 264,
      taxaVariavel: 532.4,
      taxaFixa: 2,
      liquido: 3601.6,
      pct: 12.1,
    },
  },
  {
    nome: "7 · TCV 10.000 em 7 meses, 7x — o bruto tem dízima (1.428,571…)",
    base: tcv(10000, 7, "credito", 7),
    taxas: CREDITO,
    view: {
      bruto: 1428.57,
      imposto: 85.71,
      taxaVariavel: 115.71,
      taxaFixa: 2,
      liquido: 1225.15,
      pct: 8.1,
    },
  },
  {
    nome: "8 · MRR 1.837,45 por transferência — imposto com meio centavo",
    base: mrr(1837.45, "transferencia"),
    taxas: TRANSFERENCIA,
    view: {
      bruto: 1837.45,
      imposto: 110.25,
      taxaVariavel: 0,
      taxaFixa: 0,
      liquido: 1727.2,
      pct: 0,
    },
  },
  {
    nome: "9 · TCV 60.001 em 6 meses, 6x — dízima no bruto (10.000,1666…)",
    base: tcv(60001, 6, "credito", 6),
    taxas: CREDITO,
    view: {
      bruto: 10000.17,
      imposto: 600.01,
      taxaVariavel: 730.01,
      taxaFixa: 2,
      liquido: 8668.15,
      pct: 7.3,
    },
  },
  {
    nome: "10 · MRR 1.750 no Pix — meio centavo na taxa arredonda para cima",
    base: mrr(1750, "pix"),
    taxas: PIX,
    view: {
      bruto: 1750,
      imposto: 105,
      taxaVariavel: 17.33,
      taxaFixa: 1,
      liquido: 1626.67,
      pct: 0.99,
    },
  },
];

describe("paridade com private.v_net_revenue — 10 casos medidos contra o banco", () => {
  for (const caso of CASOS) {
    it(caso.nome, () => {
      const r = calcularLiquido(caso.base, CONFIG, caso.taxas, TABELA);

      expect(r).not.toBeNull();
      expect(r?.bruto).toBe(caso.view.bruto);
      expect(r?.imposto).toBe(caso.view.imposto);
      expect(r?.taxaVariavel).toBe(caso.view.taxaVariavel);
      expect(r?.taxaFixa).toBe(caso.view.taxaFixa);
      expect(r?.liquido).toBe(caso.view.liquido);
      expect(r?.percentualVariavel).toBe(caso.view.pct);
    });
  }

  it("o líquido é sempre bruto menos as três deduções, em todos os 10", () => {
    for (const caso of CASOS) {
      const r = calcularLiquido(caso.base, CONFIG, caso.taxas, TABELA);
      const soma = Math.round((r!.imposto + r!.taxaVariavel + r!.taxaFixa + r!.liquido) * 100);
      expect(soma).toBe(Math.round(r!.bruto * 100));
    }
  });
});

describe("🔴 C3 — participação NÃO é dedução de receita", () => {
  it("o resultado não tem campo de participação nem de comissão", () => {
    const r = calcularLiquido(tcv(12000, 3, "credito", 3), CONFIG, CREDITO, TABELA);

    expect(Object.keys(r!).sort()).toEqual(
      [
        "bruto",
        "imposto",
        "liquido",
        "percentualDeDeducao",
        "percentualVariavel",
        "taxaFixa",
        "taxaVariavel",
      ].sort(),
    );
  });

  it("a função não tem como saber se o contrato é comissionável", () => {
    const base = tcv(10000, 5, "credito", 5);

    expect(Object.keys(base).sort()).toEqual(
      [
        "meioDePagamento",
        "mesesDeCobranca",
        "parcelas",
        "tipo",
        "valorMensal",
        "valorTotal",
      ].sort(),
    );
    expect(Object.keys(base)).not.toContain("comissionavel");
    expect(Object.keys(base)).not.toContain("participacoes");
  });

  it("as taxas que entram na conta são só imposto e gateway — nenhuma de pessoa", () => {
    const r = calcularLiquido(tcv(10000, 5, "credito", 5), CONFIG, CREDITO, TABELA)!;
    const deducoes = Math.round((r.bruto - r.liquido) * 100);
    const somaDasTres = Math.round((r.imposto + r.taxaVariavel + r.taxaFixa) * 100);

    expect(deducoes).toBe(somaDasTres);
  });
});

describe("brutoDoMes — null propaga em vez de virar zero", () => {
  it("MRR sem valor mensal é null", () => {
    expect(brutoDoMes({ ...mrr(0, "pix"), valorMensal: null })).toBeNull();
  });

  it("TCV sem meses de cobrança é null", () => {
    expect(brutoDoMes({ ...tcv(12000, 3, "pix"), mesesDeCobranca: null })).toBeNull();
  });

  it("TCV com zero meses é null, não divisão por zero", () => {
    expect(brutoDoMes({ ...tcv(12000, 3, "pix"), mesesDeCobranca: 0 })).toBeNull();
  });

  it("zero seria um número, e afirmaria que o contrato não gera caixa", () => {
    expect(brutoDoMes({ ...tcv(12000, 3, "pix"), mesesDeCobranca: null })).not.toBe(0);
  });
});

describe("percentualVariavel — a regra que mais confunde", () => {
  it("no crédito vem da tabela de parcelas, não do meio", () => {
    expect(percentualVariavel(tcv(12000, 3, "credito", 12), CREDITO, TABELA)).toBe(12.1);
  });

  it("fora do crédito vem do próprio meio", () => {
    expect(percentualVariavel(mrr(2000, "pix"), PIX, TABELA)).toBe(0.99);
    expect(percentualVariavel(mrr(2000, "transferencia"), TRANSFERENCIA, TABELA)).toBe(0);
  });

  it("crédito sem parcelas declaradas cai em 1x, igual à view", () => {
    expect(percentualVariavel(mrr(2000, "credito", null), CREDITO, TABELA)).toBe(3.3);
  });

  it("parcelas fora da tabela devolvem null, não zero", () => {
    expect(percentualVariavel(mrr(2000, "credito", 24), CREDITO, TABELA)).toBeNull();
    expect(calcularLiquido(mrr(2000, "credito", 24), CONFIG, CREDITO, TABELA)).toBeNull();
  });
});

describe("percentualDeDeducao — para negociar parcelamento sabendo o custo", () => {
  it("12x deduz mais que 1x, e a diferença é a razão de o simulador existir", () => {
    const umaVez = calcularLiquido(mrr(10000, "credito", 1), CONFIG, CREDITO, TABELA);
    const dozeVezes = calcularLiquido(mrr(10000, "credito", 12), CONFIG, CREDITO, TABELA);

    expect(umaVez!.percentualDeDeducao).toBeLessThan(dozeVezes!.percentualDeDeducao);

    expect(dozeVezes!.percentualDeDeducao).toBe(18.12);
    expect(umaVez!.percentualDeDeducao).toBe(9.32);
  });
});

describe("interpretarPercentual — campo vazio NÃO é zero", () => {
  it("🔴 string vazia é null, não 0", () => {
    expect(interpretarPercentual("")).toBeNull();
  });

  it("só espaços também é null", () => {
    expect(interpretarPercentual("   ")).toBeNull();
  });

  it("zero DIGITADO é aceito — isso é decisão, não ausência", () => {
    expect(interpretarPercentual("0")).toBe(0);
  });

  it("aceita vírgula como separador decimal", () => {
    expect(interpretarPercentual("12,35")).toBe(12.35);
    expect(interpretarPercentual("12.35")).toBe(12.35);
  });

  it("ignora espaço em volta", () => {
    expect(interpretarPercentual("  6  ")).toBe(6);
  });

  it("negativo é null — taxa negativa inflaria o líquido", () => {
    expect(interpretarPercentual("-1")).toBeNull();
  });

  it("texto que não é número é null", () => {
    expect(interpretarPercentual("abc")).toBeNull();
    expect(interpretarPercentual("6%")).toBeNull();
  });
});

describe("parcelasParaGravar — a tela lembra, o payload decide", () => {
  it("🔴 no crédito preserva o número escolhido", () => {
    expect(parcelasParaGravar("credito", 10)).toBe(10);
  });

  it("fora do crédito grava null, mesmo com número no rascunho", () => {
    expect(parcelasParaGravar("pix", 10)).toBeNull();
    expect(parcelasParaGravar("transferencia", 10)).toBeNull();
  });

  it("a ida e volta preserva 10x — o defeito que isto conserta", () => {
    const rascunhoApos = 10;
    expect(parcelasParaGravar("credito", rascunhoApos)).toBe(10);
  });
});

const TAXAS_EM_USO = [
  3.3, 4.1, 4.9, 5.7, 6.5, 7.3, 8.1, 8.9, 9.7, 10.5, 11.3, 12.1, 12.29, 6.0, 0.99,
];

function referenciaExata(centavos: number, pct: number): number {
  const num = BigInt(centavos) * BigInt(Math.round(pct * 100));
  const div = 10000n;
  const q = num / div;
  const r = num % div;
  return Number(r * 2n >= div ? q + 1n : q);
}

describe("paridade de arredondamento — varredura, não amostra", () => {
  it("bate com o decimal exato em 12,29% no ponto onde o float errava", () => {
    const tabela = new Map([[7, 12.29]]);
    const r50 = calcularLiquido(mrr(50, "credito", 7), CONFIG, CREDITO, tabela);
    const r1450 = calcularLiquido(mrr(1450, "credito", 7), CONFIG, CREDITO, tabela);

    expect(r50?.taxaVariavel).toBe(6.15);
    expect(r1450?.taxaVariavel).toBe(178.21);
  });

  it("bate com o decimal exato nas 15 taxas, de R$ 0,01 a R$ 10.000,00", () => {
    const divergencias: string[] = [];

    for (const pct of TAXAS_EM_USO) {
      for (let centavos = 1; centavos <= 1_000_000; centavos += 1) {
        const esperado = referenciaExata(centavos, pct);
        const obtido = Math.round(
          calcularLiquido(
            mrr(centavos / 100, "pix"),
            { ...CONFIG, aliquotaPct: pct },
            { ...PIX, taxaFixa: 0, percentualVariavel: 0 },
            TABELA,
          )!.imposto * 100,
        );
        if (obtido !== esperado) {
          divergencias.push(`pct ${pct} · centavos ${centavos}: ${obtido} ≠ ${esperado}`);
          break;
        }
      }
    }

    expect(divergencias).toEqual([]);
  });

  it("a soma das partes fecha o bruto, na mesma varredura", () => {
    for (let centavos = 1; centavos <= 200_000; centavos += 7) {
      const r = calcularLiquido(
        tcv(centavos / 100, 1, "credito", 7),
        CONFIG,
        { ...CREDITO, taxaFixa: 0 },
        TABELA,
      )!;
      const soma = Math.round((r.imposto + r.taxaVariavel + r.liquido) * 100);
      expect(soma).toBe(Math.round(r.bruto * 100));
    }
  });
});
