import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/notifications.repository", () => ({
  definirPreferencia: vi.fn(),
  lerDesligados: vi.fn(),
  lerHistorico: vi.fn(),
  lerUltimaPassada: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { definirPreferencia } = await import("../api/notifications.repository");
const { toast } = await import("sonner");
const { useDefinirPreferencia } = await import("./use-notifications");

beforeEach(() => {
  vi.clearAllMocks();
});

function montar() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return renderHook(() => useDefinirPreferencia(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  });
}

const VARIAVEIS = { profileId: "p1", tipo: "tarefa_vencida", ativo: false } as const;

describe("useDefinirPreferencia: o toast de erro nunca sai vazio", () => {
  it("🔴 rejeição SEM Error (objeto cru do fetch) cai no fallback da tela", async () => {
    vi.mocked(definirPreferencia).mockRejectedValueOnce({ message: "", code: "" });
    const { result } = montar();

    result.current.mutate(VARIAVEIS);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar a preferência.");
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("Error do repositório mantém a frase dele", async () => {
    vi.mocked(definirPreferencia).mockRejectedValueOnce(
      new Error("Você só pode mudar a sua própria preferência."),
    );
    const { result } = montar();

    result.current.mutate(VARIAVEIS);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Você só pode mudar a sua própria preferência.");
  });
});
