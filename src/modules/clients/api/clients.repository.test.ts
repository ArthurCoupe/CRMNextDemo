import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CODIGO_SEM_PERMISSAO,
  SEM_RETENTATIVA_EM_RECUSA,
  ehFaltaDePermissao,
} from "@/shared/lib/permissao";
import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

let resposta: RespostaFalsa = UMA_LINHA;

const chamadas: ChamadaRegistrada[] = [];

let respostaHttp: (url?: unknown, init?: RequestInit) => Promise<Response> = () =>
  Promise.reject(new Error("nenhuma resposta HTTP definida por este teste"));

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  const { createClient } = await import("@supabase/supabase-js");

  const real = createClient("http://exemplo.invalido", "chave-publica-de-teste", {
    global: {
      fetch: ((url: unknown, init?: RequestInit) =>
        respostaHttp(url, init)) as unknown as typeof globalThis.fetch,
    },
  });

  return {
    supabaseV2: {
      ...clienteFalso(
        () => resposta,
        (c) => chamadas.push(c),
      ),
      rpc: real.rpc.bind(real),
    },
  };
});

const {
  atualizarDadosDoCliente,
  definirAssinatura,
  definirStatusDoCliente,
  apagarCliente,
  desfazerFechamento,
  definirResponsavel,
  definirPastaDoDrive,
  definirConfidencialidade,
  listarResponsaveisPossiveis,
  criarCliente,
  listarGanhasSemContrato,
  listarClientes,
  corrigirDataDoStatus,
  listarCorrecoesDeData,
} = await import("./clients.repository");

function respostaDe(corpo: unknown, status = 200): () => Promise<Response> {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(corpo), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
}

const CLIENTE = "d0000000-0000-4000-8000-000000000002";
const VENDA = "5d1c0e2a-3b4f-4a6d-8e7f-9a0b1c2d3e4f";

describe("erro do PostgREST vira Error de verdade, não objeto cru (I1)", () => {
  beforeEach(() => {
    resposta = { data: [{ id: CLIENTE }], error: null };
  });

  it("atualizarDadosDoCliente propaga error.message como instância de Error", async () => {
    resposta = { data: null, error: { message: "coluna não existe", code: "42703" } };

    const erro: unknown = await atualizarDadosDoCliente(CLIENTE, { nome: "Novo Nome" }).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("coluna não existe");
  });

  it("definirStatusDoCliente propaga error.message como instância de Error", async () => {
    resposta = { data: null, error: { message: "status inválido para o enum", code: "22P02" } };

    const erro: unknown = await definirStatusDoCliente(CLIENTE, "active").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("status inválido para o enum");
  });

  it("preserva error.code ponta a ponta — é o que ehFaltaDePermissao lê", async () => {
    resposta = {
      data: null,
      error: {
        message: "permission denied for table clients",
        details: "detalhe do PostgREST",
        hint: "confira as policies",
        code: CODIGO_SEM_PERMISSAO,
      },
    };

    const erro: unknown = await definirStatusDoCliente(CLIENTE, "active").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(ehFaltaDePermissao(erro)).toBe(true);
    expect(SEM_RETENTATIVA_EM_RECUSA(0, erro)).toBe(false);
  });
});

