import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

import type { DadosDaLinha, LinhaDeImportacao } from "../domain/importacao";
import type { EstagioDoPipeline } from "../domain/pipeline";

let resposta: RespostaFalsa = UMA_LINHA;
let chamadas: ChamadaRegistrada[] = [];
const rpc = vi.fn();

let decidirResposta: (chamadasDaCadeia: readonly ChamadaRegistrada[]) => RespostaFalsa = () =>
  resposta;

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  return {
    supabaseV2: {
      ...clienteFalso(
        (chamadasDaCadeia) => decidirResposta(chamadasDaCadeia),
        (chamada) => chamadas.push(chamada),
      ),
      rpc: (...args: unknown[]) => rpc(...args),
    },
  };
});

const {
  apagarOportunidade,
  atualizarDadosDaOportunidade,
  atualizarDatasDeReuniao,
  atualizarEmLote,
  atualizarNutricao,
  corrigirMotivoDeSaida,
  corrigirTextoDoEvento,
  criarOportunidade,
  importarOportunidades,
  lerPrimeiroContato,
  lerTempoAtePrimeiroContato,
  listarEventos,
  listarOportunidades,
  listarResponsaveis,
  moverParaEstagio,
  registrarToque,
} = await import("./pipeline.repository");

const OPORTUNIDADE = "d0000000-0000-4000-8000-000000000002";
const PIPELINE = "10000000-0000-4000-8000-000000000001";

const TEXTO_DA_RECUSA_DA_NOTA =
  "A nota não foi corrigida: ela mudou em outra tela, ou corrigir é de quem escreveu, do owner e do manager (mudança de etapa não se corrige).";

function estagio(tipo: EstagioDoPipeline["tipo"], ordem: number): EstagioDoPipeline {
  return { id: `estagio-${tipo}`, pipelineId: PIPELINE, nome: tipo, ordem, tipo };
}
const R1 = estagio("r1", 4);
const R2 = estagio("r2", 5);
const PERDIDO = estagio("perdido", 7);

const MOTIVO_DE_PERDA = { tipo: "perda", motivoId: "motivo-preco", obs: null } as const;

afterEach(() => {
  for (const chamada of chamadas) {
    if (chamada.metodo !== "update") continue;
    expect(chamada.args[0]).not.toHaveProperty("pipeline_id");
  }
});

describe("erro do PostgREST vira Error de verdade, não objeto cru (I1)", () => {
  beforeEach(() => {
    resposta = { data: [{ id: OPORTUNIDADE }], error: null };
  });

  it("atualizarDadosDaOportunidade propaga error.message como instância de Error", async () => {
    resposta = { data: null, error: { message: "e-mail inválido", code: "23514" } };

    const erro: unknown = await atualizarDadosDaOportunidade(OPORTUNIDADE, {
      nome: "Novo Nome",
    }).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("e-mail inválido");
  });
});

const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
  {
    nome: "atualizarDatasDeReuniao",
    chamar: () => atualizarDatasDeReuniao(OPORTUNIDADE, { r1RealizadaEm: "2026-09-05T17:00:00Z" }),
    recusa: "Gravar a data de reunião é do owner e do manager.",
  },
  {
    nome: "atualizarDadosDaOportunidade",
    chamar: () => atualizarDadosDaOportunidade(OPORTUNIDADE, { nome: "Novo Nome" }),
    recusa: "Editar os dados da oportunidade é do owner e do manager.",
  },
  {
    nome: "atualizarNutricao",
    chamar: () => atualizarNutricao(OPORTUNIDADE, { emNutricao: true }),
    recusa: "Gravar a nutrição é do owner e do manager.",
  },
  {
    nome: "apagarOportunidade",
    chamar: () => apagarOportunidade(OPORTUNIDADE),
    recusa: "A oportunidade não foi apagada: apagar é do owner e do manager",
  },
  {
    nome: "corrigirMotivoDeSaida",
    chamar: () => corrigirMotivoDeSaida(OPORTUNIDADE, PERDIDO.id, { motivoId: "motivo-preco" }),
    recusa: "O motivo não foi corrigido",
  },
  {
    nome: "corrigirTextoDoEvento",
    chamar: () => corrigirTextoDoEvento("evento-1", "Texto novo", null),
    recusa: TEXTO_DA_RECUSA_DA_NOTA,
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

describe("apagarOportunidade", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas = [];
  });

  it("DELETE em opportunities preso ao id, com .select('id') para ver a recusa da RLS", async () => {
    await apagarOportunidade(OPORTUNIDADE);

    expect(chamadas).toEqual([
      { metodo: "from", args: ["opportunities"] },
      { metodo: "delete", args: [] },
      { metodo: "eq", args: ["id", OPORTUNIDADE] },
      { metodo: "select", args: ["id"] },
    ]);
  });

  it("🔴 o 42501 do gatilho chega como Error com a frase do banco e o code (não é retentado)", async () => {
    const frase =
      "Esta oportunidade tem proposta já enviada ao cliente (enviada, aceita ou recusada) e não pode ser excluída. Marque-a como perdida.";
    resposta = { data: null, error: { message: frase, code: "42501" } };

    const erro: unknown = await apagarOportunidade(OPORTUNIDADE).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(frase);
    expect((erro as { code?: string }).code).toBe("42501");
  });

  it("erro SEM code (rede) volta cru: o handler da tela cai no fallback dele", async () => {
    const cru = { message: "TypeError: Failed to fetch", code: "" };
    resposta = { data: null, error: cru };

    const erro: unknown = await apagarOportunidade(OPORTUNIDADE).catch((e: unknown) => e);

    expect(erro).toBe(cru);
  });
});

describe("atualizarDadosDaOportunidade: campos personalizados", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas = [];
  });

  it("manda o objeto inteiro em `campos`, e só ele quando é o único dado", async () => {
    await atualizarDadosDaOportunidade(OPORTUNIDADE, {
      campos: { "aaaaaaaa-0000-4000-8000-000000000001": true },
    });

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toEqual({ campos: { "aaaaaaaa-0000-4000-8000-000000000001": true } });
    expect(chamadas.map((c) => c.metodo)).toContain("select");
  });

  it("`campos: {}` é escrita (esvazia), não payload vazio", async () => {
    await atualizarDadosDaOportunidade(OPORTUNIDADE, { campos: {} });

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({ campos: {} });
  });

  it("🔴 zero linha com só `campos` no payload é recusa — a guarda vale para este caminho também", async () => {
    resposta = ZERO_LINHAS;

    await expect(atualizarDadosDaOportunidade(OPORTUNIDADE, { campos: { x: 1 } })).rejects.toThrow(
      "Editar os dados da oportunidade é do owner e do manager.",
    );
  });

  it("🔴 a frase do gatilho (23514) chega inteira, com o nome do campo", async () => {
    resposta = {
      data: null,
      error: { message: "O campo Tem site? espera sim ou não.", code: "23514" },
    };

    await expect(
      atualizarDadosDaOportunidade(OPORTUNIDADE, { campos: { x: "sim" } }),
    ).rejects.toThrow("O campo Tem site? espera sim ou não.");
  });
});

