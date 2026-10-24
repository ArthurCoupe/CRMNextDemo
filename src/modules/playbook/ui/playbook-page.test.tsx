import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const salvar = { mutate: vi.fn(), isPending: false };

vi.mock("../hooks/use-playbook", () => ({
  usePlaybook: vi.fn(() => ({ data: [], isLoading: false, isPending: false, isError: false })),
  useBuscaNoPlaybook: vi.fn(() => ({
    data: [],
    isLoading: false,
    isPending: false,
    isError: false,
  })),
  useSalvarSecao: () => salvar,
}));

const papelFalso = { papel: "member" as string | null };
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => papelFalso }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { PlaybookPage } = await import("./playbook-page");
const { usePlaybook, useBuscaNoPlaybook } = await import("../hooks/use-playbook");
const { toast } = await import("sonner");

const SECAO_COMERCIAL = {
  id: "s1",
  area: "comercial" as const,
  title: "Como abordar",
  content: "## Abordagem\n\nFale com o cliente.",
  sort_order: 0,
  updated_at: "2026-09-01T00:00:00Z",
};

const SECAO_MARKETING = {
  id: "s2",
  area: "marketing" as const,
  title: "Tom de voz",
  content: "Direto e claro.",
  sort_order: 0,
  updated_at: "2026-09-01T00:00:00Z",
};

function renderPage() {
  return render(<PlaybookPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  papelFalso.papel = "member";
  salvar.mutate.mockReset();
  salvar.isPending = false;
  vi.mocked(usePlaybook).mockReturnValue({
    data: [SECAO_COMERCIAL],
    isLoading: false,
    isPending: false,
    isError: false,
  } as never);
  vi.mocked(useBuscaNoPlaybook).mockReturnValue({
    data: [],
    isLoading: false,
    isPending: false,
    isError: false,
  } as never);
});

describe("navegação entre as 3 áreas", () => {
  it("abre em Comercial e mostra as seções de comercial", () => {
    renderPage();
    expect(screen.getByText("Como abordar")).toBeInTheDocument();
  });

  it("trocar para Marketing pede as seções de marketing, não as de comercial", async () => {
    const usuario = userEvent.setup();
    vi.mocked(usePlaybook).mockImplementation(
      (area) =>
        ({
          data: area === "marketing" ? [SECAO_MARKETING] : [SECAO_COMERCIAL],
          isLoading: false,
          isPending: false,
          isError: false,
        }) as never,
    );
    renderPage();

    await usuario.click(screen.getByRole("button", { name: "Marketing" }));

    expect(screen.getByText("Tom de voz")).toBeInTheDocument();
    expect(screen.queryByText("Como abordar")).not.toBeInTheDocument();
  });
});

