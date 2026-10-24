import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client.v2", () => ({
  supabaseV2: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const { definirEntrega, regravarMes } = await import("./result.repository");

const CONTRATO = "d0000000-0000-4000-8000-000000000002";

describe("definirEntrega", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });

  it("com data, MARCA — e manda `p_data`", async () => {
    await definirEntrega(CONTRATO, "2026-08-23");

    expect(rpc).toHaveBeenCalledWith("definir_entrega", {
      p_contract_id: CONTRATO,
      p_data: "2026-08-23",
    });
  });

  it("sem data, DESMARCA — e o argumento fica AUSENTE, não nulo", async () => {
    await definirEntrega(CONTRATO);

    const [, argumentos] = rpc.mock.calls[0] as [string, Record<string, unknown>];

    expect(Object.hasOwn(argumentos, "p_data")).toBe(false);
    expect(argumentos).toEqual({ p_contract_id: CONTRATO });
  });

  it("propaga o erro da RPC — a falha não pode virar sucesso silencioso", async () => {
    rpc.mockResolvedValue({ error: { message: "forbidden", code: "42501" } });

    await expect(definirEntrega(CONTRATO, "2026-08-23")).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("regravarMes (D-069, C1)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("chama regravar_snapshot com o mês e o motivo, e devolve o antes e o depois", async () => {
    rpc.mockResolvedValue({
      data: [{ regravou: true, resultado_antes: 1000, resultado_depois: 1200 }],
      error: null,
    });
    await expect(regravarMes("2026-08-01", "Contrato corrigido")).resolves.toEqual({
      regravou: true,
      antes: 1000,
      depois: 1200,
    });
    expect(rpc).toHaveBeenCalledWith("regravar_snapshot", {
      p_ref_month: "2026-08-01",
      p_motivo: "Contrato corrigido",
    });
  });

  it("mês sem snapshot devolve regravou false", async () => {
    rpc.mockResolvedValue({
      data: [{ regravou: false, resultado_antes: null, resultado_depois: null }],
      error: null,
    });
    await expect(regravarMes("2026-08-01", "x")).resolves.toEqual({ regravou: false });
  });

  it("resposta sem linha não vira sucesso", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(regravarMes("2026-08-01", "x")).rejects.toThrow(
      "Resposta inesperada de regravar_snapshot: nenhuma linha.",
    );
  });

  it("propaga a recusa com o code", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden", code: "42501" } });
    await expect(regravarMes("2026-08-01", "x")).rejects.toMatchObject({ code: "42501" });
  });
});
