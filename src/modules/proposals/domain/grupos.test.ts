import { describe, expect, it } from "vitest";

import type { ProdutoDecomponivel } from "@/modules/contracts/domain/items";

import {
  agruparParaContratos,
  contratoInicialDoGrupo,
  ROTULO_DA_FORMA_DE_PAGAMENTO,
  rotuloDoGrupo,
  type ItemDaProposta,
} from "./grupos";

describe("ROTULO_DA_FORMA_DE_PAGAMENTO", () => {
  it("o texto que o PDF e o editor mostram para cada meio", () => {
    expect(ROTULO_DA_FORMA_DE_PAGAMENTO).toEqual({
      transferencia: "Transferência",
      pix: "Pix",
      credito: "Cartão de crédito",
    });
  });
});

const AVULSOS: ProdutoDecomponivel[] = [
  { id: "pos", frente: "posicionamento", preco: 1197, frentesDoCombo: null },
  { id: "tra", frente: "trafego", preco: 797, frentesDoCombo: null },
  { id: "com", frente: "comercial", preco: 1197, frentesDoCombo: null },
];

function item(parcial: Partial<ItemDaProposta> & Pick<ItemDaProposta, "id">): ItemDaProposta {
  return {
    produtoId: "tra",
    nome: "Tráfego",
    descricao: null,
    frente: "trafego",
    frentesDoCombo: null,
    linhaDeNegocio: "demanda",
    tipo: "mrr",
    precoCatalogo: 797,
    valor: 797,
    ordem: 1,
    contratoId: null,
    ...parcial,
  };
}

const COMBO = item({
  id: "combo",
  produtoId: "combo-3",
  nome: "Combo 3 Frentes",
  frente: "posicionamento",
  frentesDoCombo: ["posicionamento", "trafego", "comercial"],
  precoCatalogo: 3193,
  valor: 3000,
});

