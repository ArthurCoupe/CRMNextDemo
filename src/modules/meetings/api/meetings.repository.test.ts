import { describe, expect, it, vi } from "vitest";

let chamadas: { url: string; corpo: string }[] = [];

let respostas: Array<() => Promise<Response>> = [];

let idDaSessao: string | undefined = "9b1f2c1a-0000-4000-8000-000000000001";

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { createClient } = await import("@supabase/supabase-js");

  const real = createClient("http://exemplo.invalido", "chave-publica-de-teste", {
    global: {
      fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
        const corpo = typeof init?.body === "string" ? init.body : "";
        chamadas.push({ url: String(input), corpo });
        const proxima = respostas.shift();
        if (proxima === undefined) {
          return Promise.reject(new Error("nenhuma resposta HTTP definida por este teste"));
        }
        return proxima();
      }) as unknown as typeof globalThis.fetch,
    },
  });

  real.auth.getSession = (async () => ({
    data: { session: idDaSessao === undefined ? null : { user: { id: idDaSessao } } },
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  return { supabaseV2: real };
});

const {
  listarReunioes,
  listarClientesParaSelecao,
  buscarOportunidadesParaSelecao,
  listarStaffParaSelecao,
  criarReuniao,
  atualizarReuniao,
  cancelarReuniao,
  desfazerCancelamento,
  apagarReuniao,
  consultarConflitos,
} = await import("./meetings.repository");
const { MENSAGEM_DO_TETO_DE_REUNIOES, ReuniaoCriadaSemParticipantes } =
  await import("../domain/meeting");

function respostaDe(corpo: unknown, status = 200): () => Promise<Response> {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(corpo), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
}

function reset(): void {
  chamadas = [];
  respostas = [];
  idDaSessao = "9b1f2c1a-0000-4000-8000-000000000001";
}

const REUNIAO_CRUA = {
  id: "1111e111-e11b-11d1-a111-111111111111",
  titulo: "Kickoff ACME",
  tipo: "kickoff_cliente",
  starts_at: "2026-09-15T13:00:00.000Z",
  duration_minutes: 60,
  client_id: "2222e222-e11b-11d1-a111-111111111111",
  opportunity_id: null,
  organizer_id: "9b1f2c1a-0000-4000-8000-000000000001",
  local: "Sala 1",
  notas: null,
  cancelada_em: null,
  motivo_do_cancelamento: null,
  clients: { name: "ACME" },
  opportunities: null,
  meeting_attendees: [
    { profiles: { id: "3333e333-e11b-11d1-a111-111111111111", full_name: "Ana" } },
  ],
};

describe("listarReunioes", () => {
  it("D-069 (C6): traz a ata de cada cancelamento desfeito, mais novo primeiro, com teto e a dica das duas FKs", async () => {
    reset();
    respostas = [
      respostaDe([
        {
          ...REUNIAO_CRUA,
          cancelamentos_desfeitos: [
            {
              id: "cd2",
              cancelada_em: "2026-09-12T10:00:00.123456+00:00",
              motivo: "Cliente remarcou",
              desfeito_em: "2026-09-12T11:00:00+00:00",
              cancelou: { full_name: "Ana" },
              desfez: null,
            },
          ],
        },
      ]),
    ];

    const [reuniao] = await listarReunioes();

    expect(reuniao?.cancelamentosDesfeitos).toEqual([
      {
        id: "cd2",
        canceladaEm: "2026-09-12T10:00:00.123456+00:00",
        motivo: "Cliente remarcou",
        desfeitoEm: "2026-09-12T11:00:00+00:00",
        canceladaPorNome: "Ana",
        desfeitoPorNome: null,
      },
    ]);
    const url = decodeURIComponent(chamadas[0].url);
    expect(url).toContain(
      "cancelamentos_desfeitos(id,cancelada_em,motivo,desfeito_em,cancelou:profiles!cancelamentos_desfeitos_cancelada_por_fkey(full_name),desfez:profiles!cancelamentos_desfeitos_desfeito_por_fkey(full_name))",
    );
    expect(url).toContain("cancelamentos_desfeitos.order=desfeito_em.desc");
    expect(url).toContain("cancelamentos_desfeitos.limit=20");
    expect(url).toContain("&limit=200");
  });

  it("projeta colunas explícitas e tem teto, com a resposta convertida para o domínio", async () => {
    reset();
    respostas = [respostaDe([REUNIAO_CRUA])];

    const reunioes = await listarReunioes();

    expect(reunioes).toEqual([
      {
        id: REUNIAO_CRUA.id,
        titulo: "Kickoff ACME",
        tipo: "kickoff_cliente",
        startsAt: "2026-09-15T13:00:00.000Z",
        duracaoMinutos: 60,
        clienteId: REUNIAO_CRUA.client_id,
        clienteNome: "ACME",
        oportunidadeId: null,
        oportunidadeNome: null,
        organizadorId: REUNIAO_CRUA.organizer_id,
        local: "Sala 1",
        notas: null,
        canceladaEm: null,
        motivoDoCancelamento: null,
        participantes: [{ id: "3333e333-e11b-11d1-a111-111111111111", nome: "Ana" }],
        cancelamentosDesfeitos: [],
      },
    ]);

    const url = chamadas[0].url;
    for (const coluna of ["titulo", "starts_at", "duration_minutes", "organizer_id"]) {
      expect(url).toContain(coluna);
    }
    expect(url).toContain("limit=200");
  });

  it("filtra por desde/ate no Postgres quando informados, e não filtra quando ausentes", async () => {
    reset();
    respostas = [respostaDe([]), respostaDe([])];

    await listarReunioes({ desde: "2026-09-01T00:00:00.000Z", ate: "2026-09-30T23:59:59.000Z" });
    const urlComFiltro = chamadas[0].url;
    expect(urlComFiltro).toContain("starts_at=gte.2026-09-01");
    expect(urlComFiltro).toContain("starts_at=lte.2026-09-30");

    await listarReunioes();
    const urlSemFiltro = chamadas[1].url;
    expect(urlSemFiltro).not.toContain("gte.");
    expect(urlSemFiltro).not.toContain("lte.");
  });

  it("soMinhas filtra por quem organizou (a sessão local), e sem a flag não filtra", async () => {
    reset();
    respostas = [respostaDe([]), respostaDe([])];

    await listarReunioes({ soMinhas: true });
    expect(chamadas[0].url).toContain(`organizer_id=eq.${idDaSessao}`);

    await listarReunioes({ soMinhas: false });
    expect(chamadas[1].url).not.toContain("organizer_id=eq.");
  });

  it("recusa no teto em vez de devolver as 200 mais antigas como se fossem tudo", async () => {
    reset();
    respostas = [respostaDe(Array.from({ length: 200 }, () => REUNIAO_CRUA))];

    const erro: unknown = await listarReunioes().catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(MENSAGEM_DO_TETO_DE_REUNIOES);
  });

  it("uma abaixo do teto devolve tudo — a guarda não recusa o caso normal", async () => {
    reset();
    respostas = [respostaDe(Array.from({ length: 199 }, () => REUNIAO_CRUA))];

    await expect(listarReunioes()).resolves.toHaveLength(199);
  });
});

describe("listarClientesParaSelecao", () => {
  function repetir<T>(item: T, n: number): T[] {
    return Array.from({ length: n }, (_, i) => ({
      ...item,
      id: `${(item as { id: string }).id}-${i}`,
    }));
  }

  const CLIENTE = { id: "c1", name: "Acme" };

  it("recusa no teto exato em vez de devolver lista truncada", async () => {
    reset();
    respostas = [respostaDe(repetir(CLIENTE, 200))];

    await expect(listarClientesParaSelecao()).rejects.toThrow(
      "A lista de clientes veio no teto de 200 e pode estar incompleta.",
    );
    expect(chamadas[0].url).toContain("limit=200");
  });

  it("uma abaixo do teto, devolve tudo mapeado (id, nome)", async () => {
    reset();
    respostas = [respostaDe(repetir(CLIENTE, 199))];

    const clientes = await listarClientesParaSelecao();

    expect(clientes).toHaveLength(199);
    expect(clientes[0]).toEqual({ id: "c1-0", nome: "Acme" });
  });
});

describe("buscarOportunidadesParaSelecao", () => {
  function repetir<T>(item: T, n: number): T[] {
    return Array.from({ length: n }, (_, i) => ({
      ...item,
      id: `${(item as { id: string }).id}-${i}`,
    }));
  }

  const OPORTUNIDADE = { id: "o1", name: "Reforma ACME" };

  function corpo(): unknown {
    return JSON.parse(chamadas[0].corpo);
  }

  it("chama a RPC sem acento com o termo aparado e devolve id e nome", async () => {
    reset();
    respostas = [respostaDe([OPORTUNIDADE])];

    const busca = await buscarOportunidadesParaSelecao("  acme ");

    expect(busca).toEqual({ itens: [{ id: "o1", nome: "Reforma ACME" }], haMais: false });
    expect(chamadas[0].url).toContain("/rest/v1/rpc/buscar_oportunidades_para_reuniao");
    expect(corpo()).toEqual({ p_termo: "acme" });
  });

  it("com 21 linhas devolve 20 e avisa que há mais, em vez de recusar", async () => {
    reset();
    respostas = [respostaDe(repetir(OPORTUNIDADE, 21))];

    const busca = await buscarOportunidadesParaSelecao("reforma");

    expect(busca.itens).toHaveLength(20);
    expect(busca.haMais).toBe(true);
  });

  it("com 20 linhas exatas não acusa que há mais", async () => {
    reset();
    respostas = [respostaDe(repetir(OPORTUNIDADE, 20))];

    const busca = await buscarOportunidadesParaSelecao("reforma");

    expect(busca.itens).toHaveLength(20);
    expect(busca.haMais).toBe(false);
  });

  it("o termo vai cru: o escape de %, _ e barra é da função no banco", async () => {
    reset();
    respostas = [respostaDe([])];

    await buscarOportunidadesParaSelecao(String.raw`50%_a\b`);

    expect(corpo()).toEqual({ p_termo: String.raw`50%_a\b` });
  });

  it("termo com menos de 2 letras não vai ao banco", async () => {
    reset();

    const busca = await buscarOportunidadesParaSelecao(" a ");

    expect(busca).toEqual({ itens: [], haMais: false });
    expect(chamadas).toHaveLength(0);
  });

  it("erro do banco sai por erroDoBanco, com a mensagem do banco", async () => {
    reset();
    respostas = [respostaDe({ message: "permissão negada", code: "42501" }, 403)];

    const erro: unknown = await buscarOportunidadesParaSelecao("acme").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("permissão negada");
  });
});

describe("listarStaffParaSelecao", () => {
  it("pede ao Postgres só os três papéis de staff — `client` não entra no filtro", async () => {
    reset();
    respostas = [respostaDe([])];

    await listarStaffParaSelecao();

    const url = decodeURIComponent(chamadas[0].url);
    expect(url).toContain("role=in.(owner,manager,member)");
    expect(url).not.toContain("client");
  });

  it("pede só perfil ativo, projeção explícita e teto nomeado", async () => {
    reset();
    respostas = [respostaDe([])];

    await listarStaffParaSelecao();

    const url = decodeURIComponent(chamadas[0].url);
    expect(url).toContain("active=eq.true");
    expect(url).toContain("select=id,full_name");
    expect(url).toContain("limit=200");
  });

  it("mapeia os três papéis de staff que o banco devolve (id, nome)", async () => {
    reset();
    respostas = [
      respostaDe([
        { id: "11111111-1111-4111-8111-111111111111", full_name: "Olívia Owner" },
        { id: "22222222-2222-4222-8222-222222222222", full_name: "Marina Manager A" },
        { id: "44444444-4444-4444-8444-444444444444", full_name: "Meire Member" },
      ]),
    ];

    const staff = await listarStaffParaSelecao();

    expect(staff).toEqual([
      { id: "11111111-1111-4111-8111-111111111111", nome: "Olívia Owner" },
      { id: "22222222-2222-4222-8222-222222222222", nome: "Marina Manager A" },
      { id: "44444444-4444-4444-8444-444444444444", nome: "Meire Member" },
    ]);
  });

  it("recusa no teto exato em vez de devolver lista truncada", async () => {
    reset();
    respostas = [
      respostaDe(Array.from({ length: 200 }, (_, i) => ({ id: `p-${i}`, full_name: "Alguém" }))),
    ];

    await expect(listarStaffParaSelecao()).rejects.toThrow(
      "A lista de pessoas do time veio no teto de 200 e pode estar incompleta.",
    );
  });
});

describe("criarReuniao", () => {
  const DADOS = {
    titulo: "Kickoff ACME",
    tipo: "kickoff_cliente" as const,
    startsAt: "2026-09-15T13:00:00.000Z",
    duracaoMinutos: 60,
    clienteId: "2222e222-e11b-11d1-a111-111111111111",
    oportunidadeId: null,
    local: "Sala 1",
    notas: null,
    participantes: ["3333e333-e11b-11d1-a111-111111111111"],
  };

  it("insere a reunião e depois os participantes, e devolve o id", async () => {
    reset();
    respostas = [
      respostaDe({ id: REUNIAO_CRUA.id }),
      respostaDe([{ profile_id: DADOS.participantes[0] }]),
    ];

    const id = await criarReuniao(DADOS);

    expect(id).toBe(REUNIAO_CRUA.id);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0].url).toContain("/rest/v1/meetings");
    expect(chamadas[1].url).toContain("/rest/v1/meeting_attendees");
    expect(JSON.parse(chamadas[1].corpo)).toEqual([
      { meeting_id: REUNIAO_CRUA.id, profile_id: DADOS.participantes[0] },
    ]);
  });

  it("NÃO manda organizer_id no corpo — a trigger carimba", async () => {
    reset();
    respostas = [
      respostaDe({ id: REUNIAO_CRUA.id }),
      respostaDe([{ profile_id: DADOS.participantes[0] }]),
    ];

    await criarReuniao(DADOS);

    const corpoDaReuniao = JSON.parse(chamadas[0].corpo) as Record<string, unknown>;
    expect(Object.keys(corpoDaReuniao)).not.toContain("organizer_id");
  });

  it("INSERT de participante barrado na criação (204, zero linha) não passa por sucesso", async () => {
    reset();
    respostas = [respostaDe({ id: REUNIAO_CRUA.id }), respostaDe([])];

    const erro: unknown = await criarReuniao(DADOS).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toContain("sem os participantes");
  });

  it("MEET-4: participantes com zero linha lança ReuniaoCriadaSemParticipantes com o id parcial", async () => {
    reset();
    respostas = [respostaDe({ id: REUNIAO_CRUA.id }), respostaDe([])];

    const erro: unknown = await criarReuniao(DADOS).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ReuniaoCriadaSemParticipantes);
    expect((erro as { reuniaoId: string }).reuniaoId).toBe(REUNIAO_CRUA.id);
  });

  it("MEET-4: participantes com 502 sem corpo lança a mesma classe, com o id parcial", async () => {
    reset();
    respostas = [
      respostaDe({ id: REUNIAO_CRUA.id }),
      () => Promise.resolve(new Response("", { status: 502 })),
    ];

    const erro: unknown = await criarReuniao(DADOS).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ReuniaoCriadaSemParticipantes);
    expect((erro as { reuniaoId: string }).reuniaoId).toBe(REUNIAO_CRUA.id);
  });

  it("MEET-4: falha no INSERT de meetings NÃO é ReuniaoCriadaSemParticipantes", async () => {
    reset();
    respostas = [respostaDe({ message: "recusado", code: "42501" }, 403)];

    const erro: unknown = await criarReuniao(DADOS).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).not.toBeInstanceOf(ReuniaoCriadaSemParticipantes);
    expect(chamadas).toHaveLength(1);
  });
});

