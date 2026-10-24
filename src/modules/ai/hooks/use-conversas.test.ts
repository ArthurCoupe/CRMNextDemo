import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/conversas.repository", () => ({
  apagarConversa: vi.fn(),
  renomearConversa: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { apagarConversa, renomearConversa } = await import("../api/conversas.repository");
const { toast } = await import("sonner");
const { chavesDeConversas, useApagarConversa, useRenomearConversa } =
  await import("./use-conversas");

beforeEach(() => {
  vi.clearAllMocks();
});

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  const { result } = renderHook(() => useApagarConversa(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  });
  return { result, invalidar };
}

describe("useApagarConversa", () => {
  it("a chave é a que a tela lê", () => {
    expect(chavesDeConversas.lista).toEqual(["ai-conversas"]);
  });

  it("sucesso apaga pelo id, invalida a lista e avisa 'Conversa apagada.'", async () => {
    vi.mocked(apagarConversa).mockResolvedValueOnce(undefined);
    const { result, invalidar } = montar();

    result.current.mutate("c1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apagarConversa).toHaveBeenCalledWith("c1");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["ai-conversas"] });
    expect(toast.success).toHaveBeenCalledWith("Conversa apagada.");
  });

  it("erro invalida a lista, mostra a frase do repositório e não avisa sucesso", async () => {
    vi.mocked(apagarConversa).mockRejectedValueOnce(
      new Error("Só quem abriu a conversa pode apagá-la."),
    );
    const { result, invalidar } = montar();

    result.current.mutate("c1");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["ai-conversas"] });
    expect(toast.error).toHaveBeenCalledWith("Só quem abriu a conversa pode apagá-la.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("rejeição sem Error (fetch rejeitado) cai no fallback da tela", async () => {
    vi.mocked(apagarConversa).mockRejectedValueOnce({ message: "", code: "" });
    const { result } = montar();

    result.current.mutate("c1");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível apagar a conversa.");
  });
});

describe("useRenomearConversa (A1.6)", () => {
  function montarRenomear() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useRenomearConversa(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children),
    });
    return { result, invalidar };
  }

  it("sucesso grava pelo id, invalida a lista e avisa 'Conversa renomeada.'", async () => {
    vi.mocked(renomearConversa).mockResolvedValueOnce(undefined);
    const { result, invalidar } = montarRenomear();

    result.current.mutate({ id: "c1", titulo: "Funil de outubro" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(renomearConversa).toHaveBeenCalledWith("c1", "Funil de outubro");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["ai-conversas"] });
    expect(toast.success).toHaveBeenCalledWith("Conversa renomeada.");
  });

  it("recusa do banco: a frase do repositório, a lista relida, sem sucesso", async () => {
    vi.mocked(renomearConversa).mockRejectedValueOnce(
      new Error("Só quem abriu a conversa pode renomeá-la."),
    );
    const { result, invalidar } = montarRenomear();

    result.current.mutate({ id: "c1", titulo: "Funil" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["ai-conversas"] });
    expect(toast.error).toHaveBeenCalledWith("Só quem abriu a conversa pode renomeá-la.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("rejeição sem Error cai no fallback da tela", async () => {
    vi.mocked(renomearConversa).mockRejectedValueOnce({ message: "", code: "" });
    const { result } = montarRenomear();

    result.current.mutate({ id: "c1", titulo: "Funil" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível renomear a conversa.");
  });
});
