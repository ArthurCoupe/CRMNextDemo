import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NovaTarefa } from "../api/tasks.repository";

vi.mock("../api/tasks.repository", () => ({
  adicionarLink: vi.fn(),
  adicionarParticipantes: vi.fn(),
  apagarTarefa: vi.fn(),
  atualizarLink: vi.fn(),
  atualizarTarefa: vi.fn(),
  criarTarefa: vi.fn(),
  lerCatalogo: vi.fn(),
  lerClientesParaSelecao: vi.fn(),
  lerPessoasDoTime: vi.fn(),
  lerTarefas: vi.fn(),
  moverTarefa: vi.fn(),
  removerLink: vi.fn(),
  removerParticipante: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const {
  adicionarLink,
  adicionarParticipantes,
  atualizarLink,
  criarTarefa,
  moverTarefa,
  removerLink,
  removerParticipante,
} = await import("../api/tasks.repository");
const { toast } = await import("sonner");
const {
  PARTICIPANTES_NAO_SALVOS,
  chavesDeTarefa,
  useAdicionarLink,
  useAdicionarParticipantes,
  useAtualizarLink,
  useCriarTarefa,
  useMoverTarefa,
  useRemoverLink,
  useRemoverParticipante,
} = await import("./use-tasks");

beforeEach(() => {
  vi.clearAllMocks();
});

function montar<T>(usar: () => T) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalida = vi.spyOn(qc, "invalidateQueries");
  const montado = renderHook(usar, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  });
  return { ...montado, invalida };
}

describe("useMoverTarefa: o toast de erro nunca sai vazio", () => {
  it("🔴 rejeição SEM Error (objeto cru do fetch) cai no fallback da tela", async () => {
    vi.mocked(moverTarefa).mockRejectedValueOnce({ message: "", code: "" });
    const { result } = montar(() => useMoverTarefa());

    result.current.mutate({ id: "t1", coluna: "doing" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível mover a tarefa.");
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("Error do repositório mantém a frase dele", async () => {
    vi.mocked(moverTarefa).mockRejectedValueOnce(new Error("Você não pode mover esta tarefa."));
    const { result } = montar(() => useMoverTarefa());

    result.current.mutate({ id: "t1", coluna: "doing" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Você não pode mover esta tarefa.");
  });
});

describe("useCriarTarefa: participantes gravados depois da tarefa (critério 16)", () => {
  const NOVA: NovaTarefa = {
    titulo: "Site da Acme",
    descricao: null,
    categoria: "Site · web",
    tipo: "Desenvolver site",
    responsavelId: null,
    clienteId: null,
    prazo: null,
    prioridade: "media",
    recorrencia: "nenhuma",
    participantes: ["p1"],
  };

  it("🔴 participantes falharam: a tarefa fica, o aviso diz o que fazer, e o formulário fecha", async () => {
    vi.mocked(criarTarefa).mockResolvedValueOnce("t1");
    vi.mocked(adicionarParticipantes).mockRejectedValueOnce(new Error("rede"));
    const onSuccess = vi.fn();
    const { result } = montar(() => useCriarTarefa());

    result.current.mutate(NOVA, { onSuccess });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adicionarParticipantes).toHaveBeenCalledWith("t1", ["p1"]);
    expect(toast.error).toHaveBeenCalledWith(PARTICIPANTES_NAO_SALVOS);
    expect(PARTICIPANTES_NAO_SALVOS).toBe(
      "Tarefa criada, mas os participantes não foram salvos. Abra a tarefa e adicione por lá.",
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("🔴 participantes falharam: a lista é relida mesmo assim, porque a tarefa existe", async () => {
    vi.mocked(criarTarefa).mockResolvedValueOnce("t1");
    vi.mocked(adicionarParticipantes).mockRejectedValueOnce(new Error("rede"));
    const { result, invalida } = montar(() => useCriarTarefa());

    result.current.mutate(NOVA);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ participantesSalvos: false });
    expect(invalida).toHaveBeenCalledTimes(1);
    expect(invalida).toHaveBeenCalledWith({ queryKey: chavesDeTarefa.raiz });
  });

  it("tudo gravado: a lista também é relida (o positivo ao lado)", async () => {
    vi.mocked(criarTarefa).mockResolvedValueOnce("t1");
    vi.mocked(adicionarParticipantes).mockResolvedValueOnce(undefined);
    const { result, invalida } = montar(() => useCriarTarefa());

    result.current.mutate(NOVA);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ participantesSalvos: true });
    expect(invalida).toHaveBeenCalledTimes(1);
    expect(invalida).toHaveBeenCalledWith({ queryKey: chavesDeTarefa.raiz });
  });

  it("tudo gravado: 'Tarefa criada' (o positivo ao lado)", async () => {
    vi.mocked(criarTarefa).mockResolvedValueOnce("t1");
    vi.mocked(adicionarParticipantes).mockResolvedValueOnce(undefined);
    const { result } = montar(() => useCriarTarefa());

    result.current.mutate(NOVA);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalledWith("Tarefa criada");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("sem participantes, a segunda gravação nem acontece", async () => {
    vi.mocked(criarTarefa).mockResolvedValueOnce("t1");
    const { result } = montar(() => useCriarTarefa());

    result.current.mutate({ ...NOVA, participantes: [] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adicionarParticipantes).not.toHaveBeenCalled();
  });

  it("a tarefa não foi criada: erro normal, sem segunda gravação", async () => {
    vi.mocked(criarTarefa).mockRejectedValueOnce({ message: "", code: "" });
    const onSuccess = vi.fn();
    const { result } = montar(() => useCriarTarefa());

    result.current.mutate(NOVA, { onSuccess });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(adicionarParticipantes).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Não foi possível criar a tarefa.");
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("participantes e links: o toast de erro nunca sai vazio (D-066)", () => {
  async function rejeitaCru<V>(
    usar: () => { mutate: (v: V) => void; isError: boolean },
    variaveis: V,
    fallback: string,
  ) {
    const { result } = montar(usar);
    result.current.mutate(variaveis);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith(fallback);
  }

  it("useAdicionarParticipantes", async () => {
    vi.mocked(adicionarParticipantes).mockRejectedValueOnce({ message: "", code: "" });
    await rejeitaCru(
      () => useAdicionarParticipantes(),
      { taskId: "t1", profileIds: ["p1"] },
      "Não foi possível incluir o participante.",
    );
  });

  it("useRemoverParticipante", async () => {
    vi.mocked(removerParticipante).mockRejectedValueOnce({ message: "", code: "" });
    await rejeitaCru(
      () => useRemoverParticipante(),
      { taskId: "t1", profileId: "p1" },
      "Não foi possível remover o participante.",
    );
  });

  it("useAdicionarLink", async () => {
    vi.mocked(adicionarLink).mockRejectedValueOnce({ message: "", code: "" });
    await rejeitaCru(
      () => useAdicionarLink(),
      { taskId: "t1", rotulo: "Site", url: "https://a.com" },
      "Não foi possível incluir o link.",
    );
  });

  it("useRemoverLink", async () => {
    vi.mocked(removerLink).mockRejectedValueOnce({ message: "", code: "" });
    await rejeitaCru(() => useRemoverLink(), "l1", "Não foi possível remover o link.");
  });

  it("useAtualizarLink", async () => {
    vi.mocked(atualizarLink).mockRejectedValueOnce({ message: "", code: "" });
    await rejeitaCru(
      () => useAtualizarLink(),
      { id: "l1", rotulo: "Site", url: "https://a.com" },
      "Não foi possível salvar o link.",
    );
  });

  it("useAtualizarLink: Error do repositório mantém a frase dele (o positivo ao lado)", async () => {
    vi.mocked(atualizarLink).mockRejectedValueOnce(new Error("Dê um nome ao link."));
    await rejeitaCru(
      () => useAtualizarLink(),
      { id: "l1", rotulo: "", url: "https://a.com" },
      "Dê um nome ao link.",
    );
  });

  it("Error do repositório mantém a frase dele (o positivo ao lado)", async () => {
    vi.mocked(removerLink).mockRejectedValueOnce(new Error("Você não pode mexer nos links."));
    await rejeitaCru(() => useRemoverLink(), "l1", "Você não pode mexer nos links.");
  });
});

describe("participantes e links: a lista de tarefas é relida no sucesso E no erro (D-066)", () => {
  interface RepositorioFalso {
    readonly mockResolvedValueOnce: (v: undefined) => unknown;
    readonly mockRejectedValueOnce: (e: unknown) => unknown;
  }
  type Desfecho = "sucesso" | "erro";

  async function mutaEConfere<V>(
    usar: () => { mutate: (v: V) => void; isSuccess: boolean; isError: boolean },
    variaveis: V,
    repositorio: RepositorioFalso,
    desfecho: Desfecho,
  ) {
    if (desfecho === "sucesso") repositorio.mockResolvedValueOnce(undefined);
    else repositorio.mockRejectedValueOnce(new Error("rede"));
    const { result, invalida } = montar(usar);

    result.current.mutate(variaveis);
    await waitFor(() =>
      expect(desfecho === "sucesso" ? result.current.isSuccess : result.current.isError).toBe(true),
    );

    expect(invalida).toHaveBeenCalledTimes(1);
    expect(invalida).toHaveBeenCalledWith({ queryKey: chavesDeTarefa.raiz });
  }

  const CASOS: ReadonlyArray<{ nome: string; rodar: (desfecho: Desfecho) => Promise<void> }> = [
    {
      nome: "useAdicionarParticipantes",
      rodar: (d) =>
        mutaEConfere(
          () => useAdicionarParticipantes(),
          { taskId: "t1", profileIds: ["p1"] },
          vi.mocked(adicionarParticipantes),
          d,
        ),
    },
    {
      nome: "useRemoverParticipante",
      rodar: (d) =>
        mutaEConfere(
          () => useRemoverParticipante(),
          { taskId: "t1", profileId: "p1" },
          vi.mocked(removerParticipante),
          d,
        ),
    },
    {
      nome: "useAdicionarLink",
      rodar: (d) =>
        mutaEConfere(
          () => useAdicionarLink(),
          { taskId: "t1", rotulo: "Site", url: "https://a.com" },
          vi.mocked(adicionarLink),
          d,
        ),
    },
    {
      nome: "useRemoverLink",
      rodar: (d) => mutaEConfere(() => useRemoverLink(), "l1", vi.mocked(removerLink), d),
    },
    {
      nome: "useAtualizarLink",
      rodar: (d) =>
        mutaEConfere(
          () => useAtualizarLink(),
          { id: "l1", rotulo: "Site", url: "https://a.com" },
          vi.mocked(atualizarLink),
          d,
        ),
    },
  ];

  for (const caso of CASOS) {
    it(`${caso.nome}: no sucesso, a lista é relida`, async () => {
      await caso.rodar("sucesso");
    });

    it(`🔴 ${caso.nome}: no erro, a lista também é relida`, async () => {
      await caso.rodar("erro");
    });
  }
});

describe("useAtualizarLink: a mutação só conclui depois da lista relida", () => {
  it("🔴 pendente enquanto a releitura não termina, concluída logo depois", async () => {
    let liberarReleitura: () => void = () => undefined;
    const releitura = new Promise<void>((resolve) => {
      liberarReleitura = resolve;
    });
    vi.mocked(atualizarLink).mockResolvedValueOnce(undefined);
    const { result, invalida } = montar(() => useAtualizarLink());
    invalida.mockImplementationOnce(() => releitura);

    result.current.mutate({ id: "l1", rotulo: "Site", url: "https://a.com" });
    await waitFor(() => expect(invalida).toHaveBeenCalledWith({ queryKey: chavesDeTarefa.raiz }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.isPending).toBe(true);
    expect(result.current.isSuccess).toBe(false);

    liberarReleitura();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isPending).toBe(false);
  });
});