const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
  {
    nome: "definirResponsavel",
    chamar: () => definirResponsavel(CLIENTE, "0b6e3c11-4a52-4d8e-9f10-6c2b7a3d5e94"),
    recusa:
      "Nada foi gravado: seu papel não pode alterar o responsável deste cliente. " +
      "Manager edita apenas os clientes em que já é o responsável; os demais são do owner.",
  },
  {
    nome: "definirPastaDoDrive",
    chamar: () =>
      definirPastaDoDrive(CLIENTE, "https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i"),
    recusa:
      "Nada foi gravado: seu papel não pode alterar a pasta do Drive deste cliente. " +
      "Manager edita apenas os clientes em que já é o responsável; os demais são do owner.",
  },
  {
    nome: "definirConfidencialidade",
    chamar: () => definirConfidencialidade(CLIENTE, true, "contrato sob NDA"),
    recusa:
      "Nada foi gravado: seu papel não pode alterar a confidencialidade deste cliente. " +
      "Manager edita apenas os clientes em que já é o responsável; os demais são do owner.",
  },
  {
    nome: "atualizarDadosDoCliente",
    chamar: () => atualizarDadosDoCliente(CLIENTE, { nome: "Acme Matriz" }),
    recusa: "Não foi possível salvar: você não tem permissão para editar este cliente.",
  },
  {
    nome: "definirStatusDoCliente",
    chamar: () => definirStatusDoCliente(CLIENTE, "churned"),
    recusa: "Não foi possível mudar o status: você não tem permissão para este cliente.",
  },
  {
    nome: "definirAssinatura",
    chamar: () => definirAssinatura(CLIENTE, "2026-09-01"),
    recusa: "Você não pode editar a data de assinatura deste cliente.",
  },
  {
    nome: "corrigirDataDoStatus",
    chamar: () => corrigirDataDoStatus(CLIENTE, "paused_at", "2026-09-01"),
    recusa: "Só o owner corrige a data de pausa ou de encerramento.",
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

const TITULAR = "0b6e3c11-4a52-4d8e-9f10-6c2b7a3d5e94";
const DONA = "9c1f4a77-2b60-4e3a-8d51-7f0e2a6b4c93";

function perfil(id: string, nome: string, papel: "owner" | "manager" | "member", ativo: boolean) {
  return { id, full_name: nome, role: papel, active: ativo };
}

const chamou = (metodo: string) => chamadas.some((c) => c.metodo === metodo);

describe("listarResponsaveisPossiveis: desativar a pessoa não pode esvaziar o Responsável da ficha", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
  });

  it("com titular, filtra por 'ativo OU é ele' — e o desativado volta marcado", async () => {
    resposta = {
      data: [
        perfil(TITULAR, "Ana Souza", "member", false),
        perfil(DONA, "Bia Lima", "owner", true),
      ],
      error: null,
    };

    const lista = await listarResponsaveisPossiveis(TITULAR);

    expect(chamadas).toContainEqual({
      metodo: "or",
      args: [`active.eq.true,id.eq.${TITULAR}`],
    });
    expect(chamou("eq")).toBe(false);
    expect(lista).toEqual([
      { id: TITULAR, nome: "Ana Souza", papel: "member", ativo: false },
      { id: DONA, nome: "Bia Lima", papel: "owner", ativo: true },
    ]);
  });

  it("🔴 a projeção inclui `active` — sem ela o campo `ativo` mente em silêncio", async () => {
    resposta = { data: [perfil(DONA, "Bia Lima", "owner", true)], error: null };

    await listarResponsaveisPossiveis(TITULAR);

    const select = chamadas.find((c) => c.metodo === "select");
    expect(select).toBeDefined();
    const colunas = String(select?.args[0] ?? "")
      .split(",")
      .map((coluna) => coluna.trim());
    expect(colunas).toContain("active");
    expect(colunas).toContain("id");
    expect(colunas).toContain("full_name");
    expect(colunas).toContain("role");
  });

  it("sem titular (criação de cliente e filtro da listagem), volta ao active = true puro", async () => {
    resposta = { data: [perfil(DONA, "Bia Lima", "owner", true)], error: null };

    const lista = await listarResponsaveisPossiveis(null);

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamou("or")).toBe(false);
    expect(lista).toEqual([{ id: DONA, nome: "Bia Lima", papel: "owner", ativo: true }]);
  });

  it("undefined é tratado como sem titular — a assinatura permite omitir o argumento", async () => {
    await listarResponsaveisPossiveis();

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamou("or")).toBe(false);
  });

  it("🔴 id fora do formato UUID não entra cru no or= — a vírgula viraria sintaxe", async () => {
    await listarResponsaveisPossiveis("nao-e-uuid,role.eq.owner");

    expect(chamou("or")).toBe(false);
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
  });

  it("o positivo ao lado: member ativo que NÃO é o titular continua fora da lista", async () => {
    resposta = {
      data: [
        perfil("11111111-2222-3333-4444-555555555555", "Caio Alves", "member", true),
        perfil(DONA, "Bia Lima", "manager", true),
      ],
      error: null,
    };

    const lista = await listarResponsaveisPossiveis(TITULAR);

    expect(lista).toEqual([{ id: DONA, nome: "Bia Lima", papel: "manager", ativo: true }]);
  });

  it("o teto continua falhando alto em vez de truncar a lista de escolha", async () => {
    resposta = {
      data: Array.from({ length: 100 }, (_, i) =>
        perfil(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, `P${i}`, "manager", true),
      ),
      error: null,
    };

    await expect(listarResponsaveisPossiveis(TITULAR)).rejects.toThrow(
      "A lista de responsáveis veio no teto de 100 e pode estar incompleta.",
    );
  });
});

