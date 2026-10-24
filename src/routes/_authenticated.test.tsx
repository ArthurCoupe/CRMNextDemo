import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/sessao", () => ({ obterSessao: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client.browser", () => ({ supabase: { rpc } }));
vi.mock("@/components/layout/sidebar-nav", () => ({ SidebarNav: () => null }));
vi.mock("@/hooks/use-realtime", () => ({ useRealtime: () => undefined }));
vi.mock("@/modules/financial/ui/financial-page", () => ({ FinancialPage: () => null }));

const { Route: Pai } = await import("./_authenticated");
const { Route: Financeiro } = await import("./_authenticated/financial");

async function guardaDoPai(): Promise<unknown> {
  try {
    return await Pai.options.beforeLoad!({ location: { href: "/financial" } } as never);
  } catch (lancado) {
    return lancado;
  }
}

describe("guarda de papel de _authenticated", () => {
  beforeEach(() => {
    rpc.mockClear();
  });

  it("lê o papel UMA vez e a rota filha decide pelo contexto, sem segundo RPC", async () => {
    rpc.mockResolvedValue({ data: "owner", error: null });

    const contexto = await guardaDoPai();
    expect(contexto).toEqual({ papel: "owner" });

    await Financeiro.options.beforeLoad!({ context: contexto } as never);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("papel fora do exigido na filha nega pelo contexto, ainda sem segundo RPC", async () => {
    rpc.mockResolvedValue({ data: "member", error: null });

    const contexto = await guardaDoPai();
    let lancado: unknown;
    try {
      await Financeiro.options.beforeLoad!({ context: contexto } as never);
    } catch (e) {
      lancado = e;
    }
    expect(lancado).toMatchObject({
      options: { to: "/acesso-negado", search: { exigido: "owner" } },
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("banco respondendo null vai para /conta-pendente sem afirmar causa", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await guardaDoPai()).toMatchObject({ options: { to: "/conta-pendente", search: {} } });
  });

  it("RPC falhando vai para /conta-pendente?motivo=falha, nunca para acesso-negado", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "57P01", message: "o banco caiu" } });
    expect(await guardaDoPai()).toMatchObject({
      options: { to: "/conta-pendente", search: { motivo: "falha" } },
    });
  });
});
