import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/fiscal.repository", () => ({
  definirAliquota: vi.fn(),
  definirTaxaDeParcelamento: vi.fn(),
  definirTaxasDoMeio: vi.fn(),
  lerConfiguracaoFiscal: vi.fn(),
  lerLiquidoPorContrato: vi.fn(),
  lerLiquidoTotal: vi.fn(),
  lerTabelaDeParcelamento: vi.fn(),
  lerTaxasPorMeio: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { definirTaxasDoMeio } = await import("../api/fiscal.repository");
const { toast } = await import("sonner");
const { useDefinirTaxasDoMeio } = await import("./use-fiscal");

beforeEach(() => {
  vi.clearAllMocks();
});

function montar(qc: QueryClient) {
  return renderHook(() => useDefinirTaxasDoMeio(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  }).result;
}

describe("useDefinirTaxasDoMeio com prazo e parcelável (A2.5)", () => {
  it("repassa o campo novo e invalida o fiscal", async () => {
    vi.mocked(definirTaxasDoMeio).mockResolvedValueOnce(undefined);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const resultado = montar(qc);

    resultado.current.mutate({ meio: "pix", parcelavel: true });
    await waitFor(() => expect(resultado.current.isSuccess).toBe(true));

    expect(definirTaxasDoMeio).toHaveBeenCalledWith({ meio: "pix", parcelavel: true });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["fiscal"] });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("🔴 recusa do banco aparece como mensagem, não como sucesso", async () => {
    vi.mocked(definirTaxasDoMeio).mockRejectedValueOnce(
      new Error("Nada foi alterado: só o owner edita as taxas por meio de pagamento."),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const resultado = montar(qc);

    resultado.current.mutate({ meio: "pix", liquidacao: "D+2" });
    await waitFor(() => expect(resultado.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith(
      "A alteração NÃO foi salva. Nada foi alterado: só o owner edita as taxas por meio de pagamento.",
    );
  });
});
