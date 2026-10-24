import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { sairSoDesteNavegador } from "@/integrations/supabase/sair";

import { avisarFalhaAoSair } from "./falha-ao-sair";

vi.mock("@/integrations/supabase/sair", () => ({ sairSoDesteNavegador: vi.fn() }));

const espera = (ms: number) => act(() => new Promise<void>((pronto) => setTimeout(pronto, ms)));

afterEach(() => {
  act(() => toast.dismiss());
});

describe("aviso de falha ao sair, com o Toaster real", () => {
  it("controle: o aviso aparece com a descrição e o botão", async () => {
    render(<Toaster />);
    act(() => avisarFalhaAoSair());
    await espera(100);

    expect(screen.queryByText("Sair só deste navegador")).not.toBeNull();
    expect(screen.queryByText(/A sessão pode continuar ativa no servidor/)).not.toBeNull();
  });

  it("🔴 depois do clique, o 'Saindo…' fica na tela enquanto a saída espera, sem o botão", async () => {
    vi.mocked(sairSoDesteNavegador).mockReturnValue(new Promise<void>(() => {}));
    const user = userEvent.setup();
    render(<Toaster />);
    act(() => avisarFalhaAoSair());
    await espera(100);

    await user.click(screen.getByText("Sair só deste navegador"));
    await espera(1000);

    expect(sairSoDesteNavegador).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Saindo deste navegador…")).not.toBeNull();
    expect(screen.queryByText("Sair só deste navegador")).toBeNull();
    expect(screen.queryByText(/A sessão pode continuar ativa no servidor/)).toBeNull();
  });
});
