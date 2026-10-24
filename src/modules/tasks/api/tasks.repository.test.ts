import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  repetir,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

let resultado: RespostaFalsa = UMA_LINHA;
let porTabela: Readonly<Record<string, RespostaFalsa>> = {};
let chamadas: ChamadaRegistrada[] = [];
let payloadDoUpdate: unknown;
let limitePedido: unknown;
let filtroIn: unknown;

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  return {
    supabaseV2: clienteFalso(
      (cadeia) => porTabela[String(cadeia[0]?.args[0])] ?? resultado,
      (c: ChamadaRegistrada) => {
        chamadas.push(c);
        if (c.metodo === "update") payloadDoUpdate = c.args[0];
        if (c.metodo === "limit") limitePedido = c.args[0];
        if (c.metodo === "in") filtroIn = c.args;
      },
    ),
  };
});

beforeEach(() => {
  porTabela = {};
  chamadas = [];
});

const {
  adicionarLink,
  adicionarParticipantes,
  apagarTarefa,
  atualizarLink,
  atualizarTarefa,
  criarTarefa,
  lerCatalogo,
  lerClientesParaSelecao,
  lerPessoasDoTime,
  lerTarefas,
  moverTarefa,
  removerLink,
  removerParticipante,
} = await import("./tasks.repository");

const TAREFA = "d0000000-0000-4000-8000-000000000002";

describe("erro do PostgREST vira Error de verdade, não objeto cru (I1)", () => {
  beforeEach(() => {
    resultado = { data: [{ id: TAREFA }], error: null };
  });

  it("atualizarTarefa propaga error.message como instância de Error", async () => {
    resultado = { data: null, error: { message: "prioridade inválida", code: "22P02" } };

    const erro: unknown = await atualizarTarefa(TAREFA, { titulo: "Novo título" }).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("prioridade inválida");
  });

  it("apagarTarefa, fora do 23503, propaga error.message como instância de Error", async () => {
    resultado = { data: null, error: { message: "conexão perdida", code: "08006" } };

    const erro: unknown = await apagarTarefa(TAREFA).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("conexão perdida");
  });

  it("apagarTarefa no 23503 continua com a mensagem traduzida — o positivo ao lado do fix genérico", async () => {
    resultado = { data: null, error: { message: "update or delete violates fk", code: "23503" } };

    const erro: unknown = await apagarTarefa(TAREFA).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(
      "Esta tarefa já gerou uma ocorrência seguinte e não pode ser apagada.",
    );
  });
});

describe("título em branco é recusado, e vazio vira null nos campos nuláveis (M1)", () => {
  beforeEach(() => {
    resultado = { data: [{ id: TAREFA }], error: null };
    payloadDoUpdate = undefined;
  });

  it("🔴 título em branco (só espaço) é recusado ANTES de chegar no banco", async () => {
    const erro: unknown = await atualizarTarefa(TAREFA, { titulo: "   " }).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("O título da tarefa não pode ficar em branco.");
    expect(payloadDoUpdate).toBeUndefined();
  });

  it("o positivo ao lado: título não-vazio grava sem espaço nas pontas", async () => {
    await atualizarTarefa(TAREFA, { titulo: "  Novo título  " });

    expect(payloadDoUpdate).toEqual({ title: "Novo título" });
  });

  it("🔴 descrição vazia vira null, não string vazia gravada", async () => {
    await atualizarTarefa(TAREFA, { descricao: "" });

    expect(payloadDoUpdate).toEqual({ description: null });
  });

  it("🔴 categoria e tipo chegam ao update cada um na sua coluna (valores distintos)", async () => {
    await atualizarTarefa(TAREFA, { categoria: "Site · web", tipo: "Subir em domínio" });

    expect(payloadDoUpdate).toEqual({ category: "Site · web", task_type: "Subir em domínio" });
  });

  it("o positivo ao lado: sem categoria nem tipo no que veio, o update não os leva", async () => {
    await atualizarTarefa(TAREFA, { prazo: "2026-10-10" });

    expect(payloadDoUpdate).toEqual({ due_date: "2026-10-10" });
  });
});