describe("busca vai ao Postgres, nunca à memória", () => {
  it("o campo de busca tem nome acessível, não só placeholder", () => {
    renderPage();
    expect(screen.getByRole("searchbox", { name: "Buscar no playbook" })).toBeInTheDocument();
  });

  it("digitar na busca chama o hook de busca, e a lista some da área ativa", async () => {
    const usuario = userEvent.setup();
    vi.mocked(useBuscaNoPlaybook).mockReturnValue({
      data: [SECAO_MARKETING],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);
    renderPage();

    await usuario.type(screen.getByRole("searchbox"), "tom");

    expect(useBuscaNoPlaybook).toHaveBeenCalled();
    expect(screen.getByText("Tom de voz")).toBeInTheDocument();
    expect(screen.queryByText("Como abordar")).not.toBeInTheDocument();
  });

  it("busca sem resultado diz 'não achou', nunca confunde com falha", async () => {
    const usuario = userEvent.setup();
    vi.mocked(useBuscaNoPlaybook).mockReturnValue({
      data: [],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);
    renderPage();

    await usuario.type(screen.getByRole("searchbox"), "xyz");

    expect(screen.getByText(/nenhuma seção encontrada/i)).toBeInTheDocument();
  });

  it("busca em erro avisa, e NÃO diz que não achou nada", async () => {
    const usuario = userEvent.setup();
    vi.mocked(useBuscaNoPlaybook).mockReturnValue({
      data: undefined,
      isLoading: false,
      isPending: false,
      isError: true,
    } as never);
    renderPage();

    await usuario.type(screen.getByRole("searchbox"), "xyz");

    expect(screen.getByText(/não foi possível/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhuma seção encontrada/i)).not.toBeInTheDocument();
  });
});

describe("papel decide quem edita", () => {
  it("member lê o conteúdo e não vê editar", () => {
    papelFalso.papel = "member";
    renderPage();

    expect(screen.getByText("Como abordar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
  });

  it("manager vê editar — o positivo ao lado", () => {
    papelFalso.papel = "manager";
    renderPage();

    expect(screen.getByRole("button", { name: /editar/i })).toBeInTheDocument();
  });

  it("owner edita, salva com o conteúdo do textarea, e o Salvar carimba updated_by via a mutação", async () => {
    papelFalso.papel = "owner";
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /editar/i }));
    const campo = screen.getByRole("textbox", { name: /conteúdo/i });
    await usuario.clear(campo);
    await usuario.type(campo, "novo texto");
    await usuario.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(salvar.mutate).toHaveBeenCalledWith(
      {
        id: "s1",
        dados: { title: "Como abordar", area: "comercial", sortOrder: 0, content: "novo texto" },
        updatedAt: SECAO_COMERCIAL.updated_at,
      },
      expect.anything(),
    );
  });
});

describe("achado 7: a edicao so fecha depois de saber que salvou", () => {
  it("mutacao com sucesso fecha o card (volta pro modo leitura)", async () => {
    papelFalso.papel = "owner";
    const usuario = userEvent.setup();
    salvar.mutate.mockImplementation((_vars, opcoes?: { onSuccess?: () => void }) => {
      opcoes?.onSuccess?.();
    });
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /editar/i }));
    await usuario.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(screen.queryByRole("textbox", { name: /conteúdo/i })).not.toBeInTheDocument();
  });

  it("mutacao que FALHA mantem o card aberto e o texto digitado vivo", async () => {
    papelFalso.papel = "owner";
    const usuario = userEvent.setup();
    salvar.mutate.mockImplementation(() => undefined);
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /editar/i }));
    const campo = screen.getByRole("textbox", { name: /conteúdo/i });
    await usuario.clear(campo);
    await usuario.type(campo, "texto que nao pode sumir");
    await usuario.click(screen.getByRole("button", { name: /^salvar$/i }));

    const campoAinda = screen.getByRole("textbox", { name: /conteúdo/i });
    expect(campoAinda).toBeInTheDocument();
    expect(campoAinda).toHaveValue("texto que nao pode sumir");
  });
});

describe("título, área e ordem (A2.2)", () => {
  it("owner muda título, área e ordem, e os quatro campos vão juntos", async () => {
    papelFalso.papel = "owner";
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /editar/i }));
    const titulo = screen.getByRole("textbox", { name: "Título da seção" });
    await usuario.clear(titulo);
    await usuario.type(titulo, "Primeiro contato");
    await usuario.click(screen.getByRole("combobox", { name: "Área da seção" }));
    await usuario.click(await screen.findByRole("option", { name: "Marketing" }));
    const ordem = screen.getByRole("textbox", { name: "Ordem na área" });
    await usuario.clear(ordem);
    await usuario.type(ordem, "3");
    await usuario.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(salvar.mutate).toHaveBeenCalledWith(
      {
        id: "s1",
        dados: {
          title: "Primeiro contato",
          area: "marketing",
          sortOrder: 3,
          content: SECAO_COMERCIAL.content,
        },
        updatedAt: SECAO_COMERCIAL.updated_at,
      },
      expect.anything(),
    );
  });

  it("🔴 título em branco não chama o banco, e a tela diz por quê", async () => {
    papelFalso.papel = "owner";
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /editar/i }));
    await usuario.clear(screen.getByRole("textbox", { name: "Título da seção" }));
    await usuario.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(salvar.mutate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("O título da seção não pode ficar em branco.");
  });

  async function salvarComOrdem(digitado: string): Promise<void> {
    papelFalso.papel = "manager";
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /editar/i }));
    const ordem = screen.getByRole("textbox", { name: "Ordem na área" });
    await usuario.clear(ordem);
    if (digitado !== "") await usuario.type(ordem, digitado);
    await usuario.click(screen.getByRole("button", { name: /^salvar$/i }));
  }

  it.each(["", "-1", "1,5", "10000", "abc"])(
    "🔴 ordem %j não chama o banco, e a tela diz por quê",
    async (digitado) => {
      await salvarComOrdem(digitado);

      expect(salvar.mutate).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        "A ordem precisa ser um número inteiro de 0 a 9999.",
      );
    },
  );

  it.each([
    ["0", 0],
    ["9999", 9999],
  ])("ordem %j (borda válida) grava como %d", async (digitado, esperado) => {
    await salvarComOrdem(digitado);

    expect(toast.error).not.toHaveBeenCalled();
    expect(salvar.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ dados: expect.objectContaining({ sortOrder: esperado }) }),
      expect.anything(),
    );
  });
});

