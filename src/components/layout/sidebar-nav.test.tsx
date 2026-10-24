import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
const sairLocal = vi.fn();
const toastError = vi.fn();
const toastDismiss = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
  useRouterState: () => "/",
  getRouteApi: () => ({ useLoaderData: () => ({ tema: "dark" as const }) }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: toastDismiss,
  },
}));

vi.mock("@/integrations/supabase/sair", () => ({
  sairDaConta: signOut,
  sairSoDesteNavegador: sairLocal,
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ perfil: null, papel: null }),
}));

vi.mock("@/modules/settings/ui/dialogo-meu-perfil", () => ({ DialogoMeuPerfil: () => null }));

const { SidebarNav } = await import("./sidebar-nav");

beforeEach(() => {
  signOut.mockReset();
  sairLocal.mockReset();
  toastError.mockClear();
  toastDismiss.mockClear();
});

function botoesSair() {
  return screen.getAllByRole("button", { name: "Sair" });
}

describe("Sair (AUTH-6)", () => {
  it("🔴 signOut com erro vira toast, nao fica mudo", async () => {
    const user = userEvent.setup();
    signOut.mockResolvedValue({ error: { message: "network error" } });

    render(<SidebarNav compactaInicial={false} />);
    await user.click(botoesSair()[0]!);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Não foi possível sair. Verifique a conexão e tente de novo.",
        expect.objectContaining({
          action: expect.objectContaining({ label: "Sair só deste navegador" }),
        }),
      ),
    );
    expect(sairLocal).not.toHaveBeenCalled();
  });

  it("'Sair só deste navegador' apaga a sessão local e vai para /auth", async () => {
    const user = userEvent.setup();
    signOut.mockResolvedValue({ error: { message: "network error" } });
    sairLocal.mockResolvedValue(undefined);
    const replace = vi.spyOn(window.location, "replace").mockImplementation(() => {});

    render(<SidebarNav compactaInicial={false} />);
    await user.click(botoesSair()[0]!);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const opcoes = toastError.mock.calls[0]?.[1] as {
      action: { onClick: (e: { preventDefault: () => void }) => void };
    };
    opcoes.action.onClick({ preventDefault: () => {} });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth"));
    expect(sairLocal).toHaveBeenCalledTimes(1);
    replace.mockRestore();
  });

  it("signOut sem erro nao dispara toast nenhum", async () => {
    const user = userEvent.setup();
    signOut.mockResolvedValue({ error: null });

    render(<SidebarNav compactaInicial={false} />);
    await user.click(botoesSair()[0]!);

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(sairLocal).not.toHaveBeenCalled();
  });

  it("🔴 falha e depois sucesso: o aviso antigo fecha e para de oferecer a saída", async () => {
    const user = userEvent.setup();
    signOut.mockResolvedValueOnce({ error: { message: "network error" } });
    signOut.mockResolvedValueOnce({ error: null });

    render(<SidebarNav compactaInicial={false} />);
    await user.click(botoesSair()[0]!);
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    const id = (toastError.mock.calls[0]?.[1] as { id: string }).id;
    expect(toastDismiss).not.toHaveBeenCalled();

    await user.click(botoesSair()[0]!);

    await waitFor(() => expect(toastDismiss).toHaveBeenCalledWith(id));
  });
});
