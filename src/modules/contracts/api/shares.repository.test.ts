import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";
import type { PadraoAGravar } from "./shares.repository";

let resposta: RespostaFalsa = UMA_LINHA;

let responder: (cadeia: readonly ChamadaRegistrada[]) => RespostaFalsa = () => resposta;

const chamadas: ChamadaRegistrada[] = [];

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  return {
    supabaseV2: {
      ...clienteFalso(
        (cadeia) => responder(cadeia),
        (c) => chamadas.push(c),
      ),
      rpc: (...args: unknown[]) => rpc(...args),
    },
  };
});

const {
  adicionarPadrao,
  atualizarPadrao,
  desativarPadrao,
  gravarParticipacoes,
  listarParticipacoes,
  listarPessoasParaParticipacao,
  listarTodosOsPadroes,
  salvarLimiarDeAlerta,
} = await import("./shares.repository");

const PARTICIPACAO = "7c2e1a45-0b93-4d16-a8f2-5e6b3c9d0a71";
const PADRAO = "1d4f6b80-3a27-4c59-9e01-8b2f7a5c6d34";
const PERFIL = "3f1b8c02-91d4-4a67-b0e5-2c7a9d4e6f81";
const CONTRATO = "c0000000-0000-4000-8000-000000000001";

const PADRAO_A_GRAVAR: PadraoAGravar = {
  linhaDeNegocio: "sistemas",
  perfilId: PERFIL,
  tipo: "producao",
  percentual: 15,
};

const PADRAO_ANTERIOR: PadraoAGravar = {
  linhaDeNegocio: "demanda",
  perfilId: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  tipo: "venda",
  percentual: 10,
};

const PADRAO_NAO_SALVO =
  "O padrão não foi salvo: ele mudou em outra tela ou você não tem permissão. Recarregue a página e confira.";

const PERCENTUAL_INVALIDO =
  "O percentual precisa ser maior que 0 e no máximo 100, com até duas casas.";

function responderPorCadeia(
  leitura: RespostaFalsa,
  escrita: (cadeia: readonly ChamadaRegistrada[]) => RespostaFalsa = () => resposta,
): void {
  responder = (cadeia) =>
    cadeia.some((c) => c.metodo === "update" || c.metodo === "insert") ? escrita(cadeia) : leitura;
}

const LEITURA_VAZIA: RespostaFalsa = { data: [], error: null };

function linhaDeProducao(
  id: string,
  percentual: number,
  bu = "sistemas",
  perfil = "00000000-0000-4000-8000-0000000000aa",
) {
  return {
    id,
    business_unit: bu,
    profile_id: perfil,
    kind: "producao",
    share_pct: percentual,
  };
}

const RECUSA_DO_PADRAO =
  "Nada foi alterado: só o owner configura participação padrão. Se você cadastrou o app autenticador e entrou sem o código, saia e entre de novo digitando o código de 6 dígitos.";

const PADRAO_REPETIDO =
  "Esta pessoa já tem participação padrão deste tipo nesta linha de negócio. Se ela não aparece na lista, está desativada: use Adicionar participação padrão para trazê-la de volta.";

const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
  {
    nome: "atualizarPadrao",
    chamar: () => atualizarPadrao(PADRAO, PADRAO_ANTERIOR, PADRAO_A_GRAVAR),
    recusa: PADRAO_NAO_SALVO,
  },
  {
    nome: "desativarPadrao",
    chamar: () => desativarPadrao(PADRAO),
    recusa: RECUSA_DO_PADRAO,
  },
  {
    nome: "salvarLimiarDeAlerta",
    chamar: () => salvarLimiarDeAlerta({ percentual: 60, confirmado: false }),
    recusa: "Nada foi alterado: só o owner muda o aviso de participação.",
  },
];

