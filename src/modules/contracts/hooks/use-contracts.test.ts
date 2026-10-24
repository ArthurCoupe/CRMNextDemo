import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/contracts.repository", () => ({
  apagarContrato: vi.fn(async () => undefined),
  listarClientesParaSelecao: vi.fn(),
  listarContratos: vi.fn(),
  listarProdutosAtivos: vi.fn(),
  listarVendasParaContrato: vi.fn(),
  salvarContrato: vi.fn(async () => "contrato-1"),
}));

vi.mock("../../financial/api/financial.repository", () => ({
  lerMrrPorUnidade: vi.fn(),
  lerProjetosAtrasados: vi.fn(),
  lerReceitaPorFrente: vi.fn(),
  lerTcvPorUnidade: vi.fn(),
}));

vi.mock("../../financial/api/fiscal.repository", () => ({
  definirAliquota: vi.fn(),
  definirTaxaDeParcelamento: vi.fn(),
  definirTaxasDoMeio: vi.fn(),
  lerConfiguracaoFiscal: vi.fn(),
  lerLiquidoPorContrato: vi.fn(),
  lerLiquidoTotal: vi.fn(),
  lerTabelaDeParcelamento: vi.fn(),
  lerTaxasPorMeio: vi.fn(),
}));

vi.mock("../../financial/api/expenses.repository", () => ({
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

vi.mock("../../clients/api/clients.repository", () => ({
  apagarCliente: vi.fn(),
  atualizarDadosDoCliente: vi.fn(),
  criarCliente: vi.fn(),
  definirAssinatura: vi.fn(),
  definirConfidencialidade: vi.fn(),
  definirPastaDoDrive: vi.fn(),
  definirResponsavel: vi.fn(),
  definirStatusDoCliente: vi.fn(),
  desfazerFechamento: vi.fn(),
  listarClientes: vi.fn(),
  listarGanhasSemContrato: vi.fn(),
  listarResponsaveisPossiveis: vi.fn(),
}));
vi.mock("@/modules/onboarding/hooks/use-onboarding", () => ({
  chavesDoOnboarding: { raiz: ["onboarding"] },
}));
vi.mock("@/modules/financial/hooks/use-result", () => ({
  chavesDeResultado: { raiz: ["resultado"] },
}));
vi.mock("@/modules/pipeline/hooks/use-pipeline", () => ({
  chavesDoPipeline: { raiz: ["opportunities"] },
}));
vi.mock("@/modules/content/hooks/use-content", () => ({
  chavesDoConteudo: { raiz: ["content"] },
}));
vi.mock("@/modules/tasks/hooks/use-tasks", () => ({
  chavesDeTarefa: { raiz: ["tasks"] },
}));
vi.mock("@/modules/meetings/hooks/use-meetings", () => ({
  chavesDeReunioes: { raiz: ["reunioes"] },
}));

const { chavesDeContratos, useApagarContrato, useSaveContract } = await import("./use-contracts");
const { chavesDeClientes } = await import("../../clients/hooks/use-clients");
const { apagarContrato } = await import("../api/contracts.repository");
const { toast } = await import("sonner");
const { chavesDoFinanceiro } = await import("../../financial/hooks/use-financial");
const { chavesFiscais } = await import("../../financial/hooks/use-fiscal");
const { chavesDeGastos } = await import("../../financial/hooks/use-expenses");

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

const DADOS = {
  clienteId: "cliente-1",
  nome: "Contrato Teste",
  tipo: "mrr" as const,
  linhaDeNegocio: "sistemas" as const,
  itens: [],
  inicio: "2026-09-20",
  oportunidadeId: null,
};

describe("useSaveContract: invalida contratos, opportunities e as três raízes do financeiro ((f))", () => {
  it("🔴 derruba as cinco chaves, com as três do financeiro que faltavam", async () => {
    const qc = clienteDeConsultas();
    semear(qc, chavesDeContratos.lista);
    semear(qc, ["opportunities"]);
    semear(qc, chavesDoFinanceiro.raiz);
    semear(qc, chavesFiscais.raiz);
    semear(qc, chavesDeGastos.raiz);
    semear(qc, ["proposals", "da-oportunidade", "venda-1"]);

    const { result } = montar(() => useSaveContract(), qc);
    result.current.mutate(DADOS);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(foiInvalidada(qc, chavesDeContratos.lista)).toBe(true);
    expect(foiInvalidada(qc, ["opportunities"])).toBe(true);
    expect(foiInvalidada(qc, chavesDoFinanceiro.raiz)).toBe(true);
    expect(foiInvalidada(qc, chavesFiscais.raiz)).toBe(true);
    expect(foiInvalidada(qc, chavesDeGastos.raiz)).toBe(true);
    expect(foiInvalidada(qc, ["proposals", "da-oportunidade", "venda-1"])).toBe(true);
  });
});

describe("useSaveContract: invalida a raiz de Clientes (A1.2)", () => {
  it("derruba ['clients', ...] e não derruba chave de fora", async () => {
    const qc = clienteDeConsultas();
    semear(qc, chavesDeClientes.lista({}));
    semear(qc, ["outra-chave"]);

    const { result } = montar(() => useSaveContract(), qc);
    result.current.mutate(DADOS);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(foiInvalidada(qc, chavesDeClientes.lista({}))).toBe(true);
    expect(foiInvalidada(qc, ["outra-chave"])).toBe(false);
  });
});

describe("useApagarContrato", () => {
  it("apaga pelo id, derruba as chaves de salvar, o Resultado e o 'a criar' das propostas, e avisa", async () => {
    const qc = clienteDeConsultas();
    semear(qc, chavesDeContratos.lista);
    semear(qc, ["opportunities"]);
    semear(qc, chavesDoFinanceiro.raiz);
    semear(qc, chavesFiscais.raiz);
    semear(qc, chavesDeGastos.raiz);
    semear(qc, ["resultado"]);
    semear(qc, ["proposals", "a-criar", "cliente-1"]);
    semear(qc, chavesDeClientes.lista({}));

    const { result } = montar(() => useApagarContrato(), qc);
    result.current.mutate("contrato-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apagarContrato).toHaveBeenCalledWith("contrato-1");
    expect(foiInvalidada(qc, chavesDeClientes.lista({}))).toBe(true);
    expect(foiInvalidada(qc, chavesDeContratos.lista)).toBe(true);
    expect(foiInvalidada(qc, ["opportunities"])).toBe(true);
    expect(foiInvalidada(qc, chavesDoFinanceiro.raiz)).toBe(true);
    expect(foiInvalidada(qc, chavesFiscais.raiz)).toBe(true);
    expect(foiInvalidada(qc, chavesDeGastos.raiz)).toBe(true);
    expect(foiInvalidada(qc, ["resultado"])).toBe(true);
    expect(foiInvalidada(qc, ["proposals", "a-criar", "cliente-1"])).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Contrato apagado.");
  });

  it("🔴 a ligação pendente de proposta que apontava para o contrato apagado sai do mapa", async () => {
    const CHAVE = ["ligacoes-pendentes-de-proposta"];
    const qc = clienteDeConsultas();
    qc.setQueryData(CHAVE, { "proposta-1": "contrato-1", "proposta-2": "contrato-9" });

    const { result } = montar(() => useApagarContrato(), qc);
    result.current.mutate("contrato-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(qc.getQueryData(CHAVE)).toEqual({ "proposta-2": "contrato-9" });
  });

  it("🔴 a recusa vira toast com a frase do repositório, e nada é derrubado", async () => {
    vi.mocked(apagarContrato).mockRejectedValueOnce(
      new Error("Nada foi apagado: só o owner apaga contrato."),
    );
    const qc = clienteDeConsultas();
    semear(qc, chavesDeContratos.lista);

    const { result } = montar(() => useApagarContrato(), qc);
    result.current.mutate("contrato-1");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Nada foi apagado: só o owner apaga contrato.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(foiInvalidada(qc, chavesDeContratos.lista)).toBe(false);
  });
});
