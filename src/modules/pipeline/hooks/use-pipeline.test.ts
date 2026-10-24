import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../api/pipeline.repository", () => ({
  apagarOportunidade: vi.fn(),
  atualizarDadosDaOportunidade: vi.fn(),
  atualizarDatasDeReuniao: vi.fn(),
  atualizarEmLote: vi.fn(),
  atualizarNutricao: vi.fn(),
  carregarCatalogo: vi.fn(),
  corrigirMotivoDeSaida: vi.fn(),
  corrigirTextoDoEvento: vi.fn(),
  criarOportunidade: vi.fn(),
  importarOportunidades: vi.fn(),
  listarEventos: vi.fn(),
  listarOportunidades: vi.fn(),
  listarResponsaveis: vi.fn(),
  lerAtividadeSemanal: vi.fn(),
  lerFechamentosPorCampanha: vi.fn(),
  lerFunilPorCanal: vi.fn(),
  lerMixDeOportunidades: vi.fn(),
  lerPrimeiroContato: vi.fn(),
  lerTempoAtePrimeiroContato: vi.fn(),
  moverParaEstagio: vi.fn(),
  registrarToque: vi.fn(),
  responderPergunta: vi.fn(),
  vincularRef: vi.fn(),
}));

vi.mock("../api/pipelines.repository", () => ({
  apagarPipeline: vi.fn(),
  arquivarPipeline: vi.fn(),
  criarPipeline: vi.fn(),
  listarCampos: vi.fn(),
  listarEstagios: vi.fn(),
  listarMotivos: vi.fn(),
  listarPipelines: vi.fn(),
  renomearPipeline: vi.fn(),
  salvarCampos: vi.fn(),
  salvarEstagios: vi.fn(),
  salvarMotivos: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const {
  apagarOportunidade,
  atualizarDadosDaOportunidade,
  atualizarDatasDeReuniao,
  atualizarEmLote,
  atualizarNutricao,
  corrigirMotivoDeSaida,
  corrigirTextoDoEvento,
  importarOportunidades,
  lerPrimeiroContato,
  moverParaEstagio,
  registrarToque,
} = await import("../api/pipeline.repository");
const { apagarPipeline, listarCampos, salvarCampos } = await import("../api/pipelines.repository");
const { toast } = await import("sonner");
const {
  chavesDoPipeline,
  useApagarOportunidade,
  useApagarPipeline,
  useAtualizarDadosDaOportunidade,
  useAtualizarDatasDeReuniao,
  useAtualizarEmLote,
  useAtualizarNutricao,
  useCampos,
  useCorrigirMotivoDeSaida,
  useCorrigirTextoDoEvento,
  useImportarOportunidades,
  useMoverEstagio,
  usePrimeiroContato,
  useRegistrarToque,
  useSalvarCampos,
} = await import("./use-pipeline");

beforeEach(() => {
  vi.clearAllMocks();
});

const PIPELINE = "10000000-0000-4000-8000-000000000001";
const LINHA = { numero: 2, dados: { nome: "Padaria do Zé" }, erros: [] } as never;

function montar(qc: QueryClient) {
  return renderHook(() => useImportarOportunidades(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  });
}

describe("useImportarOportunidades: invalidação depende de previa", () => {
  it("previa=false invalida chavesDoPipeline.raiz e avisa com o placar", async () => {
    vi.mocked(importarOportunidades).mockResolvedValue([
      { numero: 2, acao: "nova", motivo: null, oportunidadeId: "op-2" },
      { numero: 3, acao: "atualiza", motivo: null, oportunidadeId: "op-3" },
      { numero: 4, acao: "erro", motivo: "nome é obrigatório", oportunidadeId: null },
    ]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = montar(qc);

    result.current.mutate({
      pipelineId: PIPELINE,
      linhas: [LINHA],
      previa: false,
      arquivo: "a.csv",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidar).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: chavesDoPipeline.raiz }),
    );
    expect(toast.success).toHaveBeenCalledWith("1 nova · 1 atualizada · 1 erro");
  });

  it("previa=true NÃO invalida nada e não mostra toast de sucesso", async () => {
    vi.mocked(importarOportunidades).mockResolvedValue([
      { numero: 2, acao: "nova", motivo: null, oportunidadeId: null },
    ]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = montar(qc);

    result.current.mutate({
      pipelineId: PIPELINE,
      linhas: [LINHA],
      previa: true,
      arquivo: "a.csv",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidar).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("erro do repositório avisa por toast, com a mensagem — mesmo padrão dos vizinhos", async () => {
    vi.mocked(importarOportunidades).mockRejectedValue(
      new Error("Pipeline inexistente ou arquivado."),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = montar(qc);

    result.current.mutate({
      pipelineId: PIPELINE,
      linhas: [LINHA],
      previa: true,
      arquivo: "a.csv",
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Pipeline inexistente ou arquivado.");
  });
});

const CAMPO = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  pipelineId: PIPELINE,
  nome: "Tem site?",
  tipo: "sim_nao" as const,
  opcoes: null,
  obrigatorio: true,
  ordem: 1,
  ativo: true,
};

function envolver(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe("useCampos", () => {
  it("chave ['pipelines', id, 'campos', incluirInativos] e desligado sem pipeline", async () => {
    vi.mocked(listarCampos).mockResolvedValue([CAMPO]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const desligado = renderHook(() => useCampos(null), { wrapper: envolver(qc) });
    expect(desligado.result.current.fetchStatus).toBe("idle");
    expect(listarCampos).not.toHaveBeenCalled();

    const { result } = renderHook(() => useCampos(PIPELINE, true), { wrapper: envolver(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listarCampos).toHaveBeenCalledWith(PIPELINE, true);
    expect(chavesDoPipeline.campos(PIPELINE)).toEqual(["pipelines", PIPELINE, "campos"]);
    expect(qc.getQueryData([...chavesDoPipeline.campos(PIPELINE), true])).toEqual([CAMPO]);
  });
});

describe("useSalvarCampos: só conclui depois de campos e raiz invalidados", () => {
  it("🔴 a mutação NÃO conclui enquanto o refetch dos campos (disparado pelo invalidate) está pendente", async () => {
    let liberarRefetch: (() => void) | undefined;
    const refetchPendente = new Promise<void>((resolve) => {
      liberarRefetch = resolve;
    });
    vi.mocked(listarCampos)
      .mockResolvedValueOnce([CAMPO])
      .mockImplementationOnce(async () => {
        await refetchPendente;
        return [{ ...CAMPO, nome: "Tem site" }];
      });
    vi.mocked(salvarCampos).mockResolvedValueOnce(undefined);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");

    const lista = renderHook(() => useCampos(PIPELINE, true), { wrapper: envolver(qc) });
    await waitFor(() => expect(lista.result.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useSalvarCampos(), { wrapper: envolver(qc) });
    result.current.mutate({ pipelineId: PIPELINE, rascunho: [{ ...CAMPO, nome: "Tem site" }] });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.isSuccess).toBe(false);

    liberarRefetch?.();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(salvarCampos).toHaveBeenCalledWith(PIPELINE, [{ ...CAMPO, nome: "Tem site" }]);
    expect(invalidar).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: chavesDoPipeline.campos(PIPELINE) }),
    );
    expect(invalidar).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: chavesDoPipeline.raiz }),
    );
    const noCache = qc.getQueryData([...chavesDoPipeline.campos(PIPELINE), true]) as
      readonly { nome: string }[] | undefined;
    expect(noCache?.[0]?.nome).toBe("Tem site");
  });

  it("🔴 erro do repositório invalida os campos DO pipeline (a verdade é o banco: N requisições podem parar no meio) antes do toast — e não toca a raiz", async () => {
    vi.mocked(salvarCampos).mockRejectedValueOnce(
      new Error("Este campo tem valor gravado em 3 oportunidades. Desative em vez de apagar."),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSalvarCampos(), { wrapper: envolver(qc) });

    result.current.mutate({ pipelineId: PIPELINE, rascunho: [] });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).toHaveBeenCalledTimes(1);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoPipeline.campos(PIPELINE) });
    expect(toast.error).toHaveBeenCalledWith(
      "Este campo tem valor gravado em 3 oportunidades. Desative em vez de apagar.",
    );
    expect(invalidar.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(toast.error).mock.invocationCallOrder[0],
    );
  });
});

describe("useAtualizarEmLote: invalida a raiz nos dois desfechos, e o sucesso ESPERA o refetch", () => {
  const ALVOS = [{ id: "op-1", stageId: "estagio-r1" }];

  it("🔴 sucesso: a mutação só conclui depois do refetch da raiz, e o toast traz a contagem do banco", async () => {
    let liberarRefetch: (() => void) | undefined;
    const refetchPendente = new Promise<void>((resolve) => {
      liberarRefetch = resolve;
    });
    const { listarOportunidades } = await import("../api/pipeline.repository");
    vi.mocked(listarOportunidades)
      .mockResolvedValueOnce([])
      .mockImplementationOnce(async () => {
        await refetchPendente;
        return [];
      });
    vi.mocked(atualizarEmLote).mockResolvedValueOnce(3);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { usePipeline } = await import("./use-pipeline");
    const board = renderHook(() => usePipeline(PIPELINE), { wrapper: envolver(qc) });
    await waitFor(() => expect(board.result.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useAtualizarEmLote(), { wrapper: envolver(qc) });
    result.current.mutate({ alvos: ALVOS, acao: { ownerId: "vinicius" } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.isSuccess).toBe(false);

    liberarRefetch?.();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(atualizarEmLote).toHaveBeenCalledWith(ALVOS, { ownerId: "vinicius" });
    expect(invalidar).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: chavesDoPipeline.raiz }),
    );
    expect(toast.success).toHaveBeenCalledWith("3 oportunidades atualizadas");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("uma linha: singular no toast", async () => {
    vi.mocked(atualizarEmLote).mockResolvedValueOnce(1);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAtualizarEmLote(), { wrapper: envolver(qc) });

    result.current.mutate({ alvos: ALVOS, acao: { ownerId: "vinicius" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalledWith("1 oportunidade atualizada");
  });

  it("🔴 erro: invalida a raiz (o 23514 de 'alguém moveu' precisa do board fresco) e avisa com a frase do banco", async () => {
    vi.mocked(atualizarEmLote).mockRejectedValueOnce(
      new Error("Alguém moveu uma das oportunidades. Recarregue o board."),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useAtualizarEmLote(), { wrapper: envolver(qc) });

    result.current.mutate({ alvos: ALVOS, acao: { estagioId: "estagio-r2" } });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: chavesDoPipeline.raiz }),
    );
    expect(toast.error).toHaveBeenCalledWith(
      "Alguém moveu uma das oportunidades. Recarregue o board.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("erro SEM Error (objeto cru do fetch) cai no fallback da tela", async () => {
    vi.mocked(atualizarEmLote).mockRejectedValueOnce({ message: "Failed to fetch", code: "" });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAtualizarEmLote(), { wrapper: envolver(qc) });

    result.current.mutate({ alvos: ALVOS, acao: { ownerId: "vinicius" } });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível aplicar em lote.");
  });
});

describe("PIPE-2: erro da ficha avisa e invalida a raiz mesmo com o bloco desmontado", () => {
  const OPORTUNIDADE = "op-1";

  type Caso = {
    hook: string;
    useHook: () => { mutate: (variaveis: never) => void };
    repo: Mock;
    variaveis: unknown;
    erro: string;
  };
  const CASOS: Caso[] = [
    {
      hook: "useAtualizarDadosDaOportunidade",
      useHook: () => useAtualizarDadosDaOportunidade(),
      repo: vi.mocked(atualizarDadosDaOportunidade),
      variaveis: { id: OPORTUNIDADE, campos: { nome: "" } },
      erro: "O nome da oportunidade não pode ficar em branco.",
    },
    {
      hook: "useAtualizarDatasDeReuniao",
      useHook: () => useAtualizarDatasDeReuniao(),
      repo: vi.mocked(atualizarDatasDeReuniao),
      variaveis: { oportunidadeId: OPORTUNIDADE, campos: { r1AgendadaEm: null } },
      erro: "Editar reuniões é do owner e do manager.",
    },
    {
      hook: "useAtualizarNutricao",
      useHook: () => useAtualizarNutricao(),
      repo: vi.mocked(atualizarNutricao),
      variaveis: { oportunidadeId: OPORTUNIDADE, campos: { emNutricao: true } },
      erro: "Editar nutrição é do owner e do manager.",
    },
    {
      hook: "useCorrigirMotivoDeSaida",
      useHook: () => useCorrigirMotivoDeSaida(),
      repo: vi.mocked(corrigirMotivoDeSaida),
      variaveis: {
        oportunidadeId: OPORTUNIDADE,
        estagioAtualId: "estagio-perdido",
        correcao: { motivoId: "m-preco" },
      },
      erro: "A oportunidade mudou de estágio. Recarregue o board.",
    },
    {
      hook: "useApagarOportunidade",
      useHook: () => useApagarOportunidade(),
      repo: vi.mocked(apagarOportunidade),
      variaveis: OPORTUNIDADE,
      erro: "Esta oportunidade tem proposta já enviada ao cliente (enviada, aceita ou recusada) e não pode ser excluída. Marque-a como perdida.",
    },
  ];

  it.each(CASOS)(
    "🔴 $hook: desmontado antes da recusa → um toast com a frase e raiz invalidada",
    async ({ useHook, repo, variaveis, erro }) => {
      let rejeitar: ((e: Error) => void) | undefined;
      repo.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejeitar = reject;
          }),
      );
      const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
      const invalidar = vi.spyOn(qc, "invalidateQueries");
      const { result, unmount } = renderHook(useHook, { wrapper: envolver(qc) });

      (result.current.mutate as (v: unknown) => void)(variaveis);
      await waitFor(() => expect(repo).toHaveBeenCalledTimes(1));
      unmount();
      expect(rejeitar).toBeDefined();
      rejeitar?.(new Error(erro));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(erro));
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(invalidar).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: chavesDoPipeline.raiz }),
      );
    },
  );

  it("erro SEM Error (objeto cru do fetch) cai no fallback da tela, e ainda invalida", async () => {
    vi.mocked(atualizarDadosDaOportunidade).mockRejectedValueOnce({
      message: "Failed to fetch",
      code: "",
    });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useAtualizarDadosDaOportunidade(), {
      wrapper: envolver(qc),
    });

    result.current.mutate({ id: OPORTUNIDADE, campos: { nome: "x" } });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar.");
    expect(invalidar).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: chavesDoPipeline.raiz }),
    );
  });
});