describe("corrigirMotivoDeSaida grava o motivo sem mexer no estágio", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas = [];
  });

  function payloadDoUpdate(): Record<string, unknown> {
    const update = chamadas.find((chamada) => chamada.metodo === "update");
    return (update?.args[0] ?? {}) as Record<string, unknown>;
  }

  it("🔴 o UPDATE não carrega `stage` nem `stage_id` — corrigir o motivo NUNCA move o card", async () => {
    await corrigirMotivoDeSaida(OPORTUNIDADE, PERDIDO.id, { motivoId: "motivo-preco" });

    const payload = payloadDoUpdate();
    expect(payload).not.toHaveProperty("stage");
    expect(payload).not.toHaveProperty("stage_id");
    expect(payload).toEqual({ motivo_id: "motivo-preco" });
  });

  it("🔴 o WHERE prende o estágio (stage_id), não só o id", async () => {
    await corrigirMotivoDeSaida(OPORTUNIDADE, "estagio-descartado", {
      motivoId: "motivo-sem-verba",
      obs: "orçamento cortado",
    });

    const eqs = chamadas
      .filter((chamada) => chamada.metodo === "eq")
      .map((chamada) => chamada.args);
    expect(eqs).toContainEqual(["id", OPORTUNIDADE]);
    expect(eqs).toContainEqual(["stage_id", "estagio-descartado"]);
    expect(payloadDoUpdate()).toEqual({
      motivo_id: "motivo-sem-verba",
      motivo_obs: "orçamento cortado",
    });
  });

  it("🔴 corrigir SÓ a observação não regrava o motivo — o campo que ninguém mexeu fica fora", async () => {
    await corrigirMotivoDeSaida(OPORTUNIDADE, PERDIDO.id, { obs: "sumiu depois da proposta" });

    const payload = payloadDoUpdate();
    expect(payload).toEqual({ motivo_obs: "sumiu depois da proposta" });
    expect(payload).not.toHaveProperty("motivo_id");
  });

  it("🔴 corrigir SÓ o motivo não regrava a observação", async () => {
    await corrigirMotivoDeSaida(OPORTUNIDADE, PERDIDO.id, { motivoId: "motivo-preco" });

    expect(payloadDoUpdate()).not.toHaveProperty("motivo_obs");
  });

  it("apagar a observação é `obs: null`, e isso É uma escrita — não se confunde com não mexer", async () => {
    await corrigirMotivoDeSaida(OPORTUNIDADE, PERDIDO.id, { obs: null });

    expect(payloadDoUpdate()).toEqual({ motivo_obs: null });
  });

  it("correção vazia não chama .update() nenhum", async () => {
    await corrigirMotivoDeSaida(OPORTUNIDADE, PERDIDO.id, {});

    expect(chamadas.find((chamada) => chamada.metodo === "update")).toBeUndefined();
  });

  it("🔴 motivo do tipo errado: o 23514 do gatilho chega com a frase do banco, por erroDoBanco", async () => {
    resposta = {
      data: null,
      error: {
        message: "Oportunidade perdida recebe motivo de perda; descartada, motivo de descarte.",
        code: "23514",
      },
    };

    const lancado: unknown = await corrigirMotivoDeSaida(OPORTUNIDADE, PERDIDO.id, {
      motivoId: "motivo-nunca-respondeu",
    }).catch((erro: unknown) => erro);

    expect(lancado).toBeInstanceOf(Error);
    expect((lancado as Error).message).toBe(
      "Oportunidade perdida recebe motivo de perda; descartada, motivo de descarte.",
    );
  });
});

function simularLinha(
  estagioReal: EstagioDoPipeline | null,
): (chamadasDaCadeia: readonly ChamadaRegistrada[]) => RespostaFalsa {
  return (chamadasDaCadeia) => {
    const ehUpdate = chamadasDaCadeia.some((chamada) => chamada.metodo === "update");
    if (!ehUpdate) {
      return estagioReal === null
        ? { data: null, error: null }
        : { data: { id: OPORTUNIDADE, stage_id: estagioReal.id }, error: null };
    }
    if (estagioReal === null) return ZERO_LINHAS;
    const filtroDeEstagio = chamadasDaCadeia
      .filter((chamada) => chamada.metodo === "eq")
      .map((chamada) => chamada.args)
      .find(([coluna]) => coluna === "stage_id")?.[1];
    const casou = filtroDeEstagio === undefined || filtroDeEstagio === estagioReal.id;
    return casou ? UMA_LINHA : ZERO_LINHAS;
  };
}

