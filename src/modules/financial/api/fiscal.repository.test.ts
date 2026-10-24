import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

let resposta: RespostaFalsa = UMA_LINHA;
let chamadas: ChamadaRegistrada[] = [];
const rpc = vi.fn();

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  return {
    supabaseV2: {
      ...clienteFalso(
        () => resposta,
        (c: ChamadaRegistrada) => {
          chamadas.push(c);
        },
      ),
      rpc: (...args: unknown[]) => rpc(...args),
    },
  };
});

const { definirAliquota, definirTaxaDeParcelamento, definirTaxasDoMeio, lerLiquidoPorContrato } =
  await import("./fiscal.repository");

const ALIQUOTA = { aliquotaPct: 6, provisoria: false, fonte: "Simples Nacional, anexo III" };

const TAXAS_DO_MEIO = { meio: "pix", taxaFixa: 99 } as const;

const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
  {
    nome: "definirAliquota",
    chamar: () => definirAliquota(ALIQUOTA),
    recusa: "Nada foi alterado: só o owner edita a configuração fiscal.",
  },
  {
    nome: "definirTaxaDeParcelamento",
    chamar: () => definirTaxaDeParcelamento(6, 3.5),
    recusa: "Nada foi alterado: só o owner edita a tabela de parcelamento.",
  },
  {
    nome: "definirTaxasDoMeio",
    chamar: () => definirTaxasDoMeio(TAXAS_DO_MEIO),
    recusa: "Nada foi alterado: só o owner edita as taxas por meio de pagamento.",
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

const LINHA_DA_RPC = {
  contract_id: "c1",
  client_id: "cl1",
  cliente: "Padaria",
  contrato: "Tráfego",
  contract_type: "mrr",
  bu: "demanda",
  payment_method: "pix",
  parcelas: 1,
  bruto: 1000,
  imposto: 60,
  taxa_variavel: 0,
  taxa_fixa: 0,
  liquido: 940,
  taxa_variavel_pct: 0,
  imposto_pct: 6,
  is_provisional: false,
  fatura_no_mes: true,
};

describe("lerLiquidoPorContrato — início futuro vem de contracts.start_date (FIN-5)", () => {
  beforeEach(() => {
    rpc.mockReset();
    chamadas = [];
  });

  it("🔴 contrato fora da janela com start_date no futuro sai com inicioFuturo: true", async () => {
    rpc.mockResolvedValue({
      data: [LINHA_DA_RPC, { ...LINHA_DA_RPC, contract_id: "c2", fatura_no_mes: false }],
      error: null,
    });
    resposta = { data: [{ id: "c2", start_date: "2999-01-01" }], error: null };

    const linhas = await lerLiquidoPorContrato();

    expect(linhas.map((l) => [l.contratoId, l.faturaNoMes, l.inicioFuturo])).toEqual([
      ["c1", true, false],
      ["c2", false, true],
    ]);
    expect(chamadas.map((c) => c.metodo)).toEqual(["from", "select", "in"]);
    expect(chamadas[0]?.args).toEqual(["contracts"]);
    expect(chamadas[1]?.args).toEqual(["id, start_date"]);
    expect(chamadas[2]?.args).toEqual(["id", ["c2"]]);
  });

  it("fora da janela com start_date passado: inicioFuturo false — é fim, não começo", async () => {
    rpc.mockResolvedValue({
      data: [{ ...LINHA_DA_RPC, contract_id: "c2", fatura_no_mes: false }],
      error: null,
    });
    resposta = { data: [{ id: "c2", start_date: "2000-01-01" }], error: null };

    const [linha] = await lerLiquidoPorContrato();

    expect(linha?.inicioFuturo).toBe(false);
    expect(linha?.tipo).toBe("mrr");
  });

  it("todo mundo faturando: nenhuma leitura de contracts", async () => {
    rpc.mockResolvedValue({ data: [LINHA_DA_RPC], error: null });

    const [linha] = await lerLiquidoPorContrato();

    expect(linha?.inicioFuturo).toBe(false);
    expect(chamadas).toEqual([]);
  });
});

describe("definirTaxasDoMeio: prazo e parcelável vão sozinhos, só quando vêm (A2.5)", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas = [];
  });

  const enviado = () => chamadas.find((c) => c.metodo === "update")?.args[0];

  it("o prazo vai aparado, e só ele, no meio certo", async () => {
    await definirTaxasDoMeio({ meio: "pix", liquidacao: "  D+2  " });

    expect(enviado()).toEqual({ settlement: "D+2" });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["method", "pix"] });
  });

  it("🔴 prazo apagado grava null, nunca texto vazio", async () => {
    await definirTaxasDoMeio({ meio: "pix", liquidacao: "   " });

    expect(enviado()).toEqual({ settlement: null });
  });

  it("parcelável vai sozinho, sem levar as taxas junto", async () => {
    await definirTaxasDoMeio({ meio: "credito", parcelavel: false });

    expect(enviado()).toEqual({ installable: false });
  });

  it("🔴 zero linha com o campo novo também recusa com a frase de owner", async () => {
    resposta = ZERO_LINHAS;

    await expect(definirTaxasDoMeio({ meio: "pix", parcelavel: true })).rejects.toThrow(
      "Nada foi alterado: só o owner edita as taxas por meio de pagamento.",
    );
  });
});