describe("apagar oportunidade e pipeline (D-067)", () => {
  it("🔴 useApagarOportunidade: sucesso invalida raiz, clientes e reuniões, e avisa", async () => {
    vi.mocked(apagarOportunidade).mockResolvedValue(undefined);
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useApagarOportunidade(), { wrapper: envolver(qc) });

    await result.current.mutateAsync("op-1");

    expect(apagarOportunidade).toHaveBeenCalledWith("op-1");
    const chaves = invalidar.mock.calls.map(([filtro]) => filtro?.queryKey);
    expect(chaves).toEqual([chavesDoPipeline.raiz, ["clients"], ["reunioes"]]);
    expect(toast.success).toHaveBeenCalledWith("Oportunidade apagada.");
  });

  it("useApagarPipeline: sucesso invalida a lista, estágios, motivos e board DO pipeline, e avisa", async () => {
    vi.mocked(apagarPipeline).mockResolvedValue(undefined);
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useApagarPipeline(), { wrapper: envolver(qc) });

    await result.current.mutateAsync("p3");

    expect(apagarPipeline).toHaveBeenCalledWith("p3");
    const chaves = invalidar.mock.calls.map(([filtro]) => filtro?.queryKey);
    expect(chaves).toEqual([
      chavesDoPipeline.pipelines,
      chavesDoPipeline.estagios("p3"),
      chavesDoPipeline.motivos("p3"),
      chavesDoPipeline.board("p3"),
    ]);
    expect(toast.success).toHaveBeenCalledWith("Pipeline apagado.");
  });

  it("🔴 useApagarPipeline: a recusa do banco vira toast com a frase dele, sem toast de sucesso", async () => {
    const frase = "Este é o único pipeline ativo. Reative outro antes de apagar este.";
    vi.mocked(apagarPipeline).mockRejectedValue(new Error(frase));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useApagarPipeline(), { wrapper: envolver(qc) });

    result.current.mutate("p3");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith(frase);
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("usePrimeiroContato (D-063)", () => {
  it("board vazio não chama o banco", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => usePrimeiroContato([]), { wrapper: envolver(qc) });
    expect(lerPrimeiroContato).not.toHaveBeenCalled();
  });

  it("🔴 os mesmos ids noutra ordem são a mesma chave: uma chamada só, com os ids ordenados", async () => {
    vi.mocked(lerPrimeiroContato).mockResolvedValue([]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = renderHook(({ ids }) => usePrimeiroContato(ids), {
      wrapper: envolver(qc),
      initialProps: { ids: ["b", "a"] as readonly string[] },
    });
    await waitFor(() => expect(lerPrimeiroContato).toHaveBeenCalledTimes(1));
    expect(lerPrimeiroContato).toHaveBeenCalledWith(["a", "b"]);

    rerender({ ids: ["a", "b"] });

    expect(lerPrimeiroContato).toHaveBeenCalledTimes(1);
    expect(
      qc.getQueryCache().find({ queryKey: chavesDoPipeline.primeiroContato(["a", "b"]) }),
    ).toBeDefined();
  });
});

