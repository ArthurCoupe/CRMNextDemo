import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Reuniao } from "../api/meetings.repository";
import type { DadosDaPreparacao } from "../domain/preparacao";

vi.mock("../api/meetings.repository", () => ({
  listarReunioes: vi.fn(),
  listarClientesParaSelecao: vi.fn(),
  buscarOportunidadesParaSelecao: vi.fn(),
  listarStaffParaSelecao: vi.fn(),
  criarReuniao: vi.fn(),
  atualizarReuniao: vi.fn(),
  cancelarReuniao: vi.fn(),
  desfazerCancelamento: vi.fn(),
  apagarReuniao: vi.fn(),
  consultarConflitos: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("../api/preparacao.repository", () => ({ lerPreparacao: vi.fn() }));
vi.mock("@/modules/seguranca/api/mfa.repository", () => ({
  lerSituacaoDoSegundoFator: vi.fn(),
}));

const perfilFalso = { papel: "owner" as string | null, meuId: "u1" as string | null };
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => perfilFalso }));

const {
  apagarReuniao,
  atualizarReuniao,
  buscarOportunidadesParaSelecao,
  cancelarReuniao,
  consultarConflitos,
  criarReuniao,
  desfazerCancelamento,
} = await import("../api/meetings.repository");
const { ReuniaoCriadaSemParticipantes } = await import("../domain/meeting");
const { toast } = await import("sonner");
const {
  chavesDeReunioes,
  useApagarReuniao,
  useAtualizarReuniao,
  useBuscaDeOportunidades,
  useCancelarReuniao,
  useConflitos,
  useCriarReuniao,
  useDesfazerCancelamento,
  usePreparacao,
} = await import("./use-meetings");
const { lerPreparacao } = await import("../api/preparacao.repository");
const { lerSituacaoDoSegundoFator } = await import("@/modules/seguranca/api/mfa.repository");
const { FRASES } = await import("../domain/preparacao");

const DADOS = {
  titulo: "Kickoff",
  tipo: "interna_de_time" as const,
  startsAt: "2026-10-05T17:00:00.000Z",
  duracaoMinutos: 60,
  clienteId: null,
  oportunidadeId: null,
  local: null,
  notas: null,
  participantes: ["p1"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

function montarCom<T>(usar: () => T) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  const hook = renderHook(usar, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  });
  return { ...hook, invalidar };
}

function montar() {
  return montarCom(useCriarReuniao);
}

describe("useCriarReuniao: falha depois do INSERT de meetings (MEET-4)", () => {
  it("ReuniaoCriadaSemParticipantes invalida a lista e diz para editar", async () => {
    vi.mocked(criarReuniao).mockRejectedValue(new ReuniaoCriadaSemParticipantes("r1"));
    const { result, invalidar } = montar();

    result.current.mutate(DADOS);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeReunioes.raiz });
    expect(toast.error).toHaveBeenCalledWith(
      "Reunião criada sem participantes. Edite para adicionar",
    );
  });

  it("erro comum não invalida e mantém a mensagem do erro", async () => {
    vi.mocked(criarReuniao).mockRejectedValue(new Error("recusado pelo banco"));
    const { result, invalidar } = montar();

    result.current.mutate(DADOS);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("recusado pelo banco");
  });

  it("objeto cru (não é Error) cai no fallback, sem invalidar", async () => {
    vi.mocked(criarReuniao).mockRejectedValue({ message: "", details: "" });
    const { result, invalidar } = montar();

    result.current.mutate(DADOS);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar a reunião.");
  });
});

describe("useCancelarReuniao: falha invalida a lista", () => {
  it("erro invalida `raiz` e mantém a mensagem do erro", async () => {
    vi.mocked(cancelarReuniao).mockRejectedValue(new Error("Reunião já cancelada."));
    const { result, invalidar } = montarCom(useCancelarReuniao);

    result.current.mutate({ id: "r1", motivo: "cliente desmarcou" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeReunioes.raiz });
    expect(toast.error).toHaveBeenCalledWith("Reunião já cancelada.");
  });

  it("sucesso invalida `raiz` e confirma", async () => {
    vi.mocked(cancelarReuniao).mockResolvedValue(undefined);
    const { result, invalidar } = montarCom(useCancelarReuniao);

    result.current.mutate({ id: "r1", motivo: "cliente desmarcou" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeReunioes.raiz });
    expect(toast.success).toHaveBeenCalledWith("Reunião cancelada.");
  });
});

