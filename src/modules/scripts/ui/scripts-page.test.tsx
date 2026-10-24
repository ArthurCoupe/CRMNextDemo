import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const { toast } = await import("sonner");

const registrar = { mutate: vi.fn(), isPending: false };
const criar = { mutate: vi.fn(), isPending: false };
const atualizar = { mutate: vi.fn(), isPending: false };
const definirSituacao = { mutate: vi.fn(), isPending: false };
const apagar = { mutate: vi.fn(), isPending: false };

vi.mock("../hooks/use-scripts", () => ({
  useScripts: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  useNichos: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  useMaisUsadosRecentemente: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  useRegistrarUso: () => registrar,
  useCriarScript: () => criar,
  useAtualizarScript: () => atualizar,
  useDefinirSituacaoDoScript: () => definirSituacao,
  useApagarScript: () => apagar,
}));

const papelFalso = { papel: "member" as string | null, meuId: "u1", carregando: false };
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => papelFalso }));

const { ScriptsPage } = await import("./scripts-page");
const { useScripts, useMaisUsadosRecentemente } = await import("../hooks/use-scripts");

const SCRIPT = {
  id: "s1",
  tipo: "sdr" as const,
  title: "Primeiro toque",
  body: "Oi, tudo bem? Vi que voce...",
  nicho: "advocacia",
  canal: "whatsapp" as const,
  momento: "primeiro_contato" as const,
  pipelineStage: null,
  sortOrder: 0,
  active: true,
  updatedAt: "2026-09-08T00:00:00.000Z",
};

function renderPage(tipo: "sdr" | "closer" = "sdr") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ScriptsPage tipo={tipo} aoTrocarTipo={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("o alternador troca o que os filtros oferecem", () => {
  it("em SDR oferece os momentos de SDR e nenhum de closer", () => {
    renderPage("sdr");
    expect(screen.getByText("Primeiro contato")).toBeInTheDocument();
    expect(screen.queryByText("Fechamento")).not.toBeInTheDocument();
  });

  it("em Closer oferece os momentos de closer e nenhum de SDR", () => {
    renderPage("closer");
    expect(screen.getByText("Fechamento")).toBeInTheDocument();
    expect(screen.queryByText("Primeiro contato")).not.toBeInTheDocument();
  });
});

describe("papel decide o que a tela oferece", () => {
  it("member copia e nao ve criar", () => {
    papelFalso.papel = "member";
    vi.mocked(useScripts).mockReturnValue({
      data: [SCRIPT],
      isLoading: false,
      isError: false,
    } as never);
    renderPage();

    expect(screen.getByRole("button", { name: /copiar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /novo script/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^arquivar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^apagar$/i })).not.toBeInTheDocument();
  });

  it("manager ve criar — o positivo ao lado", () => {
    papelFalso.papel = "manager";
    vi.mocked(useScripts).mockReturnValue({
      data: [SCRIPT],
      isLoading: false,
      isError: false,
    } as never);
    renderPage();

    expect(screen.getByRole("button", { name: /novo script/i })).toBeInTheDocument();
  });
});

describe("estado vazio e honesto", () => {
  it("member ve que nao ha script, sem botao que ele nao pode usar", () => {
    papelFalso.papel = "member";
    vi.mocked(useScripts).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    renderPage();

    expect(screen.getByText(/nenhum script cadastrado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /novo script/i })).not.toBeInTheDocument();
    expect(screen.getByText(/peça a um gestor/i)).toBeInTheDocument();
    expect(screen.queryByText(/crie o primeiro/i)).not.toBeInTheDocument();
  });

  it("manager ve o convite para criar o primeiro", () => {
    papelFalso.papel = "manager";
    vi.mocked(useScripts).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    renderPage();

    expect(screen.getByText(/nenhum script cadastrado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /novo script/i })).toBeInTheDocument();
    expect(screen.getByText(/crie o primeiro/i)).toBeInTheDocument();
    expect(screen.queryByText(/peça a um gestor/i)).not.toBeInTheDocument();
  });

  it("com filtro aplicado, o vazio diz 'nao bate com os filtros', nao 'nao cadastrado'", async () => {
    const usuario = userEvent.setup();
    papelFalso.papel = "manager";
    vi.mocked(useScripts).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    renderPage();

    await usuario.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(screen.getByText(/nenhum script bate com estes filtros/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhum script cadastrado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/crie o primeiro/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /limpar filtros/i })).toBeInTheDocument();
  });

  it("'Limpar filtros' desmarca o chip selecionado", async () => {
    const usuario = userEvent.setup();
    vi.mocked(useScripts).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    renderPage();

    const chipWhatsapp = screen.getByRole("button", { name: "WhatsApp" });
    await usuario.click(chipWhatsapp);
    expect(chipWhatsapp.className).toContain("bg-primary");

    await usuario.click(screen.getByRole("button", { name: /limpar filtros/i }));

    expect(chipWhatsapp.className).not.toContain("bg-primary");
  });
});