describe("useRegistrarToque apaga o selo de primeiro contato (D-063)", () => {
  it("🔴 sucesso invalida o prefixo do primeiro contato — o selo some sem recarregar", async () => {
    vi.mocked(registrarToque).mockResolvedValue(undefined);
    const qc = new QueryClient();
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useRegistrarToque(), { wrapper: envolver(qc) });

    await result.current.mutateAsync({ oportunidadeId: "o1", tipo: "call", texto: "Ligou" });

    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoPipeline.primeiroContatoRaiz });
  });

  it("controle: falha não invalida o selo (nada mudou no banco)", async () => {
    vi.mocked(registrarToque).mockRejectedValue(new Error("falhou"));
    const qc = new QueryClient();
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useRegistrarToque(), { wrapper: envolver(qc) });

    await expect(
      result.current.mutateAsync({ oportunidadeId: "o1", tipo: "call", texto: "Ligou" }),
    ).rejects.toThrow("falhou");

    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: chavesDoPipeline.primeiroContatoRaiz });
  });
});

describe("o selo some quando o lead sai do funil ativo (D-063)", () => {
  const CHAVE_DO_SELO = chavesDoPipeline.primeiroContato(["o1"]);
  const ATRASADO = [
    { oportunidadeId: "o1", venceEm: "2026-01-05T13:05:00+00:00", primeiroToqueEm: null },
  ];

  function comSeloEmCache() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(CHAVE_DO_SELO, ATRASADO);
    expect(qc.getQueryState(CHAVE_DO_SELO)?.isInvalidated).toBe(false);
    return qc;
  }

  const DESTINO = {
    id: "estagio-perdido",
    pipelineId: PIPELINE,
    nome: "Perdido",
    ordem: 9,
    tipo: "perdido" as const,
  };

  it("🔴 mover o card invalida o selo — o card em Perdido não fica 'atrasado' sem recarregar", async () => {
    vi.mocked(moverParaEstagio).mockResolvedValue(undefined);
    const qc = comSeloEmCache();
    const { result } = renderHook(() => useMoverEstagio(), { wrapper: envolver(qc) });

    await result.current.mutateAsync({
      oportunidadeId: "o1",
      destino: DESTINO,
      estagioAtualId: "estagio-novo",
      pipelineId: PIPELINE,
    });

    expect(qc.getQueryState(CHAVE_DO_SELO)?.isInvalidated).toBe(true);
  });

  it("controle: o mover que falha não toca o selo (nada mudou no banco)", async () => {
    vi.mocked(moverParaEstagio).mockRejectedValue(new Error("falhou"));
    const qc = comSeloEmCache();
    const { result } = renderHook(() => useMoverEstagio(), { wrapper: envolver(qc) });

    await expect(
      result.current.mutateAsync({
        oportunidadeId: "o1",
        destino: DESTINO,
        estagioAtualId: "estagio-novo",
        pipelineId: PIPELINE,
      }),
    ).rejects.toThrow("falhou");

    expect(qc.getQueryState(CHAVE_DO_SELO)?.isInvalidated).toBe(false);
  });

  it("mover em lote invalida o selo (pela raiz)", async () => {
    vi.mocked(atualizarEmLote).mockResolvedValue(1);
    const qc = comSeloEmCache();
    const { result } = renderHook(() => useAtualizarEmLote(), { wrapper: envolver(qc) });

    await result.current.mutateAsync({
      alvos: [{ id: "o1", stageId: "estagio-novo" }],
      acao: { estagioId: "estagio-perdido" },
    });

    expect(qc.getQueryState(CHAVE_DO_SELO)?.isInvalidated).toBe(true);
  });

  it("mandar para nutrição invalida o selo (pela raiz)", async () => {
    vi.mocked(atualizarNutricao).mockResolvedValue(undefined);
    const qc = comSeloEmCache();
    const { result } = renderHook(() => useAtualizarNutricao(), { wrapper: envolver(qc) });

    await result.current.mutateAsync({ oportunidadeId: "o1", campos: { emNutricao: true } });

    expect(qc.getQueryState(CHAVE_DO_SELO)?.isInvalidated).toBe(true);
  });
});

