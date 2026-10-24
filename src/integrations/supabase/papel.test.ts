import { describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("./client.browser", () => ({ supabase: { rpc } }));

const { exigirPapel, FalhaAoLerPapel, obterPapel } = await import("./papel");

describe("obterPapel", () => {
  it("erro do RPC lança FalhaAoLerPapel SEM a mensagem do banco, em vez de virar null", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "57P01", message: "o banco caiu" } });
    await expect(obterPapel()).rejects.toThrow(FalhaAoLerPapel);
    await expect(obterPapel()).rejects.not.toThrow("o banco caiu");
  });

  it("data null sem erro é 'sem papel', não falha", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(obterPapel()).resolves.toEqual({ papel: null });
  });

  it("data com papel devolve o papel", async () => {
    rpc.mockResolvedValue({ data: "owner", error: null });
    await expect(obterPapel()).resolves.toEqual({ papel: "owner" });
  });
});

describe("exigirPapel", () => {
  it("é pura: decide pelo papel recebido, sem RPC", () => {
    rpc.mockClear();
    expect(() => exigirPapel(["owner"], "owner")).not.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("papel fora da lista, ou nulo, redireciona para /acesso-negado com o exigido", () => {
    for (const papel of ["member", null] as const) {
      let lancado: unknown;
      try {
        exigirPapel(["owner", "manager"], papel);
      } catch (e) {
        lancado = e;
      }
      expect(lancado).toMatchObject({
        options: { to: "/acesso-negado", search: { exigido: "owner, manager" } },
      });
    }
  });
});