describe("moverParaEstagio: o WHERE prende o estágio que a tela viu, não só o id (PIPE-1)", () => {
  beforeEach(() => {
    chamadas = [];
  });

  afterEach(() => {
    decidirResposta = () => resposta;
  });

  it("(a) linha realmente em R1 — o UPDATE sai com stage_id=eq.<R1> e grava stage_id + stage do destino", async () => {
    decidirResposta = simularLinha(R1);

    await expect(moverParaEstagio(OPORTUNIDADE, R2, R1.id)).resolves.toBeUndefined();

    const eqsDoUpdate = chamadas
      .filter((chamada) => chamada.metodo === "eq")
      .map((chamada) => chamada.args);
    expect(eqsDoUpdate).toContainEqual(["stage_id", R1.id]);
    const update = chamadas.find((chamada) => chamada.metodo === "update");
    expect(update?.args[0]).toEqual({
      stage_id: R2.id,
      stage: "r2",
      motivo_id: null,
      motivo_obs: null,
    });
  });

  it("(b) linha na verdade em PERDIDO — zero linha, conferência lê outro stage_id, erro de outra pessoa", async () => {
    decidirResposta = simularLinha(PERDIDO);

    await expect(moverParaEstagio(OPORTUNIDADE, R2, R1.id)).rejects.toThrow(
      "Esta oportunidade já foi movida por outra pessoa. Recarregue o board.",
    );
  });

  it("(c) RLS recusa o UPDATE e a conferência não lê nada — mensagem de permissão, não a de 'outra pessoa'", async () => {
    decidirResposta = simularLinha(null);

    await expect(moverParaEstagio(OPORTUNIDADE, R2, R1.id)).rejects.toThrow(
      "Mover a oportunidade de etapa é do owner e do manager.",
    );
  });

  it("(d) motivo continua exigido para destino perdido/descartado — recusado ANTES de qualquer chamada ao banco", async () => {
    decidirResposta = simularLinha(R2);

    await expect(moverParaEstagio(OPORTUNIDADE, PERDIDO, R2.id)).rejects.toThrow(
      'Mover para "perdido" exige o motivo antes de gravar.',
    );
    await expect(
      moverParaEstagio(OPORTUNIDADE, PERDIDO, R2.id, {
        tipo: "descarte",
        motivoId: "motivo-sem-verba",
        obs: null,
      }),
    ).rejects.toThrow('Mover para "perdido" exige o motivo antes de gravar.');
    expect(chamadas).toHaveLength(0);
  });

  it("positivo do (d): motivo do tipo certo, com o estágio batendo, grava motivo_id e obs", async () => {
    decidirResposta = simularLinha(R2);

    await expect(
      moverParaEstagio(OPORTUNIDADE, PERDIDO, R2.id, { ...MOTIVO_DE_PERDA, obs: "achou caro" }),
    ).resolves.toBeUndefined();

    const update = chamadas.find((chamada) => chamada.metodo === "update");
    expect(update?.args[0]).toEqual({
      stage_id: PERDIDO.id,
      stage: "perdido",
      motivo_id: "motivo-preco",
      motivo_obs: "achou caro",
    });
  });

  it("erro COM code na leitura de conferência: erroDoBanco embrulha, a mensagem do banco chega", async () => {
    decidirResposta = (chamadasDaCadeia) => {
      const ehUpdate = chamadasDaCadeia.some((chamada) => chamada.metodo === "update");
      if (ehUpdate) return ZERO_LINHAS;
      return {
        data: null,
        error: { message: "permission denied for table opportunities", code: "42501" },
      };
    };

    const lancado: unknown = await moverParaEstagio(OPORTUNIDADE, R2, R1.id).catch(
      (erro: unknown) => erro,
    );

    expect(lancado).toBeInstanceOf(Error);
    expect((lancado as Error).message).toBe("permission denied for table opportunities");
  });

  it("erro SEM code na leitura de conferência (rede): objeto cru, nunca engolido em silêncio", async () => {
    decidirResposta = (chamadasDaCadeia) => {
      const ehUpdate = chamadasDaCadeia.some((chamada) => chamada.metodo === "update");
      if (ehUpdate) return ZERO_LINHAS;
      return { data: null, error: { message: "TypeError: Failed to fetch", code: "" } };
    };

    const lancado: unknown = await moverParaEstagio(OPORTUNIDADE, R2, R1.id).catch(
      (erro: unknown) => erro,
    );

    expect(lancado).not.toBeInstanceOf(Error);
    expect(lancado).toEqual({ message: "TypeError: Failed to fetch", code: "" });
  });
});

describe("apagar canal e linha de negócio chega ao banco como null, não como no-op", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas = [];
  });

  function payloadDoUpdate(): Record<string, unknown> {
    const update = chamadas.find((c) => c.metodo === "update");
    expect(update, "nenhum .update() foi chamado").toBeDefined();
    return (update?.args[0] ?? {}) as Record<string, unknown>;
  }

  it("canal: null vira channel: null no UPDATE", async () => {
    await atualizarDadosDaOportunidade("op-1", { canal: null });

    expect(payloadDoUpdate()).toEqual({ channel: null });
  });

  it("linhaDeNegocio: null vira business_unit: null no UPDATE", async () => {
    await atualizarDadosDaOportunidade("op-1", { linhaDeNegocio: null });

    expect(payloadDoUpdate()).toEqual({ business_unit: null });
  });

  it("gravar valor continua chegando inteiro", async () => {
    await atualizarDadosDaOportunidade("op-1", { canal: "inbound", linhaDeNegocio: "sistemas" });

    expect(payloadDoUpdate()).toEqual({ channel: "inbound", business_unit: "sistemas" });
  });

  it("campo ausente não entra no payload — undefined não é null", async () => {
    await atualizarDadosDaOportunidade("op-1", { nome: "Padaria do Zé" });

    const payload = payloadDoUpdate();
    expect(payload).toEqual({ name: "Padaria do Zé" });
    expect("channel" in payload).toBe(false);
    expect("business_unit" in payload).toBe(false);
  });

  it("nenhum campo: não chama .update() nenhum", async () => {
    await atualizarDadosDaOportunidade("op-1", {});

    expect(chamadas.find((c) => c.metodo === "update")).toBeUndefined();
  });
});

describe("A1.1: os cinco campos novos chegam ao UPDATE", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas = [];
  });

  function payloadDoUpdate(): Record<string, unknown> {
    const update = chamadas.find((c) => c.metodo === "update");
    expect(update, "nenhum .update() foi chamado").toBeDefined();
    return (update?.args[0] ?? {}) as Record<string, unknown>;
  }

  it("texto aparado, texto em branco vira null, frentes como lista", async () => {
    await atualizarDadosDaOportunidade("op-1", {
      valorEstimado: 1500,
      origem: "  Feira de outubro  ",
      indicadoPor: "   ",
      observacoes: "Ligar depois das 14h",
      frentesEsperadas: ["posicionamento", "trafego"],
    });

    expect(payloadDoUpdate()).toEqual({
      estimated_value: 1500,
      lead_source: "Feira de outubro",
      referred_by: null,
      notes: "Ligar depois das 14h",
      expected_fronts: ["posicionamento", "trafego"],
    });
  });

  it("desmarcar a última frente grava lista vazia, não some do payload", async () => {
    await atualizarDadosDaOportunidade("op-1", { frentesEsperadas: [] });

    expect(payloadDoUpdate()).toEqual({ expected_fronts: [] });
  });

  it("valor estimado apagado grava null", async () => {
    await atualizarDadosDaOportunidade("op-1", { valorEstimado: null });

    expect(payloadDoUpdate()).toEqual({ estimated_value: null });
  });

  it("valor estimado de 10 bilhões recusa antes do UPDATE (numeric(12,2))", async () => {
    await expect(
      atualizarDadosDaOportunidade("op-1", { valorEstimado: 10_000_000_000 }),
    ).rejects.toThrow("O valor estimado passa do limite de R$ 9.999.999.999,99.");

    expect(chamadas.find((c) => c.metodo === "update")).toBeUndefined();
  });

  it("o positivo ao lado: R$ 9.999.999.999,99 passa", async () => {
    await atualizarDadosDaOportunidade("op-1", { valorEstimado: 9_999_999_999.99 });

    expect(payloadDoUpdate()).toEqual({ estimated_value: 9_999_999_999.99 });
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ])("valor estimado %s recusa antes do UPDATE, com a frase do número", async (_nome, valor) => {
    await expect(atualizarDadosDaOportunidade("op-1", { valorEstimado: valor })).rejects.toThrow(
      "O valor estimado precisa ser um número.",
    );

    expect(chamadas.find((c) => c.metodo === "update")).toBeUndefined();
  });

  it("9.999.999.999,996 arredonda para o teto e recusa com a frase do limite", async () => {
    await expect(
      atualizarDadosDaOportunidade("op-1", { valorEstimado: 9_999_999_999.996 }),
    ).rejects.toThrow("O valor estimado passa do limite de R$ 9.999.999.999,99.");

    expect(chamadas.find((c) => c.metodo === "update")).toBeUndefined();
  });

  it("9.999.999.999,994 arredonda para baixo, cabe e grava", async () => {
    await atualizarDadosDaOportunidade("op-1", { valorEstimado: 9_999_999_999.994 });

    expect(payloadDoUpdate()).toEqual({ estimated_value: 9_999_999_999.994 });
  });

  it("9.999.999.999,995 arredonda para o teto e recusa com a frase do limite", async () => {
    await expect(
      atualizarDadosDaOportunidade("op-1", { valorEstimado: 9_999_999_999.995 }),
    ).rejects.toThrow("O valor estimado passa do limite de R$ 9.999.999.999,99.");

    expect(chamadas.find((c) => c.metodo === "update")).toBeUndefined();
  });

  it("o lado negativo: -10 bilhões também recusa com a frase do limite", async () => {
    await expect(
      atualizarDadosDaOportunidade("op-1", { valorEstimado: -10_000_000_000 }),
    ).rejects.toThrow("O valor estimado passa do limite de R$ 9.999.999.999,99.");

    expect(chamadas.find((c) => c.metodo === "update")).toBeUndefined();
  });

  it("o positivo do lado negativo: -R$ 9.999.999.999,99 passa", async () => {
    await atualizarDadosDaOportunidade("op-1", { valorEstimado: -9_999_999_999.99 });

    expect(payloadDoUpdate()).toEqual({ estimated_value: -9_999_999_999.99 });
  });

  it("observações aparada: o texto grava sem os espaços das pontas", async () => {
    await atualizarDadosDaOportunidade("op-1", { observacoes: "  texto  " });

    expect(payloadDoUpdate()).toEqual({ notes: "texto" });
  });

  it("observações em branco: grava null", async () => {
    await atualizarDadosDaOportunidade("op-1", { observacoes: "   " });

    expect(payloadDoUpdate()).toEqual({ notes: null });
  });

  it("RLS com zero linha (member): recusa com a frase, nunca salvo", async () => {
    resposta = ZERO_LINHAS;

    await expect(
      atualizarDadosDaOportunidade("op-1", { observacoes: "Ligar depois das 14h" }),
    ).rejects.toThrow("Editar os dados da oportunidade é do owner e do manager.");
  });
});

