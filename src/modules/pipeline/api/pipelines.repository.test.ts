import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

let resposta: RespostaFalsa = UMA_LINHA;
let chamadas: ChamadaRegistrada[] = [];
const rpc = vi.fn();

let decidirResposta: (cadeia: readonly ChamadaRegistrada[]) => RespostaFalsa = () => resposta;

const ehWrite = (cadeia: readonly ChamadaRegistrada[]) =>
  cadeia.some((c) => c.metodo === "update" || c.metodo === "insert" || c.metodo === "delete");

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  return {
    supabaseV2: {
      ...clienteFalso(
        (cadeia) => decidirResposta(cadeia),
        (chamada) => chamadas.push(chamada),
      ),
      rpc: (...args: unknown[]) => rpc(...args),
    },
  };
});

const {
  apagarPipeline,
  arquivarPipeline,
  criarPipeline,
  listarCampos,
  listarEstagios,
  listarMotivos,
  listarPipelines,
  renomearPipeline,
  salvarCampos,
  salvarEstagios,
  salvarMotivos,
} = await import("./pipelines.repository");

const PIPELINE = "10000000-0000-4000-8000-000000000001";

const eqs = () => chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
const metodos = () => chamadas.map((c) => c.metodo);
const args = (metodo: string) => chamadas.filter((c) => c.metodo === metodo).map((c) => c.args);