describe("write barrado pela RLS volta zero linha, e o repositório recusa com a mensagem certa", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    responderPorCadeia(LEITURA_VAZIA);
  });
  afterEach(() => {
    responder = () => resposta;
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

describe("gravarParticipacoes: uma chamada, o conjunto inteiro, e o erro embrulhado", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [], error: null });
  });

  it("monta o payload da RPC com `id` só nas linhas já gravadas, e chama UMA vez", async () => {
    await gravarParticipacoes(CONTRATO, [
      { id: PARTICIPACAO, perfilId: PERFIL, nomeExterno: null, tipo: "producao", percentual: 50 },
      { perfilId: null, nomeExterno: "Carla Indicou", tipo: "venda", percentual: 50 },
    ]);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("save_contract_shares", {
      p_contract_id: CONTRATO,
      p_shares: [
        {
          id: PARTICIPACAO,
          profile_id: PERFIL,
          external_name: null,
          kind: "producao",
          share_pct: 50,
        },
        { profile_id: null, external_name: "Carla Indicou", kind: "venda", share_pct: 50 },
      ],
    });

    const [, argumentos] = rpc.mock.calls[0] as [string, { p_shares: Record<string, unknown>[] }];
    expect(Object.hasOwn(argumentos.p_shares[0] as object, "id")).toBe(true);
    expect(Object.hasOwn(argumentos.p_shares[1] as object, "id")).toBe(false);
  });

  it("lista vazia é pedido legítimo (tirar todas), não recusa: sem guarda de zero linha", async () => {
    await expect(gravarParticipacoes(CONTRATO, [])).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith("save_contract_shares", {
      p_contract_id: CONTRATO,
      p_shares: [],
    });
  });

  it("erro do banco chega embrulhado COM o `code` — o 23514 do teto e o 42501 do papel vêm por aqui", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23514", message: "Participações deste contrato somariam 110.00." },
    });

    const erro = await gravarParticipacoes(CONTRATO, []).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as { code?: string }).code).toBe("23514");
    expect((erro as Error).message).toContain("somariam 110.00");
  });
});

const DESATIVADO = "4b7c2e19-8d05-4f36-a1e2-9c3b6d8f0a52";
const ATIVO = "e2f9a173-5c48-4b20-9d6f-1a7e3c8b5042";

function perfil(id: string, nome: string, ativo: boolean) {
  return { id, full_name: nome, active: ativo };
}

const chamou = (metodo: string) => chamadas.some((c) => c.metodo === metodo);

describe("listarPessoasParaParticipacao: beneficiário desativado continua na lista", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
  });

  it("com participação gravada, filtra por 'ativo OU está gravado', e o desativado volta marcado", async () => {
    resposta = {
      data: [perfil(DESATIVADO, "Ana Souza", false), perfil(ATIVO, "Bia Lima", true)],
      error: null,
    };

    const lista = await listarPessoasParaParticipacao([DESATIVADO]);

    expect(chamadas).toContainEqual({
      metodo: "or",
      args: [`active.eq.true,id.in.(${DESATIVADO})`],
    });
    expect(chamou("eq")).toBe(false);
    expect(lista).toEqual([
      { id: DESATIVADO, nome: "Ana Souza", ativo: false },
      { id: ATIVO, nome: "Bia Lima", ativo: true },
    ]);
  });

  it("sem participação gravada (contrato novo e modal de fechamento), volta ao active = true puro", async () => {
    resposta = { data: [perfil(ATIVO, "Bia Lima", true)], error: null };

    const lista = await listarPessoasParaParticipacao([]);

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamou("or")).toBe(false);
    expect(lista).toEqual([{ id: ATIVO, nome: "Bia Lima", ativo: true }]);
  });

  it("null e o argumento omitido são tratados como 'ninguém a preservar'", async () => {
    await listarPessoasParaParticipacao(null);
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamou("or")).toBe(false);

    chamadas.length = 0;
    await listarPessoasParaParticipacao();
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamou("or")).toBe(false);
  });

  it("🔴 a projeção inclui `active` — sem ela o campo `ativo` mente em silêncio", async () => {
    resposta = { data: [perfil(ATIVO, "Bia Lima", true)], error: null };

    await listarPessoasParaParticipacao([DESATIVADO]);

    const select = chamadas.find((c) => c.metodo === "select");
    expect(select).toBeDefined();
    const colunas = String(select?.args[0] ?? "")
      .split(",")
      .map((coluna) => coluna.trim());
    expect(colunas).toContain("active");
    expect(colunas).toContain("id");
    expect(colunas).toContain("full_name");
  });

  it("🔴 id fora do formato UUID não entra cru no or= — a vírgula viraria sintaxe", async () => {
    await listarPessoasParaParticipacao(["nao-e-uuid,role.eq.owner"]);

    expect(chamou("or")).toBe(false);
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
  });

  it("o positivo ao lado: com um válido junto do inválido, só o válido entra no or=", async () => {
    await listarPessoasParaParticipacao(["nao-e-uuid,role.eq.owner", DESATIVADO]);

    expect(chamadas).toContainEqual({
      metodo: "or",
      args: [`active.eq.true,id.in.(${DESATIVADO})`],
    });
  });

  it("🔴 o dedupe é nosso: `.or()` é passagem literal e não deduplica o `in.(...)`", async () => {
    await listarPessoasParaParticipacao([DESATIVADO, DESATIVADO]);

    expect(chamadas).toContainEqual({
      metodo: "or",
      args: [`active.eq.true,id.in.(${DESATIVADO})`],
    });
  });

  it("o teto continua falhando alto em vez de truncar a lista de escolha", async () => {
    resposta = {
      data: Array.from({ length: 100 }, (_, i) =>
        perfil(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, `P${i}`, true),
      ),
      error: null,
    };

    await expect(listarPessoasParaParticipacao([DESATIVADO])).rejects.toThrow(
      "A lista de pessoas veio no teto de 100 e pode estar incompleta.",
    );
  });

  it("o positivo ao lado do teto: com 99 linhas ela resolve normalmente", async () => {
    resposta = {
      data: Array.from({ length: 99 }, (_, i) =>
        perfil(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, `P${i}`, true),
      ),
      error: null,
    };

    await expect(listarPessoasParaParticipacao([DESATIVADO])).resolves.toHaveLength(99);
  });

  it("erro do banco chega embrulhado COM o `code` — é ele que `ehFaltaDePermissao` lê", async () => {
    resposta = {
      data: null,
      error: { code: "42501", message: "permission denied for table profiles" },
    };

    const erro = await listarPessoasParaParticipacao([DESATIVADO]).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as { code?: string }).code).toBe("42501");
  });
});

