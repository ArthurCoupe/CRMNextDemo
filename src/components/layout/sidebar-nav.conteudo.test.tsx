import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

let papel: string | null = "member";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
  useRouterState: () => "/",
  getRouteApi: () => ({ useLoaderData: () => ({ tema: "dark" as const }) }),
}));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock("@/integrations/supabase/sair", () => ({
  sairDaConta: vi.fn(),
  sairSoDesteNavegador: vi.fn(),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ perfil: null, papel }),
}));

vi.mock("@/modules/settings/ui/dialogo-meu-perfil", () => ({ DialogoMeuPerfil: () => null }));

const { SidebarNav } = await import("./sidebar-nav");

afterEach(cleanup);

const linksDeConteudo = () =>
  screen.queryAllByRole("link").filter((a) => a.getAttribute("href") === "/conteudo");

describe("item Conteúdo na barra lateral (D-065)", () => {
  it.each(["owner", "manager", "member"])("%s vê", (p) => {
    papel = p;
    render(<SidebarNav compactaInicial={false} />);
    expect(linksDeConteudo().length).toBeGreaterThan(0);
  });

  it("client não vê; Reuniões segue a mesma regra e Notificações (sem papeis) aparece, então a barra renderizou", () => {
    papel = "client";
    render(<SidebarNav compactaInicial={false} />);
    expect(
      screen.queryAllByRole("link").filter((a) => a.getAttribute("href") === "/notificacoes"),
    ).not.toHaveLength(0);
    expect(linksDeConteudo()).toHaveLength(0);
    expect(
      screen.queryAllByRole("link").filter((a) => a.getAttribute("href") === "/meetings"),
    ).toHaveLength(0);
  });
});