beforeEach(() => {
  resposta = UMA_LINHA;
  chamadas = [];
  decidirResposta = () => resposta;
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("listarPipelines", () => {
  it("projeta colunas explícitas, filtra ativo por padrão, ordena e limita", async () => {
    resposta = {
      data: [
        { id: "p2", nome: "Parcerias", ordem: 1, ativo: true },
        { id: PIPELINE, nome: "Comercial", ordem: 0, ativo: true },
      ],
      error: null,
    };

    const lista = await listarPipelines();

    expect(chamadas[0]).toEqual({ metodo: "from", args: ["pipelines"] });
    expect(args("select")).toEqual([["id, nome, ordem, ativo"]]);
    expect(eqs()).toEqual([["ativo", true]]);
    expect(args("order")[0]).toEqual(["ordem"]);
    expect(args("limit")).toEqual([[51]]);
    expect(lista).toEqual([
      { id: "p2", nome: "Parcerias", ordem: 1, ativo: true },
      { id: PIPELINE, nome: "Comercial", ordem: 0, ativo: true },
    ]);
  });

  it("com incluirArquivados não filtra `ativo` — o positivo do caso acima", async () => {
    resposta = { data: [], error: null };

    await listarPipelines(true);

    expect(eqs()).toEqual([]);
  });

  it("erro com code vira Error com a mensagem do banco", async () => {
    resposta = { data: null, error: { message: "permission denied", code: "42501" } };

    await expect(listarPipelines()).rejects.toThrow("permission denied");
  });
});

describe("listarEstagios", () => {
  it("filtra pelo pipeline e ordena por ordem", async () => {
    resposta = {
      data: [{ id: "e1", pipeline_id: PIPELINE, nome: "Prospecção", ordem: 1, tipo: "prospeccao" }],
      error: null,
    };

    const lista = await listarEstagios(PIPELINE);

    expect(chamadas[0]).toEqual({ metodo: "from", args: ["pipeline_stages"] });
    expect(args("select")).toEqual([["id, pipeline_id, nome, ordem, tipo"]]);
    expect(eqs()).toEqual([["pipeline_id", PIPELINE]]);
    expect(args("order")).toEqual([["ordem"]]);
    expect(args("limit")).toEqual([[31]]);
    expect(lista).toEqual([
      { id: "e1", pipelineId: PIPELINE, nome: "Prospecção", ordem: 1, tipo: "prospeccao" },
    ]);
  });
});

describe("listarMotivos", () => {
  it("filtra pelo pipeline, só ativos por padrão, ordena por tipo e ordem", async () => {
    resposta = {
      data: [
        {
          id: "m1",
          pipeline_id: PIPELINE,
          tipo: "descarte",
          rotulo: "Sem verba",
          ordem: 1,
          ativo: true,
        },
      ],
      error: null,
    };

    const lista = await listarMotivos(PIPELINE);

    expect(chamadas[0]).toEqual({ metodo: "from", args: ["motivos_de_saida"] });
    expect(args("select")).toEqual([["id, pipeline_id, tipo, rotulo, ordem, ativo"]]);
    expect(eqs()).toEqual([
      ["pipeline_id", PIPELINE],
      ["ativo", true],
    ]);
    expect(args("order")).toEqual([["tipo"], ["ordem"]]);
    expect(args("limit")).toEqual([[41]]);
    expect(lista).toEqual([
      {
        id: "m1",
        pipelineId: PIPELINE,
        tipo: "descarte",
        rotulo: "Sem verba",
        ordem: 1,
        ativo: true,
      },
    ]);
  });

  it("com incluirInativos não filtra `ativo`", async () => {
    resposta = { data: [], error: null };

    await listarMotivos(PIPELINE, true);

    expect(eqs()).toEqual([["pipeline_id", PIPELINE]]);
  });

  it("🔴 `tipo` fora de perda/descarte é recusado na leitura — a coluna é text no banco", async () => {
    resposta = {
      data: [
        { id: "m1", pipeline_id: PIPELINE, tipo: "outro", rotulo: "X", ordem: 1, ativo: true },
      ],
      error: null,
    };

    await expect(listarMotivos(PIPELINE)).rejects.toThrow("tipo de motivo desconhecido");
  });
});

describe("teto de leitura: uma acima do teto é recusada, o teto passa", () => {
  const pipeline = (i: number) => ({ id: `p${i}`, nome: `P${i}`, ordem: i, ativo: true });
  const estagio = (i: number) => ({
    id: `e${i}`,
    pipeline_id: PIPELINE,
    nome: `E${i}`,
    ordem: i,
    tipo: "prospeccao",
  });
  const motivo = (i: number) => ({
    id: `m${i}`,
    pipeline_id: PIPELINE,
    tipo: "perda",
    rotulo: `M${i}`,
    ordem: i,
    ativo: true,
  });
  const lista = <T>(n: number, fabrica: (i: number) => T) =>
    Array.from({ length: n }, (_, i) => fabrica(i + 1));

  it("🔴 listarPipelines com 51 linhas lança; com 50 (o teto) resolve", async () => {
    resposta = { data: lista(51, pipeline), error: null };
    await expect(listarPipelines()).rejects.toThrow(
      "A lista de pipelines passou do teto de 50 e pode estar incompleta.",
    );

    resposta = { data: lista(50, pipeline), error: null };
    await expect(listarPipelines()).resolves.toHaveLength(50);
  });

  it("🔴 listarEstagios com 31 linhas lança; com 30 (o que a RPC aceita) resolve", async () => {
    resposta = { data: lista(31, estagio), error: null };
    await expect(listarEstagios(PIPELINE)).rejects.toThrow(
      "A lista de estágios passou do teto de 30 e pode estar incompleta.",
    );

    resposta = { data: lista(30, estagio), error: null };
    await expect(listarEstagios(PIPELINE)).resolves.toHaveLength(30);
  });

  it("🔴 listarMotivos com 41 linhas lança; com 40 (o teto) resolve", async () => {
    resposta = { data: lista(41, motivo), error: null };
    await expect(listarMotivos(PIPELINE)).rejects.toThrow(
      "A lista de motivos passou do teto de 40 e pode estar incompleta.",
    );

    resposta = { data: lista(40, motivo), error: null };
    await expect(listarMotivos(PIPELINE)).resolves.toHaveLength(40);
  });
});

const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
  {
    nome: "renomearPipeline",
    chamar: () => renomearPipeline(PIPELINE, " Vendas "),
    recusa: "Renomear pipeline é do owner e do manager.",
  },
  {
    nome: "arquivarPipeline",
    chamar: () => arquivarPipeline(PIPELINE, false),
    recusa: "Arquivar pipeline é do owner e do manager.",
  },
];

describe("write barrado pela RLS volta zero linha, e o repositório recusa com a mensagem certa", () => {
  for (const write of WRITES) {
    it(`🔴 ${write.nome} lança quando a RLS devolve lista vazia`, async () => {
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

  it("renomearPipeline apara o nome e prende o id no WHERE", async () => {
    await renomearPipeline(PIPELINE, " Vendas ");

    expect(args("update")).toEqual([[{ nome: "Vendas" }]]);
    expect(eqs()).toEqual([["id", PIPELINE]]);
    expect(metodos()).toContain("select");
  });
});

describe("criarPipeline e salvarEstagios vão pela RPC, numa transação só", () => {
  it("criarPipeline chama create_pipeline com a lista na ordem e devolve o uuid", async () => {
    rpc.mockResolvedValue({ data: "p-novo", error: null });

    const id = await criarPipeline({
      nome: " Parcerias ",
      estagios: [
        { nome: "Contato", tipo: "prospeccao" },
        { nome: "Fechado", tipo: "fechado" },
        { nome: "Perdido", tipo: "perdido" },
        { nome: "Descartado", tipo: "descartado" },
      ],
    });

    expect(id).toBe("p-novo");
    expect(rpc).toHaveBeenCalledWith("create_pipeline", {
      p_nome: "Parcerias",
      p_estagios: [
        { id: null, nome: "Contato", tipo: "prospeccao" },
        { id: null, nome: "Fechado", tipo: "fechado" },
        { id: null, nome: "Perdido", tipo: "perdido" },
        { id: null, nome: "Descartado", tipo: "descartado" },
      ],
    });
    expect(chamadas).toHaveLength(0);
  });

  it("🔴 criarPipeline: a mensagem da RPC chega inteira (42501, 23514)", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Editar pipelines é do owner e do manager.", code: "42501" },
    });

    await expect(criarPipeline({ nome: "X", estagios: [] })).rejects.toThrow(
      "Editar pipelines é do owner e do manager.",
    );
  });

  it("salvarEstagios chama save_pipeline_stages com id dos existentes e null nos novos", async () => {
    await salvarEstagios(PIPELINE, [
      { id: "e1", nome: " Contato ", tipo: "prospeccao" },
      { nome: "Proposta", tipo: "r2" },
      { id: "e6", nome: "Fechado", tipo: "fechado" },
    ]);

    expect(rpc).toHaveBeenCalledWith("save_pipeline_stages", {
      p_pipeline_id: PIPELINE,
      p_estagios: [
        { id: "e1", nome: "Contato", tipo: "prospeccao" },
        { id: null, nome: "Proposta", tipo: "r2" },
        { id: "e6", nome: "Fechado", tipo: "fechado" },
      ],
    });
    expect(chamadas).toHaveLength(0);
  });

  it("🔴 salvarEstagios: 23503 (estágio com oportunidades) vira a frase do que fazer", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message:
          'update or delete on table "pipeline_stages" violates foreign key constraint "opportunities_stage_id_fkey" on table "opportunities"',
        code: "23503",
      },
    });

    await expect(salvarEstagios(PIPELINE, [])).rejects.toThrow(
      "Mova as oportunidades desse estágio antes de removê-lo.",
    );
  });

  it("🔴 criarPipeline: 23505 do unique de nome vira 'Já existe um pipeline com esse nome.'", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint "pipelines_nome_unico"',
        code: "23505",
      },
    });

    await expect(criarPipeline({ nome: " comercial ", estagios: [] })).rejects.toThrow(
      "Já existe um pipeline com esse nome.",
    );
  });

  it("🔴 renomearPipeline: o mesmo 23505, pela cadeia do update", async () => {
    resposta = {
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint "pipelines_nome_unico"',
        code: "23505",
      },
    };

    await expect(renomearPipeline(PIPELINE, "Comercial")).rejects.toThrow(
      "Já existe um pipeline com esse nome.",
    );
  });

  it("outro código em renomearPipeline NÃO vira a frase do nome: passa por erroDoBanco", async () => {
    resposta = {
      data: null,
      error: { message: "new row violates check constraint", code: "23514" },
    };

    const erro: unknown = await renomearPipeline(PIPELINE, "").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toContain("check constraint");
  });

  it("🔴 salvarEstagios: 23514 do banco (tipo em uso) passa por erroDoBanco", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message:
          "Estágio com oportunidades não muda de tipo. Crie outro estágio e mova as oportunidades.",
        code: "23514",
      },
    });

    const erro: unknown = await salvarEstagios(PIPELINE, []).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toContain("não muda de tipo");
  });
});

