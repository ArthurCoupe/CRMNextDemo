import { describe, expect, it } from "vitest";

import { comHeadersDeSeguranca, HEADERS_DE_SEGURANCA } from "./headers-de-seguranca";

describe("C33 · HEADERS_DE_SEGURANCA", () => {
  it("tem exatamente os seis cabecalhos do controle, sem preload no HSTS", () => {
    expect(Object.keys(HEADERS_DE_SEGURANCA).sort()).toEqual([
      "Permissions-Policy",
      "Referrer-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "X-Robots-Tag",
    ]);
    expect(HEADERS_DE_SEGURANCA["Strict-Transport-Security"]).toMatch(
      /max-age=\d{8,}; includeSubDomains$/,
    );
    expect(HEADERS_DE_SEGURANCA["Strict-Transport-Security"]).not.toContain("preload");
    expect(HEADERS_DE_SEGURANCA["X-Content-Type-Options"]).toBe("nosniff");
    expect(HEADERS_DE_SEGURANCA["X-Frame-Options"]).toBe("DENY");
    expect(HEADERS_DE_SEGURANCA["X-Robots-Tag"]).toContain("noindex");
  });

  it("comHeadersDeSeguranca preserva status, corpo e headers existentes, e nao deixa sobrescrever os fixos", async () => {
    const original = new Response("ola", {
      status: 201,
      headers: {
        "content-type": "text/plain",
        "x-frame-options": "ALLOWALL",
        "cache-control": "no-store",
      },
    });
    const r = comHeadersDeSeguranca(original);
    expect(r.status).toBe(201);
    expect(await r.text()).toBe("ola");
    expect(r.headers.get("content-type")).toBe("text/plain");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
