import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/playbook.repository", () => ({
  listarSecoes: vi.fn(),
  buscarSecoes: vi.fn(),
  salvarSecao: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { listarSecoes, salvarSecao } = await import("../api/playbook.repository");
const { toast } = await import("sonner");
const { usePlaybook, useSalvarSecao, chavesDoPlaybook } = await import("./use-playbook");

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapperDe(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

const SECAO_BASE = {
  id: "s1",
  area: "comercial" as const,
  title: "Abordagem inicial",
  content: "conteúdo",
  sort_order: 1,
};

const DADOS = {
  title: "Abordagem inicial",
  area: "comercial" as const,
  sortOrder: 1,
  content: "novo",
};

describe("useSalvarSecao: sucesso e erro invalidam a lista", () => {
  it("sucesso invalida a chave raiz do playbook", async () => {
    vi.mocked(salvarSecao).mockResolvedValueOnce(undefined);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSalvarSecao(), { wrapper: wrapperDe(qc) });

    result.current.mutate({ id: "s1", dados: DADOS, updatedAt: "T0" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["playbook"] });
    expect(salvarSecao).toHaveBeenCalledWith("s1", DADOS, "T0");
  });

  it("🔴 conflito (SCR-3) invalida a lista e avisa por toast", async () => {
    vi.mocked(salvarSecao).mockRejectedValueOnce(
      new Error("Alguém editou esta seção enquanto você escrevia. Recarregue e refaça."),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSalvarSecao(), { wrapper: wrapperDe(qc) });

    result.current.mutate({ id: "s1", dados: DADOS, updatedAt: "T0" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith(
      "Alguém editou esta seção enquanto você escrevia. Recarregue e refaça.",
    );
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["playbook"] });
  });

  it("🔴 rejeição que não é Error cai no fallback, e ainda invalida a lista", async () => {
    vi.mocked(salvarSecao).mockRejectedValueOnce({ details: "", hint: "" });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSalvarSecao(), { wrapper: wrapperDe(qc) });

    result.current.mutate({ id: "s1", dados: DADOS, updatedAt: "T0" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar a seção.");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["playbook"] });
  });
});

describe("useSalvarSecao: onSuccess só libera depois da lista atualizada", () => {
  it("🔴 a mutação NÃO conclui enquanto o refetch da lista (disparado pelo invalidate) está pendente", async () => {
    let liberarRefetch: (() => void) | undefined;
    const refetchPendente = new Promise<void>((resolve) => {
      liberarRefetch = resolve;
    });
    vi.mocked(listarSecoes)
      .mockResolvedValueOnce([{ ...SECAO_BASE, updated_at: "T0" }])
      .mockImplementationOnce(async () => {
        await refetchPendente;
        return [{ ...SECAO_BASE, updated_at: "T1" }];
      });
    vi.mocked(salvarSecao).mockResolvedValueOnce(undefined);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = wrapperDe(qc);

    const lista = renderHook(() => usePlaybook("comercial"), { wrapper });
    await waitFor(() => expect(lista.result.current.isSuccess).toBe(true));
    expect(lista.result.current.data?.[0]?.updated_at).toBe("T0");

    const { result } = renderHook(() => useSalvarSecao(), { wrapper });
    result.current.mutate({ id: "s1", dados: DADOS, updatedAt: "T0" });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.isSuccess).toBe(false);
    expect(
      (
        qc.getQueryData(chavesDoPlaybook.secoes("comercial")) as
          readonly { updated_at: string }[] | undefined
      )?.[0]?.updated_at,
    ).toBe("T0");

    liberarRefetch?.();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      (
        qc.getQueryData(chavesDoPlaybook.secoes("comercial")) as
          readonly { updated_at: string }[] | undefined
      )?.[0]?.updated_at,
    ).toBe("T1");
  });
});