describe("listarOportunidades(pipelineId) filtra pelo pipeline e projeta o estágio nomeado", () => {
  beforeEach(() => {
    chamadas = [];
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [], error: null });
  });

  const LINHA = {
    id: OPORTUNIDADE,
    name: "Padaria do Zé",
    segment: null,
    nicho: null,
    stage: "r1",
    stage_changed_at: "2026-01-01T00:00:00Z",
    pipeline_id: PIPELINE,
    stage_id: R1.id,
    owner_id: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    lead_source: null,
    channel: null,
    referred_by: null,
    business_unit: null,
    expected_fronts: null,
    estimated_value: null,
    notes: null,
    next_followup_at: null,
    r1_agendada_em: null,
    r1_realizada_em: null,
    r2_agendada_em: null,
    r2_realizada_em: null,
    motivo_id: null,
    motivo_obs: null,
    em_nutricao: false,
    nutrir_ate: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    landing_url: null,
    attribution_id: null,
    created_at: "2026-01-01T00:00:00Z",
    campos: { "aaaaaaaa-0000-4000-8000-000000000001": true },
    profiles: null,
    pipeline_stages: { nome: "Diagnóstico inicial" },
    motivos_de_saida: null,
    qualification_answers: [],
  };

  it("🔴 .eq('pipeline_id', id) vai ao banco — sem ele o board mostraria todo pipeline", async () => {
    resposta = { data: [LINHA], error: null };

    const lista = await listarOportunidades(PIPELINE);

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["pipeline_id", PIPELINE]);
    expect(chamadas.find((c) => c.metodo === "limit")?.args).toEqual([400]);
    expect(lista[0]).toMatchObject({
      id: OPORTUNIDADE,
      estagio: "r1",
      pipelineId: PIPELINE,
      estagioId: R1.id,
      estagioNome: "Diagnóstico inicial",
      motivoId: null,
      motivoRotulo: null,
    });
  });

  it("D-071: clienteId vem das origens, não de contracts nem de clients", async () => {
    resposta = {
      data: [
        { ...LINHA, stage: "fechado" },
        { ...LINHA, id: "outra", stage: "fechado" },
      ],
      error: null,
    };
    rpc.mockImplementation(async (nome: string) =>
      nome === "get_origens_dos_clientes"
        ? {
            data: [
              { opportunity_id: OPORTUNIDADE, opportunity_name: "Padaria", client_id: "cli-1" },
            ],
            error: null,
          }
        : { data: [], error: null },
    );

    const lista = await listarOportunidades(PIPELINE);

    expect(String(chamadas.find((c) => c.metodo === "select")?.args[0])).not.toContain("clients(");
    expect(rpc).toHaveBeenCalledWith("get_origens_dos_clientes");
    expect(lista[0]?.clienteId).toBe("cli-1");
    expect(lista[1]?.clienteId).toBeNull();
  });

  it("D-071: origens no teto de 500 derrubam o board em vez de mostrar selo errado", async () => {
    resposta = { data: [LINHA], error: null };
    rpc.mockImplementation(async (nome: string) =>
      nome === "get_origens_dos_clientes"
        ? {
            data: Array.from({ length: 500 }, (_, i) => ({
              opportunity_id: `v-${i}`,
              opportunity_name: "x",
              client_id: "cli-1",
            })),
            error: null,
          }
        : { data: [], error: null },
    );

    await expect(listarOportunidades(PIPELINE)).rejects.toThrow("teto de 500");
  });

  it("A1.1: a projeção traz `notes`, e `observacoes` chega (ou é null)", async () => {
    resposta = {
      data: [
        { ...LINHA, notes: "Ligar depois das 14h" },
        { ...LINHA, id: "outra", notes: null },
      ],
      error: null,
    };

    const lista = await listarOportunidades(PIPELINE);

    expect(String(chamadas.find((c) => c.metodo === "select")?.args[0])).toMatch(/\bnotes\b/);
    expect(lista[0]?.observacoes).toBe("Ligar depois das 14h");
    expect(lista[1]?.observacoes).toBeNull();
  });

  it("🔴 `null` = TODOS os pipelines (Dashboard): sem .eq('pipeline_id'), mesma projeção, ordem e teto", async () => {
    resposta = { data: [LINHA], error: null };

    const lista = await listarOportunidades(null);

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args[0]);
    expect(eqs).not.toContain("pipeline_id");
    expect(String(chamadas.find((c) => c.metodo === "select")?.args[0])).toContain(
      "pipeline_stages(nome)",
    );
    expect(chamadas.find((c) => c.metodo === "order")?.args[0]).toBe("stage_changed_at");
    expect(chamadas.find((c) => c.metodo === "limit")?.args).toEqual([400]);
    expect(lista[0]?.pipelineId).toBe(PIPELINE);
  });

  it("a projeção traz os joins de estágio e motivo, e o rótulo do motivo chega", async () => {
    resposta = {
      data: [
        {
          ...LINHA,
          stage: "perdido",
          stage_id: PERDIDO.id,
          motivo_id: "motivo-preco",
          pipeline_stages: { nome: "Perdido — sem retorno" },
          motivos_de_saida: { rotulo: "Preço" },
        },
      ],
      error: null,
    };

    const lista = await listarOportunidades(PIPELINE);

    const select = String(chamadas.find((c) => c.metodo === "select")?.args[0] ?? "");
    expect(select).toContain("pipeline_id");
    expect(select).toContain("stage_id");
    expect(select).toContain("motivo_id");
    expect(select).toContain("pipeline_stages(nome)");
    expect(select).toContain("motivos_de_saida(rotulo)");
    expect(select).not.toContain("motivo_perda");
    expect(select).not.toContain("motivo_descarte");
    expect(lista[0]).toMatchObject({
      estagioNome: "Perdido — sem retorno",
      motivoId: "motivo-preco",
      motivoRotulo: "Preço",
    });
  });

  it("🔴 a projeção pede `campos` e o objeto chega inteiro ao domínio (campos personalizados)", async () => {
    resposta = { data: [LINHA], error: null };

    const lista = await listarOportunidades(PIPELINE);

    const select = String(chamadas.find((c) => c.metodo === "select")?.args[0] ?? "");
    expect(select.split(", ")).toContain("campos");
    expect(lista[0]?.campos).toEqual({ "aaaaaaaa-0000-4000-8000-000000000001": true });
  });

  it("sem o join (estágio sem nome) cai no rótulo do tipo — nunca string vazia no card", async () => {
    resposta = { data: [{ ...LINHA, pipeline_stages: null }], error: null };

    const lista = await listarOportunidades(PIPELINE);

    expect(lista[0]?.estagioNome).toBe("R1 · Diagnóstico");
  });
});

