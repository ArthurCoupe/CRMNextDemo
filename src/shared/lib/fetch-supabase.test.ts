import { describe, expect, it, vi } from "vitest";

import { comRetentativaNoRest, ESPERA_MS } from "./fetch-supabase";

function resposta(status: number): Response {
  return new Response(null, { status });
}

function dormirDeMentira() {
  return vi.fn().mockResolvedValue(undefined);
}

describe("comRetentativaNoRest", () => {
  it("1. REST 401 depois 200 -> devolve 200, fetchBase chamado 2 vezes", async () => {
    const fetchBase = vi
      .fn()
      .mockResolvedValueOnce(resposta(401))
      .mockResolvedValueOnce(resposta(200));

    const resultado = await comRetentativaNoRest(
      fetchBase,
      dormirDeMentira(),
    )("https://x.supabase.co/rest/v1/profiles");

    expect(resultado.status).toBe(200);
    expect(fetchBase).toHaveBeenCalledTimes(2);
  });

  it("2. REST 401 nas três -> devolve 401, fetchBase chamado 3 vezes", async () => {
    const fetchBase = vi.fn().mockResolvedValue(resposta(401));

    const resultado = await comRetentativaNoRest(
      fetchBase,
      dormirDeMentira(),
    )("https://x.supabase.co/rest/v1/profiles");

    expect(resultado.status).toBe(401);
    expect(fetchBase).toHaveBeenCalledTimes(3);
  });

  it("3. RPC via POST 401 depois 200 -> entra na regra, 2 chamadas", async () => {
    const fetchBase = vi
      .fn()
      .mockResolvedValueOnce(resposta(401))
      .mockResolvedValueOnce(resposta(200));

    const resultado = await comRetentativaNoRest(fetchBase, dormirDeMentira())(
      "https://x.supabase.co/rest/v1/rpc/get_mrr_by_unit",
      { method: "POST", body: "{}" },
    );

    expect(resultado.status).toBe(200);
    expect(fetchBase).toHaveBeenCalledTimes(2);
  });

  it("4. /auth/v1/ com 401 fica de fora -> devolve 401, 1 chamada só", async () => {
    const fetchBase = vi.fn().mockResolvedValue(resposta(401));
    const dormir = dormirDeMentira();

    const resultado = await comRetentativaNoRest(
      fetchBase,
      dormir,
    )("https://x.supabase.co/auth/v1/token");

    expect(resultado.status).toBe(401);
    expect(fetchBase).toHaveBeenCalledTimes(1);
    expect(dormir).not.toHaveBeenCalled();
  });

  it("5. REST 500 não é 401 -> não retenta, 1 chamada", async () => {
    const fetchBase = vi.fn().mockResolvedValue(resposta(500));

    const resultado = await comRetentativaNoRest(
      fetchBase,
      dormirDeMentira(),
    )("https://x.supabase.co/rest/v1/profiles");

    expect(resultado.status).toBe(500);
    expect(fetchBase).toHaveBeenCalledTimes(1);
  });

  it("6. REST 200 de primeira -> 1 chamada", async () => {
    const fetchBase = vi.fn().mockResolvedValue(resposta(200));

    const resultado = await comRetentativaNoRest(
      fetchBase,
      dormirDeMentira(),
    )("https://x.supabase.co/rest/v1/profiles");

    expect(resultado.status).toBe(200);
    expect(fetchBase).toHaveBeenCalledTimes(1);
  });

  it("7. entrada como URL e como Request tomam a mesma decisão que a string", async () => {
    const urlStr = "https://x.supabase.co/rest/v1/profiles";

    const viaUrlObjeto = vi
      .fn()
      .mockResolvedValueOnce(resposta(401))
      .mockResolvedValueOnce(resposta(200));
    const resultadoUrl = await comRetentativaNoRest(
      viaUrlObjeto,
      dormirDeMentira(),
    )(new URL(urlStr));
    expect(resultadoUrl.status).toBe(200);
    expect(viaUrlObjeto).toHaveBeenCalledTimes(2);

    const viaRequest = vi
      .fn()
      .mockResolvedValueOnce(resposta(401))
      .mockResolvedValueOnce(resposta(200));
    const resultadoRequest = await comRetentativaNoRest(
      viaRequest,
      dormirDeMentira(),
    )(new Request(urlStr));
    expect(resultadoRequest.status).toBe(200);
    expect(viaRequest).toHaveBeenCalledTimes(2);
  });

  it("8. as esperas seguem ESPERA_MS, na ordem", async () => {
    const dormirUmaRetentativa = dormirDeMentira();
    const fetchBaseUmaRetentativa = vi
      .fn()
      .mockResolvedValueOnce(resposta(401))
      .mockResolvedValueOnce(resposta(200));
    await comRetentativaNoRest(
      fetchBaseUmaRetentativa,
      dormirUmaRetentativa,
    )("https://x.supabase.co/rest/v1/profiles");
    expect(dormirUmaRetentativa).toHaveBeenCalledTimes(1);
    expect(dormirUmaRetentativa).toHaveBeenNthCalledWith(1, ESPERA_MS[0]);

    const dormirDuasRetentativas = dormirDeMentira();
    const fetchBaseDuasRetentativas = vi.fn().mockResolvedValue(resposta(401));
    await comRetentativaNoRest(
      fetchBaseDuasRetentativas,
      dormirDuasRetentativas,
    )("https://x.supabase.co/rest/v1/profiles");
    expect(dormirDuasRetentativas).toHaveBeenCalledTimes(2);
    expect(dormirDuasRetentativas).toHaveBeenNthCalledWith(1, ESPERA_MS[0]);
    expect(dormirDuasRetentativas).toHaveBeenNthCalledWith(2, ESPERA_MS[1]);
  });

  it("9. URL irreconhecível (caminho relativo, sem base) -> não retenta, 1 chamada", async () => {
    const fetchBase = vi.fn().mockResolvedValue(resposta(401));

    const resultado = await comRetentativaNoRest(fetchBase, dormirDeMentira())("/rest/v1/profiles");

    expect(resultado.status).toBe(401);
    expect(fetchBase).toHaveBeenCalledTimes(1);
  });
});
