import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchDoStart } = vi.hoisted(() => ({
  fetchDoStart: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: { fetch: (request: Request) => fetchDoStart(request) },
}));

import servidor from "./server";

const json = (corpo: unknown, status = 500) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });

const pedir = () => servidor.fetch(new Request("https://crm.test/qualquer"), {}, {});

describe("erro de SSR engolido pelo Start vira a página 500 da marca", () => {
  beforeEach(() => {
    fetchDoStart.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("🔴 corpo do start-server-core 1.169, com statusText vazio: página 500 em HTML", async () => {
    fetchDoStart.mockResolvedValue(
      json({ status: 500, statusText: "", unhandled: true, message: "HTTPError" }),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(500);
    expect(resposta.headers.get("content-type")).toContain("text/html");
    expect(await resposta.text()).toContain('<html lang="pt-BR">');
  });

  it("corpo antigo do h3, sem statusText: página 500 em HTML", async () => {
    fetchDoStart.mockResolvedValue(json({ unhandled: true, message: "HTTPError" }));
    const resposta = await pedir();
    expect(resposta.headers.get("content-type")).toContain("text/html");
  });

  it("o positivo ao lado: JSON 500 com outra chave segue como veio", async () => {
    fetchDoStart.mockResolvedValue(
      json({ error: "falhou", unhandled: true, message: "HTTPError" }),
    );
    const resposta = await pedir();
    expect(resposta.headers.get("content-type")).toContain("application/json");
    expect(await resposta.json()).toEqual({
      error: "falhou",
      unhandled: true,
      message: "HTTPError",
    });
  });

  it("statusText que não é texto, ou status diferente do da resposta: segue como veio", async () => {
    fetchDoStart.mockResolvedValueOnce(
      json({ status: 500, statusText: 1, unhandled: true, message: "HTTPError" }),
    );
    expect((await pedir()).headers.get("content-type")).toContain("application/json");

    fetchDoStart.mockResolvedValueOnce(
      json({ status: 502, statusText: "", unhandled: true, message: "HTTPError" }),
    );
    expect((await pedir()).headers.get("content-type")).toContain("application/json");
  });

  it("resposta abaixo de 500 nunca é trocada", async () => {
    fetchDoStart.mockResolvedValue(
      json({ status: 404, statusText: "", unhandled: true, message: "HTTPError" }, 404),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(404);
    expect(resposta.headers.get("content-type")).toContain("application/json");
  });
});