describe("achado 6: filtro orfao nao sobrevive a troca de tipo pela URL", () => {
  it("mudar a prop `tipo` diretamente (caminho que a URL usa) limpa o canal selecionado", async () => {
    const usuario = userEvent.setup();
    vi.mocked(useScripts).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <ScriptsPage tipo="sdr" aoTrocarTipo={vi.fn()} />
      </QueryClientProvider>,
    );

    await usuario.click(screen.getByRole("button", { name: "WhatsApp" }));

    rerender(
      <QueryClientProvider client={qc}>
        <ScriptsPage tipo="closer" aoTrocarTipo={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Todo canal" }).className).toContain("bg-primary");
  });
});

describe("SCR-5: trocar o tipo pela URL fecha o formulario de edicao", () => {
  function renderComTipo(tipo: "sdr" | "closer", qc: QueryClient) {
    return (
      <QueryClientProvider client={qc}>
        <ScriptsPage tipo={tipo} aoTrocarTipo={vi.fn()} />
      </QueryClientProvider>
    );
  }

  it("🔴 'Editar' aberto + tipo muda → o diálogo de edição some", async () => {
    const usuario = userEvent.setup();
    papelFalso.papel = "manager";
    vi.mocked(useScripts).mockReturnValue({
      data: [SCRIPT],
      isLoading: false,
      isError: false,
    } as never);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(renderComTipo("sdr", qc));

    await usuario.click(screen.getByRole("button", { name: /^editar$/i }));
    expect(screen.getByRole("dialog", { name: /editar script/i })).toBeInTheDocument();

    rerender(renderComTipo("closer", qc));

    expect(screen.queryByRole("dialog", { name: /editar script/i })).not.toBeInTheDocument();
  });

  it("'Novo script' aberto + tipo muda → o diálogo de criação continua", async () => {
    const usuario = userEvent.setup();
    papelFalso.papel = "manager";
    vi.mocked(useScripts).mockReturnValue({
      data: [SCRIPT],
      isLoading: false,
      isError: false,
    } as never);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(renderComTipo("sdr", qc));

    await usuario.click(screen.getByRole("button", { name: /novo script/i }));
    expect(screen.getByRole("dialog", { name: /novo script/i })).toBeInTheDocument();

    rerender(renderComTipo("closer", qc));

    expect(screen.getByRole("dialog", { name: /novo script/i })).toBeInTheDocument();
  });
});

describe("copiar", () => {
  it("poe o texto PURO no clipboard e registra o uso", async () => {
    papelFalso.papel = "member";
    vi.mocked(useScripts).mockReturnValue({
      data: [SCRIPT],
      isLoading: false,
      isError: false,
    } as never);

    const usuario = userEvent.setup();
    const escrever = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    renderPage();
    await usuario.click(screen.getByRole("button", { name: /copiar/i }));

    expect(escrever).toHaveBeenCalledWith("Oi, tudo bem? Vi que voce...");
    expect(registrar.mutate).toHaveBeenCalledWith("s1");
  });

  it("🔴 clipboard rejeitando avisa por toast e NÃO registra o uso", async () => {
    papelFalso.papel = "member";
    vi.mocked(useScripts).mockReturnValue({
      data: [SCRIPT],
      isLoading: false,
      isError: false,
    } as never);

    const usuario = userEvent.setup();
    registrar.mutate.mockClear();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("recusado"));
    renderPage();
    await usuario.click(screen.getByRole("button", { name: /copiar/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível copiar. Selecione o texto e copie à mão.",
    );
    expect(registrar.mutate).not.toHaveBeenCalled();
  });
});

describe("mais usados ultimamente, dentro do modo corrente", () => {
  it("mostra os itens que o hook devolve para o tipo corrente", () => {
    vi.mocked(useScripts).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    vi.mocked(useMaisUsadosRecentemente).mockReturnValue({
      data: [{ scriptId: "s1", titulo: "Primeiro toque", usos: 5 }],
      isLoading: false,
      isError: false,
    } as never);
    renderPage("sdr");

    expect(screen.getByText("Primeiro toque")).toBeInTheDocument();
  });

  it("erro na leitura de mais usados avisa, e NAO some em silencio", () => {
    vi.mocked(useMaisUsadosRecentemente).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);
    renderPage("sdr");

    expect(screen.getByText(/não foi possível ler os mais usados/i)).toBeInTheDocument();
  });
});

describe("botoes ligados ao formulario e ao arquivar", () => {
  beforeEach(() => {
    criar.mutate.mockClear();
    atualizar.mutate.mockClear();
    definirSituacao.mutate.mockClear();
  });

  it('"Novo script" abre o formulario vazio, para CRIAR', async () => {
    papelFalso.papel = "manager";
    vi.mocked(useScripts).mockReturnValue({
      data: [SCRIPT],
      isLoading: false,
      isError: false,
    } as never);
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /novo script/i }));

    expect(screen.getByRole("dialog", { name: /novo script/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/título/i)).toHaveValue("");
  });

  it('"Editar" abre o formulario PREENCHIDO com o script da linha', async () => {
    papelFalso.papel = "manager";
    vi.mocked(useScripts).mockReturnValue({
      data: [SCRIPT],
      isLoading: false,
      isError: false,
    } as never);
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /editar/i }));

    expect(screen.getByRole("dialog", { name: /editar script/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/título/i)).toHaveValue(SCRIPT.title);
  });

  it('"Arquivar" pede confirmacao antes de chamar a mutacao', async () => {
    papelFalso.papel = "manager";
    vi.mocked(useScripts).mockReturnValue({
      data: [SCRIPT],
      isLoading: false,
      isError: false,
    } as never);
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /arquivar/i }));
    expect(definirSituacao.mutate).not.toHaveBeenCalled();

    const confirmacao = screen.getByRole("alertdialog");
    expect(within(confirmacao).queryByText(/dá para reativar/i)).not.toBeInTheDocument();
    expect(within(confirmacao).getByText(/não há como reativar por aqui/i)).toBeInTheDocument();
    await usuario.click(within(confirmacao).getByRole("button", { name: /^arquivar$/i }));

    expect(definirSituacao.mutate).toHaveBeenCalledWith({ id: SCRIPT.id, ativo: false });
  });
});