describe("atualizarReuniao", () => {
  it("edição bem-sucedida (organizador, owner ou manager) não lança", async () => {
    reset();
    respostas = [respostaDe([{ id: REUNIAO_CRUA.id }])];

    await expect(
      atualizarReuniao(REUNIAO_CRUA.id, { titulo: "Novo título" }),
    ).resolves.toBeUndefined();
  });

  it("barrado pela RLS: 204 com zero linha vira mensagem de recusa, não silêncio", async () => {
    reset();
    respostas = [respostaDe([], 200)];

    const erro: unknown = await atualizarReuniao(REUNIAO_CRUA.id, { titulo: "Novo título" }).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(
      "Editar reunião é de quem organizou, do owner ou do manager.",
    );
  });

  const ANTIGO = "3333e333-e11b-11d1-a111-111111111111";
  const NOVO = "4444e444-e11b-11d1-a111-111111111111";

  it("sincroniza por delta: insere quem entrou ANTES de apagar quem saiu", async () => {
    reset();
    respostas = [
      respostaDe([{ id: REUNIAO_CRUA.id }]),
      respostaDe([{ profile_id: ANTIGO }]),
      respostaDe([{ profile_id: NOVO }]),
      respostaDe([{ profile_id: ANTIGO }]),
    ];

    await atualizarReuniao(REUNIAO_CRUA.id, { participantes: [NOVO] });

    expect(chamadas).toHaveLength(4);

    const leitura = chamadas[1];
    expect(leitura.url).toContain("select=profile_id");
    expect(leitura.url).toContain(`meeting_id=eq.${REUNIAO_CRUA.id}`);

    expect(JSON.parse(chamadas[2].corpo)).toEqual([
      { meeting_id: REUNIAO_CRUA.id, profile_id: NOVO },
    ]);

    const exclusao = decodeURIComponent(chamadas[3].url);
    expect(exclusao).toContain(`profile_id=in.(${ANTIGO})`);
    expect(exclusao).toContain("select=profile_id");
  });

  it("quem continua na lista não é reinserido nem apagado", async () => {
    reset();
    respostas = [respostaDe([{ id: REUNIAO_CRUA.id }]), respostaDe([{ profile_id: ANTIGO }])];

    await atualizarReuniao(REUNIAO_CRUA.id, { participantes: [ANTIGO] });

    expect(chamadas).toHaveLength(2);
  });

  it("esvaziar a lista apaga só quem estava nela, provando a linha", async () => {
    reset();
    respostas = [
      respostaDe([{ id: REUNIAO_CRUA.id }]),
      respostaDe([{ profile_id: ANTIGO }]),
      respostaDe([{ profile_id: ANTIGO }]),
    ];

    await atualizarReuniao(REUNIAO_CRUA.id, { participantes: [] });

    expect(chamadas).toHaveLength(3);
    expect(decodeURIComponent(chamadas[2].url)).toContain(`profile_id=in.(${ANTIGO})`);
  });

  it("INSERT de participante barrado pela RLS (204, zero linha) tem mensagem própria", async () => {
    reset();
    respostas = [respostaDe([{ id: REUNIAO_CRUA.id }]), respostaDe([]), respostaDe([])];

    const erro: unknown = await atualizarReuniao(REUNIAO_CRUA.id, {
      participantes: [NOVO],
    }).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(
      "A reunião foi salva, mas a lista de participantes não. Reabra a reunião e confira quem está nela.",
    );
  });

  it("DELETE de participante barrado pela RLS (204, zero linha) tem a mesma mensagem", async () => {
    reset();
    respostas = [
      respostaDe([{ id: REUNIAO_CRUA.id }]),
      respostaDe([{ profile_id: ANTIGO }]),
      respostaDe([]),
    ];

    const erro: unknown = await atualizarReuniao(REUNIAO_CRUA.id, { participantes: [] }).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(
      "A reunião foi salva, mas a lista de participantes não. Reabra a reunião e confira quem está nela.",
    );
  });
});

