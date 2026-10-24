import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST_MUDOU, POST_NAO_APAGADO } from "../domain/post";

let chamadas: { url: string; metodo: string; corpo: string }[] = [];
let respostas: Array<() => Promise<Response>> = [];

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const real = createClient("http://exemplo.invalido", "chave-publica-de-teste", {
    global: {
      fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
        chamadas.push({
          url: String(input),
          metodo: init?.method ?? "GET",
          corpo: typeof init?.body === "string" ? init.body : "",
        });
        const proxima = respostas.shift();
        if (proxima === undefined) {
          return Promise.reject(new Error("nenhuma resposta HTTP definida por este teste"));
        }
        return proxima();
      }) as unknown as typeof globalThis.fetch,
    },
  });
  return { supabaseV2: real };
});

const repo = await import("./content.repository");

function respostaDe(corpo: unknown, status = 200): () => Promise<Response> {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(corpo), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
}

const LINHA = {
  id: "p1",
  client_id: "c1",
  title: "Lançamento",
  caption: null,
  format: "reel",
  channel: "instagram",
  media_url: "https://drive.test/a",
  scheduled_at: "2026-10-10T21:00:00+00:00",
  responsible_id: "u1",
  status: "aprovado",
  status_desde: "2026-10-03T12:00:00+00:00",
  published_at: null,
  published_url: null,
  updated_at: "2026-10-04T12:00:00.123456+00:00",
  clients: { name: "Acme" },
  responsavel: { full_name: "Ana" },
};

const CAMPOS = {
  clienteId: "c1",
  titulo: "Lançamento",
  legenda: null,
  formato: "reel",
  canal: "instagram",
  linkDaArte: null,
  agendadoPara: "2026-10-10T21:00:00.000Z",
  responsavelId: "u1",
} as const;

beforeEach(() => {
  chamadas = [];
  respostas = [];
});

describe("listarPostsDoQuadro", () => {
  it("lê os abertos e os publicados recentes, filtra o cliente e traz os nomes", async () => {
    respostas = [respostaDe([LINHA]), respostaDe([])];
    const r = await repo.listarPostsDoQuadro("c1", "2026-09-20T03:00:00.000Z");
    const [abertos, publicados] = chamadas.map((c) => decodeURIComponent(c.url));
    expect(abertos).toContain("status=neq.publicado");
    expect(abertos).toContain("client_id=eq.c1");
    expect(abertos).not.toContain("*");
    expect(publicados).toContain("status=eq.publicado");
    expect(publicados).toContain("published_at=gte.2026-09-20T03:00:00.000Z");
    expect(r.temMais).toBe(false);
    expect(r.posts[0]).toMatchObject({
      id: "p1",
      clienteNome: "Acme",
      responsavelNome: "Ana",
      agendadoPara: "2026-10-10T21:00:00+00:00",
      atualizadoEm: "2026-10-04T12:00:00.123456+00:00",
      status: "aprovado",
    });
  });
});

describe("editarPost", () => {
  it("manda só as 8 colunas, com a guarda de updated_at", async () => {
    respostas = [respostaDe([{ id: "p1" }])];
    await repo.editarPost("p1", "2026-10-04T12:00:00.123456+00:00", CAMPOS);
    const chamada = chamadas[0];
    expect(chamada?.metodo).toBe("PATCH");
    expect(decodeURIComponent(chamada?.url ?? "")).toContain(
      "updated_at=eq.2026-10-04T12:00:00.123456+00:00",
    );
    expect(Object.keys(JSON.parse(chamada?.corpo ?? "{}")).sort()).toEqual([
      "caption",
      "channel",
      "client_id",
      "format",
      "media_url",
      "responsible_id",
      "scheduled_at",
      "title",
    ]);
  });

  it("zero linha vira a mensagem de conflito", async () => {
    respostas = [respostaDe([])];
    await expect(repo.editarPost("p1", "velho", CAMPOS)).rejects.toThrow(POST_MUDOU);
  });
});

