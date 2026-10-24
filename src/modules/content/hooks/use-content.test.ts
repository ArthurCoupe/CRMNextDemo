import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/content.repository", () => ({
  apagarPost: vi.fn(),
  corrigirPublicacao: vi.fn(),
  criarPost: vi.fn(),
  editarPost: vi.fn(),
  listarClientes: vi.fn(),
  listarEventos: vi.fn(),
  listarPostsDaSemana: vi.fn(),
  listarPostsDoQuadro: vi.fn(),
  listarResponsaveis: vi.fn(),
  moverPost: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { corrigirPublicacao, editarPost } = await import("../api/content.repository");
const { toast } = await import("sonner");
const { useCorrigirPublicacao, useEditarPost } = await import("./use-content");

const { POST_MUDOU } = await import("../domain/post");

const VARIAVEIS = {
  id: "p1",
  atualizadoEm: "2026-10-04T12:00:00.123456+00:00",
  campos: {
    clienteId: "c1",
    titulo: "Lançamento",
    legenda: null,
    formato: "reel",
    canal: "instagram",
    linkDaArte: null,
    agendadoPara: "2026-10-10T21:00:00.000Z",
    responsavelId: "u1",
  },
} as const;

beforeEach(() => {
  vi.clearAllMocks();
});

function salvar() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const { result } = renderHook(() => useEditarPost(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  });
  result.current.mutate(VARIAVEIS);
}

describe("useEditarPost", () => {
  it("post que mudou noutra tela: o toast mostra a frase de conflito", async () => {
    vi.mocked(editarPost).mockRejectedValueOnce(new Error(POST_MUDOU));
    salvar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(POST_MUDOU));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("controle: erro que não é Error mostra a frase da tela, não a de conflito", async () => {
    vi.mocked(editarPost).mockRejectedValueOnce({ message: "Failed to fetch", code: "" });
    salvar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o post."),
    );
    expect(toast.error).not.toHaveBeenCalledWith(POST_MUDOU);
  });
});

describe("useCorrigirPublicacao (D-069, C5)", () => {
  function corrigir(relendo?: Promise<void>) {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    if (relendo !== undefined) invalidar.mockReturnValue(relendo);
    const { result } = renderHook(() => useCorrigirPublicacao(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children),
    });
    result.current.mutate({
      id: "p1",
      atualizadoEm: "2026-10-04T12:00:00.123456+00:00",
      correcao: { link: "https://instagram.com/p/certo", publicadoEm: "2026-10-04T12:00:00.000Z" },
    });
    return { invalidar, result };
  }

  it("sucesso relê o conteúdo", async () => {
    vi.mocked(corrigirPublicacao).mockResolvedValueOnce(undefined);
    const { invalidar, result } = corrigir();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["content"] });
    expect(corrigirPublicacao).toHaveBeenCalledWith("p1", "2026-10-04T12:00:00.123456+00:00", {
      link: "https://instagram.com/p/certo",
      publicadoEm: "2026-10-04T12:00:00.000Z",
    });
  });

  it("só termina depois da releitura: quem fecha o formulário no sucesso espera por ela", async () => {
    let terminouAReleitura: () => void = () => {};
    const relendo = new Promise<void>((ok) => {
      terminouAReleitura = ok;
    });
    vi.mocked(corrigirPublicacao).mockResolvedValueOnce(undefined);
    const { invalidar, result } = corrigir(relendo);

    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ["content"] }));
    expect(result.current.isPending).toBe(true);
    expect(result.current.isSuccess).toBe(false);

    terminouAReleitura();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("conflito mostra a frase do post que mudou e relê; erro cru cai no fallback", async () => {
    vi.mocked(corrigirPublicacao).mockRejectedValueOnce(new Error(POST_MUDOU));
    const { invalidar } = corrigir();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(POST_MUDOU));
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ["content"] }));

    vi.mocked(corrigirPublicacao).mockRejectedValueOnce({ message: "Failed to fetch", code: "" });
    corrigir();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível corrigir a publicação."),
    );
    expect(toast.error).not.toHaveBeenCalledWith("Failed to fetch");
  });
});