describe("cancelarReuniao", () => {
  it("grava cancelada_em e o motivo, e não lança quando a RLS permite", async () => {
    reset();
    respostas = [respostaDe([{ id: REUNIAO_CRUA.id }])];

    await cancelarReuniao(REUNIAO_CRUA.id, "Cliente remarcou");

    const corpo = JSON.parse(chamadas[0].corpo) as Record<string, unknown>;
    expect(corpo.motivo_do_cancelamento).toBe("Cliente remarcou");
    expect(corpo.cancelada_por).toBe(idDaSessao);
    expect(typeof corpo.cancelada_em).toBe("string");
    expect(chamadas[0].url).toContain("cancelada_em=is.null");
  });

  it("zero linha (já cancelada, ou barrado pela RLS) vira mensagem que cobre os dois casos", async () => {
    reset();
    respostas = [respostaDe([], 200)];

    const erro: unknown = await cancelarReuniao(REUNIAO_CRUA.id, "Cliente remarcou").catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(
      "Esta reunião já estava cancelada, ou cancelar é só de quem organizou, do owner ou do manager. Recarregue a página.",
    );
  });

  it("sem sessão local, recusa antes de chamar o banco (cancelada_por não pode ficar ausente)", async () => {
    reset();
    idDaSessao = undefined;
    respostas = [respostaDe([{ id: REUNIAO_CRUA.id }])];

    const erro: unknown = await cancelarReuniao(REUNIAO_CRUA.id, "Cliente remarcou").catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect(chamadas).toHaveLength(0);
  });
});