describe("criarOportunidade grava o pipeline (e o estágio, se escolhido)", () => {
  beforeEach(() => {
    chamadas = [];
    resposta = { data: { id: OPORTUNIDADE }, error: null };
  });

  function payloadDoInsert(): Record<string, unknown> {
    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert, "nenhum .insert() foi chamado").toBeDefined();
    return (insert?.args[0] ?? {}) as Record<string, unknown>;
  }

  it("🔴 pipeline_id viaja no INSERT; sem estagioId, stage_id fica de FORA (o gatilho escolhe o canônico)", async () => {
    const id = await criarOportunidade({ nome: "Padaria do Zé", pipelineId: PIPELINE });

    expect(id).toBe(OPORTUNIDADE);
    const payload = payloadDoInsert();
    expect(payload.pipeline_id).toBe(PIPELINE);
    expect(payload.stage_id).toBeUndefined();
  });

  it("campos viaja no INSERT quando vem; sem ele fica de FORA (o default do banco é {})", async () => {
    await criarOportunidade({
      nome: "Padaria do Zé",
      pipelineId: PIPELINE,
      campos: { "aaaaaaaa-0000-4000-8000-000000000001": true },
    });
    expect(payloadDoInsert().campos).toEqual({ "aaaaaaaa-0000-4000-8000-000000000001": true });

    chamadas = [];
    await criarOportunidade({ nome: "Padaria do Zé", pipelineId: PIPELINE });
    expect(payloadDoInsert().campos).toBeUndefined();
  });

  it("com estagioId, stage_id viaja junto", async () => {
    await criarOportunidade({ nome: "Padaria do Zé", pipelineId: PIPELINE, estagioId: R2.id });

    expect(payloadDoInsert()).toMatchObject({ pipeline_id: PIPELINE, stage_id: R2.id });
  });
});

const TITULAR = "3d2c1b0a-9f8e-4d7c-8b6a-5e4d3c2b1a09";
const OUTRA = "9c1f4a77-2b60-4e3a-8d51-7f0e2a6b4c93";

function perfil(id: string, nome: string, ativo: boolean) {
  return { id, full_name: nome, active: ativo };
}

const chamou = (metodo: string) => chamadas.some((c) => c.metodo === metodo);

describe("listarResponsaveis: o responsável desativado continua na lista da ficha", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
  });

  it("com titular, filtra por 'ativo OU é ele' — e o desativado volta marcado", async () => {
    resposta = {
      data: [perfil(TITULAR, "Ana Souza", false), perfil(OUTRA, "Bia Lima", true)],
      error: null,
    };

    const lista = await listarResponsaveis(TITULAR);

    expect(chamadas).toContainEqual({ metodo: "or", args: [`active.eq.true,id.eq.${TITULAR}`] });
    expect(chamou("eq")).toBe(false);
    expect(lista).toEqual([
      { id: TITULAR, nome: "Ana Souza", ativo: false },
      { id: OUTRA, nome: "Bia Lima", ativo: true },
    ]);
  });

  it("sem titular (criação de oportunidade), volta ao active = true puro", async () => {
    resposta = { data: [perfil(OUTRA, "Bia Lima", true)], error: null };

    const lista = await listarResponsaveis(null);

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamou("or")).toBe(false);
    expect(lista).toEqual([{ id: OUTRA, nome: "Bia Lima", ativo: true }]);
  });

  it("undefined é tratado como sem titular — a assinatura permite omitir o argumento", async () => {
    await listarResponsaveis();

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamou("or")).toBe(false);
  });

  it("🔴 id fora do formato UUID não entra cru no or= — a vírgula viraria sintaxe", async () => {
    await listarResponsaveis("nao-e-uuid,role.eq.owner");

    expect(chamou("or")).toBe(false);
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
  });

  it("a projeção inclui `active` — sem ela o campo `ativo` mente em silêncio", async () => {
    resposta = { data: [perfil(OUTRA, "Bia Lima", true)], error: null };

    await listarResponsaveis(TITULAR);

    const select = chamadas.find((c) => c.metodo === "select");
    expect(select).toBeDefined();
    const colunas = String(select?.args[0] ?? "")
      .split(",")
      .map((coluna) => coluna.trim());
    expect(colunas).toContain("active");
    expect(colunas).toContain("id");
    expect(colunas).toContain("full_name");
  });

  it("o teto continua falhando alto em vez de truncar a lista de escolha", async () => {
    resposta = {
      data: Array.from({ length: 50 }, (_, i) =>
        perfil(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, `P${i}`, true),
      ),
      error: null,
    };

    await expect(listarResponsaveis(TITULAR)).rejects.toThrow(
      "A lista de responsáveis veio no teto de 50 e pode estar incompleta.",
    );
  });
});

