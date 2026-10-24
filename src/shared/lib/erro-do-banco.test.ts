import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { erroDoBanco } from "./erro-do-banco";
import { CODIGO_SEM_PERMISSAO, SEM_RETENTATIVA_EM_RECUSA, ehFaltaDePermissao } from "./permissao";

type Fetch = typeof globalThis.fetch;

async function erroDe(resposta: () => Promise<Response>): Promise<unknown> {
  const cliente = createClient("http://exemplo.invalido", "chave-publica-de-teste", {
    global: { fetch: resposta as unknown as Fetch },
  });

  const { error } = await cliente.from("clients").update({ name: "x" }).eq("id", "1").select("id");
  return error;
}

const semRede = () => Promise.reject(new TypeError("Failed to fetch"));
const corpoVazio = () => Promise.resolve(new Response("", { status: 502 }));
const corpoHtml = () =>
  Promise.resolve(new Response("<html><body>502 Bad Gateway</body></html>", { status: 503 }));
const recusaDoBanco = () =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        message: "permission denied for table clients",
        details: "detalhe do PostgREST",
        hint: "confira as policies",
        code: CODIGO_SEM_PERMISSAO,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    ),
  );

function oQueOToastMostra(lancado: unknown, fallback: string): string {
  return lancado instanceof Error ? lancado.message : fallback;
}

const FALLBACK = "Não foi possível mover.";

describe("o postgrest-js fabrica um erro mesmo quando o banco não respondeu", () => {
  it("fetch rejeitado vira um erro de code vazio, não nulo", async () => {
    const erro = (await erroDe(semRede)) as { code?: string; message?: string };

    expect(erro).not.toBeNull();
    expect(erro.code).toBe("");
    expect(erro.message).toContain("Failed to fetch");
  });

  it("502 sem corpo vira um erro de mensagem vazia e sem code", async () => {
    const erro = (await erroDe(corpoVazio)) as { code?: string; message?: string };

    expect(erro).not.toBeNull();
    expect(erro.code).toBeUndefined();
    expect(erro.message).toBe("");
  });

  it("resposta do banco traz o SQLSTATE — é o que distingue dos três acima", async () => {
    const erro = (await erroDe(recusaDoBanco)) as { code?: string };

    expect(erro.code).toBe(CODIGO_SEM_PERMISSAO);
  });
});

describe("erroDoBanco embrulha a resposta do banco e deixa o transporte passar cru", () => {
  it("recusa do banco vira Error, com a mensagem, o code e o details", async () => {
    const lancado = erroDoBanco((await erroDe(recusaDoBanco)) as never);

    expect(lancado).toBeInstanceOf(Error);
    expect(oQueOToastMostra(lancado, FALLBACK)).toBe("permission denied for table clients");
    expect(ehFaltaDePermissao(lancado)).toBe(true);
    expect(SEM_RETENTATIVA_EM_RECUSA(0, lancado)).toBe(false);
  });

  it("offline: o toast mostra a frase da tela, não 'TypeError: Failed to fetch'", async () => {
    const lancado = erroDoBanco((await erroDe(semRede)) as never);

    expect(lancado).not.toBeInstanceOf(Error);
    expect(oQueOToastMostra(lancado, FALLBACK)).toBe(FALLBACK);
  });

  it("503 com HTML: o toast não vaza o corpo da resposta", async () => {
    const lancado = erroDoBanco((await erroDe(corpoHtml)) as never);

    expect(lancado).not.toBeInstanceOf(Error);
    expect(oQueOToastMostra(lancado, FALLBACK)).toBe(FALLBACK);
  });

  it("502 sem corpo: o toast não fica VAZIO", async () => {
    const lancado = erroDoBanco((await erroDe(corpoVazio)) as never);

    expect(lancado).not.toBeInstanceOf(Error);
    expect(oQueOToastMostra(lancado, FALLBACK)).toBe(FALLBACK);
    expect(oQueOToastMostra(lancado, FALLBACK)).not.toBe("");
  });
});

describe("erroDoBanco não quebra com erro incompleto", () => {
  it("preenche details e hint ausentes em vez de gravar undefined no Error", () => {
    const lancado = erroDoBanco({ message: "violates check constraint", code: "23514" });

    expect(lancado).toBeInstanceOf(Error);
    expect((lancado as { details: string }).details).toBe("");
    expect((lancado as { hint: string }).hint).toBe("");
    expect((lancado as Error).message).toBe("violates check constraint");
  });

  it("code presente e message ausente ainda embrulha — o code é o critério, não a mensagem", () => {
    const lancado = erroDoBanco({ code: "23505" });

    expect(lancado).toBeInstanceOf(Error);
    expect((lancado as { code: string }).code).toBe("23505");
  });
});