describe("agruparParaContratos", () => {
  it("ordem fixa: Demanda mensal, Demanda projeto, Sistemas mensal, Sistemas projeto", () => {
    const grupos = agruparParaContratos(
      [
        item({
          id: "s",
          produtoId: "sis",
          frente: "sistemas",
          linhaDeNegocio: "sistemas",
          tipo: "tcv",
          valor: 5000,
        }),
        item({ id: "m", valor: 700 }),
        item({ id: "p", produtoId: "pos", frente: "posicionamento", tipo: "tcv", valor: 2000 }),
      ],
      AVULSOS,
    );
    expect(grupos.map(rotuloDoGrupo)).toEqual([
      "Demanda mensal",
      "Demanda projeto",
      "Sistemas projeto",
    ]);
  });

  it("ordem fixa com os quatro grupos presentes, vindos fora de ordem", () => {
    const grupos = agruparParaContratos(
      [
        item({ id: "st", frente: "sistemas", linhaDeNegocio: "sistemas", tipo: "tcv" }),
        item({ id: "sm", frente: "sistemas", linhaDeNegocio: "sistemas", tipo: "mrr" }),
        item({ id: "dt", tipo: "tcv" }),
        item({ id: "dm" }),
      ],
      AVULSOS,
    );
    expect(grupos.map(rotuloDoGrupo)).toEqual([
      "Demanda mensal",
      "Demanda projeto",
      "Sistemas mensal",
      "Sistemas projeto",
    ]);
  });

  it("produto com lista de frentes do combo vazia é avulso, não combo", () => {
    const [grupo] = agruparParaContratos([item({ id: "a", frentesDoCombo: [] })], AVULSOS);
    expect(grupo!.itens).toEqual([{ frente: "trafego", produtoId: "tra", valor: 797 }]);
    expect(grupo!.frentesSemPreco).toEqual([]);
  });

  it("item ja ligado a contrato fica fora; tudo ligado devolve nada", () => {
    expect(agruparParaContratos([item({ id: "m", contratoId: "k1" })], AVULSOS)).toEqual([]);
  });

  it("mesma frente soma em centavos; produto mantido se for um so", () => {
    const [grupo] = agruparParaContratos(
      [item({ id: "a", valor: 100.1 }), item({ id: "b", valor: 200.2 })],
      AVULSOS,
    );
    expect(grupo!.valor).toBe(300.3);
    expect(grupo!.itens).toEqual([{ frente: "trafego", produtoId: "tra", valor: 300.3 }]);
  });

  it("mesma frente de produtos diferentes: produto vira nulo", () => {
    const [grupo] = agruparParaContratos(
      [item({ id: "a", valor: 100 }), item({ id: "b", produtoId: "outro", valor: 50 })],
      AVULSOS,
    );
    expect(grupo!.itens).toEqual([{ frente: "trafego", produtoId: null, valor: 150 }]);
  });

  it("combo e rateado sobre o valor PRATICADO e a soma fecha", () => {
    const [grupo] = agruparParaContratos([COMBO], AVULSOS);
    expect(grupo!.valor).toBe(3000);
    expect(grupo!.itens).toEqual([
      { frente: "posicionamento", produtoId: null, valor: 1125.36 },
      { frente: "trafego", produtoId: null, valor: 749.29 },
      { frente: "comercial", produtoId: null, valor: 1125.35 },
    ]);
    expect(grupo!.frentesSemPreco).toEqual([]);
  });

  it("combo + avulso da mesma frente: frente somada, produto nulo, total 3700", () => {
    const [grupo] = agruparParaContratos([COMBO, item({ id: "t", valor: 700 })], AVULSOS);
    expect(grupo!.valor).toBe(3700);
    expect(grupo!.itens.find((i) => i.frente === "trafego")).toEqual({
      frente: "trafego",
      produtoId: null,
      valor: 1449.29,
    });
    const soma = grupo!.itens.reduce((s, i) => s + Math.round(i.valor * 100), 0) / 100;
    expect(soma).toBe(3700);
  });

  it("Review Focus 4: avulso de Tráfego inativo → itens do combo zerados e a frente nomeada", () => {
    const semTrafego = AVULSOS.filter((p) => p.frente !== "trafego");
    const [grupo] = agruparParaContratos([COMBO], semTrafego);
    expect(grupo!.valor).toBe(3000);
    expect(grupo!.itens.map((i) => i.valor)).toEqual([0, 0, 0]);
    expect(grupo!.frentesSemPreco).toEqual(["trafego"]);
  });

  it("combo com todos os avulsos a preco zero: nao lanca, itens zerados e as frentes nomeadas", () => {
    const aZero = AVULSOS.map((p) => ({ ...p, preco: 0 }));
    const [grupo] = agruparParaContratos([COMBO], aZero);
    expect(grupo!.valor).toBe(3000);
    expect(grupo!.itens).toEqual([
      { frente: "posicionamento", produtoId: null, valor: 0 },
      { frente: "trafego", produtoId: null, valor: 0 },
      { frente: "comercial", produtoId: null, valor: 0 },
    ]);
    expect(grupo!.frentesSemPreco).toEqual(["posicionamento", "trafego", "comercial"]);
  });

  it("controle: um avulso a preco zero e os outros com preco rateia normalmente", () => {
    const trafegoAZero = AVULSOS.map((p) => (p.frente === "trafego" ? { ...p, preco: 0 } : p));
    const [grupo] = agruparParaContratos([COMBO], trafegoAZero);
    expect(grupo!.itens).toEqual([
      { frente: "posicionamento", produtoId: null, valor: 1500 },
      { frente: "trafego", produtoId: null, valor: 0 },
      { frente: "comercial", produtoId: null, valor: 1500 },
    ]);
    expect(grupo!.frentesSemPreco).toEqual([]);
  });
});

describe("contratoInicialDoGrupo", () => {
  const CONDICOES = {
    formaPagamento: "pix",
    parcelasProjeto: 3,
    fidelidadeMeses: 12,
    prazoEntregaDias: 30,
  } as const;

  it("mensal leva fidelidade; nao leva parcelas nem prazo", () => {
    const [grupo] = agruparParaContratos([item({ id: "m", valor: 900 })], AVULSOS);
    expect(contratoInicialDoGrupo(grupo!, CONDICOES, "Acme")).toEqual({
      nome: "Acme · Demanda mensal",
      tipo: "mrr",
      linhaDeNegocio: "demanda",
      valor: 900,
      itens: [{ frente: "trafego", produtoId: "tra", valor: 900 }],
      frentesSemPreco: [],
      mesesDeCobranca: null,
      mesesDeFidelidade: 12,
      meioDePagamento: "pix",
      prazoDeEntregaDias: null,
    });
  });

  it("projeto leva parcelas e prazo; nao leva fidelidade", () => {
    const [grupo] = agruparParaContratos(
      [
        item({
          id: "s",
          produtoId: "sis",
          frente: "sistemas",
          linhaDeNegocio: "sistemas",
          tipo: "tcv",
          valor: 4500,
        }),
      ],
      AVULSOS,
    );
    const inicial = contratoInicialDoGrupo(grupo!, CONDICOES, "Acme");
    expect(inicial.nome).toBe("Acme · Sistemas projeto");
    expect(inicial.mesesDeCobranca).toBe(3);
    expect(inicial.prazoDeEntregaDias).toBe(30);
    expect(inicial.mesesDeFidelidade).toBeNull();
  });
});
