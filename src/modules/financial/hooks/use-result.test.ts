import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { brl } from "@/shared/lib/format";

vi.mock("../api/result.repository", () => ({
  lerResultadoPorBu: vi.fn(),
  lerResultadoConsolidado: vi.fn(),
  lerCustoPorBu: vi.fn(),
  lerHistorico: vi.fn(),
  lerBreakEven: vi.fn(),
  lerMetaDeMrr: vi.fn(),
  lerEncerramentos: vi.fn(),
  definirEntrega: vi.fn(async () => undefined),
  reverterEncerramento: vi.fn(async () => undefined),
  regravarMes: vi.fn(),
}));

vi.mock("../api/financial.repository", () => ({
  lerMrrPorUnidade: vi.fn(),
  lerProjetosAtrasados: vi.fn(),
  lerReceitaPorFrente: vi.fn(),
  lerTcvPorUnidade: vi.fn(),
}));

vi.mock("../api/fiscal.repository", () => ({
  definirAliquota: vi.fn(),
  definirTaxaDeParcelamento: vi.fn(),
  definirTaxasDoMeio: vi.fn(),
  lerConfiguracaoFiscal: vi.fn(),
  lerLiquidoPorContrato: vi.fn(),
  lerLiquidoTotal: vi.fn(),
  lerTabelaDeParcelamento: vi.fn(),
  lerTaxasPorMeio: vi.fn(),
}));

