import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
}));

const { AccessDenied } = await import("./access-denied");

describe("AccessDenied: a saída não pode ser um laço", () => {
  it("🔴 tela de staff (exigido inclui member): o link vai para /notificacoes", () => {
    render(<AccessDenied exigido="owner, manager, member" />);

    const link = screen.getByRole("link", { name: "Ir para Notificações" });
    expect(link).toHaveAttribute("href", "/notificacoes");
    expect(screen.queryByRole("link", { name: "Voltar ao início" })).not.toBeInTheDocument();
  });

  it("tela só de owner: 'Voltar ao início' → / (a pessoa é staff)", () => {
    render(<AccessDenied exigido="owner" />);

    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  });

  it("sem exigido: 'Voltar ao início' → /", () => {
    render(<AccessDenied />);

    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  });

  it("'membership' não é 'member' — a comparação é por papel inteiro", () => {
    render(<AccessDenied exigido="membership" />);

    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  });
});
