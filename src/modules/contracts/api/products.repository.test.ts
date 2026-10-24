import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

import type { EntradaDeProduto } from "./products.repository";

let resposta: RespostaFalsa = UMA_LINHA;

const chamadas: ChamadaRegistrada[] = [];

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  return {
    supabaseV2: clienteFalso(
      () => resposta,
      (chamada) => chamadas.push(chamada),
    ),
  };
});

const { apagarProduto, salvarProduto, definirSituacaoDoProduto } =
  await import("./products.repository");

const PRODUTO = "7c2e9a41-5d08-4b3f-9e61-8a0d3f5c2b74";

const EDICAO: EntradaDeProduto = {
  id: PRODUTO,
  nome: "Gestão de Tráfego",
  descricao: "Campanhas e otimização mensal.",
  frente: "trafego",
  linhaDeNegocio: "demanda",
  tipo: "mrr",
  preco: 4500,
};

const RECUSA = "Nada foi alterado: só o owner edita produtos.";

const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
  {
    nome: "salvarProduto",
    chamar: () => salvarProduto(EDICAO),
    recusa: RECUSA,
  },
  {
    nome: "definirSituacaoDoProduto",
    chamar: () => definirSituacaoDoProduto(PRODUTO, false),
    recusa: RECUSA,
  },
  {
    nome: "apagarProduto",
    chamar: () => apagarProduto(PRODUTO),
    recusa: "Só o owner apaga produto.",
  },
];

describe("write barrado pela RLS volta zero linha, e o repositório recusa com a mensagem certa", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
  });

  for (const write of WRITES) {
    it(`${write.nome} lança quando a RLS devolve lista vazia`, async () => {
      resposta = ZERO_LINHAS;

      await expect(write.chamar()).rejects.toThrow(write.recusa);
    });

    it(`${write.nome} lança igual quando o PostgREST devolve data null`, async () => {
      resposta = NENHUM_DADO;

      await expect(write.chamar()).rejects.toThrow(write.recusa);
    });

    it(`${write.nome} passa quando a linha volta — o positivo ao lado do negativo`, async () => {
      resposta = UMA_LINHA;

      await expect(write.chamar()).resolves.toBeUndefined();
    });
  }
});

describe("apagarProduto: produto em contrato não se apaga", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
  });

  it("🔴 o 23503 do FK chega com a frase de desativar e o code preservado", async () => {
    resposta = {
      data: null,
      error: {
        message:
          'update or delete on table "products" violates foreign key constraint "contract_items_product_id_fkey" on table "contract_items"',
        code: "23503",
      },
    };

    const erro: unknown = await apagarProduto(PRODUTO).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({
      code: "23503",
      message:
        "Este produto já foi usado em contrato e não pode ser apagado. Desative em vez de apagar.",
    });
  });

  it("outro erro do banco passa por erroDoBanco com a mensagem dele, não a de contrato", async () => {
    resposta = {
      data: null,
      error: { message: "permission denied for table products", code: "42501" },
    };

    const erro: unknown = await apagarProduto(PRODUTO).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({ code: "42501", message: "permission denied for table products" });
  });
});

describe("salvarProduto: ordem e frentes do combo só vão quando vêm (A2.3)", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas.length = 0;
  });

  it("edição com ordem e frentes do combo manda sort_order e combo_fronts", async () => {
    await salvarProduto({ ...EDICAO, ordem: 4, frentesDoCombo: ["posicionamento", "comercial"] });

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toMatchObject({
      sort_order: 4,
      combo_fronts: ["posicionamento", "comercial"],
    });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["id", PRODUTO] });
  });

  it("🔴 edição sem os dois campos não mexe neles: avulso nunca ganha combo_fronts", async () => {
    await salvarProduto(EDICAO);

    const payload = chamadas.find((c) => c.metodo === "update")?.args[0];
    expect(payload).not.toHaveProperty("combo_fronts");
    expect(payload).not.toHaveProperty("sort_order");
    expect(payload).toMatchObject({ name: "Gestão de Tráfego", price: 4500 });
  });

  it("🔴 ordem 0 grava sort_order 0: zero não vira null nem some do payload", async () => {
    await salvarProduto({ ...EDICAO, ordem: 0 });

    const payload = chamadas.find((c) => c.metodo === "update")?.args[0];
    expect(payload).toHaveProperty("sort_order", 0);
  });
});

describe("salvarProduto: frentes do combo inválidas não chegam ao banco", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas.length = 0;
  });

  it("🔴 frente de outra linha de negócio recusa sem chamar o update", async () => {
    await expect(
      salvarProduto({ ...EDICAO, frentesDoCombo: ["posicionamento", "sistemas"] }),
    ).rejects.toThrow("Sistemas não é da linha Demanda: o contrato recusaria o item.");

    expect(chamadas.some((c) => c.metodo === "update")).toBe(false);
  });

  it("🔴 combo vazio recusa sem chamar o update", async () => {
    await expect(salvarProduto({ ...EDICAO, frentesDoCombo: [] })).rejects.toThrow(
      "Marque pelo menos uma frente do combo.",
    );

    expect(chamadas.some((c) => c.metodo === "update")).toBe(false);
  });

  it("o positivo ao lado: combo da mesma linha grava", async () => {
    await expect(
      salvarProduto({ ...EDICAO, frentesDoCombo: ["posicionamento", "comercial"] }),
    ).resolves.toBeUndefined();

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toMatchObject({
      combo_fronts: ["posicionamento", "comercial"],
    });
  });

  it("combo de Sistemas só com Sistemas grava: a guarda segue a linha do produto", async () => {
    await expect(
      salvarProduto({
        ...EDICAO,
        frente: "sistemas",
        linhaDeNegocio: "sistemas",
        frentesDoCombo: ["sistemas"],
      }),
    ).resolves.toBeUndefined();
  });
});
