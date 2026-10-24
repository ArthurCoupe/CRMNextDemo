import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../api/clients.repository", () => ({
  apagarCliente: vi.fn(),
  atualizarDadosDoCliente: vi.fn(),
  criarCliente: vi.fn(),
  listarGanhasSemContrato: vi.fn(),
  definirAssinatura: vi.fn(),
  definirPastaDoDrive: vi.fn(),
  definirConfidencialidade: vi.fn(),
  definirResponsavel: vi.fn(),
  definirStatusDoCliente: vi.fn(),
  desfazerFechamento: vi.fn(),
  corrigirDataDoStatus: vi.fn(),
  listarCorrecoesDeData: vi.fn(),
  listarClientes: vi.fn(),
  listarResponsaveisPossiveis: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/contracts/hooks/use-contracts", () => ({
  chavesDeContratos: { lista: ["contracts"], clientes: ["contracts", "clientes-para-selecao"] },
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

const {
  apagarCliente,
  atualizarDadosDoCliente,
  corrigirDataDoStatus,
  criarCliente,
  definirAssinatura,
  definirStatusDoCliente,
  desfazerFechamento,
  listarCorrecoesDeData,
  listarGanhasSemContrato,
} = await import("../api/clients.repository");
const { toast } = await import("sonner");
const {
  chavesDeClientes,
  useApagarCliente,
  useAtualizarDadosDoCliente,
  useCorrecoesDeData,
  useCorrigirDataDoStatus,
  useCriarCliente,
  useDesfazerFechamento,
  useGanhasSemContrato,
  useDefinirAssinatura,
  useDefinirStatusDoCliente,
} = await import("./use-clients");

beforeEach(() => {
  vi.clearAllMocks();
});

function envolver(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe("erro da ficha avisa e invalida a raiz mesmo com o bloco desmontado", () => {
  const CLIENTE = "cliente-1";

  type Caso = {
    hook: string;
    useHook: () => { mutate: (variaveis: never) => void };
    repo: Mock;
    variaveis: unknown;
    erro: string;
    fallback: string;
  };
  const CASOS: Caso[] = [
    {
      hook: "useAtualizarDadosDoCliente",
      useHook: () => useAtualizarDadosDoCliente(),
      repo: vi.mocked(atualizarDadosDoCliente),
      variaveis: { id: CLIENTE, campos: { nome: "" } },
      erro: "O nome do cliente não pode ficar em branco.",
      fallback: "Não foi possível salvar.",
    },
    {
      hook: "useDefinirAssinatura",
      useHook: () => useDefinirAssinatura(),
      repo: vi.mocked(definirAssinatura),
      variaveis: { id: CLIENTE, data: "2026-09-01" },
      erro: "Você não pode editar a data de assinatura deste cliente.",
      fallback: "Não foi possível salvar a data.",
    },
    {
      hook: "useDefinirStatusDoCliente",
      useHook: () => useDefinirStatusDoCliente(),
      repo: vi.mocked(definirStatusDoCliente),
      variaveis: { id: CLIENTE, status: "paused" },
      erro: "Você não pode mudar o status deste cliente.",
      fallback: "Não foi possível mudar o status.",
    },
    {
      hook: "useCorrigirDataDoStatus",
      useHook: () => useCorrigirDataDoStatus(),
      repo: vi.mocked(corrigirDataDoStatus),
      variaveis: { id: CLIENTE, campo: "paused_at", data: "2026-09-01" },
      erro: "Só o owner corrige a data de pausa ou de encerramento.",
      fallback: "Não foi possível corrigir a data.",
    },
  ];

  it.each(CASOS)(
    "🔴 $hook: desmontado antes da recusa → um toast com a frase e raiz invalidada",
    async ({ useHook, repo, variaveis, erro }) => {
      let rejeitar: ((e: Error) => void) | undefined;
      repo.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejeitar = reject;
          }),
      );
      const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
      const invalidar = vi.spyOn(qc, "invalidateQueries");
      const { result, unmount } = renderHook(useHook, { wrapper: envolver(qc) });

      (result.current.mutate as (v: unknown) => void)(variaveis);
      await waitFor(() => expect(repo).toHaveBeenCalledTimes(1));
      unmount();
      expect(rejeitar).toBeDefined();
      rejeitar?.(new Error(erro));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(erro));
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(invalidar).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: chavesDeClientes.raiz }),
      );
    },
  );

  it.each(CASOS)(
    "$hook: erro SEM Error (objeto cru do fetch) cai no fallback da tela, e ainda invalida",
    async ({ useHook, repo, variaveis, fallback }) => {
      repo.mockRejectedValueOnce({ message: "Failed to fetch", code: "" });
      const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
      const invalidar = vi.spyOn(qc, "invalidateQueries");
      const { result } = renderHook(useHook, { wrapper: envolver(qc) });

      (result.current.mutate as (v: unknown) => void)(variaveis);
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(fallback));

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(invalidar).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: chavesDeClientes.raiz }),
      );
    },
  );

  it("sucesso: nenhum toast, raiz invalidada", async () => {
    vi.mocked(atualizarDadosDoCliente).mockResolvedValueOnce(undefined);
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useAtualizarDadosDoCliente(), { wrapper: envolver(qc) });

    result.current.mutate({ id: CLIENTE, campos: { nome: "Novo nome" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.error).not.toHaveBeenCalled();
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeClientes.raiz });
  });
});