describe("useAtualizarReuniao: falha no meio da edição também relê a lista", () => {
  it("erro invalida `raiz` e mantém a mensagem do erro", async () => {
    vi.mocked(atualizarReuniao).mockRejectedValue(new Error("Falhou ao sincronizar."));
    const { result, invalidar } = montarCom(useAtualizarReuniao);

    result.current.mutate({ id: "r1", dados: { organizadorId: "p1" } });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeReunioes.raiz });
    expect(toast.error).toHaveBeenCalledWith("Falhou ao sincronizar.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("sucesso invalida `raiz` e confirma", async () => {
    vi.mocked(atualizarReuniao).mockResolvedValue(undefined);
    const { result, invalidar } = montarCom(useAtualizarReuniao);

    result.current.mutate({ id: "r1", dados: { organizadorId: "p1" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(atualizarReuniao).toHaveBeenCalledWith("r1", { organizadorId: "p1" });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeReunioes.raiz });
    expect(toast.success).toHaveBeenCalledWith("Reunião salva.");
  });
});

describe("useApagarReuniao", () => {
  it("sucesso apaga pelo id, invalida `raiz` e confirma", async () => {
    vi.mocked(apagarReuniao).mockResolvedValue(undefined);
    const { result, invalidar } = montarCom(useApagarReuniao);

    result.current.mutate("r1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apagarReuniao).toHaveBeenCalledWith("r1");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeReunioes.raiz });
    expect(toast.success).toHaveBeenCalledWith("Reunião apagada.");
  });

  it("erro invalida `raiz`, mantém a mensagem e não confirma", async () => {
    vi.mocked(apagarReuniao).mockRejectedValue(new Error("Só quem organizou apaga."));
    const { result, invalidar } = montarCom(useApagarReuniao);

    result.current.mutate("r1");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeReunioes.raiz });
    expect(toast.error).toHaveBeenCalledWith("Só quem organizou apaga.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("useDesfazerCancelamento (D-069, C6)", () => {
  const LIDA = "2026-09-08T12:00:00.123456+00:00";

  function desfazerCom(qc: QueryClient) {
    return renderHook(() => useDesfazerCancelamento(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children),
    });
  }

  function comReleituraEmAndamento(qc: QueryClient) {
    let terminar: () => void = () => undefined;
    const lista = new Promise<void>((resolve) => {
      terminar = resolve;
    });
    const invalidar = vi
      .spyOn(qc, "invalidateQueries")
      .mockImplementation((filtros) =>
        filtros?.queryKey === chavesDeReunioes.listas ? lista : new Promise<void>(() => undefined),
      );
    return { invalidar, terminar };
  }

  it("sucesso leva o id e o cancelada_em lido, avisa e relê as reuniões", async () => {
    vi.mocked(desfazerCancelamento).mockResolvedValueOnce(undefined);
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = desfazerCom(qc);
    result.current.mutate({ id: "r1", canceladaEm: LIDA });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(desfazerCancelamento).toHaveBeenCalledWith("r1", LIDA);
    expect(toast.success).toHaveBeenCalledWith("Cancelamento desfeito. A reunião voltou à agenda.");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeReunioes.raiz });
    expect(invalidar).toHaveBeenCalledWith(
      { queryKey: chavesDeReunioes.listas },
      { cancelRefetch: false },
    );
  });

  it("falha também relê e mostra a frase", async () => {
    vi.mocked(desfazerCancelamento).mockRejectedValueOnce(new Error("Não estava cancelada."));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = desfazerCom(qc);
    result.current.mutate({ id: "r1", canceladaEm: LIDA });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Não estava cancelada.");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeReunioes.raiz });
    expect(invalidar).toHaveBeenCalledWith(
      { queryKey: chavesDeReunioes.listas },
      { cancelRefetch: false },
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("sucesso fica pendente até a LISTA ser relida, sem esperar o resto da raiz", async () => {
    vi.mocked(desfazerCancelamento).mockResolvedValueOnce(undefined);
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { invalidar, terminar } = comReleituraEmAndamento(qc);
    const { result } = desfazerCom(qc);
    result.current.mutate({ id: "r1", canceladaEm: LIDA });

    await waitFor(() => expect(invalidar).toHaveBeenCalledTimes(2));
    expect(result.current.isPending).toBe(true);
    expect(result.current.isSuccess).toBe(false);

    terminar();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("falha também fica pendente até a LISTA ser relida, sem esperar o resto da raiz", async () => {
    vi.mocked(desfazerCancelamento).mockRejectedValueOnce(new Error("Não estava cancelada."));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { invalidar, terminar } = comReleituraEmAndamento(qc);
    const { result } = desfazerCom(qc);
    result.current.mutate({ id: "r1", canceladaEm: LIDA });

    await waitFor(() => expect(invalidar).toHaveBeenCalledTimes(2));
    expect(result.current.isPending).toBe(true);
    expect(result.current.isError).toBe(false);

    terminar();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("`listas` é o prefixo da chave de `lista(filtros)`", () => {
    expect(chavesDeReunioes.lista({}).slice(0, chavesDeReunioes.listas.length)).toEqual([
      ...chavesDeReunioes.listas,
    ]);
  });
});

describe("useConflitos: só consulta com duração entre 1 e 1440 (MEET-6)", () => {
  const INICIO = "2026-10-05T17:00:00.000Z";

  it("🔴 duração 0 não dispara a RPC — fica idle, sem erro", async () => {
    const { result } = montarCom(() => useConflitos(["p1"], INICIO, 0));

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.isError).toBe(false);
    expect(consultarConflitos).not.toHaveBeenCalled();
  });

  it("🔴 duração 1441 tampouco", async () => {
    const { result } = montarCom(() => useConflitos(["p1"], INICIO, 1441));

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(consultarConflitos).not.toHaveBeenCalled();
  });

  it("duração 60 consulta, com os quatro argumentos", async () => {
    vi.mocked(consultarConflitos).mockResolvedValue([]);
    const { result } = montarCom(() => useConflitos(["p1"], INICIO, 60, "r9"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(consultarConflitos).toHaveBeenCalledWith(["p1"], INICIO, 60, "r9");
  });
});

describe("usePreparacao (D-060, critérios 2 e 6)", () => {
  const DADOS_DE_CLIENTE: DadosDaPreparacao = {
    oportunidadeId: null,
    oportunidade: null,
    eventos: [],
    respostas: [],
    catalogo: null,
    clienteId: "c1",
    cliente: {
      id: "c1",
      nome: "Acme",
      status: "active",
      segmento: null,
      nicho: null,
      contatoNome: null,
      contatoEmail: null,
      contatoTelefone: null,
      responsavelId: "u1",
      responsavelNome: "Ana",
      assinadoEm: null,
      confidencial: false,
    },
    contratos: [],
    jornada: null,
    tarefas: [],
    reunioesAnteriores: [],
  };

  function reuniaoDe(over: Partial<Reuniao> = {}): Reuniao {
    return {
      id: "r1",
      titulo: "Kickoff",
      tipo: "kickoff_cliente",
      startsAt: "2026-10-05T17:00:00.000Z",
      duracaoMinutos: 60,
      clienteId: "c1",
      clienteNome: "Acme",
      oportunidadeId: null,
      oportunidadeNome: null,
      organizadorId: "u1",
      local: null,
      notas: null,
      canceladaEm: null,
      motivoDoCancelamento: null,
      participantes: [],
      cancelamentosDesfeitos: [],
      ...over,
    };
  }

  beforeEach(() => {
    perfilFalso.papel = "owner";
    perfilFalso.meuId = "u1";
    vi.mocked(lerPreparacao).mockResolvedValue(DADOS_DE_CLIENTE);
    vi.mocked(lerSituacaoDoSegundoFator).mockResolvedValue("ok");
  });

  it("com a ficha fechada (reunião nula) não lê nada", () => {
    const { result } = montarCom(() => usePreparacao(null));
    expect(result.current.fetchStatus).toBe("idle");
    expect(lerPreparacao).not.toHaveBeenCalled();
  });

  it("aberta: lê com o contexto de acesso e devolve as seções montadas", async () => {
    const { result } = montarCom(() => usePreparacao(reuniaoDe()));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(lerPreparacao).toHaveBeenCalledWith(expect.objectContaining({ id: "r1" }), {
      papel: "owner",
      usuarioId: "u1",
    });
    expect(result.current.data?.map((s) => s.chave)).toEqual([
      "cliente",
      "contratos",
      "onboarding",
      "tarefas",
      "reunioes",
    ]);
  });

  it("owner com cliente e sessão sem o código: Contratos pede o código", async () => {
    vi.mocked(lerSituacaoDoSegundoFator).mockResolvedValue("falta-codigo");
    const { result } = montarCom(() => usePreparacao(reuniaoDe()));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(lerSituacaoDoSegundoFator).toHaveBeenCalledTimes(1);
    expect(result.current.data?.find((s) => s.chave === "contratos")?.vazio).toBe(
      FRASES.contratosSemCodigo,
    );
  });

  it("member não consulta o segundo fator", async () => {
    perfilFalso.papel = "member";
    const { result } = montarCom(() => usePreparacao(reuniaoDe()));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(lerSituacaoDoSegundoFator).not.toHaveBeenCalled();
  });

  it("reunião só com lead não consulta o segundo fator", async () => {
    vi.mocked(lerPreparacao).mockResolvedValue({
      ...DADOS_DE_CLIENTE,
      oportunidadeId: "o1",
      clienteId: null,
      cliente: null,
      contratos: null,
    });
    const { result } = montarCom(() =>
      usePreparacao(reuniaoDe({ clienteId: null, clienteNome: null, oportunidadeId: "o1" })),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(lerSituacaoDoSegundoFator).not.toHaveBeenCalled();
  });

  it("sem papel ainda (perfil carregando) espera em vez de ler sem contexto", () => {
    perfilFalso.papel = null;
    const { result } = montarCom(() => usePreparacao(reuniaoDe()));
    expect(result.current.fetchStatus).toBe("idle");
    expect(lerPreparacao).not.toHaveBeenCalled();
  });

  it("a chave fica sob a raiz do módulo: editar ou cancelar reunião refaz a ficha", () => {
    expect(chavesDeReunioes.preparacao("r1", "owner", "u1").slice(0, 1)).toEqual(
      chavesDeReunioes.raiz,
    );
  });
});

describe("useBuscaDeOportunidades", () => {
  it("🔴 menos de 2 letras não consulta: fica idle, sem erro", async () => {
    const { result } = montarCom(() => useBuscaDeOportunidades(" a "));

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.isError).toBe(false);
    expect(buscarOportunidadesParaSelecao).not.toHaveBeenCalled();
  });

  it("2 letras ou mais consulta, com o termo aparado", async () => {
    vi.mocked(buscarOportunidadesParaSelecao).mockResolvedValue({
      itens: [{ id: "o1", nome: "Acme" }],
      haMais: false,
    });
    const { result } = montarCom(() => useBuscaDeOportunidades("  ac "));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(buscarOportunidadesParaSelecao).toHaveBeenCalledWith("ac");
    expect(result.current.data?.itens).toEqual([{ id: "o1", nome: "Acme" }]);
  });

  it("a chave fica sob a raiz do módulo e muda com o termo", () => {
    expect(chavesDeReunioes.buscaDeOportunidades("ac")[0]).toBe(chavesDeReunioes.raiz[0]);
    expect(chavesDeReunioes.buscaDeOportunidades("ac")).not.toEqual(
      chavesDeReunioes.buscaDeOportunidades("acm"),
    );
  });
});
