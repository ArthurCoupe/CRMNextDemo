import { beforeEach, describe, expect, it, vi } from "vitest";

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

const repo = await import("./proposals.repository");
const { NOME_DO_ITEM_EM_BRANCO, PROPOSTA_CONGELADA } = await import("../domain/ciclo");

function respostaDe(corpo: unknown, status = 200): () => Promise<Response> {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(corpo), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
}
const semConteudo = () => Promise.resolve(new Response(null, { status: 204 }));

const LINHA_RPC = {
  id: "p1",
  numero: 7,
  versao: 1,
  status: "enviada",
  valida_ate: "2026-10-19",
  escopo: "Escopo",
  prazo_entrega_dias: 30,
  forma_pagamento: "pix",
  parcelas_projeto: 3,
  fidelidade_meses: 12,
  enviada_em: "2026-10-04T15:00:00Z",
  aceita_em: null,
  recusada_em: null,
  created_at: "2026-10-04T14:00:00Z",
  total_mensal: 900,
  total_projeto: 4500,
  vencida: false,
  ultima: true,
  cliente_id: null,
};

const LINHA_ITEM = {
  id: "i1",
  product_id: "prod-1",
  nome: "Tráfego",
  descricao: null,
  front: "trafego",
  combo_fronts: null,
  business_unit: "demanda",
  contract_type: "mrr",
  preco_catalogo: 1000,
  valor: 900,
  ordem: 1,
  contract_id: null,
};

beforeEach(() => {
  chamadas = [];
  respostas = [];
});

describe("leitura", () => {
  it("listarPropostas chama a RPC e devolve em camelCase", async () => {
    respostas.push(respostaDe([LINHA_RPC]));
    const [p] = await repo.listarPropostas("o1");
    expect(chamadas[0]!.url).toContain("/rest/v1/rpc/get_propostas_da_oportunidade");
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ p_opportunity_id: "o1" });
    expect(p).toMatchObject({
      id: "p1",
      numero: 7,
      validaAte: "2026-10-19",
      formaPagamento: "pix",
      totalMensal: 900,
      totalProjeto: 4500,
      ultima: true,
      clienteId: null,
    });
  });

  it("podeVerPropostas pergunta ao banco a regra do fechamento e devolve o booleano", async () => {
    respostas.push(respostaDe(false), respostaDe(true));
    expect(await repo.podeVerPropostas("o1")).toBe(false);
    expect(await repo.podeVerPropostas("o2")).toBe(true);
    expect(chamadas[0]!.url).toContain("/rest/v1/rpc/pode_ver_propostas");
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ p_opportunity_id: "o1" });
  });

  it("podeVerPropostas propaga o erro do banco com o codigo", async () => {
    respostas.push(
      respostaDe({ code: "42501", message: "permission denied", details: null, hint: null }, 403),
    );
    await expect(repo.podeVerPropostas("o1")).rejects.toMatchObject({ code: "42501" });
  });

  it("listarItens projeta colunas explicitas, ordena e limita", async () => {
    respostas.push(respostaDe([LINHA_ITEM]));
    const [i] = await repo.listarItens("p1");
    const url = decodeURIComponent(chamadas[0]!.url);
    expect(url).toContain(
      "select=id,product_id,nome,descricao,front,combo_fronts,business_unit,contract_type,preco_catalogo,valor,ordem,contract_id",
    );
    expect(url).toContain("proposal_id=eq.p1");
    expect(url).toContain("order=ordem.asc,created_at.asc");
    expect(url).toContain("limit=200");
    expect(url).not.toContain("select=*");
    expect(i).toEqual({
      id: "i1",
      produtoId: "prod-1",
      nome: "Tráfego",
      descricao: null,
      frente: "trafego",
      frentesDoCombo: null,
      linhaDeNegocio: "demanda",
      tipo: "mrr",
      precoCatalogo: 1000,
      valor: 900,
      ordem: 1,
      contratoId: null,
    });
  });
});

