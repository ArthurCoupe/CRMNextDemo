import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/scripts/ui/scripts-page", () => ({ ScriptsPage: () => null }));
vi.mock("@/integrations/supabase/papel", () => ({ exigirPapel: vi.fn() }));

const { Route } = await import("./scripts");
const { exigirPapel } = await import("@/integrations/supabase/papel");

function validar(busca: Record<string, unknown>) {
  const validateSearch = Route.options.validateSearch as (busca: Record<string, unknown>) => {
    tipo: string;
  };
  return validateSearch(busca);
}

describe("validateSearch de /scripts", () => {
  it("sem parametro cai em sdr", () => {
    expect(validar({})).toEqual({ tipo: "sdr" });
  });

  it("?tipo=closer preserva closer", () => {
    expect(validar({ tipo: "closer" })).toEqual({ tipo: "closer" });
  });

  it("?tipo=sdr preserva sdr", () => {
    expect(validar({ tipo: "sdr" })).toEqual({ tipo: "sdr" });
  });

  it("valor desconhecido (?tipo=banana) cai em sdr, nao quebra", () => {
    expect(validar({ tipo: "banana" })).toEqual({ tipo: "sdr" });
  });

  it("?tipo= vazio cai em sdr", () => {
    expect(validar({ tipo: "" })).toEqual({ tipo: "sdr" });
  });

  it("tipo repetido (array, caso do browser) cai em sdr", () => {
    expect(validar({ tipo: ["sdr", "closer"] })).toEqual({ tipo: "sdr" });
  });
});

describe("guarda de /scripts (achado 1: client atravessava)", () => {
  it("beforeLoad chama exigirPapel excluindo client", async () => {
    await Route.options.beforeLoad!({ context: { papel: "client" } } as never);
    expect(exigirPapel).toHaveBeenCalledWith(["owner", "manager", "member"], "client");
    expect(exigirPapel).toHaveBeenCalledWith(expect.not.arrayContaining(["client"]), "client");
  });
});
