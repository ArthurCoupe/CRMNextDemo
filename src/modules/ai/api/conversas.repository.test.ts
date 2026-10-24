import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

let resposta: RespostaFalsa = UMA_LINHA;
const chamadas: ChamadaRegistrada[] = [];

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  return {
    supabaseV2: clienteFalso(
      () => resposta,
      (c) => chamadas.push(c),
    ),
  };
});

const { apagarConversa, renomearConversa } = await import("./conversas.repository");

const CONVERSA = "5d2c8e14-7a3b-4f90-b1c6-2e8f4a9d0c37";
const RECUSA = "Só quem abriu a conversa pode apagá-la.";

beforeEach(() => {
  chamadas.length = 0;
  resposta = UMA_LINHA;
});

describe("apagarConversa", () => {
  it("apaga a linha de ai_conversations pelo id e pede o id de volta", async () => {
    await expect(apagarConversa(CONVERSA)).resolves.toBeUndefined();

    expect(chamadas.find((c) => c.metodo === "from")?.args).toEqual(["ai_conversations"]);
    expect(chamadas.some((c) => c.metodo === "delete")).toBe(true);
    expect(chamadas.find((c) => c.metodo === "eq")?.args).toEqual(["id", CONVERSA]);
    expect(chamadas.find((c) => c.metodo === "select")?.args).toEqual(["id"]);
  });

  it("🔴 zero linha (conversa de outra pessoa, ou já apagada) recusa com a frase de quem apaga", async () => {
    resposta = ZERO_LINHAS;

    await expect(apagarConversa(CONVERSA)).rejects.toThrow(RECUSA);
  });

  it("data nulo recusa igual", async () => {
    resposta = NENHUM_DADO;

    await expect(apagarConversa(CONVERSA)).rejects.toThrow(RECUSA);
  });

  it("erro do banco sai por erroDoBanco: Error, com a mensagem e o code", async () => {
    resposta = {
      data: null,
      error: { message: "permission denied for table ai_conversations", code: "42501" },
    };

    const erro: unknown = await apagarConversa(CONVERSA).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({
      message: "permission denied for table ai_conversations",
      code: "42501",
    });
  });
});

describe("renomearConversa (A1.6)", () => {
  const RECUSA_DE_RENOMEAR = "Só quem abriu a conversa pode renomeá-la.";

  it("grava o título aparado em ai_conversations pelo id e pede o id de volta", async () => {
    await expect(renomearConversa(CONVERSA, "  Funil de outubro  ")).resolves.toBeUndefined();

    expect(chamadas.find((c) => c.metodo === "from")?.args).toEqual(["ai_conversations"]);
    expect(chamadas.find((c) => c.metodo === "update")?.args).toEqual([
      { titulo: "Funil de outubro" },
    ]);
    expect(chamadas.find((c) => c.metodo === "eq")?.args).toEqual(["id", CONVERSA]);
    expect(chamadas.find((c) => c.metodo === "select")?.args).toEqual(["id"]);
  });

  it("zero linha (conversa de outra pessoa, ou apagada) recusa com a frase", async () => {
    resposta = ZERO_LINHAS;

    await expect(renomearConversa(CONVERSA, "Funil")).rejects.toThrow(RECUSA_DE_RENOMEAR);
  });

  it("data nulo recusa igual", async () => {
    resposta = NENHUM_DADO;

    await expect(renomearConversa(CONVERSA, "Funil")).rejects.toThrow(RECUSA_DE_RENOMEAR);
  });

  it("erro do banco sai por erroDoBanco: Error, com a mensagem e o code", async () => {
    resposta = {
      data: null,
      error: { message: "permission denied for table ai_conversations", code: "42501" },
    };

    const erro: unknown = await renomearConversa(CONVERSA, "Funil").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({
      message: "permission denied for table ai_conversations",
      code: "42501",
    });
  });

  it("título em branco recusa antes do UPDATE", async () => {
    await expect(renomearConversa(CONVERSA, "   ")).rejects.toThrow(
      "O nome da conversa não pode ficar em branco.",
    );

    expect(chamadas.some((c) => c.metodo === "update")).toBe(false);
  });
});