describe("apagarPipeline vai pela RPC apagar_pipeline", () => {
  it("chama apagar_pipeline com o id e nenhum write direto", async () => {
    await expect(apagarPipeline("p3")).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith("apagar_pipeline", { p_pipeline_id: "p3" });
    expect(chamadas).toHaveLength(0);
  });

  it("🔴 42501 'forbidden' do portão vira a frase de quem pode", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden", code: "42501" } });

    const erro: unknown = await apagarPipeline("p3").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("Apagar pipeline é do owner e do manager.");
    expect((erro as { code?: string }).code).toBe("42501");
  });

  it("🔴 a recusa em português do banco (23503, pipeline com oportunidades) chega inteira", async () => {
    const frase =
      "Este pipeline tem 2 oportunidade(s). Apague-as antes de apagar o pipeline, ou arquive o pipeline.";
    rpc.mockResolvedValue({ data: null, error: { message: frase, code: "23503" } });

    const erro: unknown = await apagarPipeline("p3").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(frase);
  });

  it("23514 (pipeline padrão, único ativo) também passa por erroDoBanco, sem virar a frase do portão", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Este é o único pipeline ativo. Reative outro antes de apagar este.",
        code: "23514",
      },
    });

    await expect(apagarPipeline("p3")).rejects.toThrow("Este é o único pipeline ativo.");
  });
});

