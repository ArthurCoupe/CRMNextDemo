import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { erroDoBanco } from "./erro-do-banco";
import { CODIGO_SEM_PERMISSAO, SEM_RETENTATIVA_EM_RECUSA, ehFaltaDePermissao } from "./permissao";

type Fetch = typeof globalThis.fetch;

const CORPO_DA_RECUSA = {
  message: "permission denied for table clients",
  details: "detalhe do PostgREST",
  hint: "confira as policies",
  code: CODIGO_SEM_PERMISSAO,
};

async function recusaDeRls(): Promise<unknown> {
  const cliente = createClient("http://exemplo.invalido", "chave-publica-de-teste", {
    global: {
      fetch: (() =>
        Promise.resolve(
          new Response(JSON.stringify(CORPO_DA_RECUSA), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }),
        )) as unknown as Fetch,
    },
  });

  const { error } = await cliente.from("clients").select("id");
  return error;
}

describe("o erro que o PostgREST entrega carrega o code e não é Error", () => {
  it("não é instância de Error — a premissa de erroDoBanco, medida e não suposta", async () => {
    const erro = await recusaDeRls();

    expect(erro).not.toBeNull();
    expect(erro).not.toBeInstanceOf(Error);
    expect(Object.getPrototypeOf(erro)).toBe(Object.prototype);
  });

  it("carrega o code, e ehFaltaDePermissao o reconhece já no objeto cru", async () => {
    const erro = await recusaDeRls();

    expect((erro as { code: string }).code).toBe(CODIGO_SEM_PERMISSAO);
    expect(ehFaltaDePermissao(erro)).toBe(true);
  });
});

describe("as três formas de repropagar a recusa", () => {
  it("cru: guarda o code, mas falha no instanceof e o toast lê o fallback genérico", async () => {
    const erro = await recusaDeRls();

    expect(ehFaltaDePermissao(erro)).toBe(true);
    expect(erro).not.toBeInstanceOf(Error);
  });

  it("new Error(error.message): ganha o instanceof e PERDE o code", async () => {
    const cru = (await recusaDeRls()) as { message: string };
    const embrulhado = new Error(cru.message);

    expect(embrulhado).toBeInstanceOf(Error);
    expect(embrulhado.message).toBe(CORPO_DA_RECUSA.message);

    expect(ehFaltaDePermissao(embrulhado)).toBe(false);
    expect(SEM_RETENTATIVA_EM_RECUSA(0, embrulhado)).toBe(true);
  });

  it("erroDoBanco: satisfaz as duas pontas — é a forma adotada nos repositórios", async () => {
    const embrulhado = erroDoBanco((await recusaDeRls()) as never);

    expect(embrulhado).toBeInstanceOf(Error);
    expect((embrulhado as Error).message).toBe(CORPO_DA_RECUSA.message);
    expect((embrulhado as { code: string }).code).toBe(CODIGO_SEM_PERMISSAO);
    expect((embrulhado as { details: string }).details).toBe(CORPO_DA_RECUSA.details);
    expect((embrulhado as { hint: string }).hint).toBe(CORPO_DA_RECUSA.hint);

    expect(ehFaltaDePermissao(embrulhado)).toBe(true);
    expect(SEM_RETENTATIVA_EM_RECUSA(0, embrulhado)).toBe(false);
  });
});

describe("SEM_RETENTATIVA_EM_RECUSA continua repetindo o que é transitório", () => {
  it("falha de rede tenta de novo até a segunda", () => {
    const rede = new Error("Failed to fetch");

    expect(SEM_RETENTATIVA_EM_RECUSA(0, rede)).toBe(true);
    expect(SEM_RETENTATIVA_EM_RECUSA(1, rede)).toBe(true);
    expect(SEM_RETENTATIVA_EM_RECUSA(2, rede)).toBe(false);
  });

  it("recusa de permissão não tenta nenhuma vez, mesmo já embrulhada", async () => {
    const recusa = erroDoBanco((await recusaDeRls()) as never);

    expect(SEM_RETENTATIVA_EM_RECUSA(0, recusa)).toBe(false);
  });
});
