import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const definirTaxas = { mutate: vi.fn(), isPending: false };
const pronto = (data: unknown) => ({ data, isError: false, isPending: false });
const TAXAS = new Map([
  [
    "pix",
    { meio: "pix", taxaFixa: 0, percentualVariavel: 0, parcelavel: false, liquidacao: "D+0" },
  ],
  [
    "credito",
    { meio: "credito", taxaFixa: 0.5, percentualVariavel: 0, parcelavel: true, liquidacao: "D+1" },
  ],
]);

vi.mock("../hooks/use-fiscal", () => ({
  useConfiguracaoFiscal: () => pronto({ aliquotaPct: 6, provisoria: false, fonte: null }),
  useTabelaDeParcelamento: () => pronto(new Map([[1, 3.3]])),
  useTaxasPorMeio: () => pronto(TAXAS),
  useDefinirAliquota: () => ({ mutate: vi.fn(), isPending: false }),
  useDefinirTaxaDeParcelamento: () => ({ mutate: vi.fn(), isPending: false }),
  useDefinirTaxasDoMeio: () => definirTaxas,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { FiscalSettings } = await import("./fiscal-settings");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("taxas por meio de pagamento (A2.5)", () => {
  it("o prazo grava ao sair do campo, só o do meio editado", async () => {
    const user = userEvent.setup();
    render(<FiscalSettings />);

    const prazo = screen.getByLabelText("Prazo (Pix)");
    expect(prazo).toHaveValue("D+0");
    await user.clear(prazo);
    await user.type(prazo, "D+2");
    await user.tab();

    expect(definirTaxas.mutate).toHaveBeenCalledTimes(1);
    expect(definirTaxas.mutate).toHaveBeenCalledWith({ meio: "pix", liquidacao: "D+2" });
  });

  it("🔴 sair do prazo sem editar não grava", async () => {
    const user = userEvent.setup();
    render(<FiscalSettings />);

    await user.click(screen.getByLabelText("Prazo (Cartão de crédito)"));
    await user.tab();

    expect(definirTaxas.mutate).not.toHaveBeenCalled();
  });

  it("o interruptor mostra o parcelável gravado e grava o novo", async () => {
    const user = userEvent.setup();
    render(<FiscalSettings />);

    expect(screen.getByRole("switch", { name: "Parcelável (Cartão de crédito)" })).toBeChecked();
    const pix = screen.getByRole("switch", { name: "Parcelável (Pix)" });
    expect(pix).not.toBeChecked();
    await user.click(pix);

    expect(definirTaxas.mutate).toHaveBeenCalledWith({ meio: "pix", parcelavel: true });
  });

  it("🔴 sem a gravação confirmada, o interruptor segue mostrando o que está no banco", async () => {
    const user = userEvent.setup();
    render(<FiscalSettings />);

    const pix = screen.getByRole("switch", { name: "Parcelável (Pix)" });
    await user.click(pix);

    expect(definirTaxas.mutate).toHaveBeenCalledTimes(1);
    expect(pix).not.toBeChecked();
  });

  it("a tela diz que o parcelável ainda não muda o formulário de contrato", () => {
    render(<FiscalSettings />);

    expect(screen.getByText(/ainda não muda o formulário de contrato/)).toBeInTheDocument();
  });
});