function dadosDaLinha(sobrescreve: Partial<DadosDaLinha> = {}): DadosDaLinha {
  return {
    nome: "Padaria do Zé",
    contato: null,
    telefone: null,
    telefone_normalizado: null,
    email: null,
    segmento: null,
    nicho: null,
    canal: null,
    bu: null,
    responsavel: null,
    valor_estimado: null,
    origem: null,
    indicado_por: null,
    observacoes: null,
    frentes: null,
    ...sobrescreve,
  };
}

function linhaValida(numero: number, sobrescreve: Partial<DadosDaLinha> = {}): LinhaDeImportacao {
  return { numero, dados: dadosDaLinha(sobrescreve), campos: {}, erros: [] };
}

function linhaComErro(numero: number, erros: string[]): LinhaDeImportacao {
  return { numero, dados: dadosDaLinha(), campos: {}, erros };
}

describe("importarOportunidades: monta o jsonb, mescla erro do cliente e trata o retorno do banco", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("(a) chama import_opportunities UMA vez, só com as linhas válidas (numero + arquivo)", async () => {
    rpc.mockResolvedValue({
      data: [{ linha: 2, acao: "nova", motivo: null, opportunity_id: "op-2" }],
      error: null,
    });

    await importarOportunidades(
      PIPELINE,
      [linhaValida(2), linhaComErro(3, ["nome é obrigatório"])],
      true,
      "clientes.csv",
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("import_opportunities", {
      p_pipeline_id: PIPELINE,
      p_linhas: [{ ...dadosDaLinha(), numero: 2, arquivo: "clientes.csv" }],
      p_previa: true,
    });
  });

  it("(b) intercala erro do cliente na posição, ordenado por numero — não pela ordem de chegada", async () => {
    rpc.mockResolvedValue({
      data: [
        { linha: 2, acao: "nova", motivo: null, opportunity_id: "op-2" },
        { linha: 4, acao: "atualiza", motivo: null, opportunity_id: "op-4" },
      ],
      error: null,
    });

    const resultado = await importarOportunidades(
      PIPELINE,
      [
        linhaComErro(3, ["e-mail inválido"]),
        linhaValida(2),
        linhaValida(4),
        linhaComErro(1, ["nome é obrigatório", "um segundo erro que não deve aparecer"]),
      ],
      false,
      "arquivo.csv",
    );

    expect(resultado.map((r) => r.numero)).toEqual([1, 2, 3, 4]);
    expect(resultado).toEqual([
      { numero: 1, acao: "erro", motivo: "nome é obrigatório", oportunidadeId: null },
      { numero: 2, acao: "nova", motivo: null, oportunidadeId: "op-2" },
      { numero: 3, acao: "erro", motivo: "e-mail inválido", oportunidadeId: null },
      { numero: 4, acao: "atualiza", motivo: null, oportunidadeId: "op-4" },
    ]);
  });

  it("(c) erro do banco COM code vira PostgrestError, com a mensagem do banco", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "pipeline arquivado", code: "22023" } });

    const lancado: unknown = await importarOportunidades(
      PIPELINE,
      [linhaValida(2)],
      true,
      "a.csv",
    ).catch((erro: unknown) => erro);

    expect(lancado).toBeInstanceOf(Error);
    expect((lancado as Error).message).toBe("pipeline arquivado");
  });

  it("(c) erro do banco SEM code volta como objeto cru — nunca embrulhado em Error", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "TypeError: Failed to fetch", code: "" },
    });

    const lancado: unknown = await importarOportunidades(
      PIPELINE,
      [linhaValida(2)],
      true,
      "a.csv",
    ).catch((erro: unknown) => erro);

    expect(lancado).not.toBeInstanceOf(Error);
    expect(lancado).toEqual({ message: "TypeError: Failed to fetch", code: "" });
  });

  it("(d) atualiza com motivo não nulo continua atualiza — motivo não é indício de erro", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          linha: 2,
          acao: "atualiza",
          motivo: "mesmo telefone ou e-mail de uma linha anterior do arquivo",
          opportunity_id: null,
        },
      ],
      error: null,
    });

    const [resultado] = await importarOportunidades(PIPELINE, [linhaValida(2)], true, "a.csv");

    expect(resultado).toEqual({
      numero: 2,
      acao: "atualiza",
      motivo: "mesmo telefone ou e-mail de uma linha anterior do arquivo",
      oportunidadeId: null,
    });
  });

  it("só linha com erro de cliente (nenhuma válida) não chama a RPC", async () => {
    const resultado = await importarOportunidades(
      PIPELINE,
      [linhaComErro(2, ["nome é obrigatório"])],
      true,
      "a.csv",
    );

    expect(rpc).not.toHaveBeenCalled();
    expect(resultado).toEqual([
      { numero: 2, acao: "erro", motivo: "nome é obrigatório", oportunidadeId: null },
    ]);
  });

  it("lista vazia não chama a RPC e devolve []", async () => {
    const resultado = await importarOportunidades(PIPELINE, [], true, "a.csv");

    expect(rpc).not.toHaveBeenCalled();
    expect(resultado).toEqual([]);
  });

  it("campos personalizados (Task 7): item com campos manda `campos`; item sem campos NÃO manda a chave", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const comCampos: LinhaDeImportacao = {
      ...linhaValida(2),
      campos: { "c7000000-0000-4000-8000-000000000001": true },
    };

    await importarOportunidades(PIPELINE, [comCampos, linhaValida(3)], true, "a.csv");

    const args = rpc.mock.calls[0]![1] as { p_linhas: Record<string, unknown>[] };
    expect(args.p_linhas[0]!.campos).toEqual({ "c7000000-0000-4000-8000-000000000001": true });
    expect("campos" in args.p_linhas[1]!).toBe(false);
  });

  it("campos personalizados (Task 7): `aviso` da RPC chega na linha; sem aviso a chave fica ausente", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          linha: 2,
          acao: "atualiza",
          motivo: null,
          opportunity_id: "op-2",
          aviso: "campos ignorados: a oportunidade está em outro pipeline",
        },
        { linha: 3, acao: "nova", motivo: null, opportunity_id: "op-3", aviso: null },
      ],
      error: null,
    });

    const [primeira, segunda] = await importarOportunidades(
      PIPELINE,
      [linhaValida(2), linhaValida(3)],
      false,
      "a.csv",
    );

    expect(primeira!.aviso).toBe("campos ignorados: a oportunidade está em outro pipeline");
    expect("aviso" in segunda!).toBe(false);
  });

  it("🔴 acao fora do contrato conhecido vira erro, sem cast cego no que o banco mandou", async () => {
    rpc.mockResolvedValue({
      data: [{ linha: 2, acao: "descartada", motivo: null, opportunity_id: null }],
      error: null,
    });

    const [resultado] = await importarOportunidades(PIPELINE, [linhaValida(2)], true, "a.csv");

    expect(resultado.acao).toBe("erro");
    expect(resultado.oportunidadeId).toBeNull();
    expect(resultado.motivo).toContain("descartada");
  });
});