describe("apagarReuniao (D-067)", () => {
  it("apaga pelo id e pede a linha de volta, sem lançar quando a RLS permite", async () => {
    reset();
    respostas = [respostaDe([{ id: REUNIAO_CRUA.id }])];

    await apagarReuniao(REUNIAO_CRUA.id);

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toContain("/rest/v1/meetings?");
    expect(chamadas[0].url).toContain(`id=eq.${REUNIAO_CRUA.id}`);
    expect(chamadas[0].url).toContain("select=id");
  });

  it("zero linha (barrado pela RLS, ou já apagada) vira mensagem que diz quem apaga", async () => {
    reset();
    respostas = [respostaDe([], 200)];

    const erro: unknown = await apagarReuniao(REUNIAO_CRUA.id).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(
      "Só quem organizou, o owner e o manager apagam a reunião. Se ela já foi apagada em outra tela, recarregue a página.",
    );
  });

  it("erro do banco sai por erroDoBanco, com o code preservado", async () => {
    reset();
    respostas = [respostaDe({ message: "permission denied", code: "42501" }, 403)];

    const erro: unknown = await apagarReuniao(REUNIAO_CRUA.id).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as { code?: string }).code).toBe("42501");
  });
});

describe("consultarConflitos", () => {
  it("chama a RPC com o intervalo certo (inicio e inicio + duracao)", async () => {
    reset();
    respostas = [respostaDe([{ profile_id: "3333e333-e11b-11d1-a111-111111111111" }])];

    const conflitantes = await consultarConflitos(
      ["3333e333-e11b-11d1-a111-111111111111"],
      "2026-09-15T13:00:00.000Z",
      60,
    );

    expect(conflitantes).toEqual(["3333e333-e11b-11d1-a111-111111111111"]);
    expect(chamadas[0].url.endsWith("/rest/v1/rpc/horarios_ocupados")).toBe(true);
    expect(JSON.parse(chamadas[0].corpo)).toEqual({
      p_profiles: ["3333e333-e11b-11d1-a111-111111111111"],
      p_inicio: "2026-09-15T13:00:00.000Z",
      p_fim: "2026-09-15T14:00:00.000Z",
    });
  });
});

