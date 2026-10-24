import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { avisarFalhaAoSair } from "@/components/layout/falha-ao-sair";
import { sairDaConta } from "@/integrations/supabase/sair";

import { Route } from "./conta-pendente";

vi.mock("@/integrations/supabase/sair", () => ({ sairDaConta: vi.fn() }));
vi.mock("@/components/layout/falha-ao-sair", () => ({ avisarFalhaAoSair: vi.fn() }));

const Pagina = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  vi.spyOn(Route, "useSearch").mockReturnValue({} as never);
});

describe("/conta-pendente — Sair", () => {
  it("🔴 servidor não confirma: mostra o aviso e não navega", async () => {
    vi.mocked(sairDaConta).mockResolvedValue({ error: new Error("rede") } as never);
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    render(<Pagina />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => expect(avisarFalhaAoSair).toHaveBeenCalledTimes(1));
    expect(assign).not.toHaveBeenCalled();
  });

  it("servidor confirma: vai para /auth, sem aviso", async () => {
    vi.mocked(sairDaConta).mockResolvedValue({ error: null });
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    render(<Pagina />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/auth"));
    expect(avisarFalhaAoSair).not.toHaveBeenCalled();
  });
});
