import { beforeEach, describe, expect, it, vi } from "vitest";

import { CODIGO_SEM_PERMISSAO, ehFaltaDePermissao } from "@/shared/lib/permissao";
import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  repetir,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

import type {
  ClienteParaSelecao,
  DadosParaSalvarContrato,
  ProdutoDoCatalogo,
} from "./contracts.repository";

let resposta: RespostaFalsa = NENHUM_DADO;
let limitePedido: unknown;
let chamadas: ChamadaRegistrada[] = [];

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
        (c: ChamadaRegistrada) => {
          chamadas.push(c);
          if (c.metodo === "limit") limitePedido = c.args[0];
        },
      ),
      rpc: real.rpc.bind(real),
    },
  };
});

const {
  apagarContrato,
  listarClientesParaSelecao,
  listarContratosDoCliente,
  listarProdutosAtivos,
  listarVendasParaContrato,
  salvarContrato,
} = await import("./contracts.repository");

const CLIENTE = { id: "c1", name: "Acme" };

const PRODUTO = {
  id: "p1",
  name: "Gestão de Tráfego",
  front: "trafego",
  business_unit: "demanda",
  contract_type: "mrr",
  price: 4500,
  combo_fronts: ["trafego", "comercial"],
};

describe("teto das listas de escolha do formulário de contrato", () => {
  beforeEach(() => {
    limitePedido = undefined;
  });

  it("listarClientesParaSelecao recusa no teto exato em vez de devolver lista truncada", async () => {
    resposta = { data: repetir(CLIENTE, 200), error: null };

    await expect(listarClientesParaSelecao()).rejects.toThrow(
      "A lista de clientes veio no teto de 200 e pode estar incompleta. " +
        "Escolher a partir de lista truncada esconde opção válida.",
    );
    expect(limitePedido).toBe(200);
  });

  it("uma abaixo do teto, listarClientesParaSelecao devolve tudo mapeado", async () => {
    resposta = { data: repetir(CLIENTE, 199), error: null };

    const clientes: ClienteParaSelecao[] = await listarClientesParaSelecao();

    expect(clientes).toHaveLength(199);
    expect(clientes[0]).toEqual({ id: "c1", nome: "Acme" });
  });

  it("listarProdutosAtivos recusa no teto exato em vez de devolver lista truncada", async () => {
    resposta = { data: repetir(PRODUTO, 200), error: null };

    await expect(listarProdutosAtivos()).rejects.toThrow(
      "A lista de produtos do catálogo veio no teto de 200 e pode estar incompleta. " +
        "Escolher a partir de lista truncada esconde opção válida.",
    );
    expect(limitePedido).toBe(200);
  });

  it("uma abaixo do teto, listarProdutosAtivos devolve tudo mapeado", async () => {
    resposta = { data: repetir(PRODUTO, 199), error: null };

    const produtos: ProdutoDoCatalogo[] = await listarProdutosAtivos();

    expect(produtos).toHaveLength(199);
    expect(produtos[0]).toEqual({
      id: "p1",
      nome: "Gestão de Tráfego",
      frente: "trafego",
      linhaDeNegocio: "demanda",
      tipo: "mrr",
      preco: 4500,
      frentesDoCombo: ["trafego", "comercial"],
    });
  });
});

describe("listarContratosDoCliente", () => {
  const LIVRE = {
    id: "k1",
    name: "Acme · Demanda mensal",
    contract_type: "mrr",
    business_unit: "demanda",
    monthly_value: 3000,
    total_value: null,
    opportunity_id: null,
    proposal_items: [],
  };

  beforeEach(() => {
    chamadas = [];
    limitePedido = undefined;
  });

  it("pede do cliente, em vigor, com projeção explícita e teto", async () => {
    resposta = { data: [LIVRE], error: null };

    await expect(listarContratosDoCliente("c1")).resolves.toEqual([
      {
        id: "k1",
        nome: "Acme · Demanda mensal",
        tipo: "mrr",
        linhaDeNegocio: "demanda",
        valorMensal: 3000,
        valorTotal: null,
        oportunidadeId: null,
      },
    ]);
    expect(chamadas).toContainEqual({ metodo: "from", args: ["contracts"] });
    expect(chamadas).toContainEqual({
      metodo: "select",
      args: [
        "id, name, contract_type, business_unit, monthly_value, total_value, opportunity_id, proposal_items(id)",
      ],
    });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["client_id", "c1"] });
    expect(chamadas).toContainEqual({ metodo: "in", args: ["status", ["active", "paused"]] });
    expect(limitePedido).toBe(200);
  });

  it("contrato já ligado a uma proposta fica fora; o livre ao lado fica", async () => {
    resposta = {
      data: [{ ...LIVRE, id: "k0", proposal_items: [{ id: "i9" }] }, LIVRE],
      error: null,
    };

    const contratos = await listarContratosDoCliente("c1");

    expect(contratos.map((c) => c.id)).toEqual(["k1"]);
  });

  it("recusa no teto exato em vez de oferecer lista truncada", async () => {
    resposta = { data: repetir(LIVRE, 200), error: null };

    await expect(listarContratosDoCliente("c1")).rejects.toThrow(
      "A lista de contratos do cliente veio no teto de 200",
    );
  });
});

