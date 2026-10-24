import { render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listarFatores } from "../api/mfa.repository";
import { SegundoFator } from "./segundo-fator";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("../api/mfa.repository", () => ({
  confirmarCadastroTotp: vi.fn(),
  iniciarCadastroTotp: vi.fn(),
  listarFatores: vi.fn(),
  removerFator: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("SegundoFator — leitura dos fatores", () => {
  it("mostra o fator verificado que a leitura trouxe", async () => {
    vi.mocked(listarFatores).mockResolvedValue([
      { id: "f1", nome: "Celular pessoal", verificado: true },
      { id: "f2", nome: "Cadastro largado", verificado: false },
    ]);
    render(<SegundoFator />);

    expect(screen.getByText("Carregando…")).toBeInTheDocument();
    expect(await screen.findByText("Celular pessoal")).toBeInTheDocument();
    expect(screen.queryByText("Cadastro largado")).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("🔴 leitura que falha avisa com a mensagem e libera o cadastro, sem ficar em Carregando", async () => {
    vi.mocked(listarFatores).mockRejectedValue(
      new Error("Não foi possível ler os fatores cadastrados."),
    );
    render(<SegundoFator />);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível ler os fatores cadastrados."),
    );
    expect(screen.queryByText("Carregando…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar app autenticador" })).toBeEnabled();
  });
});
