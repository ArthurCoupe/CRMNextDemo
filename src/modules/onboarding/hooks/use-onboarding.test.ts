import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/onboarding.repository", () => ({
  apagarJornada: vi.fn(),
  definirPapel: vi.fn(),
  editarEtapaDaJornada: vi.fn(),
  editarItemDaJornada: vi.fn(),
  iniciarJornada: vi.fn(),
  lerClientesComJornada: vi.fn(),
  lerJornada: vi.fn(),
  lerPapeis: vi.fn(),
  lerPapeisExigidosPeloMetodo: vi.fn(),
  liberarEtapa: vi.fn(),
  marcarItem: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/tasks/hooks/use-tasks", () => ({ chavesDeTarefa: { raiz: ["tasks"] } }));

const { apagarJornada, editarEtapaDaJornada, editarItemDaJornada, iniciarJornada } =
  await import("../api/onboarding.repository");
const { toast } = await import("sonner");
const {
  useApagarJornada,
  useEditarEtapaDaJornada,
  useEditarItemDaJornada,
  useIniciarJornada,
  chavesDoOnboarding,
} = await import("./use-onboarding");

beforeEach(() => {
  vi.clearAllMocks();
});

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  const { result } = renderHook(() => useIniciarJornada(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  });
  return { result, invalidar };
}

describe("useIniciarJornada: erro invalida a lista de clientes, não só avisa", () => {
  it("🔴 jornada duplicada (23505 traduzido) derruba o cache de clientes e avisa", async () => {
    vi.mocked(iniciarJornada).mockRejectedValueOnce(
      new Error("Este cliente já tem jornada aberta."),
    );
    const { result, invalidar } = montar();

    result.current.mutate("c1");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoOnboarding.clientes });
    expect(toast.error).toHaveBeenCalledWith("Este cliente já tem jornada aberta.");
  });

  it("🔴 rejeição SEM Error (objeto cru do fetch) cai no fallback da tela, e ainda invalida", async () => {
    vi.mocked(iniciarJornada).mockRejectedValueOnce({ message: "", code: "" });
    const { result, invalidar } = montar();

    result.current.mutate("c1");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível abrir a jornada.");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoOnboarding.clientes });
  });

  it("sucesso invalida a raiz do onboarding e avisa que a jornada abriu", async () => {
    vi.mocked(iniciarJornada).mockResolvedValueOnce("j-nova");
    const { result, invalidar } = montar();

    result.current.mutate("c1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoOnboarding.raiz });
    expect(toast.success).toHaveBeenCalledWith("Jornada aberta. O método foi copiado para ela");
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useApagarJornada", () => {
  function montarApagar() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(chavesDoOnboarding.clientes, [
      { id: "c1", nome: "Acme", jornadaId: "j1", jornadaConcluida: false, donoId: null },
      { id: "c2", nome: "Beta", jornadaId: "j2", jornadaConcluida: false, donoId: null },
    ]);
    qc.setQueryData(chavesDoOnboarding.jornada("j1"), { id: "j1" });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useApagarJornada(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children),
    });
    return { qc, result, invalidar };
  }

  it("sucesso zera a jornada do cliente no cache, tira a jornada apagada e invalida onboarding e tarefas", async () => {
    vi.mocked(apagarJornada).mockResolvedValueOnce(2);
    const { qc, result, invalidar } = montarApagar();

    result.current.mutate("j1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apagarJornada).toHaveBeenCalledWith("j1");
    expect(qc.getQueryData(chavesDoOnboarding.clientes)).toEqual([
      { id: "c1", nome: "Acme", jornadaId: null, jornadaConcluida: false, donoId: null },
      { id: "c2", nome: "Beta", jornadaId: "j2", jornadaConcluida: false, donoId: null },
    ]);
    expect(qc.getQueryData(chavesDoOnboarding.jornada("j1"))).toBeUndefined();
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoOnboarding.raiz });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["tasks"] });
    expect(toast.success).toHaveBeenCalledWith("Jornada apagada, com 2 cartões do quadro.");
  });

  it("sem cartão no quadro, o aviso não fala de cartão", async () => {
    vi.mocked(apagarJornada).mockResolvedValueOnce(0);
    const { result } = montarApagar();

    result.current.mutate("j1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalledWith("Jornada apagada.");
  });

  it("erro (já apagada em outra tela) invalida o onboarding, avisa e não zera nada", async () => {
    vi.mocked(apagarJornada).mockRejectedValueOnce(
      new Error("Jornada não encontrada. Ela pode já ter sido apagada em outra tela."),
    );
    const { qc, result, invalidar } = montarApagar();

    result.current.mutate("j1");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoOnboarding.raiz });
    expect(toast.error).toHaveBeenCalledWith(
      "Jornada não encontrada. Ela pode já ter sido apagada em outra tela.",
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(
      (qc.getQueryData(chavesDoOnboarding.clientes) as { jornadaId: string | null }[])[0].jornadaId,
    ).toBe("j1");
  });
});