describe("useApagarCliente", () => {
  function montar() {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useApagarCliente(), { wrapper: envolver(qc) });
    return { result, invalidar };
  }

  it("invalida as onze árvores e o toast diz quantos contratos saíram", async () => {
    vi.mocked(apagarCliente).mockResolvedValueOnce({
      contratosApagados: 1,
      jornadasApagadas: 1,
      postsApagados: 4,
    });
    const { result, invalidar } = montar();

    result.current.mutate("cliente-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apagarCliente).toHaveBeenCalledWith("cliente-1");
    const chaves = invalidar.mock.calls.map(([filtro]) => filtro?.queryKey);
    expect(chaves).toEqual(
      expect.arrayContaining([
        ["clients"],
        ["contracts"],
        ["opportunities"],
        ["resultado"],
        ["onboarding"],
        ["content"],
        ["tasks"],
        ["reunioes"],
        ["financial"],
        ["fiscal"],
        ["gastos"],
      ]),
    );
    expect(toast.success).toHaveBeenCalledWith("Cliente apagado, com 1 contrato.");
  });

  it("cliente sem contrato: o toast não inventa contagem", async () => {
    vi.mocked(apagarCliente).mockResolvedValueOnce({
      contratosApagados: 0,
      jornadasApagadas: 0,
      postsApagados: 0,
    });
    const { result } = montar();

    result.current.mutate("cliente-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalledWith("Cliente apagado.");
  });

  it("a recusa vira toast de erro e nada é invalidado como se tivesse apagado", async () => {
    vi.mocked(apagarCliente).mockRejectedValueOnce(new Error("Apagar cliente é do owner."));
    const { result, invalidar } = montar();

    result.current.mutate("cliente-1");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Apagar cliente é do owner.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(invalidar).not.toHaveBeenCalled();
  });
});

describe("D-071: ganhas sem contrato, criar sem ligar e desfazer por venda", () => {
  function montarCom<T>(usar: () => T) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(usar, { wrapper: envolver(qc) });
    return { result, invalidar };
  }
  const chavesInvalidadas = (invalidar: Mock) =>
    invalidar.mock.calls.map(([filtro]) => (filtro as { queryKey?: unknown })?.queryKey);

  it("a lista de ganhas sem contrato só é lida quando habilitada (owner)", async () => {
    vi.mocked(listarGanhasSemContrato).mockResolvedValue([]);

    const desligada = montarCom(() => useGanhasSemContrato(false));
    await waitFor(() => expect(desligada.result.current.fetchStatus).toBe("idle"));
    expect(listarGanhasSemContrato).not.toHaveBeenCalled();

    const ligada = montarCom(() => useGanhasSemContrato(true));
    await waitFor(() => expect(ligada.result.current.isSuccess).toBe(true));
    expect(listarGanhasSemContrato).toHaveBeenCalledTimes(1);
    expect(chavesDeClientes.ganhasSemContrato).toEqual(["clients", "ganhas-sem-contrato"]);
  });

  it("criar refaz clientes e a lista de clientes do contrato, e não toca o Pipeline", async () => {
    vi.mocked(criarCliente).mockResolvedValue("novo");
    const { result, invalidar } = montarCom(() => useCriarCliente());

    result.current.mutate({
      nome: "Acme",
      segmento: null,
      nicho: null,
      contatoNome: null,
      contatoEmail: null,
      contatoTelefone: null,
      responsavelId: null,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const chaves = chavesInvalidadas(invalidar);
    expect(chaves).toEqual(
      expect.arrayContaining([["clients"], ["contracts", "clientes-para-selecao"]]),
    );
    expect(chaves).not.toContainEqual(["opportunities"]);
  });

  it("desfazer manda a venda e refaz clientes, contratos, Pipeline, resultado e propostas", async () => {
    vi.mocked(desfazerFechamento).mockResolvedValue({
      contratosApagados: 1,
      estagioRestaurado: "r2",
    });
    const { result, invalidar } = montarCom(() => useDesfazerFechamento());

    result.current.mutate({ vendaId: "venda-1", motivo: "fechei a errada" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(desfazerFechamento).toHaveBeenCalledWith("venda-1", "fechei a errada");
    expect(chavesInvalidadas(invalidar)).toEqual(
      expect.arrayContaining([
        ["clients"],
        ["contracts"],
        ["opportunities"],
        ["resultado"],
        ["proposals"],
      ]),
    );
    expect(toast.success).toHaveBeenCalledWith(
      'Fechamento desfeito: 1 contrato apagado e a venda voltou para "R2 · Proposta".',
    );
  });
});

describe("D-069 (C8): corrigir a data de pausa ou de encerramento", () => {
  const CLIENTE = "cliente-1";
  const novoQc = () =>
    new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  it("🔴 a mutação segue pendente até a releitura terminar, e só então é sucesso", async () => {
    vi.mocked(corrigirDataDoStatus).mockResolvedValueOnce(undefined);
    const qc = novoQc();
    let terminarARelitura: () => void = () => {};
    const invalidar = vi.spyOn(qc, "invalidateQueries").mockImplementation(
      () =>
        new Promise<void>((resolver) => {
          terminarARelitura = resolver;
        }),
    );
    const { result } = renderHook(() => useCorrigirDataDoStatus(), { wrapper: envolver(qc) });

    result.current.mutate({ id: CLIENTE, campo: "churned_at", data: "2026-08-15" });
    await waitFor(() => expect(invalidar).toHaveBeenCalledTimes(1));

    expect(corrigirDataDoStatus).toHaveBeenCalledWith(CLIENTE, "churned_at", "2026-08-15");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDeClientes.raiz });
    expect(result.current.isPending).toBe(true);
    expect(result.current.isSuccess).toBe(false);

    terminarARelitura();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a raiz de clientes cobre a chave do rastro (prefixo)", () => {
    expect(chavesDeClientes.correcoes("c-1")).toEqual([
      ...chavesDeClientes.raiz,
      "correcoes",
      "c-1",
    ]);
  });

  it("useCorrecoesDeData: `null` não lê nada; com o id, lê o rastro daquele cliente", async () => {
    vi.mocked(listarCorrecoesDeData).mockResolvedValue([]);

    const desligada = renderHook(() => useCorrecoesDeData(null), { wrapper: envolver(novoQc()) });
    await waitFor(() => expect(desligada.result.current.fetchStatus).toBe("idle"));
    expect(listarCorrecoesDeData).not.toHaveBeenCalled();

    const ligada = renderHook(() => useCorrecoesDeData(CLIENTE), { wrapper: envolver(novoQc()) });
    await waitFor(() => expect(ligada.result.current.isSuccess).toBe(true));
    expect(listarCorrecoesDeData).toHaveBeenCalledWith(CLIENTE);
  });
});
