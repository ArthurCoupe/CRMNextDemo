import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
vi.mock("../hooks/use-clients", () => ({
  useDesfazerFechamento: () => ({ mutate, isPending: false }),
}));

const { DesfazerFechamento } = await import("./desfazer-fechamento");

const VENDA = { id: "venda-1", nome: "Acme site" };

beforeEach(() => {
  mutate.mockReset();
});

describe("DesfazerFechamento (D-071)", () => {
  it("nomeia a venda e diz que o cliente fica", async () => {
    const usuario = userEvent.setup();
    render(<DesfazerFechamento venda={VENDA} />);

    await usuario.click(screen.getByRole("button", { name: "Desfazer fechamento" }));

    expect(await screen.findByText('Desfazer o fechamento de "Acme site"?')).toBeInTheDocument();
    expect(screen.getByText(/O cliente e os contratos de outras vendas ficam/)).toBeInTheDocument();
  });

  it("confirmar nasce desabilitado com o motivo vazio ou só de espaço", async () => {
    const usuario = userEvent.setup();
    render(<DesfazerFechamento venda={VENDA} />);

    await usuario.click(screen.getByRole("button", { name: "Desfazer fechamento" }));
    expect(await screen.findByRole("button", { name: "Sim, desfazer" })).toBeDisabled();

    await usuario.type(screen.getByLabelText("Motivo"), "    ");
    expect(screen.getByRole("button", { name: "Sim, desfazer" })).toBeDisabled();
  });

  it("com motivo, manda a venda e o texto aparado", async () => {
    const usuario = userEvent.setup();
    render(<DesfazerFechamento venda={VENDA} />);

    await usuario.click(screen.getByRole("button", { name: "Desfazer fechamento" }));
    await usuario.type(await screen.findByLabelText("Motivo"), "  fechei a errada  ");
    await usuario.click(screen.getByRole("button", { name: "Sim, desfazer" }));

    expect(mutate).toHaveBeenCalledWith({ vendaId: "venda-1", motivo: "fechei a errada" });
  });
});
