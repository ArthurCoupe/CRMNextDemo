import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/settings.repository", () => ({
  atualizarPerfil: vi.fn(),
  definirPapelDaPessoa: vi.fn(),
  definirSituacaoDaPessoa: vi.fn(),
  lerMetasDeAtividade: vi.fn(),
  lerMetasFinanceiras: vi.fn(),
  lerTime: vi.fn(),
  salvarMetas: vi.fn(),
}));

vi.mock("@/modules/tasks/hooks/use-tasks", () => ({
  chavesDeTarefa: { time: ["tasks", "time"] },
}));
vi.mock("@/modules/financial/hooks/use-result", () => ({
  chavesDeResultado: { raiz: ["resultado"] },
}));

vi.mock("@/modules/contracts/api/shares.repository", () => ({}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { atualizarPerfil, definirPapelDaPessoa, definirSituacaoDaPessoa } =
  await import("../api/settings.repository");
const { chavesDeParticipacoes } = await import("@/modules/contracts/hooks/use-shares");
const { toast } = await import("sonner");
const {
  useAtualizarPerfil,
  useDefinirPapelDaPessoa,
  useDefinirSituacaoDaPessoa,
  usePerfilEmGravacao,
} = await import("./use-settings");

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapperDe(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe("useDefinirSituacaoDaPessoa: invalida Equipe E Papéis (SET-5)", () => {
  it("sucesso invalida chavesDeConfiguracoes.time e chavesDeTarefa.time", async () => {
    vi.mocked(definirSituacaoDaPessoa).mockResolvedValueOnce(undefined);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useDefinirSituacaoDaPessoa(), { wrapper: wrapperDe(qc) });

    result.current.mutate({ id: "p1", ativo: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["configuracoes", "time"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["tasks", "time"] });
  });
});

describe("useDefinirPapelDaPessoa: invalida Equipe E Papéis (SET-5)", () => {
  it("sucesso invalida chavesDeConfiguracoes.time e chavesDeTarefa.time", async () => {
    vi.mocked(definirPapelDaPessoa).mockResolvedValueOnce(undefined);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useDefinirPapelDaPessoa(), { wrapper: wrapperDe(qc) });

    result.current.mutate({ id: "p1", papel: "manager" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["configuracoes", "time"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["tasks", "time"] });
  });
});

describe("useDefinirPapelDaPessoa: o toast de erro nunca sai vazio", () => {
  it("🔴 rejeição SEM Error (objeto cru do fetch) cai no fallback da tela", async () => {
    vi.mocked(definirPapelDaPessoa).mockRejectedValueOnce({ message: "", code: "" });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useDefinirPapelDaPessoa(), { wrapper: wrapperDe(qc) });

    result.current.mutate({ id: "p1", papel: "manager" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível mudar o papel da pessoa.");
  });

  it("Error do repositório mantém a frase dele", async () => {
    vi.mocked(definirPapelDaPessoa).mockRejectedValueOnce(new Error("Só o owner muda papel."));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useDefinirPapelDaPessoa(), { wrapper: wrapperDe(qc) });

    result.current.mutate({ id: "p1", papel: "manager" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Só o owner muda papel.");
  });
});

describe("useAtualizarPerfil (A1.5)", () => {
  function montarPerfil() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useAtualizarPerfil(), { wrapper: wrapperDe(qc) });
    return { result, invalidar };
  }

  it("sucesso grava nome e cargo e invalida Equipe, Papéis e o perfil da barra lateral", async () => {
    vi.mocked(atualizarPerfil).mockResolvedValueOnce(undefined);
    const { result, invalidar } = montarPerfil();

    result.current.mutate({ id: "p1", dados: { nomeCompleto: "Marina Silva", cargo: "SDR" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(atualizarPerfil).toHaveBeenCalledWith("p1", {
      nomeCompleto: "Marina Silva",
      cargo: "SDR",
    });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["configuracoes", "time"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["tasks", "time"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["profile"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["profiles", "beneficiarios"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["bu-default-shares"] });
  });

  it("🔴 as chaves invalidadas pegam as entradas reais de `chavesDeParticipacoes`", async () => {
    vi.mocked(atualizarPerfil).mockResolvedValueOnce(undefined);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const pegas = [
      chavesDeParticipacoes.pessoas(),
      chavesDeParticipacoes.pessoas(["a", "b"]),
      chavesDeParticipacoes.todosOsPadroes,
      chavesDeParticipacoes.padroes("sistemas"),
    ];
    for (const chave of pegas) qc.setQueryData(chave, ["velho"]);
    const doContrato = chavesDeParticipacoes.doContrato("c1");
    qc.setQueryData(doContrato, ["outro"]);
    const { result } = renderHook(() => useAtualizarPerfil(), { wrapper: wrapperDe(qc) });

    result.current.mutate({ id: "p1", dados: { nomeCompleto: "Marina Silva", cargo: null } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    for (const chave of pegas) expect(qc.getQueryState(chave)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(doContrato)?.isInvalidated).toBe(false);
  });

  it("o onSuccess por chamada só roda depois da nova leitura do perfil", async () => {
    vi.mocked(atualizarPerfil).mockResolvedValueOnce(undefined);
    const { result, invalidar } = montarPerfil();
    const pendentes: Array<() => void> = [];
    invalidar.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          pendentes.push(resolve);
        }),
    );
    const aoTerminar = vi.fn();

    result.current.mutate(
      { id: "p1", dados: { nomeCompleto: "Marina Silva", cargo: "SDR" } },
      { onSuccess: aoTerminar },
    );
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ["profile"] }));
    await new Promise((r) => setTimeout(r, 20));
    expect(aoTerminar).not.toHaveBeenCalled();

    pendentes.forEach((terminar) => terminar());
    await waitFor(() => expect(aoTerminar).toHaveBeenCalledTimes(1));
  });

  it("rejeição sem Error cai no fallback e não invalida o perfil", async () => {
    vi.mocked(atualizarPerfil).mockRejectedValueOnce({ message: "", code: "" });
    const { result, invalidar } = montarPerfil();

    result.current.mutate({ id: "p1", dados: { nomeCompleto: "Marina Silva", cargo: null } });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o perfil.");
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ["profile"] });
  });

  it("Error mantém a frase do repositório", async () => {
    vi.mocked(atualizarPerfil).mockRejectedValueOnce(new Error("O nome não pode ficar em branco."));
    const { result } = montarPerfil();

    result.current.mutate({ id: "p1", dados: { nomeCompleto: "   ", cargo: null } });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("O nome não pode ficar em branco.");
  });
});

describe("usePerfilEmGravacao (A1.5)", () => {
  const dados = { id: "p1", dados: { nomeCompleto: "Marina Silva", cargo: "SDR" } };

  it("verdadeiro enquanto há gravação de perfil pendente, falso sem ela e depois dela", async () => {
    let terminar: () => void = () => undefined;
    vi.mocked(atualizarPerfil).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        terminar = resolve;
      }),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const gravador = renderHook(() => useAtualizarPerfil(), { wrapper: wrapperDe(qc) });
    const ouvinte = renderHook(() => usePerfilEmGravacao(), { wrapper: wrapperDe(qc) });
    expect(ouvinte.result.current).toBe(false);

    act(() => gravador.result.current.mutate(dados));
    await waitFor(() => expect(ouvinte.result.current).toBe(true));

    terminar();
    await waitFor(() => expect(ouvinte.result.current).toBe(false));
  });

  it("outra mutação pendente da tela não conta como gravação de perfil", async () => {
    vi.mocked(definirPapelDaPessoa).mockReturnValueOnce(new Promise<void>(() => undefined));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const outra = renderHook(() => useDefinirPapelDaPessoa(), { wrapper: wrapperDe(qc) });
    const ouvinte = renderHook(() => usePerfilEmGravacao(), { wrapper: wrapperDe(qc) });

    act(() => outra.result.current.mutate({ id: "p1", papel: "manager" }));
    await waitFor(() => expect(outra.result.current.isPending).toBe(true));

    expect(ouvinte.result.current).toBe(false);
  });
});