describe("consultarConflitos — excluir a própria reunião (achado 4)", () => {
  it("com id, manda p_excluir_reuniao para a RPC", async () => {
    reset();
    respostas = [respostaDe([])];

    await consultarConflitos(
      ["3333e333-e11b-11d1-a111-111111111111"],
      "2026-09-15T13:00:00.000Z",
      60,
      REUNIAO_CRUA.id,
    );

    expect(JSON.parse(chamadas[0].corpo)).toEqual({
      p_profiles: ["3333e333-e11b-11d1-a111-111111111111"],
      p_inicio: "2026-09-15T13:00:00.000Z",
      p_fim: "2026-09-15T14:00:00.000Z",
      p_excluir_reuniao: REUNIAO_CRUA.id,
    });
  });

  it("sem id (criação), NÃO manda a chave — o default da função é null", async () => {
    reset();
    respostas = [respostaDe([])];

    await consultarConflitos(
      ["3333e333-e11b-11d1-a111-111111111111"],
      "2026-09-15T13:00:00.000Z",
      60,
    );

    expect(Object.keys(JSON.parse(chamadas[0].corpo) as Record<string, unknown>)).not.toContain(
      "p_excluir_reuniao",
    );
  });
});

describe("desfazerCancelamento (D-069, C6)", () => {
  const LIDA = "2026-09-08T12:00:00.123456+00:00";
  const MENSAGEM_DE_ZERO_LINHA =
    "O cancelamento não foi desfeito: a reunião mudou em outra tela, ou desfazer não é seu.";

  it("zera as três colunas da ata, só em reunião cancelada e só no cancelamento que a tela leu", async () => {
    reset();
    respostas = [respostaDe([{ id: "r1" }])];
    await desfazerCancelamento("r1", LIDA);
    const url = decodeURIComponent(chamadas[0].url);
    expect(url).toContain("id=eq.r1");
    expect(url).toContain("cancelada_em=not.is.null");
    expect(url).toContain(`cancelada_em=eq.${LIDA}`);
    expect(url).toContain("select=id");
    expect(JSON.parse(chamadas[0].corpo)).toEqual({
      cancelada_em: null,
      cancelada_por: null,
      motivo_do_cancelamento: null,
    });
  });

  it("o valor lido vai codificado: o + do fuso não vira espaço no caminho", async () => {
    reset();
    respostas = [respostaDe([{ id: "r1" }])];
    await desfazerCancelamento("r1", LIDA);
    expect(chamadas[0].url).toContain("cancelada_em=eq.2026-09-08T12%3A00%3A00.123456%2B00%3A00");
  });

  it("zero linha (já desfeita, cancelada de novo noutra tela, ou barrada pela RLS) diz o que fazer", async () => {
    reset();
    respostas = [respostaDe([])];
    await expect(desfazerCancelamento("r1", LIDA)).rejects.toThrow(MENSAGEM_DE_ZERO_LINHA);
  });

  it("aba velha: o filtro leva o valor lido, e quando o banco não acha a linha a frase aparece", async () => {
    reset();
    respostas = [respostaDe([])];
    const erro: unknown = await desfazerCancelamento("r1", "2026-09-01T09:00:00.000+00:00").catch(
      (e: unknown) => e,
    );
    expect(decodeURIComponent(chamadas[0].url)).toContain(
      "cancelada_em=eq.2026-09-01T09:00:00.000+00:00",
    );
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(MENSAGEM_DE_ZERO_LINHA);
  });

  it("a recusa do gatilho chega com a frase e o code", async () => {
    reset();
    respostas = [
      respostaDe(
        {
          code: "23514",
          message: "Esta reunião já estava cancelada. Para corrigir, desfaça o cancelamento.",
          details: null,
          hint: null,
        },
        400,
      ),
    ];
    const erro: unknown = await desfazerCancelamento("r1", LIDA).catch((e: unknown) => e);
    expect(erro).toMatchObject({
      code: "23514",
      message: "Esta reunião já estava cancelada. Para corrigir, desfaça o cancelamento.",
    });
  });
});

describe("atualizarReuniao com organizador (D-069, C7)", () => {
  it("com organizadorId manda organizer_id", async () => {
    reset();
    respostas = [respostaDe([{ id: "r1" }])];
    await atualizarReuniao("r1", { organizadorId: "p1" });
    expect(JSON.parse(chamadas[0].corpo)).toEqual({ organizer_id: "p1" });
  });

  it("sem organizadorId não manda organizer_id (controle)", async () => {
    reset();
    respostas = [respostaDe([{ id: "r1" }])];
    await atualizarReuniao("r1", { titulo: "Novo" });
    expect(JSON.parse(chamadas[0].corpo)).toEqual({ titulo: "Novo" });
  });
});

describe("erro do banco", () => {
  it("sai por erroDoBanco: instanceof Error, e a mensagem do banco chega", async () => {
    reset();
    respostas = [respostaDe({ message: "coluna não existe", code: "42703" }, 400)];

    const erro: unknown = await listarReunioes().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("coluna não existe");
  });
});
