import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sairSoDesteNavegador } from "@/integrations/supabase/sair";

import { avisarFalhaAoSair, fecharAvisoDeFalhaAoSair } from "./falha-ao-sair";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() } }));
vi.mock("@/integrations/supabase/sair", () => ({ sairSoDesteNavegador: vi.fn() }));

interface OpcoesDoAviso {
  id: string;
  description: string;
  duration: number;
  action: { label: string; onClick: (e: { preventDefault: () => void }) => void };
}

function opcoesDoAviso(chamada = 0): OpcoesDoAviso {
  return vi.mocked(toast.error).mock.calls[chamada]?.[1] as unknown as OpcoesDoAviso;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sairSoDesteNavegador).mockResolvedValue(undefined);
});

describe("avisarFalhaAoSair", () => {
  it("🔴 avisa que a sessão pode continuar ativa no servidor, sem sair sozinho", () => {
    avisarFalhaAoSair();

    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível sair. Verifique a conexão e tente de novo.",
      expect.anything(),
    );
    expect(opcoesDoAviso().description).toContain("A sessão pode continuar ativa no servidor.");
    expect(opcoesDoAviso().action.label).toBe("Sair só deste navegador");
    expect(opcoesDoAviso().duration).toBeGreaterThanOrEqual(10_000);
    expect(sairSoDesteNavegador).not.toHaveBeenCalled();
  });

  it("duas falhas seguidas usam o mesmo aviso, sem empilhar", () => {
    avisarFalhaAoSair();
    avisarFalhaAoSair();

    expect(opcoesDoAviso(0).id).toBeTruthy();
    expect(opcoesDoAviso(1).id).toBe(opcoesDoAviso(0).id);
  });

  it("o clique mostra que está saindo, sai só deste navegador e troca a página por /auth", async () => {
    const replace = vi.spyOn(window.location, "replace").mockImplementation(() => {});
    avisarFalhaAoSair();

    const preventDefault = vi.fn();
    opcoesDoAviso().action.onClick({ preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(toast.loading).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ id: opcoesDoAviso().id }),
    );
    expect(sairSoDesteNavegador).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/auth"));
    replace.mockRestore();
  });

  it("fecharAvisoDeFalhaAoSair fecha o mesmo aviso", () => {
    avisarFalhaAoSair();

    fecharAvisoDeFalhaAoSair();

    expect(toast.dismiss).toHaveBeenCalledWith(opcoesDoAviso().id);
  });
});