describe("apagarPost", () => {
  it("uma linha apagada resolve sem lançar, com o filtro do id", async () => {
    respostas = [respostaDe([{ id: "p1" }])];
    await expect(repo.apagarPost("p1")).resolves.toBeUndefined();
    expect(chamadas[0]?.metodo).toBe("DELETE");
    expect(decodeURIComponent(chamadas[0]?.url ?? "")).toContain("id=eq.p1");
  });

  it("zero linha diz o que fazer", async () => {
    respostas = [respostaDe([])];
    await expect(repo.apagarPost("p1")).rejects.toThrow(POST_NAO_APAGADO);
  });
});

describe("moverPost", () => {
  it("chama a RPC com o status lido e sem os opcionais vazios", async () => {
    respostas = [respostaDe(null)];
    await repo.moverPost("p1", "aprovado", "agendado", null, null);
    expect(chamadas[0]?.url).toContain("/rest/v1/rpc/mover_post");
    expect(JSON.parse(chamadas[0]?.corpo ?? "{}")).toEqual({
      p_post_id: "p1",
      p_de: "aprovado",
      p_para: "agendado",
    });
  });

  it("a mensagem do banco chega à tela", async () => {
    respostas = [
      respostaDe(
        {
          code: "22023",
          message: "Este post mudou em outra tela. Recarregue para ver o estado atual.",
          details: null,
          hint: null,
        },
        400,
      ),
    ];
    await expect(repo.moverPost("p1", "aprovado", "agendado", null, null)).rejects.toThrow(
      "Este post mudou em outra tela. Recarregue para ver o estado atual.",
    );
  });
});

describe("criarPost", () => {
  it("devolve o id e não manda status nem autor", async () => {
    respostas = [respostaDe({ id: "novo" })];
    expect(await repo.criarPost(CAMPOS)).toBe("novo");
    const corpo = JSON.parse(chamadas[0]?.corpo ?? "{}") as Record<string, unknown>;
    expect(corpo).not.toHaveProperty("status");
    expect(corpo).not.toHaveProperty("created_by");
  });
});

describe("corrigirPublicacao (D-069, C5)", () => {
  const CORRECAO = {
    link: "https://instagram.com/p/certo",
    publicadoEm: "2026-10-04T12:00:00.000Z",
  } as const;

  it("manda só link e data, com a guarda de updated_at", async () => {
    respostas = [respostaDe([{ id: "p1" }])];
    await repo.corrigirPublicacao("p1", "2026-10-04T12:00:00.123456+00:00", CORRECAO);
    const chamada = chamadas[0];
    expect(chamada?.metodo).toBe("PATCH");
    expect(decodeURIComponent(chamada?.url ?? "")).toContain("id=eq.p1");
    expect(decodeURIComponent(chamada?.url ?? "")).toContain(
      "updated_at=eq.2026-10-04T12:00:00.123456+00:00",
    );
    expect(JSON.parse(chamada?.corpo ?? "{}")).toEqual({
      published_url: "https://instagram.com/p/certo",
      published_at: "2026-10-04T12:00:00.000Z",
    });
  });

  it("link vazio grava null, e não some do corpo", async () => {
    respostas = [respostaDe([{ id: "p1" }])];
    await repo.corrigirPublicacao("p1", "x", { ...CORRECAO, link: null });
    expect(JSON.parse(chamadas[0]?.corpo ?? "{}")).toEqual({
      published_url: null,
      published_at: "2026-10-04T12:00:00.000Z",
    });
  });

  it("zero linha vira a mensagem de conflito", async () => {
    respostas = [respostaDe([])];
    await expect(repo.corrigirPublicacao("p1", "velho", CORRECAO)).rejects.toThrow(POST_MUDOU);
  });

  it("a recusa do gatilho chega com a frase e o code", async () => {
    respostas = [
      respostaDe(
        {
          code: "22023",
          message: "A data da publicação não pode ficar no futuro.",
          details: null,
          hint: null,
        },
        400,
      ),
    ];
    await expect(repo.corrigirPublicacao("p1", "x", CORRECAO)).rejects.toMatchObject({
      message: "A data da publicação não pode ficar no futuro.",
      code: "22023",
    });
  });
});
