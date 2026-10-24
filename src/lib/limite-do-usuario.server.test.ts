import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { criarCliente, rpc, fetchComRetentativa } = vi.hoisted(() => {
  const rpc = vi.fn();
  return { rpc, criarCliente: vi.fn(() => ({ rpc })), fetchComRetentativa: vi.fn() };
});
vi.mock("@supabase/supabase-js", () => ({ createClient: criarCliente }));
vi.mock("@/shared/lib/fetch-supabase", () => ({
  comRetentativaNoRest: () => fetchComRetentativa,
}));

const { dentroDoLimite } = await import("./limite-do-usuario.server");

const UID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  criarCliente.mockClear();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: true, error: null });
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54421");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "chave-publica-de-teste");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-servico-de-teste");
});
afterEach(() => vi.unstubAllEnvs());

describe("dentroDoLimite", () => {
  it("🔴 chama com a chave de serviço, nunca com a pública, e passa o uid da sessão", async () => {
    await expect(dentroDoLimite(UID, "aianalyze", 60, 60)).resolves.toBe(true);

    expect(criarCliente).toHaveBeenCalledTimes(1);
    expect(criarCliente.mock.calls[0]).toEqual([
      "http://127.0.0.1:54421",
      "chave-de-servico-de-teste",
      expect.objectContaining({ global: { fetch: fetchComRetentativa } }),
    ]);
    expect(rpc).toHaveBeenCalledWith("limite_do_usuario", {
      p_uid: UID,
      p_bucket: "aianalyze",
      p_limite: 60,
      p_janela_s: 60,
    });
  });

  it("acima do limite devolve false (controle do true acima)", async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(dentroDoLimite(UID, "aianalyze", 60, 60)).resolves.toBe(false);
  });

  it("sem a chave de serviço devolve null (não cai para a pública), e avisa no log uma vez só", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(dentroDoLimite(UID, "a", 60, 60)).resolves.toBeNull();
    await expect(dentroDoLimite(UID, "a", 60, 60)).resolves.toBeNull();

    expect(criarCliente).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    log.mockRestore();
  });

  it("recusa do banco devolve null e vai ao log com o código, sem a chave", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(dentroDoLimite(UID, "a", 60, 60)).resolves.toBeNull();

    expect(log).toHaveBeenCalledWith("[limite] limite_do_usuario falhou: 42501");
    expect(JSON.stringify(log.mock.calls)).not.toContain("chave-de-servico-de-teste");
    log.mockRestore();
  });

  it("falha de rede devolve null em vez de derrubar a server function", async () => {
    rpc.mockRejectedValue(new Error("rede"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(dentroDoLimite(UID, "a", 60, 60)).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith("[limite] limite_do_usuario falhou: Error");
    log.mockRestore();
  });
});
