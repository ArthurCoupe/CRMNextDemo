import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/shared/types/database.types";

let papel: Database["public"]["Enums"]["app_role"] | null = null;

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
vi.mock("@/modules/settings/ui/dialogo-meu-perfil", () => ({
  DialogoMeuPerfil: ({ onFechar }: { onFechar: () => void }) => (
    <div>
      <p>Diálogo do meu perfil</p>
      <button type="button" onClick={onFechar}>
        Fechar o diálogo
      </button>
    </div>
  ),
}));

const { SidebarNav } = await import("./sidebar-nav");

afterEach(cleanup);

describe("Meu perfil na barra lateral (A1.5)", () => {
  it.each(["owner", "manager", "member"] as const)(
    "%s vê o botão, e o clique abre o diálogo",
    async (p) => {
      papel = p;
      const user = userEvent.setup();
      render(<SidebarNav compactaInicial={false} />);

      expect(screen.queryByText("Diálogo do meu perfil")).not.toBeInTheDocument();
      await user.click(screen.getAllByRole("button", { name: "Meu perfil" })[0]!);

      expect(screen.getByText("Diálogo do meu perfil")).toBeInTheDocument();
    },
  );

  it("o onFechar do diálogo o desmonta e o botão abre de novo", async () => {
    papel = "member";
    const user = userEvent.setup();
    render(<SidebarNav compactaInicial={false} />);
    const abrirDeNovo = () => user.click(screen.getAllByRole("button", { name: "Meu perfil" })[0]!);

    await abrirDeNovo();
    expect(screen.getByText("Diálogo do meu perfil")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fechar o diálogo" }));
    expect(screen.queryByText("Diálogo do meu perfil")).not.toBeInTheDocument();

    await abrirDeNovo();
    expect(screen.getByText("Diálogo do meu perfil")).toBeInTheDocument();
  });

  it.each(["client", null] as const)("%s não vê o botão (o menu continua lá)", (p) => {
    papel = p;
    render(<SidebarNav compactaInicial={false} />);

    expect(
      screen.getAllByRole("link").some((a) => a.getAttribute("href") === "/notificacoes"),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Meu perfil" })).not.toBeInTheDocument();
  });
});