describe("a trava do updated_at é a da abertura da edição", () => {
  const T1 = "2026-09-02T00:00:00Z";

  it("🔴 releitura no meio da edição não troca o carimbo enviado ao Salvar", async () => {
    papelFalso.papel = "manager";
    const usuario = userEvent.setup();
    const { rerender } = renderPage();

    await usuario.click(screen.getByRole("button", { name: /editar/i }));
    vi.mocked(usePlaybook).mockReturnValue({
      data: [{ ...SECAO_COMERCIAL, updated_at: T1, title: "Outro" }],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);
    rerender(<PlaybookPage />);
    await usuario.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(salvar.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        dados: expect.objectContaining({ title: "Como abordar" }),
        updatedAt: SECAO_COMERCIAL.updated_at,
      }),
      expect.anything(),
    );
  });

  it("o positivo ao lado: reabrir a edição depois da releitura manda o carimbo novo", async () => {
    papelFalso.papel = "manager";
    const usuario = userEvent.setup();
    const { rerender } = renderPage();

    await usuario.click(screen.getByRole("button", { name: /editar/i }));
    vi.mocked(usePlaybook).mockReturnValue({
      data: [{ ...SECAO_COMERCIAL, updated_at: T1, title: "Outro" }],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);
    rerender(<PlaybookPage />);
    await usuario.click(screen.getByRole("button", { name: /cancelar/i }));
    await usuario.click(screen.getByRole("button", { name: /editar/i }));
    await usuario.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(salvar.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        dados: expect.objectContaining({ title: "Outro" }),
        updatedAt: T1,
      }),
      expect.anything(),
    );
  });
});

describe("durante o Salvar pendente os campos não aceitam digitação", () => {
  it("🔴 título, área, ordem e conteúdo travam com a gravação pendente, e liberam sem ela", async () => {
    papelFalso.papel = "owner";
    const usuario = userEvent.setup();
    const { rerender } = renderPage();

    await usuario.click(screen.getByRole("button", { name: /editar/i }));
    expect(screen.getByRole("textbox", { name: "Título da seção" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Área da seção" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Ordem na área" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: /conteúdo/i })).toBeEnabled();

    salvar.isPending = true;
    rerender(<PlaybookPage />);

    expect(screen.getByRole("textbox", { name: "Título da seção" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Área da seção" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Ordem na área" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /conteúdo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^salvar$/i })).toBeDisabled();

    salvar.isPending = false;
    rerender(<PlaybookPage />);

    expect(screen.getByRole("textbox", { name: "Título da seção" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: /conteúdo/i })).toBeEnabled();
  });

  it("🔴 o Select de área não abre com a gravação pendente (controle: sem ela, abre)", async () => {
    papelFalso.papel = "owner";
    const usuario = userEvent.setup();
    const { rerender } = renderPage();

    await usuario.click(screen.getByRole("button", { name: /editar/i }));
    salvar.isPending = true;
    rerender(<PlaybookPage />);

    await usuario.click(screen.getByRole("combobox", { name: "Área da seção" }));
    expect(screen.queryByRole("option", { name: "Marketing" })).not.toBeInTheDocument();

    salvar.isPending = false;
    rerender(<PlaybookPage />);

    await usuario.click(screen.getByRole("combobox", { name: "Área da seção" }));
    expect(await screen.findByRole("option", { name: "Marketing" })).toBeInTheDocument();
  });
});

describe("markdown renderiza, sem HTML bruto", () => {
  it("um ## vira <h2>, não texto cru com cerquilhas", () => {
    renderPage();
    const titulo = screen.getByRole("heading", { name: "Abordagem", level: 2 });
    expect(titulo.tagName).toBe("H2");
  });

  it("o <h2> carrega classe de título — não fica visualmente igual a um parágrafo", () => {
    renderPage();
    const titulo = screen.getByRole("heading", { name: "Abordagem", level: 2 });
    expect(titulo.className).toContain("font-semibold");
  });

  it("tabela GFM vira <table>, e a célula carrega a classe aplicada", () => {
    vi.mocked(usePlaybook).mockReturnValue({
      data: [
        {
          ...SECAO_COMERCIAL,
          content: "| Métrica | Referência |\n|---|---|\n| CAC | R$ 100 |",
        },
      ],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);
    renderPage();

    const tabela = screen.getByRole("table");
    expect(tabela).toBeInTheDocument();
    const celula = screen.getByText("R$ 100");
    expect(celula.tagName).toBe("TD");
    expect(celula.className).toContain("px-2");
  });
});