describe("recorrência vai ao banco (A1.3)", () => {
  beforeEach(() => {
    resultado = { data: [{ id: TAREFA }], error: null };
    payloadDoUpdate = undefined;
  });

  it("quinzenal grava recurrence", async () => {
    await atualizarTarefa(TAREFA, { recorrencia: "quinzenal" });

    expect(payloadDoUpdate).toEqual({ recurrence: "quinzenal" });
  });

  it("nenhuma também grava: parar a corrente é escrita, não ausência", async () => {
    await atualizarTarefa(TAREFA, { recorrencia: "nenhuma" });

    expect(payloadDoUpdate).toEqual({ recurrence: "nenhuma" });
  });

  it.each(["semanal", "mensal"] as const)("%s grava recurrence", async (valor) => {
    await atualizarTarefa(TAREFA, { recorrencia: valor });

    expect(payloadDoUpdate).toEqual({ recurrence: valor });
  });

  it("recorrência junto do título no mesmo UPDATE leva as duas chaves, e só elas", async () => {
    await atualizarTarefa(TAREFA, { titulo: "  Revisar contrato  ", recorrencia: "semanal" });

    expect(payloadDoUpdate).toEqual({ title: "Revisar contrato", recurrence: "semanal" });
  });

  it("RLS com zero linha recusa com a frase de permissão", async () => {
    resultado = ZERO_LINHAS;

    await expect(atualizarTarefa(TAREFA, { recorrencia: "mensal" })).rejects.toThrow(
      "Você não tem permissão para editar esta tarefa.",
    );
  });
});

const RECUSA_PARTICIPANTES =
  "Você não pode mexer nos participantes desta tarefa: só owner, manager, o responsável, os participantes e quem criou a tarefa mexem.";
const RECUSA_LINKS =
  "Você não pode mexer nos links desta tarefa: só owner, manager, o responsável e os participantes mexem.";

const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
  {
    nome: "moverTarefa",
    chamar: () => moverTarefa(TAREFA, "doing"),
    recusa: "Você não tem permissão para mover esta tarefa.",
  },
  {
    nome: "atualizarTarefa",
    chamar: () => atualizarTarefa(TAREFA, { titulo: "Novo título" }),
    recusa: "Você não tem permissão para editar esta tarefa.",
  },
  {
    nome: "apagarTarefa",
    chamar: () => apagarTarefa(TAREFA),
    recusa:
      "Só owner, manager e quem criou a tarefa podem apagá-la, e card de onboarding não se apaga por aqui.",
  },
  {
    nome: "adicionarParticipantes",
    chamar: () => adicionarParticipantes(TAREFA, ["p1"]),
    recusa: RECUSA_PARTICIPANTES,
  },
  {
    nome: "removerParticipante",
    chamar: () => removerParticipante(TAREFA, "p1"),
    recusa: RECUSA_PARTICIPANTES,
  },
  {
    nome: "adicionarLink",
    chamar: () => adicionarLink(TAREFA, "Briefing", "https://docs.google.com/x"),
    recusa: RECUSA_LINKS,
  },
  {
    nome: "removerLink",
    chamar: () => removerLink("l1"),
    recusa: RECUSA_LINKS,
  },
  {
    nome: "atualizarLink",
    chamar: () => atualizarLink("l1", "Briefing", "https://docs.google.com/x"),
    recusa: RECUSA_LINKS,
  },
];

describe("write barrado pela RLS volta zero linha, e o repositório recusa com a mensagem certa", () => {
  beforeEach(() => {
    resultado = UMA_LINHA;
  });

  for (const write of WRITES) {
    it(`${write.nome} lança quando a RLS devolve lista vazia`, async () => {
      resultado = ZERO_LINHAS;

      await expect(write.chamar()).rejects.toThrow(write.recusa);
    });

    it(`${write.nome} lança igual quando o PostgREST devolve data null`, async () => {
      resultado = NENHUM_DADO;

      await expect(write.chamar()).rejects.toThrow(write.recusa);
    });

    it(`${write.nome} passa quando a linha volta — o positivo ao lado do negativo`, async () => {
      resultado = UMA_LINHA;

      await expect(write.chamar()).resolves.toBeUndefined();
    });
  }
});

const ITEM_DO_CATALOGO = { category: "Onboarding · método", task_type: "Kickoff", ordem: 1 };
const PESSOA = { id: "p1", full_name: "Ana" };
const CLIENTE = { id: "c1", name: "Acme" };

