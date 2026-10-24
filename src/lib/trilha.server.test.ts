import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { criarCliente, rpc } = vi.hoisted(() => {
  const rpc = vi.fn();
  return { rpc, criarCliente: vi.fn(() => ({ rpc })) };
});
vi.mock("@supabase/supabase-js", () => ({ createClient: criarCliente }));

const { registrarEventoDeSeguranca } = await import("./trilha.server");

beforeEach(() => {
  criarCliente.mockClear();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: true, error: null });
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54421");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "chave-publica-de-teste");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-servico-de-teste");
});
afterEach(() => vi.unstubAllEnvs());

describe("registrarEventoDeSeguranca", () => {
  it("🔴 chama com a chave de serviço, nunca com a pública (a função recusa anon desde 20261002000000)", async () => {
    await registrarEventoDeSeguranca("csp_violacao", "script-src", "203.0.113.5", { linha: 1 });

    expect(criarCliente).toHaveBeenCalledTimes(1);
    expect(criarCliente.mock.calls[0]).toEqual([
      "http://127.0.0.1:54421",
      "chave-de-servico-de-teste",
      expect.anything(),
    ]);
    expect(rpc).toHaveBeenCalledWith("registrar_evento_de_seguranca", {
      p_evento: "csp_violacao",
      p_alvo: "script-src",
      p_detalhes: { linha: 1 },
      p_ip: "203.0.113.5",
    });
  });

  it("sem a chave de serviço não grava (e não cai para a pública), e avisa no log uma vez só", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await registrarEventoDeSeguranca("sessao_recusada", "alvo", undefined);
    await registrarEventoDeSeguranca("sessao_recusada", "alvo", undefined);

    expect(criarCliente).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    log.mockRestore();
  });

  it("recusa do banco vai ao log com o código, sem a chave", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await registrarEventoDeSeguranca("csp_violacao", "a", "1.2.3.4");

    expect(log).toHaveBeenCalledWith("[trilha] csp_violacao recusado pelo banco: 42501");
    expect(JSON.stringify(log.mock.calls)).not.toContain("chave-de-servico-de-teste");
    log.mockRestore();
  });

  it("alvo cortado em 256; sem detalhes, o parâmetro não vai", async () => {
    await registrarEventoDeSeguranca("origem_recusada", "x".repeat(300), undefined);

    const args = rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.p_alvo).toHaveLength(256);
    expect("p_detalhes" in args).toBe(false);
  });

  it("falha do banco não derruba quem chamou", async () => {
    rpc.mockRejectedValue(new Error("rede"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(registrarEventoDeSeguranca("sessao_recusada", "a", "1.2.3.4")).resolves.toBe(
      undefined,
    );
    expect(log).toHaveBeenCalledWith("[trilha] sessao_recusada não gravado: Error");
    log.mockRestore();
  });
});
