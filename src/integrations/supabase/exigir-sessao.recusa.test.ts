import { beforeEach, describe, expect, it, vi } from "vitest";

const { autenticarPedido, registrarEventoDeSeguranca, dentroDoLimite } = vi.hoisted(() => ({
  autenticarPedido: vi.fn(),
  registrarEventoDeSeguranca: vi.fn(),
  dentroDoLimite: vi.fn(),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("http://crm.test/_serverFn/x"),
  getRequestIP: () => "203.0.113.7",
}));
vi.mock("./auth-middleware", () => ({ autenticarPedido }));
vi.mock("@/lib/trilha.server", () => ({ registrarEventoDeSeguranca }));
vi.mock("@/lib/limite-do-usuario.server", () => ({ dentroDoLimite }));

const { exigirSessaoPorPadrao } = await import("./exigir-sessao");

type Servidor = (opcoes: {
  next: (ctx: unknown) => unknown;
  serverFnMeta: { name: string; filename: string };
}) => Promise<unknown>;
const servidor = (exigirSessaoPorPadrao.options as unknown as { server: Servidor }).server;
const META = { name: "aiAnalyze", filename: "/src/lib/ai.functions.ts" };
const UID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  autenticarPedido.mockReset();
  registrarEventoDeSeguranca.mockReset();
  dentroDoLimite.mockReset();
});

describe("exigirSessaoPorPadrao: sem sessão", () => {
  it("🔴 responde 401 e grava sessao_recusada com a chave da função e o IP", async () => {
    autenticarPedido.mockResolvedValue(null);
    const next = vi.fn();

    const recusa = await servidor({ next, serverFnMeta: META }).catch((erro: unknown) => erro);

    expect(recusa).toBeInstanceOf(Response);
    expect((recusa as Response).status).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(registrarEventoDeSeguranca).toHaveBeenCalledWith(
      "sessao_recusada",
      "src/lib/ai.functions.ts#aiAnalyze",
      "203.0.113.7",
    );
  });

  it("falha na trilha não troca o 401", async () => {
    autenticarPedido.mockResolvedValue(null);
    registrarEventoDeSeguranca.mockRejectedValue(new Error("banco"));

    const recusa = await servidor({ next: vi.fn(), serverFnMeta: META }).catch(
      (erro: unknown) => erro,
    );

    expect((recusa as Response).status).toBe(401);
  });

  it("controle: com sessão, segue e não grava recusa", async () => {
    autenticarPedido.mockResolvedValue({ supabase: { rpc: vi.fn() }, userId: UID });
    dentroDoLimite.mockResolvedValue(true);
    const next = vi.fn().mockResolvedValue("ok");

    await servidor({ next, serverFnMeta: META });

    expect(next).toHaveBeenCalledTimes(1);
    expect(registrarEventoDeSeguranca).not.toHaveBeenCalled();
  });
});

describe("exigirSessaoPorPadrao: limite por usuário", () => {
  it("🔴 mede pela chave de serviço com o uid da sessão; o token de quem pede não chama a RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    autenticarPedido.mockResolvedValue({ supabase: { rpc }, userId: UID });
    dentroDoLimite.mockResolvedValue(true);

    await servidor({ next: vi.fn().mockResolvedValue("ok"), serverFnMeta: META });

    expect(dentroDoLimite).toHaveBeenCalledWith(UID, "aianalyze", 60, 60);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("🔴 acima do limite: 429 e a função não roda", async () => {
    autenticarPedido.mockResolvedValue({ supabase: { rpc: vi.fn() }, userId: UID });
    dentroDoLimite.mockResolvedValue(false);
    const next = vi.fn();

    const recusa = await servidor({ next, serverFnMeta: META }).catch((erro: unknown) => erro);

    expect((recusa as Response).status).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });

  it("sem medida (sem chave ou erro do banco): segue, porque a sessão é o portão", async () => {
    autenticarPedido.mockResolvedValue({ supabase: { rpc: vi.fn() }, userId: UID });
    dentroDoLimite.mockResolvedValue(null);
    const next = vi.fn().mockResolvedValue("ok");

    await servidor({ next, serverFnMeta: META });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("sem sessão o limite nem é consultado", async () => {
    autenticarPedido.mockResolvedValue(null);

    await servidor({ next: vi.fn(), serverFnMeta: META }).catch(() => undefined);

    expect(dentroDoLimite).not.toHaveBeenCalled();
  });
});