describe("desfazerFechamento", () => {
  beforeEach(() => {
    chamadas.length = 0;
    respostaHttp = () => Promise.reject(new Error("nenhuma resposta HTTP definida por este teste"));
  });

  it("devolve o que foi apagado e o estágio de volta", async () => {
    respostaHttp = respostaDe([{ contratos_apagados: 2, estagio_restaurado: "r2" }]);

    await expect(desfazerFechamento(VENDA, "fechei a errada")).resolves.toEqual({
      contratosApagados: 2,
      estagioRestaurado: "r2",
    });
  });

  it("🔴 estagioRestaurado null NÃO vira string nem zero — a tela precisa distinguir", async () => {
    respostaHttp = respostaDe([{ contratos_apagados: 1, estagio_restaurado: null }]);

    const resultado = await desfazerFechamento(VENDA, "motivo");

    expect(resultado.estagioRestaurado).toBeNull();
    expect(resultado.contratosApagados).toBe(1);
  });

  it("D-071: manda a venda e o motivo para a RPC", async () => {
    let corpo: unknown = null;
    respostaHttp = (_url, init) => {
      corpo = JSON.parse(String(init?.body ?? "null"));
      return respostaDe([{ contratos_apagados: 1, estagio_restaurado: "r2" }])();
    };

    await desfazerFechamento(VENDA, "fechei a errada");

    expect(corpo).toEqual({ p_opportunity_id: VENDA, p_motivo: "fechei a errada" });
  });

  it("venda sem contrato chega com o 23514 e a frase do banco", async () => {
    respostaHttp = respostaDe(
      {
        code: "23514",
        message:
          'A venda "Acme" não tem contrato. Para tirá-la de Fechado, arraste o card para outra etapa no Pipeline.',
        details: null,
        hint: null,
      },
      400,
    );

    await expect(desfazerFechamento(VENDA, "motivo")).rejects.toMatchObject({
      code: "23514",
      message: expect.stringContaining("não tem contrato"),
    });
  });

  it("recusa de mês congelado chega com o code 23514 preservado", async () => {
    respostaHttp = respostaDe(
      { code: "23514", message: "O mes 08/2026 ja foi fechado", details: null, hint: null },
      400,
    );

    await expect(desfazerFechamento(VENDA, "motivo")).rejects.toMatchObject({
      code: "23514",
      message: expect.stringContaining("ja foi fechado"),
    });
  });

  it("recusa de permissão chega com 42501, que é o que corta a retentativa", async () => {
    respostaHttp = respostaDe(
      { code: CODIGO_SEM_PERMISSAO, message: "forbidden", details: null, hint: null },
      403,
    );

    const erro = await desfazerFechamento(VENDA, "motivo").catch((e: unknown) => e);

    expect(ehFaltaDePermissao(erro)).toBe(true);
    expect(SEM_RETENTATIVA_EM_RECUSA(0, erro)).toBe(false);
    expect(erro).toMatchObject({
      code: CODIGO_SEM_PERMISSAO,
      message:
        "Desfazer um fechamento é do owner. Se você cadastrou o app autenticador e entrou sem o código, saia e entre de novo digitando o código de 6 dígitos.",
    });
  });

  it("retorno vazio não passa por sucesso silencioso", async () => {
    respostaHttp = respostaDe([]);

    await expect(desfazerFechamento(VENDA, "motivo")).rejects.toThrow(
      "O fechamento não foi desfeito. Recarregue a página e confira a venda.",
    );
  });
});

describe("apagarCliente (RPC apagar_cliente)", () => {
  let pedido: { url: string; corpo: unknown } | null = null;

  function responder(corpo: unknown, status = 200) {
    const resposta = respostaDe(corpo, status);
    respostaHttp = (url, init) => {
      pedido = { url: String(url), corpo: JSON.parse(String(init?.body ?? "null")) };
      return resposta();
    };
  }

  beforeEach(() => {
    chamadas.length = 0;
    pedido = null;
    respostaHttp = () => Promise.reject(new Error("nenhuma resposta HTTP definida por este teste"));
  });

  it("chama apagar_cliente com p_client_id e devolve o que saiu junto", async () => {
    responder([{ contratos_apagados: 2, jornadas_apagadas: 1, posts_apagados: 5 }]);

    await expect(apagarCliente(CLIENTE)).resolves.toEqual({
      contratosApagados: 2,
      jornadasApagadas: 1,
      postsApagados: 5,
    });
    expect(pedido).toEqual({
      url: expect.stringMatching(/\/rest\/v1\/rpc\/apagar_cliente$/),
      corpo: { p_client_id: CLIENTE },
    });
    expect(chamou("from")).toBe(false);
  });

  it("recusa de permissão: 42501 preservado e a frase diz o que fazer", async () => {
    responder({ code: CODIGO_SEM_PERMISSAO, message: "forbidden", details: null, hint: null }, 403);

    const erro = await apagarCliente(CLIENTE).catch((e: unknown) => e);

    expect(ehFaltaDePermissao(erro)).toBe(true);
    expect(SEM_RETENTATIVA_EM_RECUSA(0, erro)).toBe(false);
    expect(erro).toMatchObject({
      code: CODIGO_SEM_PERMISSAO,
      message:
        "Apagar cliente é do owner. Se você cadastrou o app autenticador e entrou sem o código, saia e entre de novo digitando o código de 6 dígitos.",
    });
  });

  it("outra recusa do banco chega com a mensagem e o code dele, sem tradução", async () => {
    responder(
      {
        code: "P0002",
        message: "Cliente não encontrado. Ele pode já ter sido apagado em outra tela.",
        details: null,
        hint: null,
      },
      404,
    );

    await expect(apagarCliente(CLIENTE)).rejects.toMatchObject({
      code: "P0002",
      message: "Cliente não encontrado. Ele pode já ter sido apagado em outra tela.",
    });
  });

  it("retorno vazio não passa por sucesso silencioso", async () => {
    responder([]);

    await expect(apagarCliente(CLIENTE)).rejects.toThrow("O cliente não foi apagado");
  });
});

