import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  repetir,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

import type { DespesaParaGravar } from "./expenses.repository";

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

const {
  apagarDespesa,
  atualizarDespesa,
  definirSituacaoDaDespesa,
  listarAgrupadores,
  listarDespesasCadastradas,
} = await import("./expenses.repository");

const DESPESA = "9c4d1e77-2a03-4b58-8e16-5f0b7c9a3d24";

const DADOS: DespesaParaGravar = {
  descricao: "Assinatura de servidor",
  valor: 890.5,
  categoria: "operacional",
  bu: "compartilhado",
  recorrencia: "mensal",
  parcelasTotal: null,
  inicio: "2026-09-01",
  fim: null,
  fornecedor: "Fornecedor de teste",
  meioDePagamento: "cartao",
  agrupadorId: null,
  ehAgrupador: false,
  observacoes: null,
};

const RECUSA = "Nada foi alterado: só o owner edita despesas.";

const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
  {
    nome: "atualizarDespesa",
    chamar: () => atualizarDespesa(DESPESA, DADOS),
    recusa: RECUSA,
  },
  {
    nome: "definirSituacaoDaDespesa",
    chamar: () => definirSituacaoDaDespesa(DESPESA, false),
    recusa: RECUSA,
  },
  {
    nome: "apagarDespesa",
    chamar: () => apagarDespesa(DESPESA),
    recusa:
      "Só o owner apaga despesa. Se você usa app autenticador, saia e entre de novo com o código de 6 dígitos.",
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

const AGRUPADOR = "1d8c3f60-4a29-4b71-9e05-2c6b8d7a5f13";
const OUTRO_AGRUPADOR = "6b0e5a34-7c18-4d92-8a63-9f2d1c40e857";

function cartao(id: string, descricao: string, ativo: boolean) {
  return { id, description: descricao, active: ativo };
}

const chamou = (metodo: string) => chamadas.some((c) => c.metodo === metodo);

describe("listarAgrupadores: desativar o cartão não pode esvaziar o 'Pendurar em'", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
  });

  it("com agrupador gravado, filtra por 'ativo OU é ele' — e o desativado volta marcado", async () => {
    resposta = {
      data: [
        cartao(AGRUPADOR, "Cartão Inter", false),
        cartao(OUTRO_AGRUPADOR, "Cartão Itaú", true),
      ],
      error: null,
    };

    const lista = await listarAgrupadores(AGRUPADOR);

    expect(chamadas).toContainEqual({ metodo: "or", args: [`active.eq.true,id.eq.${AGRUPADOR}`] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["is_group", true] });
    expect(chamadas).not.toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(lista).toEqual([
      { id: AGRUPADOR, descricao: "Cartão Inter", ativo: false },
      { id: OUTRO_AGRUPADOR, descricao: "Cartão Itaú", ativo: true },
    ]);
  });

  it("o positivo ao lado: sem agrupador (despesa nova), volta aos dois `.eq`", async () => {
    resposta = { data: [cartao(OUTRO_AGRUPADOR, "Cartão Itaú", true)], error: null };

    const lista = await listarAgrupadores(null);

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["is_group", true] });
    expect(chamou("or")).toBe(false);
    expect(lista).toEqual([{ id: OUTRO_AGRUPADOR, descricao: "Cartão Itaú", ativo: true }]);
  });

  it("undefined é tratado como sem agrupador — a assinatura permite omitir o argumento", async () => {
    await listarAgrupadores();

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamou("or")).toBe(false);
  });

  it("🔴 id fora do formato UUID não entra cru no or= — a vírgula viraria sintaxe", async () => {
    await listarAgrupadores("nao-e-uuid,is_group.eq.false");

    expect(chamou("or")).toBe(false);
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["is_group", true] });
  });

  it("🔴 a projeção inclui `active` — sem ela o campo `ativo` mente em silêncio", async () => {
    resposta = { data: [cartao(OUTRO_AGRUPADOR, "Cartão Itaú", true)], error: null };

    await listarAgrupadores(AGRUPADOR);

    const select = chamadas.find((c) => c.metodo === "select");
    expect(select).toBeDefined();
    const colunas = String(select?.args[0] ?? "")
      .split(",")
      .map((coluna) => coluna.trim());
    expect(colunas).toContain("active");
    expect(colunas).toContain("id");
    expect(colunas).toContain("description");
  });

  it("🔴 a cauda da cadeia mantém ordenação e teto — nos dois ramos", async () => {
    await listarAgrupadores(AGRUPADOR);

    expect(chamadas).toContainEqual({ metodo: "order", args: ["description"] });
    expect(chamadas).toContainEqual({ metodo: "limit", args: [500] });

    chamadas.length = 0;
    await listarAgrupadores(null);

    expect(chamadas).toContainEqual({ metodo: "order", args: ["description"] });
    expect(chamadas).toContainEqual({ metodo: "limit", args: [500] });
  });

  it("🔴 lista no teto EXATO recusa — truncar calado esconde o cartão gravado", async () => {
    resposta = { data: repetir(cartao(OUTRO_AGRUPADOR, "Cartão Itaú", true), 500), error: null };

    await expect(listarAgrupadores(AGRUPADOR)).rejects.toThrow(/teto de 500/);
  });

  it("uma linha abaixo do teto passa — a guarda não recusa lista completa", async () => {
    resposta = { data: repetir(cartao(OUTRO_AGRUPADOR, "Cartão Itaú", true), 499), error: null };

    await expect(listarAgrupadores(AGRUPADOR)).resolves.toHaveLength(499);
  });
});