describe("apagar (D-067)", () => {
  beforeEach(() => {
    apagar.mutate.mockClear();
    definirSituacao.mutate.mockClear();
    vi.mocked(useScripts).mockReturnValue({
      data: [SCRIPT],
      isLoading: false,
      isError: false,
    } as never);
  });

  it("owner e manager veem Apagar ao lado de Arquivar", () => {
    papelFalso.papel = "owner";
    const { unmount } = renderPage();
    expect(screen.getByRole("button", { name: /^apagar$/i })).toBeInTheDocument();
    unmount();

    papelFalso.papel = "manager";
    renderPage();
    expect(screen.getByRole("button", { name: /^apagar$/i })).toBeInTheDocument();
  });

  it("confirmar apaga o script da linha, e o diálogo diz que o histórico fica e aponta Arquivar", async () => {
    papelFalso.papel = "manager";
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /^apagar$/i }));
    const confirmacao = screen.getByRole("alertdialog", { name: 'Apagar "Primeiro toque"?' });
    expect(
      within(confirmacao).getByText(/O histórico de uso fica, sem o script/),
    ).toBeInTheDocument();
    expect(within(confirmacao).getByText(/use Arquivar/)).toBeInTheDocument();
    expect(apagar.mutate).not.toHaveBeenCalled();

    await usuario.click(within(confirmacao).getByRole("button", { name: "Sim, apagar" }));

    expect(apagar.mutate).toHaveBeenCalledTimes(1);
    expect(apagar.mutate).toHaveBeenCalledWith(SCRIPT.id);
    expect(definirSituacao.mutate).not.toHaveBeenCalled();
  });

  it("Cancelar no diálogo não apaga", async () => {
    papelFalso.papel = "manager";
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /^apagar$/i }));
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(apagar.mutate).not.toHaveBeenCalled();
  });
});

describe("erro nao vira lista vazia", () => {
  it("consulta em erro avisa, e NAO diz que nao ha script", () => {
    vi.mocked(useMaisUsadosRecentemente).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useScripts).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);
    renderPage();

    expect(screen.queryByText(/nenhum script cadastrado/i)).not.toBeInTheDocument();
    expect(screen.getByText(/não foi possível/i)).toBeInTheDocument();
  });
});

