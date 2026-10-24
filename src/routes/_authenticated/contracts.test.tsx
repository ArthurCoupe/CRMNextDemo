import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/contracts/ui/contracts-page", () => ({ ContractsPage: () => null }));

const { Route } = await import("./contracts");

function validar(busca: Record<string, unknown>) {
  const validateSearch = Route.options.validateSearch as (busca: Record<string, unknown>) => {
    cliente?: string;
  };
  return validateSearch(busca);
}

describe("validateSearch de /contracts", () => {
  it("sem parâmetro mostra todos os contratos", () => {
    expect(validar({})).toEqual({ cliente: undefined });
  });

  it("?cliente=<uuid> preserva o id, em minúsculas", () => {
    const id = "a0000000-0000-4000-8000-00000000000a";
    expect(validar({ cliente: id })).toEqual({ cliente: id });
    expect(validar({ cliente: id.toUpperCase() })).toEqual({ cliente: id });
  });

  it("🔴 ?cliente= que não é uuid vira undefined", () => {
    const id = "a0000000-0000-4000-8000-00000000000a";
    expect(validar({ cliente: "abc" })).toEqual({ cliente: undefined });
    expect(validar({ cliente: "" })).toEqual({ cliente: undefined });
    expect(validar({ cliente: `x${id}` })).toEqual({ cliente: undefined });
    expect(validar({ cliente: `${id}x` })).toEqual({ cliente: undefined });
    expect(validar({ cliente: [id] })).toEqual({ cliente: undefined });
  });

  it("cliente repetido (array) vira undefined", () => {
    expect(validar({ cliente: ["a", "b"] })).toEqual({ cliente: undefined });
  });
});