describe("atualizarEmLote: monta os argumentos da bulk_update_opportunities e lê o retorno", () => {
  const ALVOS = [
    { id: "op-1", stageId: "estagio-r1" },
    { id: "op-2", stageId: "estagio-r2" },
  ];

  beforeEach(() => {
    rpc.mockReset();
  });

  it("(a) só o responsável: p_alvos com stage_id e p_owner_id — nenhum outro parâmetro no objeto", async () => {
    rpc.mockResolvedValue({ data: 2, error: null });

    const n = await atualizarEmLote(ALVOS, { ownerId: "vinicius" });

    expect(n).toBe(2);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("bulk_update_opportunities", {
      p_alvos: [
        { id: "op-1", stage_id: "estagio-r1" },
        { id: "op-2", stage_id: "estagio-r2" },
      ],
      p_owner_id: "vinicius",
    });
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(args).sort()).toEqual(["p_alvos", "p_owner_id"]);
  });

  it("(b) etapa com motivo e campos: os cinco parâmetros viajam com o nome do banco", async () => {
    rpc.mockResolvedValue({ data: 1, error: null });

    await atualizarEmLote([ALVOS[0]!], {
      ownerId: "vinicius",
      estagioId: "estagio-perdido",
      motivoId: "m-preco",
      motivoObs: "caro",
      campos: { "campo-1": true },
    });

    expect(rpc).toHaveBeenCalledWith("bulk_update_opportunities", {
      p_alvos: [{ id: "op-1", stage_id: "estagio-r1" }],
      p_owner_id: "vinicius",
      p_estagio_id: "estagio-perdido",
      p_motivo_id: "m-preco",
      p_motivo_obs: "caro",
      p_campos: { "campo-1": true },
    });
  });

  it("(c) erro COM code (o 23514 de 'alguém moveu') chega como Error com a frase do banco", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Alguém moveu uma das oportunidades. Recarregue o board.", code: "23514" },
    });

    const lancado: unknown = await atualizarEmLote(ALVOS, { ownerId: "vinicius" }).catch(
      (erro: unknown) => erro,
    );

    expect(lancado).toBeInstanceOf(Error);
    expect((lancado as Error).message).toBe(
      "Alguém moveu uma das oportunidades. Recarregue o board.",
    );
  });

  it("(c) erro SEM code (rede) volta cru — o handler da tela cai no fallback dele", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Failed to fetch", code: "" } });

    const lancado: unknown = await atualizarEmLote(ALVOS, { ownerId: "vinicius" }).catch(
      (erro: unknown) => erro,
    );

    expect(lancado).not.toBeInstanceOf(Error);
  });

  it("🔴 (d) zero linhas é recusa, não sucesso silencioso — e `null` no data conta como zero", async () => {
    rpc.mockResolvedValue({ data: 0, error: null });
    await expect(atualizarEmLote(ALVOS, { ownerId: "vinicius" })).rejects.toThrow(
      "Nenhuma oportunidade foi alterada. Recarregue o board.",
    );

    rpc.mockResolvedValue({ data: null, error: null });
    await expect(atualizarEmLote(ALVOS, { ownerId: "vinicius" })).rejects.toThrow(
      "Nenhuma oportunidade foi alterada. Recarregue o board.",
    );
  });
});

describe("registrarToque: o banco carimba o autor, o payload não leva actor_id (D-059)", () => {
  beforeEach(() => {
    chamadas = [];
    resposta = NENHUM_DADO;
    decidirResposta = () => resposta;
  });

  it("🔴 grava o toque de WhatsApp com tipo e texto, e nada além", async () => {
    await registrarToque(OPORTUNIDADE, "whatsapp", "WhatsApp · Abertura genérica");

    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert, "nenhum .insert() foi chamado").toBeDefined();
    expect(insert?.args[0]).toEqual({
      opportunity_id: OPORTUNIDADE,
      event_type: "whatsapp",
      content: "WhatsApp · Abertura genérica",
    });
  });
});

describe("primeiro contato (D-063)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("lerPrimeiroContato chama get_primeiro_contato com os ids e projeta os três campos", async () => {
    rpc.mockResolvedValue({
      data: [
        { opportunity_id: "o1", vence_em: "2026-01-05T13:05:00+00:00", primeiro_toque_em: null },
      ],
      error: null,
    });

    await expect(lerPrimeiroContato(["o1"])).resolves.toEqual([
      { oportunidadeId: "o1", venceEm: "2026-01-05T13:05:00+00:00", primeiroToqueEm: null },
    ]);
    expect(rpc).toHaveBeenCalledWith("get_primeiro_contato", { p_ids: ["o1"] });
  });

  it("erro do banco vira Error com o code — a recusa 42501 não é retentada", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden", code: "42501" } });

    const erro: unknown = await lerPrimeiroContato(["o1"]).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as { code?: string }).code).toBe("42501");
  });

  it("lerTempoAtePrimeiroContato passa o período e projeta em camelCase", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          canal: "pago",
          novos: 5,
          contatados: 3,
          mediana_min: 5,
          com_prazo_medido: 4,
          no_prazo: 2,
        },
      ],
      error: null,
    });

    await expect(lerTempoAtePrimeiroContato("2026-01-06")).resolves.toEqual([
      { canal: "pago", novos: 5, contatados: 3, medianaMin: 5, comPrazoMedido: 4, noPrazo: 2 },
    ]);
    expect(rpc).toHaveBeenCalledWith("get_tempo_ate_primeiro_contato", { p_desde: "2026-01-06" });
  });

  it("sem período, p_desde vai undefined ('sempre'), como o funil", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await lerTempoAtePrimeiroContato();
    expect(rpc).toHaveBeenCalledWith("get_tempo_ate_primeiro_contato", { p_desde: undefined });
  });
});