describe("salvarMotivos reconcilia pela lista", () => {
  const ATUAIS = [
    { id: "m1", pipeline_id: PIPELINE, tipo: "perda", rotulo: "Preço", ordem: 1, ativo: true },
    { id: "m2", pipeline_id: PIPELINE, tipo: "perda", rotulo: "Sumiu", ordem: 2, ativo: true },
    {
      id: "m3",
      pipeline_id: PIPELINE,
      tipo: "descarte",
      rotulo: "Sem verba",
      ordem: 1,
      ativo: true,
    },
  ];

  const lendoAtuais =
    (escrita: RespostaFalsa) =>
    (cadeia: readonly ChamadaRegistrada[]): RespostaFalsa =>
      ehWrite(cadeia) ? escrita : { data: ATUAIS, error: null };

  it("apaga quem sumiu, atualiza quem tem id, insere quem não tem — ordem = posição por tipo", async () => {
    decidirResposta = lendoAtuais(UMA_LINHA);

    await salvarMotivos(PIPELINE, [
      { id: "m2", tipo: "perda", rotulo: "Sumiu depois da proposta", ativo: false },
      { tipo: "perda", rotulo: " Timing ", ativo: true },
      { id: "m3", tipo: "descarte", rotulo: "Sem verba", ativo: true },
    ]);

    expect(args("delete")).toHaveLength(1);
    expect(eqs()).toContainEqual(["id", "m1"]);
    expect(args("update")).toEqual([
      [{ rotulo: "Sumiu depois da proposta", ordem: 1, ativo: false }],
      [{ rotulo: "Sem verba", ordem: 1, ativo: true }],
    ]);
    expect(eqs()).toContainEqual(["id", "m2"]);
    expect(eqs()).toContainEqual(["id", "m3"]);
    const cadeiasDeUpdate = chamadas
      .map((c, i) => (c.metodo === "update" ? i : -1))
      .filter((i) => i >= 0)
      .map((inicio) => {
        const fim = chamadas.findIndex((c, i) => i > inicio && c.metodo === "from");
        return chamadas.slice(inicio, fim === -1 ? undefined : fim);
      });
    expect(cadeiasDeUpdate).toHaveLength(2);
    for (const cadeia of cadeiasDeUpdate) {
      expect(cadeia.map((c) => c.args)).toContainEqual(["pipeline_id", PIPELINE]);
    }
    expect(args("insert")).toEqual([
      [{ pipeline_id: PIPELINE, tipo: "perda", rotulo: "Timing", ordem: 2, ativo: true }],
    ]);
  });

  it("🔴 zero linha no update é recusa — e a mensagem diz o que fazer", async () => {
    decidirResposta = lendoAtuais(ZERO_LINHAS);

    await expect(
      salvarMotivos(PIPELINE, [{ id: "m1", tipo: "perda", rotulo: "Preço", ativo: true }]),
    ).rejects.toThrow("Editar motivos é do owner e do manager.");
  });

  it("o positivo do caso acima: uma linha de volta em cada write resolve", async () => {
    decidirResposta = lendoAtuais(UMA_LINHA);

    await expect(
      salvarMotivos(PIPELINE, [{ id: "m1", tipo: "perda", rotulo: "Preço", ativo: true }]),
    ).resolves.toBeUndefined();
  });

  it("🔴 rótulo repetido no mesmo tipo: o 23505 do unique chega com a frase do tipo", async () => {
    decidirResposta = lendoAtuais({
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint "motivos_de_saida_rotulo_unico"',
        code: "23505",
      },
    });

    await expect(
      salvarMotivos(PIPELINE, [
        { id: "m1", tipo: "perda", rotulo: "Preço", ativo: true },
        { id: "m2", tipo: "perda", rotulo: " preço ", ativo: true },
        { id: "m3", tipo: "descarte", rotulo: "Sem verba", ativo: true },
      ]),
    ).rejects.toThrow("Já existe um motivo de perda com esse rótulo.");
  });

  it("🔴 apagar motivo em uso: o 23503 do FK chega com a frase de desativar", async () => {
    decidirResposta = lendoAtuais({
      data: null,
      error: {
        message: 'violates foreign key constraint "opportunities_motivo_id_fkey"',
        code: "23503",
      },
    });

    await expect(salvarMotivos(PIPELINE, [])).rejects.toThrow(
      "Este motivo já foi usado em alguma oportunidade e não pode ser apagado. Desative-o em vez de apagar.",
    );
  });
});