describe("teto das listas de referência das tarefas", () => {
  beforeEach(() => {
    limitePedido = undefined;
  });

  it("lerCatalogo recusa no teto exato em vez de devolver lista truncada", async () => {
    resultado = { data: repetir(ITEM_DO_CATALOGO, 200), error: null };

    await expect(lerCatalogo()).rejects.toThrow(
      "A lista de tipos de tarefa veio no teto de 200 e pode estar incompleta. " +
        "Escolher a partir de uma lista truncada esconde opção válida. " +
        "Esta leitura precisa de filtro ou paginação antes de crescer.",
    );
    expect(limitePedido).toBe(200);
  });

  it("uma abaixo do teto, lerCatalogo devolve tudo mapeado", async () => {
    resultado = { data: repetir(ITEM_DO_CATALOGO, 199), error: null };

    const catalogo = await lerCatalogo();

    expect(catalogo).toHaveLength(199);
    expect(catalogo[0]).toEqual({ categoria: "Onboarding · método", tipo: "Kickoff" });
  });

  it("lerPessoasDoTime recusa no teto exato em vez de devolver lista truncada", async () => {
    resultado = { data: repetir(PESSOA, 50), error: null };

    await expect(lerPessoasDoTime()).rejects.toThrow(
      "A lista de pessoas do time veio no teto de 50 e pode estar incompleta.",
    );
    expect(limitePedido).toBe(50);
  });

  it("uma abaixo do teto, lerPessoasDoTime devolve tudo mapeado", async () => {
    resultado = { data: repetir(PESSOA, 49), error: null };

    const pessoas = await lerPessoasDoTime();

    expect(pessoas).toHaveLength(49);
    expect(pessoas[0]).toEqual({ id: "p1", nome: "Ana" });
  });

  it("lerClientesParaSelecao recusa no teto exato em vez de devolver lista truncada", async () => {
    resultado = { data: repetir(CLIENTE, 200), error: null };

    await expect(lerClientesParaSelecao()).rejects.toThrow(
      "A lista de clientes veio no teto de 200 e pode estar incompleta.",
    );
    expect(limitePedido).toBe(200);
  });

  it("uma abaixo do teto, lerClientesParaSelecao devolve tudo mapeado", async () => {
    resultado = { data: repetir(CLIENTE, 199), error: null };

    const clientes = await lerClientesParaSelecao();

    expect(clientes).toHaveLength(199);
    expect(clientes[0]).toEqual({ id: "c1", nome: "Acme" });
  });
});

describe("lerPessoasDoTime — só staff (ONB-1)", () => {
  beforeEach(() => {
    filtroIn = undefined;
  });

  it("pede ao banco só owner, manager e member — nunca client", async () => {
    resultado = { data: [PESSOA], error: null };

    await lerPessoasDoTime();

    expect(filtroIn).toEqual(["role", ["owner", "manager", "member"]]);
  });

  it("com o filtro, o que o banco devolve chega mapeado", async () => {
    resultado = { data: [PESSOA], error: null };

    expect(await lerPessoasDoTime()).toEqual([{ id: "p1", nome: "Ana" }]);
  });
});

function linhaCrua(p: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: TAREFA,
    title: "Site da Acme",
    description: null,
    category: "Site · web",
    task_type: "Desenvolver site",
    assignee_id: "u1",
    client_id: "c1",
    col: "doing",
    priority: "alta",
    due_date: null,
    recurrence: "nenhuma",
    raiz_recorrente: null,
    created_by: "u9",
    responsavel: { full_name: "Ana" },
    cliente: { name: "Acme", drive_folder_id: "1AbC_d-9" },
    participantes: [],
    links: [],
    ...p,
  };
}