describe("escrita direta", () => {
  it("criarProposta manda so a oportunidade e devolve o id", async () => {
    respostas.push(respostaDe({ id: "p9" }, 201));
    expect(await repo.criarProposta("o1")).toBe("p9");
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ opportunity_id: "o1" });
  });

  it("Review Focus 1: editarProposta com zero linhas diz que a proposta foi enviada", async () => {
    respostas.push(respostaDe([]));
    await expect(repo.editarProposta("p1", { escopo: "novo" })).rejects.toThrow(
      "Esta proposta já foi enviada. Crie uma nova versão para mudar.",
    );
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ escopo: "novo" });
  });

  it("editarProposta com uma linha grava so os campos passados", async () => {
    respostas.push(respostaDe([{ id: "p1" }]));
    await repo.editarProposta("p1", { fidelidadeMeses: 12, validaAte: "2026-11-01" });
    expect(chamadas[0]!.metodo).toBe("PATCH");
    expect(chamadas[0]!.url).toContain("/rest/v1/proposals?");
    expect(decodeURIComponent(chamadas[0]!.url)).toMatch(/[?&]id=eq\.p1(&|$)/);
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({
      fidelidade_meses: 12,
      valida_ate: "2026-11-01",
    });
  });

  it("Review Focus 1: adicionarItem com 42501 (trigger de congelamento ou RLS) diz que a proposta foi enviada", async () => {
    respostas.push(
      respostaDe(
        {
          code: "42501",
          message: 'new row violates row-level security policy for table "proposal_items"',
          details: null,
          hint: null,
        },
        403,
      ),
    );
    await expect(repo.adicionarItem("p1", "prod-1", 2)).rejects.toThrow(PROPOSTA_CONGELADA);
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({
      proposal_id: "p1",
      product_id: "prod-1",
      ordem: 2,
    });
  });

  it("adicionarItem com produto inativo devolve a mensagem do banco, com o codigo", async () => {
    respostas.push(
      respostaDe(
        {
          code: "22023",
          message: "Produto fora do catálogo ativo. Escolha um produto ativo.",
          details: null,
          hint: null,
        },
        400,
      ),
    );
    await expect(repo.adicionarItem("p1", "prod-x", 2)).rejects.toMatchObject({
      code: "22023",
      message: "Produto fora do catálogo ativo. Escolha um produto ativo.",
    });
  });

  it("editarItem com zero linhas diz que a proposta foi enviada; corpo so com o valor", async () => {
    respostas.push(respostaDe([]));
    await expect(repo.editarItem("i1", { valor: 1500 })).rejects.toThrow(PROPOSTA_CONGELADA);
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ valor: 1500 });
  });

  it("removerItem e excluirRascunho com zero linhas dizem o mesmo", async () => {
    respostas.push(respostaDe([]), respostaDe([]));
    await expect(repo.removerItem("i1")).rejects.toThrow(PROPOSTA_CONGELADA);
    await expect(repo.excluirRascunho("p1")).rejects.toThrow(PROPOSTA_CONGELADA);
  });
});

describe("Review Focus 1: 42501 em toda escrita de item", () => {
  const recusaGenerica = () =>
    respostaDe(
      {
        code: "42501",
        message: 'new row violates row-level security policy for table "proposal_items"',
        details: null,
        hint: null,
      },
      403,
    );

  it("editarItem com 42501 diz que a proposta foi enviada", async () => {
    respostas.push(recusaGenerica());
    await expect(repo.editarItem("i1", { valor: 1500 })).rejects.toThrow(PROPOSTA_CONGELADA);
    expect(chamadas[0]!.metodo).toBe("PATCH");
  });

  it("removerItem com 42501 diz que a proposta foi enviada", async () => {
    respostas.push(recusaGenerica());
    await expect(repo.removerItem("i1")).rejects.toThrow(PROPOSTA_CONGELADA);
    expect(chamadas[0]!.metodo).toBe("DELETE");
  });
});

describe("escrita direta com uma linha", () => {
  it("adicionarItem: POST em proposal_items com os tres campos", async () => {
    respostas.push(respostaDe({ id: "i9" }, 201));
    await expect(repo.adicionarItem("p1", "prod-1", 2)).resolves.toBeUndefined();
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]!.metodo).toBe("POST");
    expect(chamadas[0]!.url).toContain("/rest/v1/proposal_items?");
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({
      proposal_id: "p1",
      product_id: "prod-1",
      ordem: 2,
    });
  });

  it("editarItem: PATCH so no item pedido", async () => {
    respostas.push(respostaDe([{ id: "i1" }]));
    await expect(
      repo.editarItem("i1", { descricao: "Texto", valor: 1500 }),
    ).resolves.toBeUndefined();
    expect(chamadas[0]!.metodo).toBe("PATCH");
    expect(chamadas[0]!.url).toContain("/rest/v1/proposal_items?");
    expect(decodeURIComponent(chamadas[0]!.url)).toMatch(/[?&]id=eq\.i1(&|$)/);
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ descricao: "Texto", valor: 1500 });
  });

  it("removerItem: DELETE so no item pedido", async () => {
    respostas.push(respostaDe([{ id: "i1" }]));
    await expect(repo.removerItem("i1")).resolves.toBeUndefined();
    expect(chamadas[0]!.metodo).toBe("DELETE");
    expect(chamadas[0]!.url).toContain("/rest/v1/proposal_items?");
    expect(decodeURIComponent(chamadas[0]!.url)).toMatch(/[?&]id=eq\.i1(&|$)/);
  });

  it("excluirRascunho: DELETE so na proposta pedida", async () => {
    respostas.push(respostaDe([{ id: "p1" }]));
    await expect(repo.excluirRascunho("p1")).resolves.toBeUndefined();
    expect(chamadas[0]!.metodo).toBe("DELETE");
    expect(chamadas[0]!.url).toContain("/rest/v1/proposals?");
    expect(decodeURIComponent(chamadas[0]!.url)).toMatch(/[?&]id=eq\.p1(&|$)/);
  });
});

