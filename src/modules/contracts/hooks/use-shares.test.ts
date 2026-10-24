import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/shares.repository", () => ({
  listarPessoasParaParticipacao: vi.fn(async () => []),
  listarParticipacoes: vi.fn(),
  listarPadroesDaLinhaDeNegocio: vi.fn(),
  listarTodosOsPadroes: vi.fn(),
  listarContratosSemParticipacao: vi.fn(),
  lerLimiarDeAlerta: vi.fn(),
  gravarParticipacoes: vi.fn(),
  adicionarPadrao: vi.fn(),
  atualizarPadrao: vi.fn(),
  desativarPadrao: vi.fn(),
  salvarLimiarDeAlerta: vi.fn(),
}));

const {
  adicionarPadrao,
  atualizarPadrao,
  desativarPadrao,
  listarPessoasParaParticipacao,
  salvarLimiarDeAlerta,
} = await import("../api/shares.repository");
const {
  chavesDeParticipacoes,
  useAdicionarPadrao,
  useAtualizarPadrao,
  useDesativarPadrao,
  usePessoasParaParticipacao,
  useSalvarLimiarDeAlerta,
} = await import("./use-shares");

beforeEach(() => {
  vi.clearAllMocks();
});

const ANA = "4b7c2e19-8d05-4f36-a1e2-9c3b6d8f0a52";
const CARLOS = "e2f9a173-5c48-4b20-9d6f-1a7e3c8b5042";

function clienteDeConsultas() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function abrirFicha(qc: QueryClient, perfisAPreservar: readonly string[]) {
  const { result } = renderHook(() => usePessoasParaParticipacao(perfisAPreservar), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  });
  await waitFor(() => expect(result.current.isPending).toBe(false));
  return result;
}

const chavesNoCache = (qc: QueryClient) =>
  qc
    .getQueryCache()
    .getAll()
    .map((consulta) => consulta.queryKey);

describe("chavesDeParticipacoes.pessoas", () => {
  it("🔴 conjuntos diferentes dão chaves diferentes — sem isso o contrato B lê o cache do A", () => {
    expect(chavesDeParticipacoes.pessoas([ANA])).not.toEqual(
      chavesDeParticipacoes.pessoas([CARLOS]),
    );
    expect(chavesDeParticipacoes.pessoas([ANA])).not.toEqual(chavesDeParticipacoes.pessoas([]));
  });

  it("o positivo ao lado: o MESMO conjunto dá a mesma chave, em qualquer ordem", () => {
    expect(chavesDeParticipacoes.pessoas([ANA, CARLOS])).toEqual(
      chavesDeParticipacoes.pessoas([CARLOS, ANA]),
    );
    expect(chavesDeParticipacoes.pessoas([])).toEqual(["profiles", "beneficiarios", ""]);
  });
});

describe("usePessoasParaParticipacao: uma entrada de cache por conjunto a preservar", () => {
  it("🔴 o caso comum (todos ativos): duas fichas dividem UMA entrada e UMA consulta", async () => {
    const qc = clienteDeConsultas();

    await abrirFicha(qc, []);
    await abrirFicha(qc, []);

    expect(chavesNoCache(qc)).toEqual([["profiles", "beneficiarios", ""]]);
    expect(vi.mocked(listarPessoasParaParticipacao)).toHaveBeenCalledTimes(1);
  });

  it("🔴 o negativo ao lado: cada desativado tem a sua entrada, e nenhuma serve a outra", async () => {
    const qc = clienteDeConsultas();

    await abrirFicha(qc, [ANA]);
    await abrirFicha(qc, [CARLOS]);

    expect(chavesNoCache(qc)).toEqual([
      ["profiles", "beneficiarios", ANA],
      ["profiles", "beneficiarios", CARLOS],
    ]);
    expect(vi.mocked(listarPessoasParaParticipacao)).toHaveBeenCalledTimes(2);
  });

  it("ordem e repetição não criam entrada nova — o conjunto é ordenado e deduplicado", async () => {
    const qc = clienteDeConsultas();

    await abrirFicha(qc, [CARLOS, ANA]);
    await abrirFicha(qc, [ANA, CARLOS, ANA]);

    expect(chavesNoCache(qc)).toHaveLength(1);
    expect(vi.mocked(listarPessoasParaParticipacao)).toHaveBeenCalledTimes(1);
  });

  it("o repositório recebe o MESMO conjunto que foi para a chave", async () => {
    const qc = clienteDeConsultas();

    await abrirFicha(qc, [CARLOS, ANA, CARLOS]);

    expect(vi.mocked(listarPessoasParaParticipacao)).toHaveBeenCalledWith([ANA, CARLOS]);
    expect(chavesNoCache(qc)).toEqual([["profiles", "beneficiarios", `${ANA},${CARLOS}`]]);
  });
});