describe("lerTarefas — participantes, links e pasta do Drive chegam no domínio (D-066)", () => {
  it("participantes por nome, links pela ordem de inclusão, e a URL da pasta", async () => {
    resultado = {
      data: [
        linhaCrua({
          participantes: [
            { profile_id: "u3", pessoa: { full_name: "Zeca", active: false } },
            { profile_id: "u2", pessoa: { full_name: "Bia", active: true } },
          ],
          links: [
            {
              id: "l2",
              label: "Domínio",
              url: "https://registro.br",
              created_at: "2026-10-05T12:00:00Z",
            },
            {
              id: "l1",
              label: "Briefing",
              url: "https://docs.google.com/x",
              created_at: "2026-10-05T11:00:00Z",
            },
          ],
        }),
      ],
      error: null,
    };

    const { tarefas } = await lerTarefas({ responsavelId: null }, "2026-10-05");

    expect(tarefas[0]).toMatchObject({
      criadoPor: "u9",
      cliente: "Acme",
      pastaDoDriveDoCliente: "https://drive.google.com/drive/folders/1AbC_d-9",
      participantes: [
        { id: "u2", nome: "Bia", ativo: true },
        { id: "u3", nome: "Zeca", ativo: false },
      ],
      links: [
        { id: "l1", rotulo: "Briefing", url: "https://docs.google.com/x" },
        { id: "l2", rotulo: "Domínio", url: "https://registro.br" },
      ],
    });
  });

  it("sem cliente: sem pasta; listas vazias chegam vazias", async () => {
    resultado = { data: [linhaCrua({ client_id: null, cliente: null })], error: null };

    const { tarefas } = await lerTarefas({ responsavelId: null }, "2026-10-05");

    expect(tarefas[0]).toMatchObject({
      cliente: null,
      pastaDoDriveDoCliente: null,
      participantes: [],
      links: [],
    });
  });

  it("cliente sem pasta, ou com pasta em branco: null", async () => {
    resultado = {
      data: [
        linhaCrua({ cliente: { name: "Acme", drive_folder_id: null } }),
        linhaCrua({ id: "outra", cliente: { name: "Acme", drive_folder_id: "  " } }),
      ],
      error: null,
    };

    const { tarefas } = await lerTarefas({ responsavelId: null }, "2026-10-05");

    expect(tarefas.map((t) => t.pastaDoDriveDoCliente)).toEqual([null, null]);
  });

  it("🔴 o embed dos links pede no máximo 20 por tarefa, o teto do banco", async () => {
    resultado = { data: [], error: null };

    await lerTarefas({ responsavelId: null }, "2026-10-05");

    expect(chamadas).toContainEqual({ metodo: "limit", args: [20, { referencedTable: "links" }] });
    expect(chamadas).toContainEqual({ metodo: "range", args: [0, 99] });
  });

  it("🔴 o responsável principal que também participa aparece só como responsável", async () => {
    resultado = {
      data: [
        linhaCrua({
          assignee_id: "u1",
          participantes: [
            { profile_id: "u1", pessoa: { full_name: "Ana", active: true } },
            { profile_id: "u2", pessoa: { full_name: "Bia", active: true } },
          ],
        }),
      ],
      error: null,
    };

    const { tarefas } = await lerTarefas({ responsavelId: null }, "2026-10-05");

    expect(tarefas[0]?.responsavelId).toBe("u1");
    expect(tarefas[0]?.participantes).toEqual([{ id: "u2", nome: "Bia", ativo: true }]);
  });

  it("sem responsável, todos os participantes ficam (o positivo ao lado)", async () => {
    resultado = {
      data: [
        linhaCrua({
          assignee_id: null,
          responsavel: null,
          participantes: [
            { profile_id: "u1", pessoa: { full_name: "Ana", active: true } },
            { profile_id: "u2", pessoa: { full_name: "Bia", active: true } },
          ],
        }),
      ],
      error: null,
    };

    const { tarefas } = await lerTarefas({ responsavelId: null }, "2026-10-05");

    expect(tarefas[0]?.participantes.map((p) => p.id)).toEqual(["u1", "u2"]);
  });

  it("🔴 id de pasta com caractere de URL é codificado, não vira outro caminho", async () => {
    resultado = {
      data: [linhaCrua({ cliente: { name: "Acme", drive_folder_id: "a/b?c" } })],
      error: null,
    };

    const { tarefas } = await lerTarefas({ responsavelId: null }, "2026-10-05");

    expect(tarefas[0]?.pastaDoDriveDoCliente).toBe(
      "https://drive.google.com/drive/folders/a%2Fb%3Fc",
    );
  });
});

