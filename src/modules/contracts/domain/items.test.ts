import { describe, expect, it } from "vitest";

import type { ItemDeContrato } from "./contract";
import {
  avisoDeFrenteSemPreco,
  decomporProduto,
  mensagemDeFrenteRepetida,
  ratearCombo,
  restanteAAlocar,
  somaFecha,
  somarItens,
  type FrenteComPreco,
  type ProdutoDecomponivel,
} from "./items";

const COMBO_3_FRENTES: FrenteComPreco[] = [
  { frente: "posicionamento", precoAvulso: 1197.0 },
  { frente: "comercial", precoAvulso: 1197.0 },
  { frente: "trafego", precoAvulso: 797.0 },
];

describe("ratearCombo — D-002", () => {
  it("Combo 3 Frentes a R$ 3.193,00 gera 1197,75 · 1197,75 · 797,50", () => {
    const itens = ratearCombo(COMBO_3_FRENTES, 3193.0);

    expect(itens).toEqual([
      { frente: "posicionamento", produtoId: null, valor: 1197.75 },
      { frente: "comercial", produtoId: null, valor: 1197.75 },
      { frente: "trafego", produtoId: null, valor: 797.5 },
    ]);
    expect(somarItens(itens)).toBe(3193.0);
  });

  it("o mesmo combo a R$ 3.000,00 gera resíduo de 1 centavo, e a soma fecha", () => {
    const itens = ratearCombo(COMBO_3_FRENTES, 3000.0);

    expect(somarItens(itens)).toBe(3000.0);
    expect(itens.map((i) => i.valor)).toEqual([1125.36, 1125.35, 749.29]);
  });

  it("o resíduo vai para a frente de maior preço", () => {
    const itens = ratearCombo(
      [
        { frente: "trafego", precoAvulso: 797.0 },
        { frente: "posicionamento", precoAvulso: 1197.0 },
      ],
      1000.0,
    );

    expect(somarItens(itens)).toBe(1000.0);
    expect(itens.map((i) => i.valor)).toEqual([399.7, 600.3]);
  });

  it("empate de preço é resolvido pela primeira frente da lista, de forma estável", () => {
    const umaOrdem = ratearCombo(COMBO_3_FRENTES, 3000.0);
    const outraOrdem = ratearCombo(
      [
        { frente: "comercial", precoAvulso: 1197.0 },
        { frente: "posicionamento", precoAvulso: 1197.0 },
        { frente: "trafego", precoAvulso: 797.0 },
      ],
      3000.0,
    );

    expect(umaOrdem[0]!.valor).toBe(1125.36);
    expect(umaOrdem[1]!.valor).toBe(1125.35);
    expect(outraOrdem[0]!.valor).toBe(1125.36);
    expect(outraOrdem[1]!.valor).toBe(1125.35);

    expect(ratearCombo(COMBO_3_FRENTES, 3000.0)).toEqual(umaOrdem);
  });

  it("frente única recebe o valor inteiro", () => {
    const itens = ratearCombo([{ frente: "sistemas", precoAvulso: 24637.0 }], 12327.0);
    expect(itens).toEqual([{ frente: "sistemas", produtoId: null, valor: 12327.0 }]);
  });

  it("preserva o produtoId de origem", () => {
    const itens = ratearCombo(
      [
        {
          frente: "trafego",
          precoAvulso: 797.0,
          produtoId: "4af60000-0000-4000-8000-000000000001",
        },
      ],
      797.0,
    );
    expect(itens[0]!.produtoId).toBe("4af60000-0000-4000-8000-000000000001");
  });

  it("valor com centavo ímpar continua fechando ao centavo", () => {
    for (const valor of [3193.01, 2999.99, 1000.01, 777.77, 0.03]) {
      expect(somarItens(ratearCombo(COMBO_3_FRENTES, valor))).toBe(valor);
    }
  });

  it("recusa lista vazia", () => {
    expect(() => ratearCombo([], 1000)).toThrow(/ao menos uma frente/);
  });

  it("recusa soma de preços zerada — não há proporção a calcular", () => {
    expect(() => ratearCombo([{ frente: "trafego", precoAvulso: 0 }], 1000)).toThrow(
      /maior que zero/,
    );
  });
});

describe("somarItens · restanteAAlocar · somaFecha", () => {
  const brief44: ItemDeContrato[] = [
    { frente: "posicionamento", valor: 1200.0 },
    { frente: "trafego", valor: 800.0 },
  ];

  it("brief §4.4 — 1.200 + 800 fecha em 2.000", () => {
    expect(somarItens(brief44)).toBe(2000.0);
    expect(restanteAAlocar(brief44, 2000.0)).toBe(0);
    expect(somaFecha(brief44, 2000.0)).toBe(true);
  });

  it("aponta quanto falta quando a soma não fecha", () => {
    const faltando: ItemDeContrato[] = [
      { frente: "posicionamento", valor: 1000.0 },
      { frente: "trafego", valor: 900.0 },
    ];
    expect(restanteAAlocar(faltando, 2000.0)).toBe(100.0);
    expect(somaFecha(faltando, 2000.0)).toBe(false);
  });

  it("aponta valor negativo quando passou do total", () => {
    const passou: ItemDeContrato[] = [{ frente: "trafego", valor: 2500.0 }];
    expect(restanteAAlocar(passou, 2000.0)).toBe(-500.0);
    expect(somaFecha(passou, 2000.0)).toBe(false);
  });

  it("não erra por ponto flutuante", () => {
    const centavos: ItemDeContrato[] = [
      { frente: "posicionamento", valor: 0.1 },
      { frente: "trafego", valor: 0.2 },
    ];
    expect(somarItens(centavos)).toBe(0.3);
    expect(somaFecha(centavos, 0.3)).toBe(true);
  });

  it("lista vazia soma zero e só fecha com contrato de valor zero", () => {
    expect(somarItens([])).toBe(0);
    expect(somaFecha([], 0)).toBe(true);
    expect(somaFecha([], 100)).toBe(false);
  });
});

