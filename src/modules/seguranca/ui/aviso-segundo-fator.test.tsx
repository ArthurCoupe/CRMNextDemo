import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ler = vi.hoisted(() => vi.fn());
vi.mock("../api/mfa.repository", () => ({ lerSituacaoDoSegundoFator: ler }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const { AvisoSegundoFator } = await import("./aviso-segundo-fator");

beforeEach(() => ler.mockReset());

describe("C21 · AvisoSegundoFator", () => {
  it("sem fator: pede o cadastro e aponta para /seguranca", async () => {
    ler.mockResolvedValue("sem-fator");
    render(<AvisoSegundoFator />);
    await waitFor(() => expect(screen.getByText(/Proteja o financeiro/)).toBeTruthy());
    expect(screen.getByRole("link", { name: /Ativar em Segurança/ }).getAttribute("href")).toBe(
      "/seguranca",
    );
  });

  it("fator verificado e sessao sem o codigo: diz o que fazer", async () => {
    ler.mockResolvedValue("falta-codigo");
    render(<AvisoSegundoFator />);
    await waitFor(() =>
      expect(screen.getByText(/Falta o código do app autenticador/)).toBeTruthy(),
    );
  });

  it("ok: nao mostra nada (a guarda anti-vacuidade dos dois acima)", async () => {
    ler.mockResolvedValue("ok");
    const { container } = render(<AvisoSegundoFator />);
    await waitFor(() => expect(ler).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
