import { describe, expect, it, vi } from "vitest";

import type { DadosDaSecao } from "./playbook.repository";

let respostaHttp: () => Promise<Response> = () =>
  Promise.reject(new Error("nenhuma resposta HTTP definida por este teste"));

let ultimaUrl = "";

let ultimoCorpo = "";

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { createClient } = await import("@supabase/supabase-js");

  const real = createClient("http://exemplo.invalido", "chave-publica-de-teste", {
    global: {
      fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
        ultimaUrl = String(input);
        ultimoCorpo = typeof init?.body === "string" ? init.body : "";
        return respostaHttp();
      }) as unknown as typeof globalThis.fetch,
    },
  });

  return { supabaseV2: real };
});

const { listarSecoes, buscarSecoes, salvarSecao } = await import("./playbook.repository");

function respostaDe(corpo: unknown, status = 200): () => Promise<Response> {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(corpo), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
}

const SECAO = {
  id: "d0000000-0000-4000-8000-000000000002",
  area: "comercial",
  title: "Abordagem inicial",
  content: "conteúdo",
  sort_order: 1,
  updated_at: "2026-09-08T00:00:00.000Z",
};

const DADOS: DadosDaSecao = {
  title: "Abordagem inicial",
  area: "comercial",
  sortOrder: 1,
  content: "novo conteúdo",
};

describe("listarSecoes", () => {
  it("devolve as seções da área", async () => {
    respostaHttp = respostaDe([SECAO]);

    const secoes = await listarSecoes("comercial");

    expect(secoes).toEqual([SECAO]);
  });

  it("ordena por ordem e, no empate, por título (ordem estável)", async () => {
    respostaHttp = respostaDe([SECAO]);

    await listarSecoes("comercial");

    expect(decodeURIComponent(ultimaUrl)).toContain("order=sort_order.asc,title.asc");
  });

  it("erro do banco vira Error de verdade, não objeto cru", async () => {
    respostaHttp = respostaDe({ message: "coluna não existe", code: "42703" }, 400);

    const erro: unknown = await listarSecoes("comercial").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("coluna não existe");
  });
});

describe("buscarSecoes", () => {
  it("devolve vazio sem consultar o banco quando o termo é vazio ou só espaço", async () => {
    respostaHttp = () => Promise.reject(new Error("não deveria chamar o banco"));

    expect(await buscarSecoes("")).toEqual([]);
    expect(await buscarSecoes("   ")).toEqual([]);
  });

  it("busca com termo comum devolve as seções encontradas, chamando o RPC certo", async () => {
    respostaHttp = respostaDe([SECAO]);

    const secoes = await buscarSecoes("abordagem");

    expect(secoes).toEqual([SECAO]);
    expect(ultimaUrl.endsWith("/rest/v1/rpc/buscar_secoes_playbook")).toBe(true);
  });

  it("termo com vírgula, parênteses e curinga de LIKE chega intacto no corpo do RPC", async () => {
    respostaHttp = respostaDe([SECAO]);

    const secoes = await buscarSecoes("ACME (Matriz), filial 100%_livre");

    expect(secoes).toEqual([SECAO]);
    expect(JSON.parse(ultimoCorpo)).toEqual({ p_termo: "ACME (Matriz), filial 100%_livre" });
  });

  it("erro do RPC vira Error com a mensagem do banco, não objeto cru", async () => {
    respostaHttp = respostaDe({ message: "function not found", code: "PGRST202" }, 404);

    const erro: unknown = await buscarSecoes("termo qualquer").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("function not found");
  });
});

describe("salvarSecao", () => {
  it("edição bem-sucedida (owner/manager) não lança", async () => {
    respostaHttp = respostaDe([{ id: SECAO.id }]);

    await expect(salvarSecao(SECAO.id, DADOS, SECAO.updated_at)).resolves.toBeUndefined();
  });

  it("member barrado pela RLS (ou edição concorrente): 204 com zero linha vira mensagem de conflito, não silêncio", async () => {
    respostaHttp = respostaDe([], 200);

    const erro: unknown = await salvarSecao(SECAO.id, DADOS, SECAO.updated_at).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(
      "Alguém editou esta seção enquanto você escrevia. Recarregue e refaça.",
    );
  });

  it("id inexistente (data null) também vira a mensagem de conflito", async () => {
    respostaHttp = respostaDe(null, 200);

    const erro: unknown = await salvarSecao(SECAO.id, DADOS, SECAO.updated_at).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(
      "Alguém editou esta seção enquanto você escrevia. Recarregue e refaça.",
    );
  });

  it("🔴 o UPDATE manda updated_at na query string, não só id", async () => {
    respostaHttp = respostaDe([{ id: SECAO.id }]);

    await salvarSecao(SECAO.id, DADOS, SECAO.updated_at);

    expect(ultimaUrl).toContain(`updated_at=eq.${encodeURIComponent(SECAO.updated_at)}`);
  });

  it("🔴 o UPDATE manda título, área, ordem e conteúdo juntos, com o título aparado", async () => {
    respostaHttp = respostaDe([{ id: SECAO.id }]);

    await salvarSecao(
      SECAO.id,
      { ...DADOS, title: "  Abordagem inicial  ", area: "marketing" },
      SECAO.updated_at,
    );

    expect(JSON.parse(ultimoCorpo)).toEqual({
      title: "Abordagem inicial",
      area: "marketing",
      sort_order: 1,
      content: "novo conteúdo",
    });
  });

  it("🔴 título em branco não chega ao banco", async () => {
    let chamou = false;
    respostaHttp = () => {
      chamou = true;
      return Promise.reject(new Error("não deveria chamar o banco"));
    };

    await expect(
      salvarSecao(SECAO.id, { ...DADOS, title: "   " }, SECAO.updated_at),
    ).rejects.toThrow("O título da seção não pode ficar em branco.");
    expect(chamou).toBe(false);
  });

  it.each([-1, 1.5, Number.NaN, 10000])("🔴 ordem %s não chega ao banco", async (ordem) => {
    let chamou = false;
    respostaHttp = () => {
      chamou = true;
      return Promise.reject(new Error("não deveria chamar o banco"));
    };

    await expect(
      salvarSecao(SECAO.id, { ...DADOS, sortOrder: ordem }, SECAO.updated_at),
    ).rejects.toThrow("A ordem precisa ser um número inteiro de 0 a 9999.");
    expect(chamou).toBe(false);
  });

  it.each([0, 9999])("ordem %d (borda válida) chega ao banco", async (ordem) => {
    respostaHttp = respostaDe([{ id: SECAO.id }]);

    await expect(
      salvarSecao(SECAO.id, { ...DADOS, sortOrder: ordem }, SECAO.updated_at),
    ).resolves.toBeUndefined();
    expect(JSON.parse(ultimoCorpo)).toMatchObject({ sort_order: ordem });
  });
});
