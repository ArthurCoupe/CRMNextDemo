import { describe, expect, it, vi } from "vitest";

import { sessaoVerificada } from "./sessao";

function cliente(claims: { data: { claims: { sub?: string } } | null; error: unknown }) {
  const getSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
  return {
    cliente: { auth: { getClaims: vi.fn().mockResolvedValue(claims), getSession } },
    getSession,
  };
}

describe("C17 · sessaoVerificada", () => {
  it("cookie que nao verifica (getClaims com erro) -> null, e getSession nem e consultado", async () => {
    const { cliente: c, getSession } = cliente({
      data: null,
      error: new Error("invalid signature"),
    });
    expect(await sessaoVerificada(c)).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("claims sem sub -> null", async () => {
    const { cliente: c } = cliente({ data: { claims: {} }, error: null });
    expect(await sessaoVerificada(c)).toBeNull();
  });

  it("controle positivo: claims validos -> devolve a sessao do cookie", async () => {
    const { cliente: c } = cliente({ data: { claims: { sub: "u1" } }, error: null });
    expect(await sessaoVerificada(c)).toEqual({ user: { id: "u1" } });
  });
});