describe("editar item e etapa da jornada (entrega B)", () => {
  function montarEdicao<T>(usar: () => T) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(usar, {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children),
    });
    const seguradas = new Map<string, () => void>();
    function segurarReleituras() {
      invalidar.mockImplementation(
        (filtros) =>
          new Promise<void>((resolve) => {
            seguradas.set(String(filtros?.queryKey?.[0]), resolve);
          }),
      );
    }
    const soltar = (raiz: string) => seguradas.get(raiz)?.();
    return { result, invalidar, segurarReleituras, soltar };
  }
  const esperar = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
  const CAMPOS_DO_ITEM = { titulo: "Kickoff", prazoEmDias: 5, papel: "Design" };
  const CAMPOS_DA_ETAPA = { descricao: "Nova", responsavel: "AM" };

  it("item: no sucesso relê a jornada e o quadro, e avisa", async () => {
    vi.mocked(editarItemDaJornada).mockResolvedValueOnce(undefined);
    const { result, invalidar } = montarEdicao(() => useEditarItemDaJornada());

    result.current.mutate({ itemId: "i1", campos: CAMPOS_DO_ITEM });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(editarItemDaJornada).toHaveBeenCalledWith("i1", CAMPOS_DO_ITEM);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoOnboarding.raiz });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["tasks"] });
    expect(toast.success).toHaveBeenCalledWith("Item atualizado");
  });

  it("item: a mutação só termina depois das duas releituras, a jornada e o quadro", async () => {
    vi.mocked(editarItemDaJornada).mockResolvedValueOnce(undefined);
    const { result, invalidar, segurarReleituras, soltar } = montarEdicao(() =>
      useEditarItemDaJornada(),
    );
    segurarReleituras();

    result.current.mutate({ itemId: "i1", campos: CAMPOS_DO_ITEM });
    await waitFor(() => expect(invalidar).toHaveBeenCalledTimes(2));
    await esperar();
    expect(result.current.isPending).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();

    soltar("onboarding");
    await esperar();
    expect(result.current.isPending).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();

    soltar("tasks");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Item atualizado");
  });

  it("item: no erro mostra a frase do repositório, não avisa sucesso e relê a jornada", async () => {
    vi.mocked(editarItemDaJornada).mockRejectedValueOnce(
      new Error("O prazo do item é um número inteiro de dias, de 0 a 365."),
    );
    const { result, invalidar } = montarEdicao(() => useEditarItemDaJornada());

    result.current.mutate({ itemId: "i1", campos: CAMPOS_DO_ITEM });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith(
      "O prazo do item é um número inteiro de dias, de 0 a 365.",
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoOnboarding.raiz });
  });

  it("item: rejeição sem Error cai no fallback da tela", async () => {
    vi.mocked(editarItemDaJornada).mockRejectedValueOnce({ message: "", code: "" });
    const { result } = montarEdicao(() => useEditarItemDaJornada());

    result.current.mutate({ itemId: "i1", campos: CAMPOS_DO_ITEM });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o item.");
  });

  it("etapa: no sucesso relê só a jornada e avisa", async () => {
    vi.mocked(editarEtapaDaJornada).mockResolvedValueOnce(undefined);
    const { result, invalidar } = montarEdicao(() => useEditarEtapaDaJornada());

    result.current.mutate({ etapaId: "e1", campos: CAMPOS_DA_ETAPA });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(editarEtapaDaJornada).toHaveBeenCalledWith("e1", CAMPOS_DA_ETAPA);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoOnboarding.raiz });
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ["tasks"] });
    expect(toast.success).toHaveBeenCalledWith("Etapa atualizada");
  });

  it("etapa: a mutação só termina depois da releitura da jornada", async () => {
    vi.mocked(editarEtapaDaJornada).mockResolvedValueOnce(undefined);
    const { result, invalidar, segurarReleituras, soltar } = montarEdicao(() =>
      useEditarEtapaDaJornada(),
    );
    segurarReleituras();

    result.current.mutate({ etapaId: "e1", campos: CAMPOS_DA_ETAPA });
    await waitFor(() => expect(invalidar).toHaveBeenCalledTimes(1));
    await esperar();
    expect(result.current.isPending).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();

    soltar("onboarding");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Etapa atualizada");
  });

  it("etapa: rejeição sem Error cai no fallback da tela, e relê a jornada", async () => {
    vi.mocked(editarEtapaDaJornada).mockRejectedValueOnce({ message: "", code: "" });
    const { result, invalidar } = montarEdicao(() => useEditarEtapaDaJornada());

    result.current.mutate({ etapaId: "e1", campos: CAMPOS_DA_ETAPA });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar a etapa.");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chavesDoOnboarding.raiz });
  });
});