describe("lerTarefas — filtro por pessoa: responsável OU participante (D-066)", () => {
  const PESSOA_DO_FILTRO = "3f1c2b4a-0d5e-4f6a-8b7c-9d0e1f2a3b4c";
  const PARTICIPA_1 = "0b6d1c52-6f1e-4c55-9a0e-2a4f1f9d7e01";
  const PARTICIPA_2 = "0b6d1c52-6f1e-4c55-9a0e-2a4f1f9d7e02";
  const participa = (ids: readonly string[]): RespostaFalsa => ({
    data: ids.map((task_id) => ({ task_id })),
    error: null,
  });

  beforeEach(() => {
    resultado = { data: [], error: null };
  });

  it("🔴 id fora do formato UUID recusa ANTES de consultar o banco", async () => {
    await expect(
      lerTarefas({ responsavelId: "x),assignee_id.neq.(0" }, "2026-10-05"),
    ).rejects.toThrow("O filtro de pessoa não é um id válido.");
    expect(chamadas).toEqual([]);
  });

  it("com participação, o filtro é responsável OU uma das tarefas em que participa", async () => {
    porTabela = { internal_task_participants: participa([PARTICIPA_1, PARTICIPA_2]) };

    await lerTarefas({ responsavelId: PESSOA_DO_FILTRO }, "2026-10-05");

    expect(chamadas).toContainEqual({
      metodo: "or",
      args: [`assignee_id.eq.${PESSOA_DO_FILTRO},id.in.(${PARTICIPA_1},${PARTICIPA_2})`],
    });
    expect(chamadas).not.toContainEqual({ metodo: "eq", args: ["assignee_id", PESSOA_DO_FILTRO] });
  });

  it("sem participação, só o responsável, por eq (o positivo ao lado)", async () => {
    porTabela = { internal_task_participants: participa([]) };

    await lerTarefas({ responsavelId: PESSOA_DO_FILTRO }, "2026-10-05");

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["assignee_id", PESSOA_DO_FILTRO] });
    expect(chamadas.some((c) => c.metodo === "or")).toBe(false);
  });

  it("as participações lidas são só da pessoa, só das abertas, com teto 200", async () => {
    porTabela = { internal_task_participants: participa([]) };

    await lerTarefas({ responsavelId: PESSOA_DO_FILTRO }, "2026-10-05");

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["profile_id", PESSOA_DO_FILTRO] });
    expect(chamadas).toContainEqual({ metodo: "neq", args: ["tarefa.col", "done"] });
    expect(chamadas).toContainEqual({ metodo: "limit", args: [200] });
  });

  it("com 'Mostrar concluídas', as participações em concluídas também entram", async () => {
    porTabela = { internal_task_participants: participa([]) };

    await lerTarefas({ responsavelId: PESSOA_DO_FILTRO, incluirConcluidas: true }, "2026-10-05");

    expect(chamadas).not.toContainEqual({ metodo: "neq", args: ["tarefa.col", "done"] });
  });

  it("🔴 'Só vencidas' junto de 'Mostrar concluídas': as participações em concluídas seguem de fora", async () => {
    porTabela = { internal_task_participants: participa([]) };

    await lerTarefas(
      { responsavelId: PESSOA_DO_FILTRO, incluirConcluidas: true, somenteVencidas: true },
      "2026-10-05",
    );

    expect(chamadas).toContainEqual({ metodo: "neq", args: ["tarefa.col", "done"] });
  });

  it("🔴 id de participação fora do formato UUID recusa ANTES de montar a consulta principal", async () => {
    porTabela = {
      internal_task_participants: participa([PARTICIPA_1, "x),assignee_id.neq.(0"]),
    };

    await expect(lerTarefas({ responsavelId: PESSOA_DO_FILTRO }, "2026-10-05")).rejects.toThrow(
      "O filtro de pessoa não é um id válido.",
    );

    expect(chamadas.filter((c) => c.metodo === "from").map((c) => c.args[0])).toEqual([
      "internal_task_participants",
    ]);
    expect(chamadas.some((c) => c.metodo === "or")).toBe(false);
  });

  it("ids de participação válidos: lê as participações e depois a consulta principal (o positivo ao lado)", async () => {
    porTabela = { internal_task_participants: participa([PARTICIPA_1, PARTICIPA_2]) };

    await lerTarefas({ responsavelId: PESSOA_DO_FILTRO }, "2026-10-05");

    expect(chamadas.filter((c) => c.metodo === "from").map((c) => c.args[0])).toEqual([
      "internal_task_participants",
      "internal_tasks",
    ]);
  });

  it("🔴 200 participações abertas recusam alto em vez de cortar calado", async () => {
    porTabela = { internal_task_participants: participa(repetir(PARTICIPA_1, 200)) };

    await expect(lerTarefas({ responsavelId: PESSOA_DO_FILTRO }, "2026-10-05")).rejects.toThrow(
      "A lista de tarefas em que a pessoa participa veio no teto de 200 e pode estar incompleta.",
    );
  });

  it("199 participações passam (o positivo ao lado)", async () => {
    porTabela = { internal_task_participants: participa(repetir(PARTICIPA_1, 199)) };

    await expect(
      lerTarefas({ responsavelId: PESSOA_DO_FILTRO }, "2026-10-05"),
    ).resolves.toMatchObject({ tarefas: [] });
  });

  it("sem filtro de pessoa, nem consulta participações", async () => {
    await lerTarefas({ responsavelId: null }, "2026-10-05");

    expect(chamadas.filter((c) => c.metodo === "from").map((c) => c.args[0])).toEqual([
      "internal_tasks",
    ]);
  });
});