describe("listarParticipacoes: o join diz quem está desativado", () => {
  beforeEach(() => {
    chamadas.length = 0;
  });

  function gravada(perfilId: string | null, perfis: { full_name: string; active: boolean } | null) {
    return {
      id: "s1",
      contract_id: "contrato-1",
      profile_id: perfilId,
      external_name: perfilId === null ? "Quem Indicou" : null,
      kind: "producao",
      share_pct: 15,
      profiles: perfis,
    };
  }

  it("🔴 a projeção pede `active` no embed — sem ele `perfilDesativado` mente em silêncio", async () => {
    resposta = { data: [], error: null };

    await listarParticipacoes("contrato-1");

    const select = chamadas.find((c) => c.metodo === "select");
    expect(select).toBeDefined();
    expect(String(select?.args[0] ?? "")).toContain("profiles(full_name, active)");
    expect(String(select?.args[0] ?? "")).toContain("share_pct");
  });

  it("beneficiário DESATIVADO volta marcado — é ele que precisa ser preservado", async () => {
    resposta = { data: [gravada(PERFIL, { full_name: "Ana Souza", active: false })], error: null };

    const lista = await listarParticipacoes("contrato-1");

    expect(lista[0]?.perfilDesativado).toBe(true);
    expect(lista[0]?.beneficiario).toBe("Ana Souza");
  });

  it("o positivo ao lado: beneficiário ATIVO NÃO é marcado — pô-lo na chave só fragmenta o cache", async () => {
    resposta = { data: [gravada(PERFIL, { full_name: "Bia Lima", active: true })], error: null };

    const lista = await listarParticipacoes("contrato-1");

    expect(lista[0]?.perfilDesativado).toBe(false);
  });

  it("beneficiário externo não tem perfil, logo não é 'desativado'", async () => {
    resposta = { data: [gravada(null, null)], error: null };

    const lista = await listarParticipacoes("contrato-1");

    expect(lista[0]?.perfilDesativado).toBe(false);
    expect(lista[0]?.beneficiario).toBe("Quem Indicou");
  });
});

describe("listarTodosOsPadroes: filtra active = true (SET-7)", () => {
  beforeEach(() => {
    chamadas.length = 0;
  });

  it("chama .eq('active', true) — o duplo é cego ao filtro, quem prende o defeito é a CADEIA", async () => {
    resposta = { data: [], error: null };

    await listarTodosOsPadroes();

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
  });
});