function respostaDoPostgrest(corpo: unknown, status: number): () => Promise<Response> {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(corpo), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
}

const FRENTE_REPETIDA = respostaDoPostgrest(
  {
    message:
      'duplicate key value violates unique constraint "contract_items_contract_id_front_key"',
    details:
      "Key (contract_id, front)=(2e1f0c5e-0000-4000-8000-000000000001, trafego) already exists.",
    hint: null,
    code: "23505",
  },
  409,
);

const OUTRA_DUPLICATA = respostaDoPostgrest(
  {
    message:
      'duplicate key value violates unique constraint "contract_shares_contract_id_profile_id_kind_key"',
    details:
      "Key (contract_id, profile_id, kind)=(2e1f0c5e-0000-4000-8000-000000000009, 2e1f0c5e-0000-4000-8000-00000000000a, venda) already exists.",
    hint: null,
    code: "23505",
  },
  409,
);

const ID_DO_CONTRATO = "9c1b7a10-0000-4000-8000-0000000000aa";

const DADOS: DadosParaSalvarContrato = {
  clienteId: "2e1f0c5e-0000-4000-8000-000000000001",
  nome: "Acme · Demanda",
  tipo: "mrr",
  linhaDeNegocio: "demanda",
  inicio: "2026-09-01",
  valorMensal: 1500.0,
  itens: [
    { frente: "posicionamento", valor: 500.0 },
    { frente: "trafego", valor: 700.0 },
    { frente: "trafego", valor: 300.0 },
  ],
  oportunidadeId: null,
};

function oQueOToastMostra(lancado: unknown): string {
  return lancado instanceof Error ? lancado.message : "Não foi possível salvar.";
}

async function oQueSalvarLancou(): Promise<unknown> {
  return salvarContrato(DADOS).then(
    () => null,
    (erro: unknown) => erro,
  );
}

describe("frente repetida vira frase em português, e só ela", () => {
  it("o 23505 desta constraint chega ao toast nomeando a frente e dizendo o que fazer", async () => {
    respostaHttp = FRENTE_REPETIDA;

    const lancado = await oQueSalvarLancou();

    expect(oQueOToastMostra(lancado)).toBe(
      "A frente Tráfego aparece em duas linhas deste contrato. " +
        "Junte os dois valores numa linha só, ou troque uma delas por outra frente.",
    );
    expect((lancado as { code?: string }).code).toBe("23505");
  });

  it("outro 23505, de outra constraint, NÃO vira a frase de frente repetida", async () => {
    respostaHttp = OUTRA_DUPLICATA;

    const lancado = await oQueSalvarLancou();

    expect(oQueOToastMostra(lancado)).toBe(
      'duplicate key value violates unique constraint "contract_shares_contract_id_profile_id_kind_key"',
    );
    expect(oQueOToastMostra(lancado)).not.toContain("A frente");
  });

  it("sem erro, salvarContrato devolve o id que a RPC retornou", async () => {
    respostaHttp = respostaDoPostgrest(ID_DO_CONTRATO, 200);

    await expect(salvarContrato(DADOS)).resolves.toBe(ID_DO_CONTRATO);
  });
});