const CAMPO_A = "aaaaaaaa-0000-4000-8000-000000000001";
const CAMPO_B = "bbbbbbbb-0000-4000-8000-000000000002";
const LINHA_DE_CAMPO = {
  id: CAMPO_A,
  pipeline_id: PIPELINE,
  nome: "Tem site?",
  tipo: "sim_nao",
  opcoes: null,
  obrigatorio: true,
  ordem: 1,
  ativo: true,
};
const RASCUNHO_A = {
  id: CAMPO_A,
  nome: "Tem site?",
  tipo: "sim_nao",
  opcoes: null,
  obrigatorio: true,
  ordem: 1,
  ativo: true,
} as const;

describe("listarCampos", () => {
  it("projeta colunas explícitas, filtra pipeline e só ativos por padrão, ordena por ordem, lê teto + 1", async () => {
    resposta = { data: [LINHA_DE_CAMPO], error: null };

    const lista = await listarCampos(PIPELINE);

    expect(chamadas[0]).toEqual({ metodo: "from", args: ["pipeline_campos"] });
    expect(args("select")).toEqual([
      ["id, pipeline_id, nome, tipo, opcoes, obrigatorio, ordem, ativo"],
    ]);
    expect(eqs()).toEqual([
      ["pipeline_id", PIPELINE],
      ["ativo", true],
    ]);
    expect(args("order")).toEqual([["ordem"]]);
    expect(args("limit")).toEqual([[31]]);
    expect(lista).toEqual([
      {
        id: CAMPO_A,
        pipelineId: PIPELINE,
        nome: "Tem site?",
        tipo: "sim_nao",
        opcoes: null,
        obrigatorio: true,
        ordem: 1,
        ativo: true,
      },
    ]);
  });

  it("com incluirInativos não filtra `ativo` — o positivo do caso acima", async () => {
    resposta = { data: [], error: null };

    await listarCampos(PIPELINE, true);

    expect(eqs()).toEqual([["pipeline_id", PIPELINE]]);
  });

  it("🔴 31 linhas lança; 30 (o teto, o que o banco aceita) resolve", async () => {
    const lista = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...LINHA_DE_CAMPO, id: `c${i}`, ordem: i + 1 }));

    resposta = { data: lista(31), error: null };
    await expect(listarCampos(PIPELINE)).rejects.toThrow(
      "A lista de campos passou do teto de 30 e pode estar incompleta.",
    );

    resposta = { data: lista(30), error: null };
    await expect(listarCampos(PIPELINE)).resolves.toHaveLength(30);
  });

  it("erro com code vira Error com a mensagem do banco", async () => {
    resposta = { data: null, error: { message: "permission denied", code: "42501" } };

    await expect(listarCampos(PIPELINE)).rejects.toThrow("permission denied");
  });
});