describe("D-071: ganhas sem contrato e o cadastro que só preenche", () => {
  let pedidos: { url: string; corpo: unknown }[] = [];

  function responder(...corpos: [unknown, number?][]) {
    const fila = [...corpos];
    respostaHttp = (url, init) => {
      pedidos.push({ url: String(url), corpo: JSON.parse(String(init?.body ?? "null")) });
      const proxima = fila.shift();
      if (proxima === undefined) return Promise.reject(new Error("pedido HTTP a mais"));
      return respostaDe(proxima[0], proxima[1] ?? 200)();
    };
  }

  const LINHA_GANHA = {
    id: "opp-1",
    name: "Acme",
    contact_name: "Ana",
    contact_email: "ana@acme.com",
    contact_phone: null,
    segment: "Saúde",
    nicho: null,
    ganha_em: "2026-10-06T15:00:00Z",
  };

  beforeEach(() => {
    chamadas.length = 0;
    pedidos = [];
    resposta = UMA_LINHA;
    respostaHttp = () => Promise.reject(new Error("nenhuma resposta HTTP definida por este teste"));
  });

  it("listarGanhasSemContrato chama a RPC nova e devolve no formato do domínio", async () => {
    responder([[LINHA_GANHA]]);

    await expect(listarGanhasSemContrato()).resolves.toEqual([
      {
        id: "opp-1",
        nome: "Acme",
        contatoNome: "Ana",
        contatoEmail: "ana@acme.com",
        contatoTelefone: null,
        segmento: "Saúde",
        nicho: null,
        ganhaEm: "2026-10-06T15:00:00Z",
      },
    ]);
    expect(pedidos[0]?.url).toMatch(/\/rest\/v1\/rpc\/listar_ganhas_sem_contrato$/);
  });

  it("listarGanhasSemContrato recusa no teto de 200 em vez de esconder ganha", async () => {
    responder([Array.from({ length: 200 }, (_, i) => ({ ...LINHA_GANHA, id: `opp-${i}` }))]);

    await expect(listarGanhasSemContrato()).rejects.toThrow("teto de 200");
  });

  it("criarCliente faz só o insert: nenhuma RPC de ligar", async () => {
    resposta = { data: { id: "novo" }, error: null };

    await expect(
      criarCliente({
        nome: "Acme",
        segmento: null,
        nicho: null,
        contatoNome: null,
        contatoEmail: null,
        contatoTelefone: null,
        responsavelId: null,
      }),
    ).resolves.toBe("novo");
    expect(pedidos).toHaveLength(0);
    expect(chamadas.map((c) => c.metodo)).toContain("insert");
  });
});