describe("atualizarPadrao e desativarPadrao: o que vai no UPDATE", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas.length = 0;
    responderPorCadeia(LEITURA_VAZIA);
  });
  afterEach(() => {
    responder = () => resposta;
  });

  const doUpdate = () => chamadas.slice(chamadas.findIndex((c) => c.metodo === "update"));

  it("atualizar manda BU, pessoa, tipo e percentual novos", async () => {
    await atualizarPadrao(PADRAO, PADRAO_ANTERIOR, PADRAO_A_GRAVAR);

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({
      business_unit: "sistemas",
      profile_id: PERFIL,
      kind: "producao",
      share_pct: 15,
    });
    expect(doUpdate()).toContainEqual({ metodo: "select", args: ["id"] });
  });

  it("🔴 trava otimista: o UPDATE só casa a linha como a tela a leu, e ainda ativa", async () => {
    await atualizarPadrao(PADRAO, PADRAO_ANTERIOR, PADRAO_A_GRAVAR);

    for (const filtro of [
      ["id", PADRAO],
      ["business_unit", PADRAO_ANTERIOR.linhaDeNegocio],
      ["profile_id", PADRAO_ANTERIOR.perfilId],
      ["kind", PADRAO_ANTERIOR.tipo],
      ["share_pct", PADRAO_ANTERIOR.percentual],
      ["active", true],
    ]) {
      expect(doUpdate()).toContainEqual({ metodo: "eq", args: filtro });
    }
  });

  it("🔴 atualizar para pessoa, tipo e BU de outra linha: 23505 vira frase", async () => {
    responderPorCadeia(LEITURA_VAZIA, () => ({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    }));

    const erro: unknown = await atualizarPadrao(PADRAO, PADRAO_ANTERIOR, PADRAO_A_GRAVAR).catch(
      (e: unknown) => e,
    );

    expect(erro).toMatchObject({ code: "23505", message: PADRAO_REPETIDO });
  });

  it("desativar só apaga a marca de ativo, na linha certa", async () => {
    await desativarPadrao(PADRAO);

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({ active: false });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["id", PADRAO] });
  });
});

describe("adicionarPadrao: a unique (BU, pessoa, tipo) inclui as linhas desativadas", () => {
  beforeEach(() => {
    chamadas.length = 0;
  });
  afterEach(() => {
    responder = () => resposta;
  });

  it("🔴 pessoa desativada volta: reativa a linha antiga com o percentual novo, sem INSERT", async () => {
    responderPorCadeia(LEITURA_VAZIA, () => UMA_LINHA);

    await expect(adicionarPadrao(PADRAO_A_GRAVAR)).resolves.toBeUndefined();

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({
      active: true,
      share_pct: 15,
    });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["business_unit", "sistemas"] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["profile_id", PERFIL] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["kind", "producao"] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", false] });
    expect(chamadas.map((c) => c.metodo)).not.toContain("insert");
  });

  it("sem linha desativada: insere a linha nova", async () => {
    responderPorCadeia(LEITURA_VAZIA, (cadeia) =>
      cadeia.some((c) => c.metodo === "update") ? ZERO_LINHAS : { data: null, error: null },
    );

    await expect(adicionarPadrao(PADRAO_A_GRAVAR)).resolves.toBeUndefined();

    expect(chamadas.find((c) => c.metodo === "insert")?.args[0]).toEqual({
      business_unit: "sistemas",
      profile_id: PERFIL,
      kind: "producao",
      share_pct: 15,
    });
  });

  it("🔴 a mesma pessoa, tipo e BU já ATIVA: 23505 vira frase, com o code preservado", async () => {
    responderPorCadeia(LEITURA_VAZIA, (cadeia) =>
      cadeia.some((c) => c.metodo === "update")
        ? ZERO_LINHAS
        : {
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          },
    );

    const erro: unknown = await adicionarPadrao(PADRAO_A_GRAVAR).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({ code: "23505", message: PADRAO_REPETIDO });
  });

  it("🔴 INSERT recusado pela RLS (não owner, ou owner sem o código do app): 42501 diz o que fazer", async () => {
    responderPorCadeia(LEITURA_VAZIA, (cadeia) =>
      cadeia.some((c) => c.metodo === "update")
        ? ZERO_LINHAS
        : {
            data: null,
            error: {
              code: "42501",
              message: 'new row violates row-level security policy for table "bu_default_shares"',
            },
          },
    );

    const erro: unknown = await adicionarPadrao(PADRAO_A_GRAVAR).catch((e: unknown) => e);

    expect(erro).toMatchObject({ code: "42501", message: RECUSA_DO_PADRAO });
  });

  it("🔴 erro no UPDATE de reativação sai com o code e não tenta o INSERT", async () => {
    responderPorCadeia(LEITURA_VAZIA, () => ({
      data: null,
      error: { code: "40001", message: "could not serialize access due to concurrent update" },
    }));

    const erro: unknown = await adicionarPadrao(PADRAO_A_GRAVAR).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({ code: "40001" });
    expect(chamadas.map((c) => c.metodo)).not.toContain("insert");
  });
});