describe("mutações do padrão de BU invalidam os padrões, nunca as participações de contrato", () => {
  const PADRAO_A_GRAVAR = {
    linhaDeNegocio: "sistemas" as const,
    perfilId: ANA,
    tipo: "producao" as const,
    percentual: 15,
  };

  function montar<T>(usar: () => T, qc: QueryClient) {
    return renderHook(usar, {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children),
    }).result;
  }

  it("atualizar repassa id, o valor anterior e o padrão, e invalida os padrões", async () => {
    vi.mocked(atualizarPadrao).mockResolvedValueOnce(undefined);
    const qc = clienteDeConsultas();
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const resultado = montar(() => useAtualizarPadrao(), qc);
    const anterior = { ...PADRAO_A_GRAVAR, perfilId: CARLOS, percentual: 10 };

    resultado.current.mutate({ id: "p1", anterior, padrao: PADRAO_A_GRAVAR });
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));

    expect(atualizarPadrao).toHaveBeenCalledWith("p1", anterior, PADRAO_A_GRAVAR);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["bu-default-shares"] });
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ["contract-shares"] });
  });

  it("adicionar repassa o padrão e invalida os padrões", async () => {
    vi.mocked(adicionarPadrao).mockResolvedValueOnce(undefined);
    const qc = clienteDeConsultas();
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const resultado = montar(() => useAdicionarPadrao(), qc);

    resultado.current.mutate(PADRAO_A_GRAVAR);
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));

    expect(adicionarPadrao).toHaveBeenCalledWith(PADRAO_A_GRAVAR);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["bu-default-shares"] });
  });

  it("desativar repassa o id e invalida os padrões", async () => {
    vi.mocked(desativarPadrao).mockResolvedValueOnce(undefined);
    const qc = clienteDeConsultas();
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const resultado = montar(() => useDesativarPadrao(), qc);

    resultado.current.mutate("p1");
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));

    expect(desativarPadrao).toHaveBeenCalledWith("p1");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["bu-default-shares"] });
  });

  it("salvar o aviso invalida só a chave do aviso", async () => {
    vi.mocked(salvarLimiarDeAlerta).mockResolvedValueOnce(undefined);
    const qc = clienteDeConsultas();
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const resultado = montar(() => useSalvarLimiarDeAlerta(), qc);

    resultado.current.mutate({ percentual: 70, confirmado: false });
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));

    expect(salvarLimiarDeAlerta).toHaveBeenCalledWith({ percentual: 70, confirmado: false });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeParticipacoes.limiar });
    expect(invalidar).toHaveBeenCalledTimes(1);
  });

  function refetchEmAndamento(qc: QueryClient) {
    let liberar!: () => void;
    const pendente = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    const invalidar = vi.spyOn(qc, "invalidateQueries").mockReturnValue(pendente);
    return { liberar, invalidar };
  }

  it("🔴 atualizar só conclui depois do refetch dos padrões", async () => {
    vi.mocked(atualizarPadrao).mockResolvedValueOnce(undefined);
    const qc = clienteDeConsultas();
    const { liberar, invalidar } = refetchEmAndamento(qc);
    const resultado = montar(() => useAtualizarPadrao(), qc);

    resultado.current.mutate({ id: "p1", anterior: PADRAO_A_GRAVAR, padrao: PADRAO_A_GRAVAR });
    await waitFor(() => expect(invalidar).toHaveBeenCalled());

    expect(resultado.current.isSuccess).toBe(false);
    expect(resultado.current.isPending).toBe(true);

    liberar();
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));
  });

  it("🔴 adicionar só conclui depois do refetch dos padrões", async () => {
    vi.mocked(adicionarPadrao).mockResolvedValueOnce(undefined);
    const qc = clienteDeConsultas();
    const { liberar, invalidar } = refetchEmAndamento(qc);
    const resultado = montar(() => useAdicionarPadrao(), qc);

    resultado.current.mutate(PADRAO_A_GRAVAR);
    await waitFor(() => expect(invalidar).toHaveBeenCalled());

    expect(resultado.current.isSuccess).toBe(false);
    expect(resultado.current.isPending).toBe(true);

    liberar();
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));
  });

  it("🔴 desativar só conclui depois do refetch dos padrões", async () => {
    vi.mocked(desativarPadrao).mockResolvedValueOnce(undefined);
    const qc = clienteDeConsultas();
    const { liberar, invalidar } = refetchEmAndamento(qc);
    const resultado = montar(() => useDesativarPadrao(), qc);

    resultado.current.mutate("p1");
    await waitFor(() => expect(invalidar).toHaveBeenCalled());

    expect(resultado.current.isSuccess).toBe(false);
    expect(resultado.current.isPending).toBe(true);

    liberar();
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));
  });

  it("🔴 salvar o aviso só conclui depois do refetch do aviso", async () => {
    vi.mocked(salvarLimiarDeAlerta).mockResolvedValueOnce(undefined);
    const qc = clienteDeConsultas();
    const { liberar, invalidar } = refetchEmAndamento(qc);
    const resultado = montar(() => useSalvarLimiarDeAlerta(), qc);

    resultado.current.mutate({ percentual: 70, confirmado: false });
    await waitFor(() => expect(invalidar).toHaveBeenCalled());

    expect(resultado.current.isSuccess).toBe(false);
    expect(resultado.current.isPending).toBe(true);

    liberar();
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));
  });
});
