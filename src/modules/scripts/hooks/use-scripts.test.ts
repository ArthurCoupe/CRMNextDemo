import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/scripts.repository", () => ({
  listarScripts: vi.fn(),
  listarNichos: vi.fn(),
  listarMaisUsados: vi.fn(),
  listarScriptsDeWhatsApp: vi.fn(),
  criarScript: vi.fn(),
  atualizarScript: vi.fn(),
  definirSituacaoDoScript: vi.fn(async () => undefined),
  apagarScript: vi.fn(),
  registrarUso: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const {
  apagarScript,
  definirSituacaoDoScript,
  atualizarScript,
  listarScripts,
  listarScriptsDeWhatsApp,
} = await import("../api/scripts.repository");
const { toast } = await import("sonner");
const {
  useApagarScript,
  useDefinirSituacaoDoScript,
  useAtualizarScript,
  useScripts,
  useScriptsDeWhatsApp,
  chavesDeScripts,
} = await import("./use-scripts");

beforeEach(() => {
  vi.clearAllMocks();
});

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useDefinirSituacaoDoScript(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  });
}

describe("useDefinirSituacaoDoScript: mensagem depende do que aconteceu", () => {
  it("ativo: false (arquivar) avisa 'arquivado'", async () => {
    const { result } = montar();

    result.current.mutate({ id: "s1", ativo: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(definirSituacaoDoScript).toHaveBeenCalledWith("s1", false);
    expect(toast.success).toHaveBeenCalledWith("Script arquivado.");
  });

  it("ativo: true (reativar) avisa 'reativado', não 'arquivado'", async () => {
    const { result } = montar();

    result.current.mutate({ id: "s1", ativo: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalledWith("Script reativado.");
    expect(toast.success).not.toHaveBeenCalledWith("Script arquivado.");
  });
});

describe("useApagarScript (D-067)", () => {
  function montarApagar() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useApagarScript(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children),
    });
    return { result, invalidar };
  }

  it("sucesso apaga pelo id, invalida a raiz de scripts e avisa 'Script apagado.'", async () => {
    vi.mocked(apagarScript).mockResolvedValueOnce(undefined);
    const { result, invalidar } = montarApagar();

    result.current.mutate("s1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apagarScript).toHaveBeenCalledWith("s1");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeScripts.raiz });
    expect(toast.success).toHaveBeenCalledWith("Script apagado.");
  });

  it("erro invalida a raiz, mostra a mensagem do repositório e não avisa sucesso", async () => {
    vi.mocked(apagarScript).mockRejectedValueOnce(new Error("Só owner e manager apagam script."));
    const { result, invalidar } = montarApagar();

    result.current.mutate("s1");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeScripts.raiz });
    expect(toast.error).toHaveBeenCalledWith("Só owner e manager apagam script.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("useAtualizarScript: conflito invalida a lista, não só avisa", () => {
  function montarAtualizar() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useAtualizarScript(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children),
    });
    return { result, invalidar };
  }

  it("🔴 erro de conflito invalida a chave de scripts, além de avisar por toast", async () => {
    vi.mocked(atualizarScript).mockRejectedValueOnce(
      new Error("Alguém editou este script enquanto você escrevia. Recarregue e refaça."),
    );
    const { result, invalidar } = montarAtualizar();

    result.current.mutate({ id: "s1", dados: { title: "x" }, updatedAt: "2026-01-01" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith(
      "Alguém editou este script enquanto você escrevia. Recarregue e refaça.",
    );
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["scripts"] });
  });

  it("sucesso continua invalidando e avisando 'Script salvo.'", async () => {
    vi.mocked(atualizarScript).mockResolvedValueOnce(undefined);
    const { result } = montarAtualizar();

    result.current.mutate({ id: "s1", dados: { title: "x" }, updatedAt: "2026-01-01" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalledWith("Script salvo.");
  });
});

const SCRIPT_BASE = {
  id: "s1",
  tipo: "sdr" as const,
  title: "Primeiro toque",
  body: "Oi",
  nicho: "advocacia",
  canal: "whatsapp" as const,
  momento: "primeiro_contato" as const,
  pipelineStage: null,
  sortOrder: 0,
  active: true,
};

describe("useAtualizarScript: onSuccess só libera depois da lista atualizada", () => {
  it("🔴 a mutação NÃO conclui enquanto o refetch da lista (disparado pelo invalidate) está pendente", async () => {
    const filtros = { tipo: "sdr" as const };
    let liberarRefetch: (() => void) | undefined;
    const refetchPendente = new Promise<void>((resolve) => {
      liberarRefetch = resolve;
    });
    vi.mocked(listarScripts)
      .mockResolvedValueOnce([{ ...SCRIPT_BASE, updatedAt: "T0" }])
      .mockImplementationOnce(async () => {
        await refetchPendente;
        return [{ ...SCRIPT_BASE, updatedAt: "T1" }];
      });
    vi.mocked(atualizarScript).mockResolvedValueOnce(undefined);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children);

    const lista = renderHook(() => useScripts(filtros), { wrapper });
    await waitFor(() => expect(lista.result.current.isSuccess).toBe(true));
    expect(lista.result.current.data?.[0]?.updatedAt).toBe("T0");

    const { result } = renderHook(() => useAtualizarScript(), { wrapper });
    result.current.mutate({ id: "s1", dados: { title: "x" }, updatedAt: "T0" });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.isSuccess).toBe(false);
    expect(
      (
        qc.getQueryData(chavesDeScripts.lista(filtros)) as
          readonly { updatedAt: string }[] | undefined
      )?.[0]?.updatedAt,
    ).toBe("T0");

    liberarRefetch?.();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      (
        qc.getQueryData(chavesDeScripts.lista(filtros)) as
          readonly { updatedAt: string }[] | undefined
      )?.[0]?.updatedAt,
    ).toBe("T1");
  });
});