describe("🔴 produção padrão: o teto é conferido sobre o que o banco tem agora, não só sobre a tela", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas.length = 0;
  });
  afterEach(() => {
    responder = () => resposta;
  });

  const escreveu = () => chamadas.some((c) => c.metodo === "update" || c.metodo === "insert");
  const OUTRA_ABA = {
    data: [linhaDeProducao(PADRAO, 15), linhaDeProducao("outra", 80)],
    error: null,
  };

  it("atualizar: outra aba já gravou 80% de produção na BU, então 90% estoura e nada é escrito", async () => {
    responderPorCadeia(OUTRA_ABA);

    const erro: unknown = await atualizarPadrao(PADRAO, PADRAO_ANTERIOR, {
      ...PADRAO_A_GRAVAR,
      percentual: 90,
    }).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(
      "A produção padrão de Sistemas somaria 170%. Acima de 100%, todo contrato novo dessa linha seria recusado.",
    );
    expect(escreveu()).toBe(false);
  });

  it("o positivo ao lado: 20% no lugar dos 15% da própria linha, ao lado de 80%, dá 100% e grava", async () => {
    responderPorCadeia(OUTRA_ABA);

    await expect(
      atualizarPadrao(PADRAO, PADRAO_ANTERIOR, { ...PADRAO_A_GRAVAR, percentual: 20 }),
    ).resolves.toBeUndefined();

    expect(escreveu()).toBe(true);
  });

  it("adicionar: 90% já gravados na BU, então mais 15,5% estoura, com a soma em pt-BR e sem write", async () => {
    responderPorCadeia({ data: [linhaDeProducao("outra", 90)], error: null });

    const erro: unknown = await adicionarPadrao({ ...PADRAO_A_GRAVAR, percentual: 15.5 }).catch(
      (e: unknown) => e,
    );

    expect((erro as Error).message).toBe(
      "A produção padrão de Sistemas somaria 105,5%. Acima de 100%, todo contrato novo dessa linha seria recusado.",
    );
    expect(escreveu()).toBe(false);
  });

  it("o positivo ao lado: mais 10% ao lado de 90% dá 100% e insere", async () => {
    responderPorCadeia({ data: [linhaDeProducao("outra", 90)], error: null }, (cadeia) =>
      cadeia.some((c) => c.metodo === "update") ? ZERO_LINHAS : { data: null, error: null },
    );

    await expect(adicionarPadrao({ ...PADRAO_A_GRAVAR, percentual: 10 })).resolves.toBeUndefined();

    expect(chamadas.map((c) => c.metodo)).toContain("insert");
  });

  it("🔴 a mesma pessoa já ATIVA na BU: a soma não a conta duas vezes, e a recusa é a frase de repetição", async () => {
    responderPorCadeia(
      { data: [linhaDeProducao("ja-ativa", 90, "sistemas", PERFIL)], error: null },
      (cadeia) =>
        cadeia.some((c) => c.metodo === "update")
          ? ZERO_LINHAS
          : {
              data: null,
              error: { code: "23505", message: "duplicate key value violates unique constraint" },
            },
    );

    const erro: unknown = await adicionarPadrao({ ...PADRAO_A_GRAVAR, percentual: 50 }).catch(
      (e: unknown) => e,
    );

    expect(erro).toMatchObject({ code: "23505", message: PADRAO_REPETIDO });
    expect(chamadas.map((c) => c.metodo)).toContain("insert");
  });

  it("a releitura pede só a produção ATIVA da BU, com projeção explícita e limite", async () => {
    responderPorCadeia(LEITURA_VAZIA);

    await atualizarPadrao(PADRAO, PADRAO_ANTERIOR, PADRAO_A_GRAVAR);

    const leitura = chamadas.slice(
      0,
      chamadas.findIndex((c) => c.metodo === "update"),
    );
    expect(leitura).toContainEqual({ metodo: "from", args: ["bu_default_shares"] });
    expect(leitura).toContainEqual({
      metodo: "select",
      args: ["id, business_unit, profile_id, kind, share_pct"],
    });
    expect(leitura).toContainEqual({ metodo: "eq", args: ["business_unit", "sistemas"] });
    expect(leitura).toContainEqual({ metodo: "eq", args: ["kind", "producao"] });
    expect(leitura).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(leitura).toContainEqual({ metodo: "limit", args: [100] });
  });

  it("outro tipo não relê: o gatilho só aplica produção, então nada a somar", async () => {
    responderPorCadeia({ data: [linhaDeProducao("outra", 90)], error: null });

    await atualizarPadrao(PADRAO, PADRAO_ANTERIOR, {
      ...PADRAO_A_GRAVAR,
      tipo: "venda",
      percentual: 90,
    });
    await adicionarPadrao({ ...PADRAO_A_GRAVAR, tipo: "indicacao", percentual: 90 });

    expect(chamadas.map((c) => c.metodo)).not.toContain("limit");
    expect(escreveu()).toBe(true);
  });

  it.each([
    ["atualizarPadrao", () => atualizarPadrao(PADRAO, PADRAO_ANTERIOR, PADRAO_A_GRAVAR)],
    ["adicionarPadrao", () => adicionarPadrao(PADRAO_A_GRAVAR)],
  ])("%s: erro da releitura sai com o code e nada é escrito", async (_nome, chamar) => {
    responderPorCadeia({
      data: null,
      error: { code: "42501", message: "permission denied for table bu_default_shares" },
    });

    const erro: unknown = await chamar().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({ code: "42501" });
    expect(escreveu()).toBe(false);
  });

  it("releitura no teto de 100 linhas falha alto, em vez de somar menos que o banco", async () => {
    responderPorCadeia({
      data: Array.from({ length: 100 }, (_, i) => linhaDeProducao(`p-${i}`, 0.5)),
      error: null,
    });

    await expect(adicionarPadrao(PADRAO_A_GRAVAR)).rejects.toThrow("pode estar incompleta");

    expect(escreveu()).toBe(false);
  });
});