describe("salvarCampos reconcilia pela lista, como salvarMotivos", () => {
  const ATUAIS = [
    LINHA_DE_CAMPO,
    {
      ...LINHA_DE_CAMPO,
      id: CAMPO_B,
      nome: "Nicho",
      tipo: "lista",
      opcoes: ["Clínica", "Varejo"],
      obrigatorio: false,
      ordem: 2,
    },
  ];
  const lendoAtuais =
    (escrita: RespostaFalsa) =>
    (cadeia: readonly ChamadaRegistrada[]): RespostaFalsa =>
      ehWrite(cadeia) ? escrita : { data: ATUAIS, error: null };

  it("apaga quem sumiu, atualiza quem tem id (preso ao pipeline), insere quem não tem — nome aparado", async () => {
    decidirResposta = lendoAtuais(UMA_LINHA);

    await salvarCampos(PIPELINE, [
      {
        id: CAMPO_B,
        nome: " Nicho de atuação ",
        tipo: "lista",
        opcoes: ["Clínica", "Varejo", "Serviços"],
        obrigatorio: false,
        ordem: 1,
        ativo: false,
      },
      { nome: " Cidade ", tipo: "texto", opcoes: null, obrigatorio: true, ordem: 2, ativo: true },
    ]);

    expect(args("delete")).toHaveLength(1);
    expect(eqs()).toContainEqual(["id", CAMPO_A]);
    expect(args("update")).toEqual([
      [
        {
          nome: "Nicho de atuação",
          tipo: "lista",
          opcoes: ["Clínica", "Varejo", "Serviços"],
          obrigatorio: false,
          ordem: 1,
          ativo: false,
        },
      ],
    ]);
    const cadeiasDeWrite = chamadas
      .map((c, i) => (c.metodo === "update" || c.metodo === "delete" ? i : -1))
      .filter((i) => i >= 0)
      .map((inicio) => {
        const fim = chamadas.findIndex((c, i) => i > inicio && c.metodo === "from");
        return chamadas.slice(inicio, fim === -1 ? undefined : fim);
      });
    expect(cadeiasDeWrite).toHaveLength(2);
    for (const cadeia of cadeiasDeWrite) {
      expect(cadeia.map((c) => c.args)).toContainEqual(["pipeline_id", PIPELINE]);
      expect(cadeia.map((c) => c.metodo)).toContain("select");
    }
    expect(args("insert")).toEqual([
      [
        {
          pipeline_id: PIPELINE,
          nome: "Cidade",
          tipo: "texto",
          opcoes: null,
          obrigatorio: true,
          ordem: 2,
          ativo: true,
        },
      ],
    ]);
  });

  const MANTENDO_OS_DOIS = [
    { ...RASCUNHO_A },
    { ...RASCUNHO_A, id: CAMPO_B, nome: "Nicho", ordem: 2 },
  ];

  it("🔴 zero linha no update é recusa — e a mensagem diz o que fazer", async () => {
    decidirResposta = lendoAtuais(ZERO_LINHAS);

    await expect(salvarCampos(PIPELINE, MANTENDO_OS_DOIS)).rejects.toThrow(
      "Você não pode editar os campos deste pipeline.",
    );
    expect(args("delete")).toHaveLength(0);
    expect(args("update")).toHaveLength(1);
  });

  it("zero linha no delete é a mesma recusa", async () => {
    decidirResposta = lendoAtuais(ZERO_LINHAS);

    await expect(salvarCampos(PIPELINE, [])).rejects.toThrow(
      "Você não pode editar os campos deste pipeline.",
    );
  });

  it("o positivo dos dois casos acima: uma linha de volta em cada write resolve", async () => {
    decidirResposta = lendoAtuais(UMA_LINHA);

    await expect(salvarCampos(PIPELINE, MANTENDO_OS_DOIS)).resolves.toBeUndefined();
    await expect(salvarCampos(PIPELINE, [])).resolves.toBeUndefined();
  });

  it("🔴 nome repetido: o 23505 do unique chega como 'Já existe um campo com esse nome neste pipeline.'", async () => {
    decidirResposta = lendoAtuais({
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint "pipeline_campos_nome_unico"',
        code: "23505",
      },
    });

    await expect(
      salvarCampos(PIPELINE, [
        { ...RASCUNHO_A },
        { ...RASCUNHO_A, id: CAMPO_B, nome: " tem SITE? ", ordem: 2 },
      ]),
    ).rejects.toThrow("Já existe um campo com esse nome neste pipeline.");
  });

  it("🔴 apagar campo com valor gravado: o 23514 do gatilho chega com a frase do banco, inteira", async () => {
    decidirResposta = lendoAtuais({
      data: null,
      error: {
        message: "Este campo tem valor gravado em 2 oportunidades. Desative em vez de apagar.",
        code: "23514",
      },
    });

    const erro: unknown = await salvarCampos(PIPELINE, []).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(
      "Este campo tem valor gravado em 2 oportunidades. Desative em vez de apagar.",
    );
  });
});