vi.mock("../api/expenses.repository", () => ({
  atualizarDespesa: vi.fn(),
  criarDespesa: vi.fn(),
  definirSituacaoDaDespesa: vi.fn(),
  lerDespesasEfetivas: vi.fn(),
  lerProjecaoDeCusto: vi.fn(),
  lerQuedaDeCusto: vi.fn(),
  listarAgrupadores: vi.fn(),
  listarDespesasCadastradas: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { chavesDeResultado, useDefinirEntrega, useRegravarMes, useReverterEncerramento } =
  await import("./use-result");
const { regravarMes } = await import("../api/result.repository");
const { toast } = await import("sonner");
const { chavesDoFinanceiro } = await import("./use-financial");
const { chavesFiscais } = await import("./use-fiscal");
const { chavesDeGastos } = await import("./use-expenses");

beforeEach(() => {
  vi.clearAllMocks();
});

function clienteDeConsultas() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function montar<T>(hook: () => T, qc: QueryClient) {
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  });
}

function semear(qc: QueryClient, chave: readonly unknown[]) {
  qc.setQueryData(chave as unknown[], { seed: true });
}

const foiInvalidada = (qc: QueryClient, chave: readonly unknown[]) =>
  qc.getQueryState(chave as unknown[])?.isInvalidated === true;

const CHAVE_DE_CONTROLE = ["opportunities"] as const;

describe("useDefinirEntrega: invalida a raiz certa do financeiro (FIN-2)", () => {
  it('🔴 derruba chavesDeResultado.raiz e chavesDoFinanceiro.raiz — não ["financeiro"]', async () => {
    const qc = clienteDeConsultas();
    semear(qc, chavesDeResultado.raiz);
    semear(qc, chavesDoFinanceiro.projetosAtrasados);
    semear(qc, CHAVE_DE_CONTROLE);

    const { result } = montar(() => useDefinirEntrega(), qc);
    result.current.mutate({ contractId: "c1", data: "2026-09-12" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(foiInvalidada(qc, chavesDeResultado.raiz)).toBe(true);
    expect(foiInvalidada(qc, chavesDoFinanceiro.projetosAtrasados)).toBe(true);
    expect(foiInvalidada(qc, CHAVE_DE_CONTROLE)).toBe(false);
  });

  it("desmarcar (sem `data`) invalida as mesmas duas raízes", async () => {
    const qc = clienteDeConsultas();
    semear(qc, chavesDeResultado.raiz);
    semear(qc, chavesDoFinanceiro.projetosAtrasados);

    const { result } = montar(() => useDefinirEntrega(), qc);
    result.current.mutate({ contractId: "c1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(foiInvalidada(qc, chavesDeResultado.raiz)).toBe(true);
    expect(foiInvalidada(qc, chavesDoFinanceiro.projetosAtrasados)).toBe(true);
  });
});

describe("useReverterEncerramento: invalida resultado, financeiro, fiscal e gastos (FIN-2)", () => {
  it('🔴 derruba as quatro raízes reais — não ["financeiro"]', async () => {
    const qc = clienteDeConsultas();
    semear(qc, chavesDeResultado.raiz);
    semear(qc, chavesDoFinanceiro.projetosAtrasados);
    semear(qc, chavesDoFinanceiro.mrrPorUnidade);
    semear(qc, chavesFiscais.liquidoPorContrato);
    semear(qc, chavesDeGastos.raiz);
    semear(qc, CHAVE_DE_CONTROLE);

    const { result } = montar(() => useReverterEncerramento(), qc);
    result.current.mutate("c1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(foiInvalidada(qc, chavesDeResultado.raiz)).toBe(true);
    expect(foiInvalidada(qc, chavesDoFinanceiro.projetosAtrasados)).toBe(true);
    expect(foiInvalidada(qc, chavesDoFinanceiro.mrrPorUnidade)).toBe(true);
    expect(foiInvalidada(qc, chavesFiscais.liquidoPorContrato)).toBe(true);
    expect(foiInvalidada(qc, chavesDeGastos.raiz)).toBe(true);
    expect(foiInvalidada(qc, CHAVE_DE_CONTROLE)).toBe(false);
  });
});

describe("useRegravarMes (D-069, C1)", () => {
  it("regravou: invalida só a raiz do resultado e diz o antes e o depois", async () => {
    vi.mocked(regravarMes).mockResolvedValue({ regravou: true, antes: 1000, depois: 1200 });
    const qc = clienteDeConsultas();
    semear(qc, chavesDeResultado.raiz);
    semear(qc, chavesDoFinanceiro.mrrPorUnidade);
    semear(qc, CHAVE_DE_CONTROLE);

    const { result } = montar(() => useRegravarMes(), qc);
    result.current.mutate({ mes: "2026-08-01", motivo: "Contrato corrigido" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(regravarMes).toHaveBeenCalledWith("2026-08-01", "Contrato corrigido");
    expect(foiInvalidada(qc, chavesDeResultado.raiz)).toBe(true);
    expect(foiInvalidada(qc, chavesDoFinanceiro.mrrPorUnidade)).toBe(false);
    expect(foiInvalidada(qc, CHAVE_DE_CONTROLE)).toBe(false);
    expect(toast.success).toHaveBeenCalledWith(
      `Mês regravado. Resultado de ${brl(1000)} para ${brl(1200)}.`,
    );
  });

  it("isPending segue verdadeiro até a invalidação terminar", async () => {
    vi.mocked(regravarMes).mockResolvedValue({ regravou: true, antes: 1000, depois: 1200 });
    const qc = clienteDeConsultas();
    let liberar: () => void = () => undefined;
    vi.spyOn(qc, "invalidateQueries").mockReturnValue(
      new Promise<void>((resolver) => {
        liberar = resolver;
      }),
    );

    const { result } = montar(() => useRegravarMes(), qc);
    result.current.mutate({ mes: "2026-08-01", motivo: "x" });
    await waitFor(() => expect(qc.invalidateQueries).toHaveBeenCalled());
    expect(result.current.isPending).toBe(true);

    liberar();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("mês sem snapshot avisa e não diz que regravou", async () => {
    vi.mocked(regravarMes).mockResolvedValue({ regravou: false });
    const { result } = montar(() => useRegravarMes(), clienteDeConsultas());
    result.current.mutate({ mes: "2026-08-01", motivo: "x" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Este mês não tem snapshot para regravar.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("recusa de permissão vira frase em português", async () => {
    vi.mocked(regravarMes).mockRejectedValue(
      Object.assign(new Error("forbidden"), { code: "42501" }),
    );
    const { result } = montar(() => useRegravarMes(), clienteDeConsultas());
    result.current.mutate({ mes: "2026-08-01", motivo: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith(
      "O mês NÃO foi regravado. Só o owner, com o segundo fator, regrava mês fechado.",
    );
  });

  it("outro erro mostra a mensagem dele (controle)", async () => {
    vi.mocked(regravarMes).mockRejectedValue(new Error("Falhou a leitura."));
    const { result } = montar(() => useRegravarMes(), clienteDeConsultas());
    result.current.mutate({ mes: "2026-08-01", motivo: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("O mês NÃO foi regravado. Falhou a leitura.");
  });

  it("no erro relê a tabela: a RPC pode ter gravado antes de a resposta se perder", async () => {
    vi.mocked(regravarMes).mockRejectedValue(new Error("Failed to fetch"));
    const qc = clienteDeConsultas();
    semear(qc, chavesDeResultado.raiz);
    semear(qc, CHAVE_DE_CONTROLE);

    const { result } = montar(() => useRegravarMes(), qc);
    result.current.mutate({ mes: "2026-08-01", motivo: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(foiInvalidada(qc, chavesDeResultado.raiz)).toBe(true);
    expect(foiInvalidada(qc, CHAVE_DE_CONTROLE)).toBe(false);
  });
});
