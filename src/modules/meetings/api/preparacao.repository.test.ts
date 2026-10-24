import { beforeEach, describe, expect, it, vi } from "vitest";

let chamadas: { tabela: string; url: string }[] = [];
let corpos: Record<string, unknown> = {};
let tabelaQueFalha: string | null = null;

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { createClient } = await import("@supabase/supabase-js");

  const real = createClient("http://exemplo.invalido", "chave-publica-de-teste", {
    global: {
      fetch: ((input: RequestInfo | URL) => {
        const bruta = String(input);
        const tabela = new URL(bruta).pathname.replace("/rest/v1/", "");
        chamadas.push({ tabela, url: decodeURIComponent(bruta) });
        const cabecalhos = { "Content-Type": "application/json" };
        if (tabela === tabelaQueFalha) {
          return Promise.resolve(
            new Response(JSON.stringify({ message: "falha simulada", code: "XX000" }), {
              status: 500,
              headers: cabecalhos,
            }),
          );
        }
        if (!(tabela in corpos)) {
          return Promise.reject(new Error(`nenhuma resposta definida para ${tabela}`));
        }
        return Promise.resolve(
          new Response(JSON.stringify(corpos[tabela]), { status: 200, headers: cabecalhos }),
        );
      }) as unknown as typeof globalThis.fetch,
    },
  });

  real.auth.getSession = (async () => ({
    data: { session: { user: { id: "9b1f2c1a-0000-4000-8000-000000000001" } } },
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  return { supabaseV2: real };
});

const { lerPreparacao } = await import("./preparacao.repository");

const OPP = "0a000000-0000-4000-8000-000000000001";
const CLI = "0b000000-0000-4000-8000-000000000001";
const DONO = "0c000000-0000-4000-8000-000000000001";

const REUNIAO = {
  id: "0d000000-0000-4000-8000-000000000001",
  startsAt: "2026-10-05T17:00:00.000Z",
  oportunidadeId: OPP as string | null,
  clienteId: CLI as string | null,
};

const OWNER = { papel: "owner" as const, usuarioId: DONO };

const OPORTUNIDADE_CRUA = {
  id: OPP,
  name: "Academia Corpo",
  segment: "Fitness",
  nicho: "Academia",
  owner_id: DONO,
  contact_name: "Rita",
  contact_email: "rita@exemplo.invalido",
  contact_phone: "11 98888-7777",
  lead_source: "Google",
  channel: "inbound",
  estimated_value: 2500,
  next_followup_at: "2026-10-03",
  r1_agendada_em: "2026-09-20T13:00:00.000Z",
  r1_realizada_em: null,
  r2_agendada_em: null,
  r2_realizada_em: null,
  pipeline_stages: { nome: "R1" },
  profiles: { full_name: "Ana" },
};

const EVENTO_CRU = {
  id: "0e000000-0000-4000-8000-000000000001",
  event_type: "call",
  content: "Ligou",
  created_at: "2026-09-21T12:00:00.000Z",
  profiles: { full_name: "Ana" },
};

const RESPOSTA_CRUA = {
  question_key: "orcamento",
  option_index: 0,
  points: 2,
  is_ko: false,
  catalog_version: 1,
};

const CATALOGO_CRU = {
  value: {
    version: 1,
    questions: [
      {
        key: "orcamento",
        label: "Orçamento",
        prompt: "Qual?",
        options: [{ label: "Acima de 5 mil", points: 2 }],
      },
    ],
  },
};

const CLIENTE_CRU = {
  id: CLI,
  name: "Acme",
  status: "active",
  segment: "Varejo",
  nicho: "Óptica",
  contact_name: "Bia",
  contact_email: null,
  contact_phone: null,
  owner_id: DONO,
  signed_at: "2026-08-01",
  confidencial: true,
  profiles: { full_name: "Ana" },
};

const CONTRATO_CRU = {
  id: "0f000000-0000-4000-8000-000000000001",
  name: "Tráfego mensal",
  contract_type: "mrr",
  business_unit: "demanda",
  monthly_value: 3500,
  total_value: null,
  billing_months: null,
  start_date: "2026-08-01",
  status: "active",
};

const JORNADA_CRUA = {
  id: "1a000000-0000-4000-8000-000000000001",
  client_id: CLI,
  template_versao: 1,
  iniciada_em: "2026-08-02T12:00:00.000Z",
  concluida_em: null,
  cliente: { name: "Acme" },
  onboarding_phases: [
    {
      id: "f2",
      ordem: 2,
      nome: "Etapa 2",
      descricao: "",
      periodo: "",
      responsavel: "CS",
      liberada_em: null,
      onboarding_tasks: [],
    },
    {
      id: "f1",
      ordem: 1,
      nome: "Etapa 1",
      descricao: "",
      periodo: "",
      responsavel: "CS",
      liberada_em: "2026-08-02T12:00:00.000Z",
      onboarding_tasks: [
        {
          id: "t2",
          ordem: 2,
          titulo: "B",
          papel: "CS",
          deadline_days: 2,
          internal_task_id: null,
          concluida_em: null,
        },
        {
          id: "t1",
          ordem: 1,
          titulo: "A",
          papel: "CS",
          deadline_days: 1,
          internal_task_id: null,
          concluida_em: "2026-08-03T12:00:00.000Z",
        },
      ],
    },
  ],
};

const TAREFA_CRUA = {
  id: "1b000000-0000-4000-8000-000000000001",
  title: "Relatório",
  due_date: "2026-10-01",
  col: "todo",
  responsavel: { full_name: "Ana" },
};

const ANTERIOR_CRUA = {
  id: "1c000000-0000-4000-8000-000000000001",
  titulo: "Kickoff",
  tipo: "kickoff_cliente",
  starts_at: "2026-09-01T13:00:00.000Z",
  notas: "Combinado X",
};

function responderTudo(): void {
  corpos = {
    opportunities: [OPORTUNIDADE_CRUA],
    opportunity_events: [EVENTO_CRU],
    qualification_answers: [RESPOSTA_CRUA],
    app_settings: CATALOGO_CRU,
    clients: [CLIENTE_CRU],
    contracts: [CONTRATO_CRU],
    onboarding_journeys: [JORNADA_CRUA],
    internal_tasks: [TAREFA_CRUA],
    meetings: [ANTERIOR_CRUA],
  };
}

function urlDe(tabela: string): string {
  const achada = chamadas.find((c) => c.tabela === tabela);
  if (achada === undefined) throw new Error(`nenhuma chamada a ${tabela}`);
  return achada.url;
}

const tabelasChamadas = () => chamadas.map((c) => c.tabela).sort();

beforeEach(() => {
  chamadas = [];
  tabelaQueFalha = null;
  responderTudo();
});

describe("lerPreparacao: reunião com lead e cliente, como owner", () => {
  it("lê as nove fontes e converte para o domínio", async () => {
    const r = await lerPreparacao(REUNIAO, OWNER);

    expect(tabelasChamadas()).toEqual([
      "app_settings",
      "clients",
      "contracts",
      "internal_tasks",
      "meetings",
      "onboarding_journeys",
      "opportunities",
      "opportunity_events",
      "qualification_answers",
    ]);
    expect(r.oportunidadeId).toBe(OPP);
    expect(r.oportunidade).toEqual({
      id: OPP,
      nome: "Academia Corpo",
      segmento: "Fitness",
      nicho: "Academia",
      estagioNome: "R1",
      responsavelNome: "Ana",
      contatoNome: "Rita",
      contatoEmail: "rita@exemplo.invalido",
      contatoTelefone: "11 98888-7777",
      origem: "Google",
      canal: "inbound",
      valorEstimado: 2500,
      proximoFollowUp: "2026-10-03",
      r1AgendadaEm: "2026-09-20T13:00:00.000Z",
      r1RealizadaEm: null,
      r2AgendadaEm: null,
      r2RealizadaEm: null,
    });
    expect(r.eventos).toEqual([
      {
        id: EVENTO_CRU.id,
        tipo: "call",
        conteudo: "Ligou",
        autorNome: "Ana",
        criadoEm: EVENTO_CRU.created_at,
      },
    ]);
    expect(r.respostas).toEqual([
      { questionKey: "orcamento", optionIndex: 0, points: 2, isKo: false },
    ]);
    expect(r.catalogo?.version).toBe(1);
    expect(r.clienteId).toBe(CLI);
    expect(r.cliente).toEqual({
      id: CLI,
      nome: "Acme",
      status: "active",
      segmento: "Varejo",
      nicho: "Óptica",
      contatoNome: "Bia",
      contatoEmail: null,
      contatoTelefone: null,
      responsavelId: DONO,
      responsavelNome: "Ana",
      assinadoEm: "2026-08-01",
      confidencial: true,
    });
    expect(r.contratos).toEqual([
      {
        id: CONTRATO_CRU.id,
        nome: "Tráfego mensal",
        tipo: "mrr",
        linhaDeNegocio: "demanda",
        valorMensal: 3500,
        valorTotal: null,
        mesesDeCobranca: null,
        inicio: "2026-08-01",
      },
    ]);
    expect(r.jornada?.etapas.map((e) => e.nome)).toEqual(["Etapa 1", "Etapa 2"]);
    expect(r.jornada?.etapas[0]?.itens.map((i) => i.id)).toEqual(["t1", "t2"]);
    expect(r.tarefas).toEqual([
      { id: TAREFA_CRUA.id, titulo: "Relatório", prazo: "2026-10-01", responsavelNome: "Ana" },
    ]);
    expect(r.reunioesAnteriores).toEqual([
      {
        id: ANTERIOR_CRUA.id,
        titulo: "Kickoff",
        tipo: "kickoff_cliente",
        startsAt: ANTERIOR_CRUA.starts_at,
        notas: "Combinado X",
      },
    ]);
  });

  it("projeção explícita: nenhum select=*, nada de closed_mrr/closed_tcv nem da nota confidencial, mas a marca sim (critério 15, D-043)", async () => {
    await lerPreparacao(REUNIAO, OWNER);

    for (const { url } of chamadas) expect(url).not.toContain("select=*");
    expect(urlDe("opportunities")).not.toMatch(/closed_mrr|closed_tcv/);
    expect(urlDe("opportunities")).toContain(`id=eq.${OPP}`);
    expect(urlDe("clients")).not.toContain("confidencial_nota");
    expect(decodeURIComponent(urlDe("clients"))).toMatch(/\bconfidencial\b/);
    expect(urlDe("clients")).toContain(`id=eq.${CLI}`);
    expect(urlDe("app_settings")).toContain("key=eq.qualification_questions");
  });

  it("listas com filtro, ordem e limite da spec (critérios 9, 10, 11 e 15)", async () => {
    await lerPreparacao(REUNIAO, OWNER);

    const eventos = urlDe("opportunity_events");
    expect(eventos).toContain(`opportunity_id=eq.${OPP}`);
    expect(eventos).toContain("order=created_at.desc");
    expect(eventos).toContain("limit=21");
    expect(eventos).toContain("event_type=neq.stage_change");
    expect(eventos).not.toMatch(/from_stage|to_stage/);
    expect(eventos).toContain("profiles!opportunity_events_actor_id_fkey(full_name)");
    expect(eventos).not.toMatch(/(^|[ ,])profiles\(/);

    const respostas = urlDe("qualification_answers");
    expect(respostas).toContain(`opportunity_id=eq.${OPP}`);
    expect(respostas).toContain("limit=50");

    const contratos = urlDe("contracts");
    expect(contratos).toContain(`client_id=eq.${CLI}`);
    expect(contratos).toContain("status=eq.active");
    expect(contratos).toContain("order=start_date.desc");
    expect(contratos).toContain("limit=50");

    const jornada = urlDe("onboarding_journeys");
    expect(jornada).toContain(`client_id=eq.${CLI}`);
    expect(jornada).toContain("order=concluida_em.desc.nullsfirst,iniciada_em.desc");
    expect(jornada).toContain("limit=1");

    const tarefas = urlDe("internal_tasks");
    expect(tarefas).toContain(`client_id=eq.${CLI}`);
    expect(tarefas).toContain("col=neq.done");
    expect(tarefas).toContain("order=due_date.asc.nullslast");
    expect(tarefas).toContain("limit=21");

    const anteriores = urlDe("meetings");
    expect(anteriores).toContain(`or=(opportunity_id.eq.${OPP},client_id.eq.${CLI})`);
    expect(anteriores).toContain(`starts_at=lt.${REUNIAO.startsAt}`);
    expect(anteriores).toContain("cancelada_em=is.null");
    expect(anteriores).toContain("order=starts_at.desc");
    expect(anteriores).toContain("limit=6");
  });
});

describe("contratos: a consulta só roda para quem a policy deixa ler (critério 5)", () => {
  it.each([
    ["member, mesmo sendo o responsável", { papel: "member" as const, usuarioId: DONO }],
    [
      "manager de outro cliente",
      { papel: "manager" as const, usuarioId: "0c000000-0000-4000-8000-000000000999" },
    ],
  ])("%s: não consulta e devolve null", async (_quem, contexto) => {
    const r = await lerPreparacao(REUNIAO, contexto);

    expect(r.contratos).toBeNull();
    expect(tabelasChamadas()).not.toContain("contracts");
    expect(r.cliente?.id).toBe(CLI);
    expect(tabelasChamadas()).toContain("internal_tasks");
  });

  it("controle positivo: manager responsável consulta e recebe a lista", async () => {
    const r = await lerPreparacao(REUNIAO, { papel: "manager", usuarioId: DONO });

    expect(tabelasChamadas()).toContain("contracts");
    expect(r.contratos).toHaveLength(1);
  });
});

describe("o vínculo decide o que se lê", () => {
  it("só lead: não lê cliente, contratos, onboarding nem tarefas; reuniões pelo lead", async () => {
    const r = await lerPreparacao({ ...REUNIAO, clienteId: null }, OWNER);

    expect(tabelasChamadas()).toEqual([
      "app_settings",
      "meetings",
      "opportunities",
      "opportunity_events",
      "qualification_answers",
    ]);
    expect(urlDe("meetings")).toContain(`or=(opportunity_id.eq.${OPP})`);
    expect(r).toMatchObject({
      clienteId: null,
      cliente: null,
      contratos: null,
      jornada: null,
      tarefas: [],
    });
  });

  it("só cliente: não lê lead, eventos, respostas nem catálogo; reuniões pelo cliente", async () => {
    const r = await lerPreparacao({ ...REUNIAO, oportunidadeId: null }, OWNER);

    expect(tabelasChamadas()).toEqual([
      "clients",
      "contracts",
      "internal_tasks",
      "meetings",
      "onboarding_journeys",
    ]);
    expect(urlDe("meetings")).toContain(`or=(client_id.eq.${CLI})`);
    expect(r).toMatchObject({
      oportunidadeId: null,
      oportunidade: null,
      eventos: [],
      catalogo: null,
    });
  });

  it("sem vínculo: nenhuma leitura (Review Focus 3)", async () => {
    const r = await lerPreparacao({ ...REUNIAO, oportunidadeId: null, clienteId: null }, OWNER);

    expect(chamadas).toEqual([]);
    expect(r.reunioesAnteriores).toEqual([]);
  });

  it("lead e cliente que não voltam viram null, sem erro, e contratos nem são consultados (critério 13)", async () => {
    corpos.opportunities = [];
    corpos.clients = [];

    const r = await lerPreparacao(REUNIAO, OWNER);

    expect(r.oportunidade).toBeNull();
    expect(r.cliente).toBeNull();
    expect(r.contratos).toBeNull();
    expect(tabelasChamadas()).not.toContain("contracts");
  });
});

describe("falha de leitura derruba a ficha inteira (spec §2.6, critério 14)", () => {
  it.each(["opportunity_events", "internal_tasks", "meetings", "app_settings", "contracts"])(
    "falha em %s rejeita com o erro do banco",
    async (tabela) => {
      tabelaQueFalha = tabela;
      await expect(lerPreparacao(REUNIAO, OWNER)).rejects.toThrow("falha simulada");
    },
  );

  it("controle: sem falha, resolve", async () => {
    await expect(lerPreparacao(REUNIAO, OWNER)).resolves.toMatchObject({ clienteId: CLI });
  });
});