describe("listarDespesasCadastradas: a data da saída chega à lista (FIN-3)", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
  });

  const linha = (deactivated_at: string | null) => ({
    id: DESPESA,
    description: "Assinatura",
    amount: 800,
    category: "operacional",
    business_unit: "sistemas",
    recurrence: "mensal",
    installments_total: null,
    installments_paid: 0,
    start_date: "2026-01-01",
    end_date: null,
    vendor: null,
    payment_method: null,
    parent_expense_id: null,
    is_group: false,
    active: deactivated_at === null,
    notes: null,
    deactivated_at,
  });

  it("🔴 a projeção inclui `deactivated_at` — sem ela a lista não tem como dizer quando saiu", async () => {
    await listarDespesasCadastradas({ incluirInativas: true });

    const select = chamadas.find((c) => c.metodo === "select");
    const colunas = String(select?.args[0] ?? "")
      .split(",")
      .map((coluna) => coluna.trim());
    expect(colunas).toContain("deactivated_at");
    expect(colunas).toContain("active");
  });

  it("inativa volta com `saiuEm` preenchido; ativa volta com null — o positivo ao lado", async () => {
    resposta = {
      data: [linha("2026-03-15T15:00:00+00:00"), { ...linha(null), id: AGRUPADOR }],
      error: null,
    };

    const { linhas } = await listarDespesasCadastradas({ incluirInativas: true });

    expect(linhas.map((d) => d.saiuEm)).toEqual(["2026-03-15T15:00:00+00:00", null]);
  });
});

describe("apagarDespesa: agrupador com despesas penduradas não se apaga", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = UMA_LINHA;
  });

  it("🔴 o 23503 do FK chega com a frase de mover ou apagar as filhas, e o code preservado", async () => {
    resposta = {
      data: null,
      error: {
        message:
          'update or delete on table "expenses" violates foreign key constraint "expenses_parent_expense_id_fkey" on table "expenses"',
        code: "23503",
      },
    };

    const erro: unknown = await apagarDespesa(AGRUPADOR).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({
      code: "23503",
      message:
        "Este agrupador ainda tem despesas penduradas, inclusive as tiradas do custo. Mova ou apague essas despesas primeiro.",
    });
  });

  it("outro erro do banco passa por erroDoBanco com a mensagem dele, não a de agrupador", async () => {
    resposta = {
      data: null,
      error: { message: "permission denied for table expenses", code: "42501" },
    };

    const erro: unknown = await apagarDespesa(DESPESA).catch((e: unknown) => e);

    expect(erro).toMatchObject({ code: "42501", message: "permission denied for table expenses" });
  });

  it("a cadeia é DELETE em `expenses` preso ao id, com `.select` para ver a recusa", async () => {
    await apagarDespesa(DESPESA);

    expect(chamadas).toContainEqual({ metodo: "from", args: ["expenses"] });
    expect(chamadas).toContainEqual({ metodo: "delete", args: [] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["id", DESPESA] });
    expect(chamadas).toContainEqual({ metodo: "select", args: ["id"] });
  });
});
