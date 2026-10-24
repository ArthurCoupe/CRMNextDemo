import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/pipeline/ui/pipeline-page", () => ({ PipelinePage: () => null }));

const { Route } = await import("./pipeline");

function validar(busca: Record<string, unknown>) {
  const validateSearch = Route.options.validateSearch as (busca: Record<string, unknown>) => {
    pipeline?: string;
  };
  return validateSearch(busca);
}

describe("validateSearch de /pipeline", () => {
  it("sem parâmetro devolve undefined — a página escolhe o primeiro ativo", () => {
    expect(validar({})).toEqual({ pipeline: undefined });
  });

  it("?pipeline=<uuid> preserva o id — e em maiúsculas vira minúsculas, a caixa dos ids do banco", () => {
    const id = "10000000-0000-4000-8000-00000000000a";
    expect(validar({ pipeline: id })).toEqual({ pipeline: id });
    expect(validar({ pipeline: id.toUpperCase() })).toEqual({ pipeline: id });
  });

  it("🔴 ?pipeline= que não é uuid vira undefined — o valor iria cru para um `.eq()`", () => {
    expect(validar({ pipeline: "abc" })).toEqual({ pipeline: undefined });
    expect(validar({ pipeline: "10000000-0000-4000-8000-00000000000" })).toEqual({
      pipeline: undefined,
    });
  });

  it("?pipeline= vazio vira undefined", () => {
    expect(validar({ pipeline: "" })).toEqual({ pipeline: undefined });
  });

  it("pipeline repetido (array, caso do browser) vira undefined, não quebra", () => {
    expect(validar({ pipeline: ["a", "b"] })).toEqual({ pipeline: undefined });
  });
});
