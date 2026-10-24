import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const salvar = { mutateAsync: vi.fn(), isPending: false };
let consulta: { data: unknown; isError: boolean; isPending: boolean } = {
  data: { percentual: 60, confirmado: false },
  isError: false,
  isPending: false,
};

vi.mock("../hooks/use-shares", () => ({
  useLimiarDeAlerta: () => consulta,
  useSalvarLimiarDeAlerta: () => salvar,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { LimiarDeAlertaSettings } = await import("./limiar-de-alerta-settings");
const { toast } = await import("sonner");

beforeEach(() => {
  vi.clearAllMocks();
  salvar.mutateAsync.mockReset();
  consulta = { data: { percentual: 60, confirmado: false }, isError: false, isPending: false };
});

describe("aviso de participação", () => {
  it("mostra o percentual gravado e diz que não está confirmado", () => {
    render(<LimiarDeAlertaSettings />);

    expect(screen.getByLabelText("Avisar a partir de (%)")).toHaveValue("60");
    expect(screen.getByText(/ainda não foi confirmado/)).toBeInTheDocument();
  });

  it("🔴 mostra a vírgula do pt-BR, que é a que o campo relê ao gravar", async () => {
    consulta = { data: { percentual: 70.5, confirmado: true }, isError: false, isPending: false };
    const user = userEvent.setup();
    render(<LimiarDeAlertaSettings />);

    const campo = screen.getByLabelText("Avisar a partir de (%)");
    expect(campo).toHaveValue("70,5");

    await user.type(campo, "0");
    await user.click(screen.getByRole("button", { name: "Salvar aviso" }));
    expect(salvar.mutateAsync).toHaveBeenCalledWith({ percentual: 70.5, confirmado: true });
  });

  it("grava o novo percentual e preserva a marca de não confirmado", async () => {
    const user = userEvent.setup();
    render(<LimiarDeAlertaSettings />);

    const campo = screen.getByLabelText("Avisar a partir de (%)");
    await user.clear(campo);
    await user.type(campo, "70,5");
    await user.click(screen.getByRole("button", { name: "Salvar aviso" }));

    expect(salvar.mutateAsync).toHaveBeenCalledWith({ percentual: 70.5, confirmado: false });
    expect(toast.success).toHaveBeenCalledWith("Aviso atualizado.");
  });

  it("confirmado segue confirmado, e o aviso de não confirmado some", async () => {
    consulta = { data: { percentual: 60, confirmado: true }, isError: false, isPending: false };
    const user = userEvent.setup();
    render(<LimiarDeAlertaSettings />);

    expect(screen.queryByText(/ainda não foi confirmado/)).toBeNull();
    const campo = screen.getByLabelText("Avisar a partir de (%)");
    await user.clear(campo);
    await user.type(campo, "50");
    await user.click(screen.getByRole("button", { name: "Salvar aviso" }));

    expect(salvar.mutateAsync).toHaveBeenCalledWith({ percentual: 50, confirmado: true });
  });

  it.each(["0", "150", "abc"])(
    "🔴 %s não chama o banco, e a tela diz por quê",
    async (digitado) => {
      const user = userEvent.setup();
      render(<LimiarDeAlertaSettings />);

      const campo = screen.getByLabelText("Avisar a partir de (%)");
      await user.clear(campo);
      await user.type(campo, digitado);
      await user.click(screen.getByRole("button", { name: "Salvar aviso" }));

      expect(salvar.mutateAsync).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("O aviso precisa ser maior que 0 e no máximo 100%.");
    },
  );

  it("🔴 campo apagado não grava zero: vazio não chama o banco", async () => {
    const user = userEvent.setup();
    render(<LimiarDeAlertaSettings />);

    await user.clear(screen.getByLabelText("Avisar a partir de (%)"));
    await user.click(screen.getByRole("button", { name: "Salvar aviso" }));

    expect(salvar.mutateAsync).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("O aviso precisa ser maior que 0 e no máximo 100%.");
  });

  it("🔴 recusa do banco aparece como mensagem, não como sucesso", async () => {
    salvar.mutateAsync.mockRejectedValueOnce(
      new Error("Nada foi alterado: só o owner muda o aviso de participação."),
    );
    const user = userEvent.setup();
    render(<LimiarDeAlertaSettings />);

    const campo = screen.getByLabelText("Avisar a partir de (%)");
    await user.clear(campo);
    await user.type(campo, "70");
    await user.click(screen.getByRole("button", { name: "Salvar aviso" }));

    expect(toast.error).toHaveBeenCalledWith(
      "Nada foi alterado: só o owner muda o aviso de participação.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("🔴 leitura em erro não oferece campo nem botão", () => {
    consulta = { data: undefined, isError: true, isPending: false };

    render(<LimiarDeAlertaSettings />);

    expect(screen.getByText(/não foi possível ler/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Avisar a partir de (%)")).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar aviso" })).toBeNull();
  });
});