describe("mover o card atualiza as ganhas sem contrato (D-071)", () => {
  const CHAVE_DAS_GANHAS = ["clients", "ganhas-sem-contrato"] as const;
  const FECHADO = {
    id: "estagio-fechado",
    pipelineId: PIPELINE,
    nome: "Fechado",
    ordem: 8,
    tipo: "fechado" as const,
  };

  function comGanhasEmCache() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(CHAVE_DAS_GANHAS, []);
    expect(qc.getQueryState(CHAVE_DAS_GANHAS)?.isInvalidated).toBe(false);
    return qc;
  }

  it("🔴 marcar ganha invalida a lista de ganhas sem contrato", async () => {
    vi.mocked(moverParaEstagio).mockResolvedValue(undefined);
    const qc = comGanhasEmCache();
    const { result } = renderHook(() => useMoverEstagio(), { wrapper: envolver(qc) });

    await result.current.mutateAsync({
      oportunidadeId: "o1",
      destino: FECHADO,
      estagioAtualId: "estagio-r2",
      pipelineId: PIPELINE,
    });

    expect(qc.getQueryState(CHAVE_DAS_GANHAS)?.isInvalidated).toBe(true);
  });

  it("controle: o mover que falha não toca a lista", async () => {
    vi.mocked(moverParaEstagio).mockRejectedValue(new Error("falhou"));
    const qc = comGanhasEmCache();
    const { result } = renderHook(() => useMoverEstagio(), { wrapper: envolver(qc) });

    await expect(
      result.current.mutateAsync({
        oportunidadeId: "o1",
        destino: FECHADO,
        estagioAtualId: "estagio-r2",
        pipelineId: PIPELINE,
      }),
    ).rejects.toThrow("falhou");

    expect(qc.getQueryState(CHAVE_DAS_GANHAS)?.isInvalidated).toBe(false);
  });
});

