import { afterEach, describe, expect, it, vi } from "vitest";

import { pedirLinkDeRecuperacao } from "./recuperacao";

function responder(status: number, corpo: unknown = { ok: true }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(corpo), {
          status,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("C32 · pedirLinkDeRecuperacao", () => {
  it("manda e-mail e token no corpo, por POST, para /api/recuperar", async () => {
    responder(200);
    await pedirLinkDeRecuperacao("a@b.com", "tok");
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recuperar");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ email: "a@b.com", captchaToken: "tok" });
  });

  it("🔴 200, 429, 500 e 400 que nao e captcha dao o MESMO resultado", async () => {
    const resultados = [];
    for (const [status, corpo] of [
      [200, { ok: true }],
      [429, { error: "Too many requests" }],
      [500, { error: "x" }],
      [400, { error: "User not found" }],
    ] as const) {
      responder(status, corpo);
      resultados.push(await pedirLinkDeRecuperacao("a@b.com"));
    }
    expect(resultados).toEqual(["enviado", "enviado", "enviado", "enviado"]);
  });

  it("400 captcha vira captcha; fetch rejeitado vira sem-conexao", async () => {
    responder(400, { error: "captcha" });
    expect(await pedirLinkDeRecuperacao("a@b.com")).toBe("captcha");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    expect(await pedirLinkDeRecuperacao("a@b.com")).toBe("sem-conexao");
  });
});