describe("nome e ordem do item (A1.4)", () => {
  it("editarItem com nome: PATCH só no item, com o nome aparado", async () => {
    respostas.push(respostaDe([{ id: "i1" }]));

    await expect(repo.editarItem("i1", { nome: "  Tráfego premium  " })).resolves.toBeUndefined();

    expect(chamadas[0]!.metodo).toBe("PATCH");
    expect(decodeURIComponent(chamadas[0]!.url)).toMatch(/[?&]id=eq\.i1(&|$)/);
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ nome: "Tráfego premium" });
  });

  it("nome em branco recusa antes do PATCH", async () => {
    await expect(repo.editarItem("i1", { nome: "   " })).rejects.toThrow(NOME_DO_ITEM_EM_BRANCO);
    expect(chamadas).toHaveLength(0);
  });

  it("201 caracteres recusa antes do PATCH; 200 passam", async () => {
    await expect(repo.editarItem("i1", { nome: "x".repeat(201) })).rejects.toThrow(
      "O nome do item tem 201 caracteres; o máximo é 200.",
    );
    expect(chamadas).toHaveLength(0);

    respostas.push(respostaDe([{ id: "i1" }]));
    await expect(repo.editarItem("i1", { nome: "x".repeat(200) })).resolves.toBeUndefined();
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ nome: "x".repeat(200) });
  });

  it("nome com emoji é contado por caractere: 200 passam, 201 recusam", async () => {
    const emoji = "😀";

    respostas.push(respostaDe([{ id: "i1" }]));
    await expect(repo.editarItem("i1", { nome: emoji.repeat(200) })).resolves.toBeUndefined();
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ nome: emoji.repeat(200) });

    await expect(repo.editarItem("i1", { nome: emoji.repeat(201) })).rejects.toThrow(
      "O nome do item tem 201 caracteres; o máximo é 200.",
    );
    expect(chamadas).toHaveLength(1);
  });

  it("reordenarItens: um PATCH por mudança, na ordem, só com a ordem", async () => {
    respostas.push(respostaDe([{ id: "i2" }]), respostaDe([{ id: "i1" }]));

    await expect(
      repo.reordenarItens([
        { id: "i2", ordem: 1 },
        { id: "i1", ordem: 2 },
      ]),
    ).resolves.toBeUndefined();

    expect(chamadas.map((c) => c.metodo)).toEqual(["PATCH", "PATCH"]);
    expect(decodeURIComponent(chamadas[0]!.url)).toMatch(/[?&]id=eq\.i2(&|$)/);
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ ordem: 1 });
    expect(decodeURIComponent(chamadas[1]!.url)).toMatch(/[?&]id=eq\.i1(&|$)/);
    expect(JSON.parse(chamadas[1]!.corpo)).toEqual({ ordem: 2 });
  });

  it("reordenarItens com a proposta enviada no meio: recusa com a frase", async () => {
    respostas.push(respostaDe([{ id: "i2" }]), respostaDe([]));

    await expect(
      repo.reordenarItens([
        { id: "i2", ordem: 1 },
        { id: "i1", ordem: 2 },
      ]),
    ).rejects.toThrow(PROPOSTA_CONGELADA);
    expect(chamadas).toHaveLength(2);
  });

  it("reordenarItens com 3 mudanças: todas gravam, na ordem da lista", async () => {
    respostas.push(
      respostaDe([{ id: "i3" }]),
      respostaDe([{ id: "i1" }]),
      respostaDe([{ id: "i2" }]),
    );

    await expect(
      repo.reordenarItens([
        { id: "i3", ordem: 1 },
        { id: "i1", ordem: 2 },
        { id: "i2", ordem: 3 },
      ]),
    ).resolves.toBeUndefined();

    expect(chamadas).toHaveLength(3);
    expect(chamadas.map((c) => /[?&]id=eq\.(\w+)/.exec(decodeURIComponent(c.url))?.[1])).toEqual([
      "i3",
      "i1",
      "i2",
    ]);
    expect(chamadas.map((c) => JSON.parse(c.corpo))).toEqual([
      { ordem: 1 },
      { ordem: 2 },
      { ordem: 3 },
    ]);
  });

  it("reordenarItens com 3 mudanças e zero linha na segunda: recusa e a terceira não é enviada", async () => {
    respostas.push(respostaDe([{ id: "i3" }]), respostaDe([]), respostaDe([{ id: "i2" }]));

    await expect(
      repo.reordenarItens([
        { id: "i3", ordem: 1 },
        { id: "i1", ordem: 2 },
        { id: "i2", ordem: 3 },
      ]),
    ).rejects.toThrow(PROPOSTA_CONGELADA);

    expect(chamadas).toHaveLength(2);
    expect(decodeURIComponent(chamadas[0]!.url)).toMatch(/[?&]id=eq\.i3(&|$)/);
    expect(decodeURIComponent(chamadas[1]!.url)).toMatch(/[?&]id=eq\.i1(&|$)/);
  });
});

