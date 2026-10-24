import { QueryClient, QueryClientProvider, useIsMutating } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/proposals.repository", () => ({
  listarPropostas: vi.fn(),
  listarItens: vi.fn(),
  criarProposta: vi.fn(),
  editarProposta: vi.fn(),
  excluirRascunho: vi.fn(),
  adicionarItem: vi.fn(),
  editarItem: vi.fn(),
  removerItem: vi.fn(),
  reordenarItens: vi.fn(),
  enviarProposta: vi.fn(),
  recusarProposta: vi.fn(),
  novaVersao: vi.fn(),
  registrarContratoDaProposta: vi.fn(),
  listarContratosACriar: vi.fn(),
  lerPropostaParaImpressao: vi.fn(),
  podeVerPropostas: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client.v2", () => ({ supabaseV2: {} }));

const repo = await import("../api/proposals.repository");
const { chavesDoPipeline } = await import("@/modules/pipeline/hooks/use-pipeline");
const { toast } = await import("sonner");
const {
  CHAVE_DA_LIGACAO,
  CHAVE_DAS_LIGACOES_PENDENTES,
  chavesDePropostas,
  useEditarProposta,
  useEnviarProposta,
  useLigacoesPendentes,
  useNovaVersao,
  usePodeVerPropostas,
  usePropostas,
  useRegistrarContratoDaProposta,
  useReordenarItens,
} = await import("./use-proposals");
const { PROPOSTA_CONGELADA } = await import("../domain/ciclo");

let qc: QueryClient;
function envoltorio({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(repo.enviarProposta).mockReset();
  vi.mocked(repo.editarProposta).mockReset();
  vi.mocked(repo.novaVersao).mockReset();
  vi.mocked(repo.registrarContratoDaProposta).mockReset();
  vi.mocked(repo.listarPropostas).mockReset();
  vi.mocked(repo.reordenarItens).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("useEnviarProposta", () => {
  it("invalida a lista, a linha do tempo, o primeiro contato e a atividade", async () => {
    vi.mocked(repo.enviarProposta).mockResolvedValue(undefined);
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useEnviarProposta(), { wrapper: envoltorio });

    await result.current.mutateAsync({ propostaId: "p1", oportunidadeId: "o1" });

    expect(repo.enviarProposta).toHaveBeenCalledWith("p1");
    const chaves = invalidar.mock.calls.map(([f]) => f?.queryKey);
    expect(chaves).toContainEqual(chavesDePropostas.daOportunidade("o1"));
    expect(chaves).toContainEqual(chavesDoPipeline.eventos("o1"));
    expect(chaves).toContainEqual(chavesDoPipeline.primeiroContatoRaiz);
    expect(chaves).toContainEqual(chavesDoPipeline.atividade);
  });
});

describe("usePodeVerPropostas", () => {
  it("le a regra pelo banco, e invalidar a lista da oportunidade a rele", async () => {
    vi.mocked(repo.podeVerPropostas).mockReset();
    vi.mocked(repo.podeVerPropostas).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderHook(() => usePodeVerPropostas("o1"), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.data).toBe(false));
    expect(repo.podeVerPropostas).toHaveBeenCalledWith("o1");

    await act(() => qc.invalidateQueries({ queryKey: chavesDePropostas.daOportunidade("o1") }));
    await waitFor(() => expect(result.current.data).toBe(true));
  });
});

describe("Review Focus 1: proposta enviada noutra aba", () => {
  it("o erro vira aviso com a frase e a lista recarrega", async () => {
    vi.mocked(repo.editarProposta).mockRejectedValue(new Error(PROPOSTA_CONGELADA));
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useEditarProposta(), { wrapper: envoltorio });

    result.current.mutate({ propostaId: "p1", oportunidadeId: "o1", campos: { escopo: "x" } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(PROPOSTA_CONGELADA));
    expect(invalidar.mock.calls.map(([f]) => f?.queryKey)).toContainEqual(
      chavesDePropostas.daOportunidade("o1"),
    );
  });
});

describe("useReordenarItens (A1.4)", () => {
  it("manda as mudanças ao repositório e relê itens e lista", async () => {
    vi.mocked(repo.reordenarItens).mockResolvedValue(undefined);
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useReordenarItens(), { wrapper: envoltorio });
    const mudancas = [
      { id: "i2", ordem: 1 },
      { id: "i1", ordem: 2 },
    ];

    await result.current.mutateAsync({ propostaId: "p1", oportunidadeId: "o1", mudancas });

    expect(repo.reordenarItens).toHaveBeenCalledWith(mudancas);
    const chaves = invalidar.mock.calls.map(([f]) => f?.queryKey);
    expect(chaves).toContainEqual(chavesDePropostas.itens("p1"));
    expect(chaves).toContainEqual(chavesDePropostas.daOportunidade("o1"));
  });

  it("proposta enviada no meio: avisa com a frase e relê a ordem que ficou", async () => {
    vi.mocked(repo.reordenarItens).mockRejectedValue(new Error(PROPOSTA_CONGELADA));
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useReordenarItens(), { wrapper: envoltorio });

    result.current.mutate({
      propostaId: "p1",
      oportunidadeId: "o1",
      mudancas: [{ id: "i1", ordem: 2 }],
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(PROPOSTA_CONGELADA));
    const chaves = invalidar.mock.calls.map(([f]) => f?.queryKey);
    expect(chaves).toContainEqual(chavesDePropostas.itens("p1"));
    expect(chaves).toContainEqual(chavesDePropostas.daOportunidade("o1"));
  });
});

