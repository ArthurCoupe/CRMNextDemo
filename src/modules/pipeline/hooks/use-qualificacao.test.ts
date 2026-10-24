import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogoLidoParaEdicao } from "../api/qualificacao.repository";

vi.mock("../api/qualificacao.repository", () => ({
  lerCatalogoParaEdicao: vi.fn(),
  salvarCatalogoDeQualificacao: vi.fn(),
}));
vi.mock("./use-pipeline", () => ({
  chavesDoPipeline: { catalogo: ["qualification-catalog"] },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { lerCatalogoParaEdicao, salvarCatalogoDeQualificacao } =
  await import("../api/qualificacao.repository");
const { toast } = await import("sonner");
const { chaveDoCatalogoEmEdicao, useCatalogoParaEdicao, useSalvarCatalogoDeQualificacao } =
  await import("./use-qualificacao");

const LIDO: CatalogoLidoParaEdicao = {
  catalogo: { version: 1, questions: [] },
  bruto: { version: 1, questions: [] },
  atualizadoEm: "2026-10-07T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lerCatalogoParaEdicao).mockReset();
  vi.mocked(salvarCatalogoDeQualificacao).mockReset();
});

afterEach(() => {
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

function envolver(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function montar(qc: QueryClient) {
  return renderHook(() => useSalvarCatalogoDeQualificacao(), { wrapper: envolver(qc) }).result;
}

function clienteComoOApp() {
  return new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
}

const PROVOCAR = {
  "volta o foco à janela": () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  },
  "a rede volta": () => {
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
  },
};

describe("useCatalogoParaEdicao", () => {
  it("lê pela chave da edição e entrega o que o repositório devolveu", async () => {
    vi.mocked(lerCatalogoParaEdicao).mockResolvedValue(LIDO);
    const qc = clienteComoOApp();
    const { result } = renderHook(() => useCatalogoParaEdicao(), { wrapper: envolver(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(LIDO);
    expect(qc.getQueryData(chaveDoCatalogoEmEdicao)).toBe(LIDO);
  });

  it.each(Object.entries(PROVOCAR))(
    "🔴 quando %s não refaz a leitura (e uma consulta comum refaz)",
    async (_nome, provocar) => {
      vi.mocked(lerCatalogoParaEdicao).mockResolvedValue(LIDO);

      const qcControle = clienteComoOApp();
      const controle = renderHook(
        () => useQuery({ queryKey: ["controle"], queryFn: lerCatalogoParaEdicao }),
        { wrapper: envolver(qcControle) },
      );
      await waitFor(() => expect(controle.result.current.isSuccess).toBe(true));
      provocar();
      await waitFor(() => expect(lerCatalogoParaEdicao).toHaveBeenCalledTimes(2));
      controle.unmount();

      vi.mocked(lerCatalogoParaEdicao).mockClear();
      const qc = clienteComoOApp();
      const { result } = renderHook(() => useCatalogoParaEdicao(), { wrapper: envolver(qc) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(lerCatalogoParaEdicao).toHaveBeenCalledTimes(1);

      provocar();
      await new Promise((r) => setTimeout(r, 50));

      expect(lerCatalogoParaEdicao).toHaveBeenCalledTimes(1);
    },
  );

  it("🔴 recusa de permissão não retenta; falha comum retenta", async () => {
    vi.mocked(lerCatalogoParaEdicao).mockRejectedValue({ code: "42501", message: "negado" });
    const recusada = renderHook(() => useCatalogoParaEdicao(), {
      wrapper: envolver(clienteComoOApp()),
    });
    await waitFor(() => expect(recusada.result.current.isError).toBe(true));
    expect(lerCatalogoParaEdicao).toHaveBeenCalledTimes(1);
    recusada.unmount();

    vi.mocked(lerCatalogoParaEdicao).mockClear();
    vi.mocked(lerCatalogoParaEdicao).mockRejectedValue(new Error("rede caiu"));
    const comum = renderHook(() => useCatalogoParaEdicao(), {
      wrapper: envolver(clienteComoOApp()),
    });
    await waitFor(() => expect(comum.result.current.isError).toBe(true));
    expect(vi.mocked(lerCatalogoParaEdicao).mock.calls.length).toBeGreaterThan(1);
  });
});

describe("useSalvarCatalogoDeQualificacao", () => {
  it("a chave da edição vive sob a do catálogo: invalidar uma pega as duas", () => {
    expect(chaveDoCatalogoEmEdicao).toEqual(["qualification-catalog", "edicao"]);
  });

  it("salvar marca como velha a leitura do editor (e só o catálogo, não outra chave)", async () => {
    vi.mocked(salvarCatalogoDeQualificacao).mockResolvedValueOnce(undefined);
    const qc = new QueryClient();
    qc.setQueryData(chaveDoCatalogoEmEdicao, LIDO);
    qc.setQueryData(["outra-consulta"], 1);
    const resultado = montar(qc);

    resultado.current.mutate({ lido: LIDO, perguntas: [] });
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));

    expect(qc.getQueryState(chaveDoCatalogoEmEdicao)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(["outra-consulta"])?.isInvalidated).toBe(false);
  });

  it("🔴 a mutação só conclui depois do refetch: o próximo Salvar já leva o updated_at novo", async () => {
    vi.mocked(salvarCatalogoDeQualificacao).mockResolvedValueOnce(undefined);
    const qc = new QueryClient();
    let liberar!: () => void;
    const refetchEmAndamento = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    const invalidar = vi.spyOn(qc, "invalidateQueries").mockReturnValueOnce(refetchEmAndamento);
    const resultado = montar(qc);

    resultado.current.mutate({ lido: LIDO, perguntas: [] });
    await waitFor(() => expect(invalidar).toHaveBeenCalled());

    expect(resultado.current.isSuccess).toBe(false);
    expect(resultado.current.isPending).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();

    liberar();
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("sucesso repassa lido e perguntas, invalida o catálogo e avisa", async () => {
    vi.mocked(salvarCatalogoDeQualificacao).mockResolvedValueOnce(undefined);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const resultado = montar(qc);

    resultado.current.mutate({ lido: LIDO, perguntas: [] });
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));

    expect(salvarCatalogoDeQualificacao).toHaveBeenCalledWith(LIDO, []);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["qualification-catalog"] });
    expect(toast.success).toHaveBeenCalledWith(
      "Perguntas salvas. As respostas já dadas não mudam.",
    );
  });

  it("🔴 falha avisa com a frase do repositório e recarrega o catálogo", async () => {
    vi.mocked(salvarCatalogoDeQualificacao).mockRejectedValueOnce(
      new Error("As perguntas não foram salvas: alguém salvou antes de você."),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const resultado = montar(qc);

    resultado.current.mutate({ lido: LIDO, perguntas: [] });
    await waitFor(() => expect(resultado.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith(
      "As perguntas não foram salvas: alguém salvou antes de você.",
    );
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["qualification-catalog"] });
  });

  it("🔴 rejeição que não é Error cai no fallback", async () => {
    vi.mocked(salvarCatalogoDeQualificacao).mockRejectedValueOnce({ details: "", hint: "" });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const resultado = montar(qc);

    resultado.current.mutate({ lido: LIDO, perguntas: [] });
    await waitFor(() => expect(resultado.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar as perguntas.");
  });
});