describe("RPCs de ciclo", () => {
  it("enviarProposta propaga a recusa do banco com o codigo", async () => {
    respostas.push(
      respostaDe(
        {
          code: "22023",
          message: "Adicione ao menos um item antes de enviar.",
          details: null,
          hint: null,
        },
        400,
      ),
    );
    await expect(repo.enviarProposta("p1")).rejects.toMatchObject({ code: "22023" });
    expect(JSON.parse(chamadas[0]!.corpo)).toEqual({ p_id: "p1" });
  });

  it("novaVersao devolve o id da nova; registrar manda os dois ids", async () => {
    respostas.push(respostaDe("p2"), semConteudo);
    expect(await repo.novaVersao("p1")).toBe("p2");
    await repo.registrarContratoDaProposta("p1", "k1");
    expect(chamadas[1]!.url).toContain("/rest/v1/rpc/registrar_contrato_da_proposta");
    expect(JSON.parse(chamadas[1]!.corpo)).toEqual({ p_id: "p1", p_contract_id: "k1" });
  });

  it("listarContratosACriar devolve os grupos pendentes", async () => {
    respostas.push(
      respostaDe([
        {
          proposta_id: "p1",
          numero: 7,
          versao: 1,
          contract_type: "tcv",
          business_unit: "sistemas",
          valor: 4500,
          forma_pagamento: "pix",
          prazo_entrega_dias: 30,
          parcelas_projeto: 3,
          fidelidade_meses: null,
          opportunity_id: "venda-1",
        },
      ]),
    );
    expect(await repo.listarContratosACriar("c1")).toEqual([
      {
        propostaId: "p1",
        numero: 7,
        versao: 1,
        tipo: "tcv",
        linhaDeNegocio: "sistemas",
        valor: 4500,
        formaPagamento: "pix",
        prazoEntregaDias: 30,
        parcelasProjeto: 3,
        fidelidadeMeses: null,
        oportunidadeId: "venda-1",
      },
    ]);
  });
});

describe("lerPropostaParaImpressao", () => {
  it("le o contato da oportunidade na hora, a linha da RPC e os itens", async () => {
    respostas.push(
      respostaDe({
        opportunity_id: "o1",
        opportunities: {
          name: "Acme",
          contact_name: "Ana",
          contact_email: "ana@exemplo.invalido",
          contact_phone: null,
        },
      }),
      respostaDe([LINHA_RPC]),
      respostaDe([LINHA_ITEM]),
    );
    const r = await repo.lerPropostaParaImpressao("p1");
    expect(r.oportunidade).toEqual({
      nome: "Acme",
      contatoNome: "Ana",
      contatoEmail: "ana@exemplo.invalido",
      contatoTelefone: null,
    });
    expect(r.proposta.id).toBe("p1");
    expect(r.itens).toHaveLength(1);
    expect(decodeURIComponent(chamadas[0]!.url)).toContain(
      "select=opportunity_id,opportunities(name,contact_name,contact_email,contact_phone)",
    );
  });

  it("proposta que a RLS nao devolve: Proposta nao encontrada", async () => {
    respostas.push(respostaDe(null, 200));
    await expect(repo.lerPropostaParaImpressao("p1")).rejects.toThrow("Proposta não encontrada.");
  });
});