describe("timeline com rastro de correção (D-069, C3)", () => {
  beforeEach(() => {
    chamadas = [];
    decidirResposta = () => resposta;
  });

  it("corrigirTextoDoEvento: UPDATE só de content, preso ao id e a nota nunca corrigida, com .select('id')", async () => {
    resposta = UMA_LINHA;
    await corrigirTextoDoEvento("evento-1", "Texto novo", null);
    expect(chamadas).toEqual([
      { metodo: "from", args: ["opportunity_events"] },
      { metodo: "update", args: [{ content: "Texto novo" }] },
      { metodo: "eq", args: ["id", "evento-1"] },
      { metodo: "is", args: ["editado_em", null] },
      { metodo: "select", args: ["id"] },
    ]);
  });

  it("🔴 nota já corrigida: o UPDATE fica preso ao editado_em que a tela leu", async () => {
    resposta = UMA_LINHA;
    await corrigirTextoDoEvento("evento-1", "Texto novo", "2026-10-02T15:30:00+00:00");
    expect(chamadas).toEqual([
      { metodo: "from", args: ["opportunity_events"] },
      { metodo: "update", args: [{ content: "Texto novo" }] },
      { metodo: "eq", args: ["id", "evento-1"] },
      { metodo: "eq", args: ["editado_em", "2026-10-02T15:30:00+00:00"] },
      { metodo: "select", args: ["id"] },
    ]);
    expect(chamadas.some((c) => c.metodo === "is")).toBe(false);
  });

  it("zero linha lança a frase das duas causas (mudou em outra tela, ou a policy recusou)", async () => {
    resposta = ZERO_LINHAS;
    await expect(corrigirTextoDoEvento("evento-1", "Texto novo", null)).rejects.toThrow(
      TEXTO_DA_RECUSA_DA_NOTA,
    );
    await expect(
      corrigirTextoDoEvento("evento-1", "Texto novo", "2026-10-02T15:30:00+00:00"),
    ).rejects.toThrow(TEXTO_DA_RECUSA_DA_NOTA);
  });

  it("erro do banco vira Error com o code, não a frase da recusa", async () => {
    resposta = { data: null, error: { message: "permission denied", code: "42501" } };
    const erro: unknown = await corrigirTextoDoEvento("evento-1", "x", null).catch(
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(Error);
    expect((erro as { code?: string }).code).toBe("42501");
    expect((erro as Error).message).not.toBe(TEXTO_DA_RECUSA_DA_NOTA);
  });

  it("listarEventos traz autor, editado em e texto original", async () => {
    resposta = {
      data: [
        {
          id: "e1",
          event_type: "note",
          from_stage: null,
          to_stage: null,
          content: "Ligar sexta",
          actor_id: "u1",
          editado_em: "2026-10-02T15:30:00Z",
          conteudo_original: "Ligar hoje",
          created_at: "2026-10-01T12:00:00Z",
          profiles: { full_name: "Ana" },
          editor: { full_name: "Bruno" },
          correcoes_de_nota: [
            {
              id: "c2",
              antes: "Ligar amanhã",
              depois: "Ligar sexta",
              corrigido_em: "2026-10-02T15:30:00Z",
              autor: { full_name: "Bruno" },
            },
            {
              id: "c1",
              antes: "Ligar hoje",
              depois: "Ligar amanhã",
              corrigido_em: "2026-10-02T14:00:00Z",
              autor: null,
            },
          ],
        },
      ],
      error: null,
    };
    await expect(listarEventos(OPORTUNIDADE)).resolves.toEqual([
      {
        id: "e1",
        tipo: "note",
        deEstagio: null,
        paraEstagio: null,
        conteudo: "Ligar sexta",
        autorId: "u1",
        autorNome: "Ana",
        editadoEm: "2026-10-02T15:30:00Z",
        editadoPorNome: "Bruno",
        conteudoOriginal: "Ligar hoje",
        correcoes: [
          {
            id: "c2",
            antes: "Ligar amanhã",
            depois: "Ligar sexta",
            corrigidoEm: "2026-10-02T15:30:00Z",
            corrigidoPorNome: "Bruno",
          },
          {
            id: "c1",
            antes: "Ligar hoje",
            depois: "Ligar amanhã",
            corrigidoEm: "2026-10-02T14:00:00Z",
            corrigidoPorNome: null,
          },
        ],
        criadoEm: "2026-10-01T12:00:00Z",
      },
    ]);
    const select = chamadas.find((c) => c.metodo === "select");
    expect(String(select?.args[0])).toContain("editado_em");
    expect(String(select?.args[0])).toContain("conteudo_original");
    expect(String(select?.args[0])).toContain("actor_id");
  });

  it("D-069 (C3): as correções vêm do banco mais nova primeiro e com teto por evento (§4.3)", async () => {
    resposta = { data: [], error: null };
    await listarEventos(OPORTUNIDADE);
    expect(String(chamadas.find((c) => c.metodo === "select")?.args[0])).toContain(
      "correcoes_de_nota(id, antes, depois, corrigido_em, autor:profiles!correcoes_de_nota_corrigido_por_fkey(full_name))",
    );
    expect(chamadas).toContainEqual({
      metodo: "order",
      args: ["corrigido_em", { referencedTable: "correcoes_de_nota", ascending: false }],
    });
    expect(chamadas).toContainEqual({
      metodo: "limit",
      args: [50, { referencedTable: "correcoes_de_nota" }],
    });
    expect(chamadas).toContainEqual({
      metodo: "order",
      args: ["created_at", { ascending: false }],
    });
  });

  it("evento sem correção (embed nulo ou vazio) traz correcoes vazia", async () => {
    resposta = {
      data: [
        {
          id: "e1",
          event_type: "note",
          from_stage: null,
          to_stage: null,
          content: "Ligar hoje",
          actor_id: "u1",
          editado_em: null,
          conteudo_original: null,
          created_at: "2026-10-01T11:00:00Z",
          profiles: { full_name: "Ana" },
          editor: null,
          correcoes_de_nota: null,
        },
      ],
      error: null,
    };
    const [unico] = await listarEventos(OPORTUNIDADE);
    expect(unico?.correcoes).toEqual([]);
  });

  it("🔴 os dois embeds de profiles levam a dica da FK: sem ela o PostgREST responde 300 (PGRST201)", async () => {
    resposta = { data: [], error: null };
    await listarEventos(OPORTUNIDADE);
    const select = String(chamadas.find((c) => c.metodo === "select")?.args[0]);
    expect(select).toContain("profiles!opportunity_events_actor_id_fkey(full_name)");
    expect(select).toContain("editor:profiles!opportunity_events_editado_por_fkey(full_name)");
    expect(select).not.toMatch(/(^|[ ,])profiles\(/);
  });

  it("evento corrigido sem sessão (editado_por nulo): editadoPorNome nulo, e nunca corrigido idem", async () => {
    resposta = {
      data: [
        {
          id: "e1",
          event_type: "note",
          from_stage: null,
          to_stage: null,
          content: "Ligar sexta",
          actor_id: "u1",
          editado_em: "2026-10-02T15:30:00Z",
          conteudo_original: "Ligar hoje",
          created_at: "2026-10-01T12:00:00Z",
          profiles: { full_name: "Ana" },
          editor: null,
        },
        {
          id: "e2",
          event_type: "note",
          from_stage: null,
          to_stage: null,
          content: "Ligar hoje",
          actor_id: "u1",
          editado_em: null,
          conteudo_original: null,
          created_at: "2026-10-01T11:00:00Z",
          profiles: { full_name: "Ana" },
          editor: null,
        },
      ],
      error: null,
    };
    const eventos = await listarEventos(OPORTUNIDADE);
    expect(eventos.map((e) => e.editadoPorNome)).toEqual([null, null]);
  });
});