describe("useRegistrarContratoDaProposta marca a ligação pendente nas opções do hook", () => {
  function registrarELer() {
    return renderHook(
      () => ({ registrar: useRegistrarContratoDaProposta(), ligacoes: useLigacoesPendentes() }),
      { wrapper: envoltorio },
    );
  }

  it("falha marca { p1: k1 } e avisa; o sucesso seguinte limpa", async () => {
    vi.mocked(repo.registrarContratoDaProposta)
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce(undefined);
    const { result } = registrarELer();

    await expect(
      result.current.registrar.mutateAsync({ propostaId: "p1", contratoId: "k1" }),
    ).rejects.toThrow("rede");
    await waitFor(() => expect(result.current.ligacoes.pendentes).toEqual({ p1: "k1" }));
    expect(toast.error).toHaveBeenCalledWith("rede");

    await result.current.registrar.mutateAsync({ propostaId: "p1", contratoId: "k1" });
    await waitFor(() => expect(result.current.ligacoes.pendentes).toEqual({}));
  });

  it("controle: sucesso de primeira não marca nada", async () => {
    vi.mocked(repo.registrarContratoDaProposta).mockResolvedValue(undefined);
    const { result } = registrarELer();

    await result.current.registrar.mutateAsync({ propostaId: "p1", contratoId: "k1" });
    expect(qc.getQueryData(CHAVE_DAS_LIGACOES_PENDENTES) ?? {}).toEqual({});
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a ligação segue em voo (useIsMutating) até a lista recarregar: 'Aceita' não reabre com a lista velha", async () => {
    let responderLista: (lista: []) => void = () => {};
    vi.mocked(repo.listarPropostas)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(
        new Promise((resolver) => {
          responderLista = resolver;
        }),
      );
    vi.mocked(repo.registrarContratoDaProposta).mockResolvedValue(undefined);
    const { result } = renderHook(
      () => ({
        lista: usePropostas("o1"),
        registrar: useRegistrarContratoDaProposta(),
        emVoo: useIsMutating({ mutationKey: CHAVE_DA_LIGACAO }),
      }),
      { wrapper: envoltorio },
    );
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    act(() => result.current.registrar.mutate({ propostaId: "p1", contratoId: "k1" }));
    await waitFor(() => expect(repo.listarPropostas).toHaveBeenCalledTimes(2));
    await act(() => new Promise((resolver) => setTimeout(resolver, 30)));
    expect(result.current.emVoo).toBe(1);

    await act(async () => responderLista([]));
    await waitFor(() => expect(result.current.emVoo).toBe(0));
  });

  it("sem useLigacoesPendentes montado, a marca não expira com o gcTime padrão", async () => {
    qc = new QueryClient({
      defaultOptions: { queries: { gcTime: 10 }, mutations: { retry: false } },
    });
    vi.mocked(repo.registrarContratoDaProposta).mockRejectedValueOnce(new Error("rede"));
    const { result } = renderHook(() => useRegistrarContratoDaProposta(), {
      wrapper: envoltorio,
    });

    await expect(
      result.current.mutateAsync({ propostaId: "p1", contratoId: "k1" }),
    ).rejects.toThrow("rede");
    await new Promise((resolver) => setTimeout(resolver, 60));
    expect(qc.getQueryData(CHAVE_DAS_LIGACOES_PENDENTES)).toEqual({ p1: "k1" });
  });
});

describe("useNovaVersao", () => {
  it("devolve o id da nova versao", async () => {
    vi.mocked(repo.novaVersao).mockResolvedValue("p2");
    const { result } = renderHook(() => useNovaVersao(), { wrapper: envoltorio });
    await expect(
      result.current.mutateAsync({ propostaId: "p1", oportunidadeId: "o1" }),
    ).resolves.toBe("p2");
  });

  it("segue pendente até a lista recarregar: o botão não reabre sobre a lista velha", async () => {
    let responderLista: (lista: []) => void = () => {};
    vi.mocked(repo.listarPropostas)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(
        new Promise((resolver) => {
          responderLista = resolver;
        }),
      );
    vi.mocked(repo.novaVersao).mockResolvedValue("p2");
    const { result } = renderHook(() => ({ lista: usePropostas("o1"), nova: useNovaVersao() }), {
      wrapper: envoltorio,
    });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    act(() => result.current.nova.mutate({ propostaId: "p1", oportunidadeId: "o1" }));
    await waitFor(() => expect(repo.listarPropostas).toHaveBeenCalledTimes(2));
    await act(() => new Promise((resolver) => setTimeout(resolver, 30)));
    expect(result.current.nova.isPending).toBe(true);

    await act(async () => responderLista([]));
    await waitFor(() => expect(result.current.nova.isPending).toBe(false));
    expect(result.current.nova.isSuccess).toBe(true);
    expect(repo.novaVersao).toHaveBeenCalledTimes(1);
  });
});

describe("CHAVE_DAS_LIGACOES_PENDENTES", () => {
  it("é o literal que use-contracts.ts usa para limpar a pendência do contrato apagado", async () => {
    const { CHAVE_DAS_LIGACOES_PENDENTES } = await import("./use-proposals");
    expect(CHAVE_DAS_LIGACOES_PENDENTES).toEqual(["ligacoes-pendentes-de-proposta"]);
  });
});