describe("criarTarefa devolve o id criado (D-066)", () => {
  const NOVA = {
    titulo: "Site da Acme",
    descricao: null,
    categoria: "Site · web",
    tipo: "Desenvolver site",
    responsavelId: null,
    clienteId: null,
    prazo: null,
    prioridade: "media",
    recorrencia: "nenhuma",
    participantes: ["p1"],
  } as const;

  it("devolve o id que o banco devolveu", async () => {
    resultado = { data: [{ id: TAREFA }], error: null };

    await expect(criarTarefa(NOVA)).resolves.toBe(TAREFA);
  });

  it("🔴 sem linha de volta, lança dizendo para conferir", async () => {
    resultado = NENHUM_DADO;

    await expect(criarTarefa(NOVA)).rejects.toThrow(
      "A tarefa foi enviada, mas o banco não a devolveu. Recarregue a página para conferir se ela foi criada.",
    );
  });

  it("os participantes não entram no insert da tarefa", async () => {
    resultado = { data: [{ id: TAREFA }], error: null };

    await criarTarefa(NOVA);

    const insert = chamadas.find((c) => c.metodo === "insert")?.args[0];
    expect(Object.keys(insert as object).sort()).toEqual([
      "assignee_id",
      "category",
      "client_id",
      "description",
      "due_date",
      "priority",
      "recurrence",
      "task_type",
      "title",
    ]);
  });
});