describe("número grande demais vira frase em português, e só ele", () => {
  const FRASE_DO_LIMITE =
    "Um número do contrato passou do limite que o banco aceita. Confira valores e meses.";

  it.each([
    ["22003", 'value "99999999999" is out of range for type integer'],
    ["22008", "date/time field value out of range"],
  ])("o %s chega ao toast em português, com o code intacto", async (code, message) => {
    respostaHttp = respostaDoPostgrest({ message, details: null, hint: null, code }, 400);

    const lancado = await oQueSalvarLancou();

    expect(oQueOToastMostra(lancado)).toBe(FRASE_DO_LIMITE);
    expect((lancado as { code?: string }).code).toBe(code);
  });

  it("o P0001 da própria RPC segue com a mensagem original", async () => {
    respostaHttp = respostaDoPostgrest(
      {
        message: "A decomposição por frente é obrigatória: envie ao menos um item.",
        details: null,
        hint: null,
        code: "P0001",
      },
      400,
    );

    const lancado = await oQueSalvarLancou();

    expect(oQueOToastMostra(lancado)).toBe(
      "A decomposição por frente é obrigatória: envie ao menos um item.",
    );
    expect(oQueOToastMostra(lancado)).not.toBe(FRASE_DO_LIMITE);
  });
});

describe("apagarContrato", () => {
  const RECUSA =
    "Nada foi apagado: só o owner apaga contrato. Se você é o owner e cadastrou o app autenticador, saia e entre de novo digitando o código de 6 dígitos.";

  beforeEach(() => {
    chamadas = [];
  });

  it("apaga pelo id, com projeção no retorno, e passa quando a linha volta", async () => {
    resposta = UMA_LINHA;

    await expect(apagarContrato("k1")).resolves.toBeUndefined();
    expect(chamadas).toContainEqual({ metodo: "from", args: ["contracts"] });
    expect(chamadas).toContainEqual({ metodo: "delete", args: [] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["id", "k1"] });
    expect(chamadas).toContainEqual({ metodo: "select", args: ["id"] });
  });

  it("🔴 zero linha (RLS barrou) lança dizendo quem pode e o que fazer", async () => {
    resposta = ZERO_LINHAS;

    await expect(apagarContrato("k1")).rejects.toThrow(RECUSA);
  });

  it("data null lança igual", async () => {
    resposta = NENHUM_DADO;

    await expect(apagarContrato("k1")).rejects.toThrow(RECUSA);
  });

  it("erro do banco passa por erroDoBanco e preserva o code", async () => {
    resposta = {
      data: null,
      error: { message: "permission denied for table contracts", code: CODIGO_SEM_PERMISSAO },
    };

    const erro = await apagarContrato("k1").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(ehFaltaDePermissao(erro)).toBe(true);
  });
});

describe("D-071: a venda de origem do contrato", () => {
  it("salvarContrato manda p_opportunity_id; Nenhuma vai sem a chave", async () => {
    let corpo: Record<string, unknown> = {};
    respostaHttp = (_url, init) => {
      corpo = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return respostaDoPostgrest(ID_DO_CONTRATO, 200)();
    };

    await salvarContrato({ ...DADOS, contratoId: ID_DO_CONTRATO, oportunidadeId: "venda-1" });
    expect(corpo.p_opportunity_id).toBe("venda-1");

    await salvarContrato({ ...DADOS, contratoId: ID_DO_CONTRATO, oportunidadeId: null });
    expect(corpo).not.toHaveProperty("p_opportunity_id");
  });

  const GANHA = {
    id: "v-1",
    name: "Acme",
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    segment: null,
    nicho: null,
    ganha_em: "2026-10-06T15:00:00Z",
  };

  it("listarVendasParaContrato lê as duas RPCs e devolve no formato do domínio", async () => {
    respostaHttp = (url) =>
      String(url).includes("listar_ganhas_sem_contrato")
        ? respostaDoPostgrest([GANHA], 200)()
        : respostaDoPostgrest(
            [{ opportunity_id: "v-2", opportunity_name: "Beta", client_id: "cli-1" }],
            200,
          )();

    await expect(listarVendasParaContrato()).resolves.toEqual({
      ganhas: [{ id: "v-1", nome: "Acme" }],
      origens: [{ vendaId: "v-2", vendaNome: "Beta", clienteId: "cli-1" }],
    });
  });

  it("🔴 ganhas no teto de 200 falham alto em vez de esconder venda", async () => {
    respostaHttp = (url) =>
      String(url).includes("listar_ganhas_sem_contrato")
        ? respostaDoPostgrest(
            Array.from({ length: 200 }, (_, i) => ({ ...GANHA, id: `v-${i}` })),
            200,
          )()
        : respostaDoPostgrest([], 200)();

    await expect(listarVendasParaContrato()).rejects.toThrow("teto de 200");
  });
});