describe("percentual do padrão: fora de 0 a 100, ou com mais de duas casas, não chega ao banco", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas.length = 0;
    responderPorCadeia(LEITURA_VAZIA);
  });
  afterEach(() => {
    responder = () => resposta;
  });

  it.each([0, -1, 100.5, 1.005, Number.NaN])(
    "🔴 %s recusa em atualizar e em adicionar, sem nenhuma chamada",
    async (percentual) => {
      const padrao = { ...PADRAO_A_GRAVAR, percentual };

      await expect(atualizarPadrao(PADRAO, PADRAO_ANTERIOR, padrao)).rejects.toThrow(
        PERCENTUAL_INVALIDO,
      );
      await expect(adicionarPadrao(padrao)).rejects.toThrow(PERCENTUAL_INVALIDO);

      expect(chamadas).toHaveLength(0);
    },
  );

  it.each([100, 0.01, 53.02])("o positivo ao lado: %s grava", async (percentual) => {
    const padrao = { ...PADRAO_A_GRAVAR, percentual };

    await expect(atualizarPadrao(PADRAO, PADRAO_ANTERIOR, padrao)).resolves.toBeUndefined();
    await expect(adicionarPadrao(padrao)).resolves.toBeUndefined();
  });
});

describe("salvarLimiarDeAlerta", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas.length = 0;
  });

  it("grava pct e PRESERVA _confirmado, na chave certa", async () => {
    await salvarLimiarDeAlerta({ percentual: 70, confirmado: false });

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({
      value: { pct: 70, _confirmado: false },
    });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["key", "share_warning_pct"] });
    expect(chamadas).toContainEqual({ metodo: "select", args: ["key"] });
  });

  it.each([0, -5, 100.01, Number.NaN])("🔴 %s não chega ao banco", async (percentual) => {
    await expect(salvarLimiarDeAlerta({ percentual, confirmado: false })).rejects.toThrow(
      "O aviso precisa ser maior que 0 e no máximo 100%.",
    );

    expect(chamadas.map((c) => c.metodo)).not.toContain("update");
  });

  it("100 cabe: o positivo ao lado", async () => {
    await expect(
      salvarLimiarDeAlerta({ percentual: 100, confirmado: true }),
    ).resolves.toBeUndefined();
  });
});