describe("useScripts: a lista anterior segura SO quando muda o termo da lupa", () => {
  type Filtros = Parameters<typeof useScripts>[0];

  function montarLista(inicial: Filtros) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return renderHook((filtros: Filtros) => useScripts(filtros), {
      initialProps: inicial,
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children),
    });
  }

  it("termo novo: mostra a lista anterior enquanto a busca responde", async () => {
    vi.mocked(listarScripts).mockResolvedValueOnce([{ id: "a" }] as never);
    vi.mocked(listarScripts).mockReturnValueOnce(new Promise(() => undefined));
    const { result, rerender } = montarLista({ tipo: "sdr", busca: "" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ tipo: "sdr", busca: "ob" });

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toEqual([{ id: "a" }]);
  });

  it("tipo novo com o mesmo termo: nada de lista de outro recorte", async () => {
    vi.mocked(listarScripts).mockResolvedValueOnce([{ id: "a" }] as never);
    vi.mocked(listarScripts).mockReturnValueOnce(new Promise(() => undefined));
    const { result, rerender } = montarLista({ tipo: "sdr", busca: "ob" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ tipo: "closer", busca: "ob" });

    expect(result.current.isPlaceholderData).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe("useScriptsDeWhatsApp: só lê quando a lista abre", () => {
  it("não lê fechada, e lê ao abrir", async () => {
    vi.mocked(listarScriptsDeWhatsApp).mockResolvedValue([]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(
      ({ habilitado }: { habilitado: boolean }) => useScriptsDeWhatsApp(habilitado),
      {
        initialProps: { habilitado: false },
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client: qc }, children),
      },
    );

    expect(listarScriptsDeWhatsApp).not.toHaveBeenCalled();

    rerender({ habilitado: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listarScriptsDeWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("a chave fica sob a raiz de scripts: criar, editar ou arquivar script invalida a lista do botão", () => {
    expect(chavesDeScripts.whatsapp.slice(0, 1)).toEqual([...chavesDeScripts.raiz]);
  });
});