describe("participantes e links (D-066)", () => {
  it("adicionarParticipantes grava uma linha por pessoa, cada uma com objeto literal", async () => {
    resultado = { data: [{ task_id: TAREFA }], error: null };

    await adicionarParticipantes(TAREFA, ["p1", "p2"]);

    expect(chamadas.filter((c) => c.metodo === "insert").map((c) => c.args[0])).toEqual([
      { task_id: TAREFA, profile_id: "p1" },
      { task_id: TAREFA, profile_id: "p2" },
    ]);
  });

  it("🔴 INSERT recusado pela RLS (42501) diz quem pode mexer", async () => {
    resultado = {
      data: null,
      error: {
        message:
          'new row violates row-level security policy for table "internal_task_participants"',
        code: "42501",
      },
    };

    await expect(adicionarParticipantes(TAREFA, ["p1"])).rejects.toThrow(RECUSA_PARTICIPANTES);
  });

  it("🔴 a mesma pessoa duas vezes (23505) diz que ela já participa", async () => {
    resultado = { data: null, error: { message: "duplicate key value", code: "23505" } };

    await expect(adicionarParticipantes(TAREFA, ["p1"])).rejects.toThrow(
      "Esta pessoa já participa da tarefa.",
    );
  });

  it("removerParticipante filtra pela tarefa E pela pessoa", async () => {
    resultado = { data: [{ task_id: TAREFA }], error: null };

    await removerParticipante(TAREFA, "p1");

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["task_id", TAREFA] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["profile_id", "p1"] });
  });

  it("🔴 adicionarLink valida antes do banco: http:// nem chega a consultar", async () => {
    await expect(adicionarLink(TAREFA, "Site", "http://a.com")).rejects.toThrow(
      "O link precisa começar com https:// e ter até 2.000 caracteres.",
    );
    expect(chamadas).toEqual([]);
  });

  it("adicionarLink grava rótulo e URL sem espaço nas pontas, e sem autor no payload", async () => {
    resultado = { data: [{ id: "l1" }], error: null };

    await adicionarLink(TAREFA, " Briefing ", " https://docs.google.com/x ");

    expect(chamadas.find((c) => c.metodo === "insert")?.args[0]).toEqual({
      task_id: TAREFA,
      label: "Briefing",
      url: "https://docs.google.com/x",
    });
  });

  it("🔴 INSERT de link recusado pela RLS (42501) diz quem pode mexer", async () => {
    resultado = {
      data: null,
      error: {
        message: 'new row violates row-level security policy for table "internal_task_links"',
        code: "42501",
      },
    };

    await expect(adicionarLink(TAREFA, "Site", "https://a.com")).rejects.toThrow(RECUSA_LINKS);
  });

  it("🔴 o 21º link (23514 do gatilho do teto) chega com a frase do banco", async () => {
    resultado = {
      data: null,
      error: {
        message: "A tarefa já tem 20 links. Remova um antes de incluir outro.",
        code: "23514",
      },
    };

    const erro: unknown = await adicionarLink(TAREFA, "Site", "https://a.com").catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(
      "A tarefa já tem 20 links. Remova um antes de incluir outro.",
    );
    expect((erro as { code?: string }).code).toBe("23514");
  });

  const ERRO_NAO_MAPEADO = { message: "boom", code: "XX000" };
  const NAO_MAPEADOS: ReadonlyArray<{ nome: string; chamar: () => Promise<void> }> = [
    { nome: "adicionarParticipantes", chamar: () => adicionarParticipantes(TAREFA, ["p1"]) },
    { nome: "removerParticipante", chamar: () => removerParticipante(TAREFA, "p1") },
    { nome: "adicionarLink", chamar: () => adicionarLink(TAREFA, "Site", "https://a.com") },
    { nome: "removerLink", chamar: () => removerLink("l1") },
    { nome: "atualizarLink", chamar: () => atualizarLink("l1", "Site", "https://a.com") },
  ];

  for (const caso of NAO_MAPEADOS) {
    it(`🔴 ${caso.nome}: código não mapeado mantém a mensagem e o code do banco`, async () => {
      resultado = { data: null, error: ERRO_NAO_MAPEADO };

      const erro: unknown = await caso.chamar().catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(Error);
      expect((erro as Error).message).toBe("boom");
      expect((erro as { code?: string }).code).toBe("XX000");
      const frasesDeRecusa = [
        RECUSA_PARTICIPANTES,
        RECUSA_LINKS,
        "Esta pessoa já participa da tarefa.",
      ];
      expect(frasesDeRecusa).not.toContain((erro as Error).message);
    });
  }
});

describe("atualizarLink (entrega B)", () => {
  beforeEach(() => {
    resultado = UMA_LINHA;
    payloadDoUpdate = undefined;
  });

  it("javascript: é recusado antes do banco, com a frase da tela", async () => {
    await expect(atualizarLink("l1", "Site", "javascript:alert(1)")).rejects.toThrow(
      "O link precisa começar com https:// e ter até 2.000 caracteres.",
    );
    expect(chamadas).toEqual([]);
  });

  it("rótulo em branco é recusado antes do banco", async () => {
    await expect(atualizarLink("l1", "   ", "https://a.com")).rejects.toThrow(
      "Dê um nome ao link.",
    );
    expect(chamadas).toEqual([]);
  });

  it("grava rótulo e endereço sem espaço nas pontas, só no link do id", async () => {
    await atualizarLink("l1", " Contrato ", " https://docs.google.com/y ");

    expect(payloadDoUpdate).toEqual({ label: "Contrato", url: "https://docs.google.com/y" });
    expect(chamadas).toContainEqual(expect.objectContaining({ metodo: "eq", args: ["id", "l1"] }));
    expect(chamadas).toContainEqual(expect.objectContaining({ metodo: "select", args: ["id"] }));
  });

  it("23514 do CHECK chega como Error com o code do banco", async () => {
    resultado = {
      data: null,
      error: {
        message:
          'new row for relation "internal_task_links" violates check constraint "internal_task_links_url_check"',
        code: "23514",
      },
    };

    const erro: unknown = await atualizarLink("l1", "Site", "https://a.com").catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect((erro as { code?: string }).code).toBe("23514");
  });
});
