import { describe, expect, it } from "vitest";

import { MODO_DEMO, respostaDaDemo, rotaDesligadaNaDemo } from "./demo";

describe("rotaDesligadaNaDemo", () => {
  it("🔴 desliga toda rota /api, com caixa, barra dupla ou codificação diferentes", () => {
    for (const caminho of [
      "/api",
      "/api/",
      "/api/contato",
      "/api/track",
      "/api/recuperar",
      "/api/cron/notificacoes",
      "/API/contato/",
      "//api/contato",
      "/%61pi/contato",
    ])
      expect(rotaDesligadaNaDemo(caminho), caminho).toBe(true);
  });

  it("controle: as telas seguem no ar, inclusive as que começam parecido", () => {
    for (const caminho of ["/", "/auth", "/dashboard", "/ai", "/apis", "/api-docs", "/clients/api"])
      expect(rotaDesligadaNaDemo(caminho), caminho).toBe(false);
  });

  it("caminho mal codificado não lança e decide pelo texto cru", () => {
    expect(rotaDesligadaNaDemo("/api/%E0%A4%A")).toBe(true);
    expect(rotaDesligadaNaDemo("/%E0%A4%A")).toBe(false);
  });
});

describe("respostaDaDemo", () => {
  it("avisa que é simulada e devolve o contexto montado pelo CRM", () => {
    const texto = respostaDaDemo("Clientes ativos: 9");
    expect(texto).toMatch(/^\*\*Resposta simulada\.\*\*/);
    expect(texto).toContain("Clientes ativos: 9");
  });

  it("contexto vazio vira aviso, não resposta em branco", () => {
    expect(respostaDaDemo("  ")).toContain("Nenhum dado visível para esta conta.");
  });

  it("sem travessão nem meia-risca (§4.5)", () => {
    expect(respostaDaDemo("x")).not.toMatch(/[–—]/);
  });
});

it("🔴 fora do build da demo, o modo fica desligado", () => {
  expect(MODO_DEMO).toBe(false);
});