describe("D-071: listarClientes traz as vendas de origem de cada cliente", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = {
      data: [{ id: CLIENTE, name: "Acme", contracts: [], profiles: null }],
      error: null,
    };
  });

  it("lê as origens uma vez e entrega só as do cliente da linha", async () => {
    respostaHttp = (url) =>
      String(url).includes("/rpc/get_origens_dos_clientes")
        ? respostaDe([
            { opportunity_id: "v-1", opportunity_name: "Acme site", client_id: CLIENTE },
            { opportunity_id: "v-2", opportunity_name: "Outra", client_id: "cli-outro" },
          ])()
        : Promise.reject(new Error(`pedido inesperado: ${String(url)}`));

    const pagina = await listarClientes({});

    expect(pagina.clientes[0]?.vendasDeOrigem).toEqual([{ id: "v-1", nome: "Acme site" }]);
  });

  it("🔴 origens no teto de 500 falham alto, não somem da ficha", async () => {
    respostaHttp = respostaDe(
      Array.from({ length: 500 }, (_, i) => ({
        opportunity_id: `v-${i}`,
        opportunity_name: "x",
        client_id: CLIENTE,
      })),
    );

    await expect(listarClientes({})).rejects.toThrow("teto de 500");
  });

  it("a projeção de clientes não pede mais opportunity_id", async () => {
    respostaHttp = respostaDe([]);

    await listarClientes({});

    const projecao = String(chamadas.find((c) => c.metodo === "select")?.args[0]);
    expect(projecao).not.toContain("opportunity_id");
  });
});

describe("correção de data com rastro (D-069, C8)", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = UMA_LINHA;
  });

  it("corrigirDataDoStatus manda só a coluna escolhida, presa ao id", async () => {
    await corrigirDataDoStatus(CLIENTE, "paused_at", "2026-09-01");
    expect(chamadas).toContainEqual({ metodo: "update", args: [{ paused_at: "2026-09-01" }] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["id", CLIENTE] });
    expect(chamadas).toContainEqual({ metodo: "select", args: ["id"] });

    chamadas.length = 0;
    await corrigirDataDoStatus(CLIENTE, "churned_at", "2026-08-15");
    expect(chamadas).toContainEqual({ metodo: "update", args: [{ churned_at: "2026-08-15" }] });
  });

  it("recusa do gatilho: a frase do banco e o code sobrevivem (a tela não retenta a recusa)", async () => {
    resposta = {
      data: null,
      error: {
        message: "A data de pausa só se corrige com o cliente pausado.",
        code: "23514",
      },
    };

    const erro: unknown = await corrigirDataDoStatus(CLIENTE, "paused_at", "2026-09-01").catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("A data de pausa só se corrige com o cliente pausado.");
    expect((erro as { code?: string }).code).toBe("23514");
  });

  it("listarCorrecoesDeData projeta, filtra, ordena, limita e descarta campo desconhecido", async () => {
    resposta = {
      data: [
        {
          id: "r1",
          campo: "paused_at",
          antes: "2026-09-10",
          depois: "2026-09-01",
          corrigido_em: "2026-10-07T13:00:00Z",
          profiles: { full_name: "Augusto" },
        },
        {
          id: "r2",
          campo: "outra_coisa",
          antes: null,
          depois: "2026-09-01",
          corrigido_em: "2026-10-07T13:00:00Z",
          profiles: null,
        },
      ],
      error: null,
    };
    await expect(listarCorrecoesDeData(CLIENTE)).resolves.toEqual([
      {
        id: "r1",
        campo: "paused_at",
        antes: "2026-09-10",
        depois: "2026-09-01",
        corrigidoEm: "2026-10-07T13:00:00Z",
        autorNome: "Augusto",
      },
    ]);
    expect(chamadas).toContainEqual({ metodo: "from", args: ["correcoes_de_data_do_cliente"] });
    expect(chamadas).toContainEqual({
      metodo: "select",
      args: ["id, campo, antes, depois, corrigido_em, profiles(full_name)"],
    });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["client_id", CLIENTE] });
    expect(chamadas).toContainEqual({
      metodo: "order",
      args: ["corrigido_em", { ascending: false }],
    });
    expect(chamadas).toContainEqual({ metodo: "limit", args: [50] });
  });

  it("autor que saiu da equipe (profiles nulo) vira autorNome nulo, e a linha fica", async () => {
    resposta = {
      data: [
        {
          id: "r3",
          campo: "churned_at",
          antes: null,
          depois: "2026-08-15",
          corrigido_em: "2026-10-07T13:00:00Z",
          profiles: null,
        },
      ],
      error: null,
    };
    await expect(listarCorrecoesDeData(CLIENTE)).resolves.toEqual([
      {
        id: "r3",
        campo: "churned_at",
        antes: null,
        depois: "2026-08-15",
        corrigidoEm: "2026-10-07T13:00:00Z",
        autorNome: null,
      },
    ]);
  });

  it("listarCorrecoesDeData: erro do banco vira Error com o code", async () => {
    resposta = { data: null, error: { message: "permission denied", code: CODIGO_SEM_PERMISSAO } };

    const erro: unknown = await listarCorrecoesDeData(CLIENTE).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(ehFaltaDePermissao(erro)).toBe(true);
  });
});