describe("useCorrigirTextoDoEvento (D-069, C3)", () => {
  const NOTA = {
    oportunidadeId: "o1",
    eventoId: "e1",
    texto: "Texto novo",
    editadoEmLido: null,
  };

  function montarCorrecao(qc: QueryClient) {
    return renderHook(() => useCorrigirTextoDoEvento(), { wrapper: envolver(qc) });
  }

  function releituraTravada(qc: QueryClient) {
    let liberar: () => void = () => undefined;
    const trava = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const invalidar = vi.spyOn(qc, "invalidateQueries").mockImplementation(() => trava);
    return { invalidar, liberar };
  }

  it("sucesso chama o repositório com o editado_em lido e invalida só a timeline da oportunidade", async () => {
    vi.mocked(corrigirTextoDoEvento).mockResolvedValue(undefined);
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = montarCorrecao(qc);

    result.current.mutate({ ...NOTA, editadoEmLido: "2026-10-02T15:30:00+00:00" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(corrigirTextoDoEvento).toHaveBeenCalledWith(
      "e1",
      "Texto novo",
      "2026-10-02T15:30:00+00:00",
    );
    expect(invalidar).toHaveBeenCalledTimes(1);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoPipeline.eventos("o1") });
  });

  it("🔴 o sucesso só é anunciado depois da releitura (o formulário não fecha antes)", async () => {
    vi.mocked(corrigirTextoDoEvento).mockResolvedValue(undefined);
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { invalidar, liberar } = releituraTravada(qc);
    const { result } = montarCorrecao(qc);
    const aoSucesso = vi.fn();

    result.current.mutate(NOTA, { onSuccess: aoSucesso });
    await waitFor(() => expect(invalidar).toHaveBeenCalledTimes(1));

    expect(aoSucesso).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);

    liberar();
    await waitFor(() => expect(aoSucesso).toHaveBeenCalledTimes(1));
    expect(result.current.isPending).toBe(false);
  });

  it("🔴 recusa avisa com a frase do repositório e RELÊ a timeline, só depois liberando o formulário", async () => {
    vi.mocked(corrigirTextoDoEvento).mockRejectedValueOnce(
      new Error("A nota não foi corrigida: ela mudou em outra tela."),
    );
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { invalidar, liberar } = releituraTravada(qc);
    const { result } = montarCorrecao(qc);
    const aoErro = vi.fn();

    result.current.mutate(NOTA, { onError: aoErro });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "A nota não foi corrigida: ela mudou em outra tela.",
      ),
    );
    expect(invalidar).toHaveBeenCalledTimes(1);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoPipeline.eventos("o1") });
    expect(aoErro).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);

    liberar();
    await waitFor(() => expect(aoErro).toHaveBeenCalledTimes(1));
  });

  it("erro cru (rede) cai no fallback em português e também relê", async () => {
    vi.mocked(corrigirTextoDoEvento).mockRejectedValueOnce({
      message: "Failed to fetch",
      code: "",
    });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = montarCorrecao(qc);

    result.current.mutate(NOTA);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível corrigir a nota."),
    );
    await waitFor(() =>
      expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoPipeline.eventos("o1") }),
    );
  });
});