describe("mensagemDeFrenteRepetida", () => {
  it("nomeia a frente que aparece duas vezes, e diz as duas saídas", () => {
    const itens: ItemDeContrato[] = [
      { frente: "trafego", valor: 1000.0 },
      { frente: "posicionamento", valor: 500.0 },
      { frente: "trafego", valor: 500.0 },
    ];

    expect(mensagemDeFrenteRepetida(itens)).toBe(
      "A frente Tráfego aparece em duas linhas deste contrato. " +
        "Junte os dois valores numa linha só, ou troque uma delas por outra frente.",
    );
  });

  it("a frente nomeada é a repetida, não a primeira da lista", () => {
    const itens: ItemDeContrato[] = [
      { frente: "trafego", valor: 1000.0 },
      { frente: "posicionamento", valor: 500.0 },
      { frente: "posicionamento", valor: 500.0 },
    ];

    const frase = mensagemDeFrenteRepetida(itens);
    expect(frase).toContain("A frente Posicionamento aparece em duas linhas");
    expect(frase).not.toContain("Tráfego");
  });

  it("sem repetição na lista, não inventa frente — a frase fica genérica", () => {
    const itens: ItemDeContrato[] = [
      { frente: "trafego", valor: 1000.0 },
      { frente: "posicionamento", valor: 500.0 },
    ];

    expect(mensagemDeFrenteRepetida(itens)).toBe(
      "Duas linhas deste contrato usam a mesma frente. " +
        "Junte os dois valores numa linha só, ou troque uma delas por outra frente.",
    );
  });
});

describe("decomporProduto — FECH-4: combo só rateia com avulso ativo em TODAS as frentes", () => {
  const COMBO: ProdutoDecomponivel = {
    id: "combo",
    frente: "posicionamento",
    preco: 3193.0,
    frentesDoCombo: ["posicionamento", "comercial", "trafego"],
  };
  const POSICIONAMENTO: ProdutoDecomponivel = {
    id: "pos",
    frente: "posicionamento",
    preco: 1197.0,
    frentesDoCombo: null,
  };
  const COMERCIAL: ProdutoDecomponivel = {
    id: "com",
    frente: "comercial",
    preco: 1197.0,
    frentesDoCombo: null,
  };
  const TRAFEGO: ProdutoDecomponivel = {
    id: "tra",
    frente: "trafego",
    preco: 797.0,
    frentesDoCombo: null,
  };

  it("avulso: um item com o preço e o produtoId dele", () => {
    expect(decomporProduto(TRAFEGO, [TRAFEGO, COMBO])).toEqual({
      itens: [{ frente: "trafego", produtoId: "tra", valor: 797.0 }],
      semPreco: [],
    });
  });

  it("combo com os três avulsos: o rateio da D-002, sem frente sem preço", () => {
    const { itens, semPreco } = decomporProduto(COMBO, [COMBO, POSICIONAMENTO, COMERCIAL, TRAFEGO]);
    expect(semPreco).toEqual([]);
    expect(itens.map((i) => i.valor)).toEqual([1197.75, 1197.75, 797.5]);
  });

  it("🔴 Tráfego sem avulso ativo: NÃO rateia com peso 1 — itens zerados e a frente nomeada", () => {
    const { itens, semPreco } = decomporProduto(COMBO, [COMBO, POSICIONAMENTO, COMERCIAL]);
    expect(semPreco).toEqual(["trafego"]);
    expect(itens).toEqual([
      { frente: "posicionamento", produtoId: null, valor: 0 },
      { frente: "comercial", produtoId: null, valor: 0 },
      { frente: "trafego", produtoId: null, valor: 0 },
    ]);
    expect(itens.map((i) => i.valor)).not.toContain(1.33);
  });

  it("outro combo no catálogo não serve de preço avulso para a frente", () => {
    const OUTRO_COMBO: ProdutoDecomponivel = {
      id: "combo-2",
      frente: "trafego",
      preco: 1500.0,
      frentesDoCombo: ["trafego", "comercial"],
    };
    expect(
      decomporProduto(COMBO, [COMBO, OUTRO_COMBO, POSICIONAMENTO, COMERCIAL]).semPreco,
    ).toEqual(["trafego"]);
  });

  it("a frase nomeia a frente, no singular e no plural", () => {
    expect(avisoDeFrenteSemPreco(["trafego"])).toBe(
      "Frente Tráfego sem preço de tabela ativo. Ative o produto no catálogo ou informe a decomposição.",
    );
    expect(avisoDeFrenteSemPreco(["trafego", "comercial"])).toBe(
      "Frentes Tráfego, Comercial sem preço de tabela ativo. Ative os produtos no catálogo ou informe a decomposição.",
    );
  });
});