describe("lista mostra titulos; o corpo abre no clique", () => {
  const OUTRO = { ...SCRIPT, id: "s2", title: "Follow-up frio", body: "Passando para retomar..." };

  beforeEach(() => {
    vi.mocked(useScripts).mockReturnValue({
      data: [SCRIPT, OUTRO],
      isLoading: false,
      isError: false,
    } as never);
  });

  it("fechado por padrao: titulo visivel, corpo escondido", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Primeiro toque" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText(SCRIPT.body)).not.toBeVisible();
  });

  it("aria-controls aponta para um elemento que existe com o card fechado", () => {
    renderPage();

    const alvo = screen
      .getByRole("button", { name: "Primeiro toque" })
      .getAttribute("aria-controls");
    expect(alvo).not.toBeNull();
    expect(document.getElementById(alvo ?? "")).toHaveTextContent(SCRIPT.body);
  });

  it("abrir um NAO fecha o outro — varios abertos juntos, e clicar de novo fecha", async () => {
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: "Primeiro toque" }));
    await usuario.click(screen.getByRole("button", { name: "Follow-up frio" }));

    expect(screen.getByText(SCRIPT.body)).toBeVisible();
    expect(screen.getByText(OUTRO.body)).toBeVisible();

    await usuario.click(screen.getByRole("button", { name: "Primeiro toque" }));

    expect(screen.getByText(SCRIPT.body)).not.toBeVisible();
    expect(screen.getByText(OUTRO.body)).toBeVisible();
  });

  it("copiar funciona com o card fechado", async () => {
    const usuario = userEvent.setup();
    const escrever = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    renderPage();

    await usuario.click(screen.getAllByRole("button", { name: /copiar/i })[0]);

    expect(escrever).toHaveBeenCalledWith(SCRIPT.body);
  });
});

describe("lupa", () => {
  beforeEach(() => {
    vi.mocked(useScripts).mockClear();
    vi.mocked(useScripts).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
  });

  function ultimosFiltros() {
    return vi.mocked(useScripts).mock.lastCall?.[0];
  }

  it("clicar na lupa abre o campo, e o termo vai para o hook junto dos filtros", async () => {
    const usuario = userEvent.setup();
    renderPage();

    expect(screen.queryByRole("textbox", { name: /buscar scripts/i })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /buscar scripts/i }));
    await usuario.click(screen.getByRole("button", { name: "WhatsApp" }));
    await usuario.type(screen.getByRole("textbox", { name: /buscar scripts/i }), "objecao");

    await waitFor(() =>
      expect(ultimosFiltros()).toMatchObject({ tipo: "sdr", canal: "whatsapp", busca: "objecao" }),
    );
  });

  it("so o termo final vai ao hook — as letras do meio nao viram consulta", async () => {
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /buscar scripts/i }));
    await usuario.type(screen.getByRole("textbox", { name: /buscar scripts/i }), "objecao");
    await waitFor(() => expect(ultimosFiltros()).toMatchObject({ busca: "objecao" }));

    const termos = new Set(vi.mocked(useScripts).mock.calls.map(([f]) => f.busca));
    expect([...termos]).toEqual(["", "objecao"]);
  });

  it("termo sem resultado diz 'nao bate', nao 'nao cadastrado'", async () => {
    const usuario = userEvent.setup();
    papelFalso.papel = "manager";
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /buscar scripts/i }));
    await usuario.type(screen.getByRole("textbox", { name: /buscar scripts/i }), "xyz");

    expect(screen.getByText(/nenhum script bate com estes filtros/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhum script cadastrado/i)).not.toBeInTheDocument();
  });

  it("Esc fecha a lupa, limpa o termo e devolve o foco ao botao da lupa", async () => {
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /buscar scripts/i }));
    await usuario.type(screen.getByRole("textbox", { name: /buscar scripts/i }), "abc");
    await waitFor(() => expect(ultimosFiltros()).toMatchObject({ busca: "abc" }));
    await usuario.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: /buscar scripts/i })).not.toBeInTheDocument();
    expect(ultimosFiltros()).toMatchObject({ busca: "" });
    expect(screen.getByRole("button", { name: /buscar scripts/i })).toHaveFocus();
  });

  it("o X tambem devolve o foco ao botao da lupa", async () => {
    const usuario = userEvent.setup();
    renderPage();

    await usuario.click(screen.getByRole("button", { name: /buscar scripts/i }));
    await usuario.click(screen.getByRole("button", { name: /fechar busca/i }));

    expect(screen.getByRole("button", { name: /buscar scripts/i })).toHaveFocus();
  });
});
