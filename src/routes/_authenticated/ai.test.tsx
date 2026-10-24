import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LIMITE_DE_CONVERSA_ABERTA } from "@/modules/ai/domain/pergunta";

const { listar, carregar, apagarConversa, renomearConversa } = vi.hoisted(() => ({
  listar: vi.fn(),
  carregar: vi.fn(),
  apagarConversa: vi.fn(),
  renomearConversa: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
  createServerFn: () => ({ handler: (fn: unknown) => fn }),
}));
vi.mock("@/lib/ai.functions", () => ({
  aiAnalyze: vi.fn(),
  carregarConversa: carregar,
  listarConversas: listar,
}));
vi.mock("@/modules/ai/api/conversas.repository", () => ({ apagarConversa, renomearConversa }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ papel: "member", meuId: "u1" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const { aiAnalyze } = await import("@/lib/ai.functions");
const { toast } = await import("sonner");
const { PaginaDaIa } = await import("./ai");

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PaginaDaIa />
    </QueryClientProvider>,
  );
}

describe("seletor de conversas em /ai", () => {
  it("falha ao ler o histórico NÃO vira seletor vazio", async () => {
    listar.mockRejectedValue(new Error("sem rede"));

    renderizar();

    expect(await screen.findByText(/não foi possível ler o histórico de conversas/i)).toBeVisible();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nova conversa/i })).toBeInTheDocument();
  });

  it("histórico lido sem erro continua mostrando o seletor", async () => {
    listar.mockResolvedValue([{ id: "c1", titulo: "Pipeline parado" }]);

    renderizar();

    expect(await screen.findByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByText(/não foi possível ler/i)).not.toBeInTheDocument();
  });
});

describe("teto da pergunta em /ai (AI-3)", () => {
  it("um caractere acima do teto desabilita o envio e diz o tamanho; no teto, envia", async () => {
    listar.mockResolvedValue([]);
    renderizar();

    const caixa = await screen.findByRole("textbox", { name: /pergunta para o assistente/i });
    const enviar = screen.getByRole("button", { name: /enviar/i });

    fireEvent.change(caixa, { target: { value: "a".repeat(8001) } });
    expect(caixa).not.toHaveAttribute("maxlength");
    expect(enviar).toBeDisabled();
    const excesso = screen.getByText("A pergunta tem 8.001 caracteres; o máximo é 8.000.");
    expect(excesso).toBeVisible();
    expect(excesso).toHaveAttribute("role", "alert");

    fireEvent.change(caixa, { target: { value: "a".repeat(8000) } });
    expect(enviar).toBeEnabled();
    const contador = screen.getByText("8.000 / 8.000");
    expect(contador).toBeVisible();
    expect(contador).not.toHaveAttribute("role");
    expect(contador).not.toHaveAttribute("aria-live");
  });
});

describe("reabrir conversa avisa quando o histórico foi cortado (AI-5)", () => {
  const mensagens = (quantas: number) =>
    Array.from({ length: quantas }, (_, i) => ({
      id: `m${i}`,
      papel: "user" as const,
      conteudo: `pergunta ${i}`,
      criadaEm: "2026-09-21T12:00:00.000Z",
    }));

  async function abrirConversaComHistorico(quantas: number) {
    const user = userEvent.setup();
    listar.mockResolvedValue([{ id: "c1", titulo: "Pipeline parado" }]);
    carregar.mockResolvedValue(mensagens(quantas));
    renderizar();

    await user.click(await screen.findByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Pipeline parado" }));
    await screen.findByText(`pergunta ${quantas - 1}`);
  }

  const AVISO =
    "O começo desta conversa (antes das últimas 200 mensagens) pode não estar sendo mostrado.";

  it("🔴 histórico no teto (200): avisa que o começo PODE não estar sendo mostrado", async () => {
    expect(LIMITE_DE_CONVERSA_ABERTA).toBe(200);
    await abrirConversaComHistorico(LIMITE_DE_CONVERSA_ABERTA);

    expect(screen.getByText(AVISO)).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando as últimas/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /nova conversa/i }));
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });

  it("histórico abaixo do teto (199): nenhum aviso", async () => {
    await abrirConversaComHistorico(LIMITE_DE_CONVERSA_ABERTA - 1);

    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });
});

describe("pergunta que falha sem Error cai no fallback da tela (item 3 da fix wave)", () => {
  it("🔴 rejeição SEM Error → 'Não foi possível perguntar.'", async () => {
    listar.mockResolvedValue([]);
    vi.mocked(aiAnalyze).mockRejectedValueOnce({ message: "", code: "" });
    renderizar();

    const caixa = await screen.findByRole("textbox", { name: /pergunta para o assistente/i });
    fireEvent.change(caixa, { target: { value: "quantas tarefas vencidas?" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível perguntar."));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("Error da server function mantém a frase dela", async () => {
    listar.mockResolvedValue([]);
    vi.mocked(aiAnalyze).mockRejectedValueOnce(new Error("A pergunta passa de 8.000 caracteres."));
    renderizar();

    const caixa = await screen.findByRole("textbox", { name: /pergunta para o assistente/i });
    fireEvent.change(caixa, { target: { value: "oi" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("A pergunta passa de 8.000 caracteres."),
    );
  });
});

describe("conversa reaberta mostra a resposta da IA sem travessão", () => {
  const T = String.fromCharCode(0x2014);
  const M = String.fromCharCode(0x2013);

  it("🔴 resposta gravada com travessão e meia-risca; a pergunta da pessoa fica como foi escrita", async () => {
    const user = userEvent.setup();
    listar.mockResolvedValue([{ id: "c1", titulo: "Pipeline parado" }]);
    carregar.mockResolvedValue([
      {
        id: "m0",
        papel: "user" as const,
        conteudo: `minha pergunta ${T} com traço`,
        criadaEm: "2026-10-06T12:00:00.000Z",
      },
      {
        id: "m1",
        papel: "assistant" as const,
        conteudo: `Receita ${T} 3${M}5 meses`,
        criadaEm: "2026-10-06T12:00:01.000Z",
      },
    ]);
    renderizar();

    await user.click(await screen.findByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Pipeline parado" }));

    expect(await screen.findByText("Receita, 3 a 5 meses")).toBeVisible();
    expect(screen.getByText(`minha pergunta ${T} com traço`)).toBeVisible();
    const texto = document.body.textContent ?? "";
    expect(texto.split(T)).toHaveLength(2);
    expect(texto).not.toContain(M);
  });
});

describe("apagar a conversa aberta em /ai (D-067)", () => {
  async function abrirPipelineParado() {
    const user = userEvent.setup();
    listar.mockResolvedValue([{ id: "c1", titulo: "Pipeline parado" }]);
    carregar.mockResolvedValue([
      {
        id: "m0",
        papel: "user" as const,
        conteudo: "quais oportunidades estão paradas?",
        criadaEm: "2026-10-06T12:00:00.000Z",
      },
    ]);
    renderizar();

    await user.click(await screen.findByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Pipeline parado" }));
    await screen.findByText("quais oportunidades estão paradas?");
    return user;
  }

  it("sem conversa aberta, o botão não aparece", async () => {
    listar.mockResolvedValue([{ id: "c1", titulo: "Pipeline parado" }]);
    renderizar();

    await screen.findByRole("combobox");
    expect(screen.queryByRole("button", { name: /apagar conversa/i })).not.toBeInTheDocument();
  });

  it("com uma conversa aberta, o botão aparece; Nova conversa o esconde de novo", async () => {
    await abrirPipelineParado();

    expect(screen.getByRole("button", { name: /apagar conversa/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /nova conversa/i }));
    expect(screen.queryByRole("button", { name: /apagar conversa/i })).not.toBeInTheDocument();
  });

  it("🔴 confirmar apaga pelo id, relê a lista e volta à conversa nova", async () => {
    apagarConversa.mockReset();
    apagarConversa.mockResolvedValue(undefined);
    const user = await abrirPipelineParado();
    const leiturasAntes = listar.mock.calls.length;

    await user.click(screen.getByRole("button", { name: /apagar conversa/i }));
    expect(
      screen.getByRole("alertdialog", { name: 'Apagar "Pipeline parado"?' }),
    ).toBeInTheDocument();
    expect(screen.getByText("Apaga a conversa e as mensagens dela.")).toBeInTheDocument();
    expect(apagarConversa).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));

    expect(apagarConversa).toHaveBeenCalledTimes(1);
    expect(apagarConversa).toHaveBeenCalledWith("c1");
    await waitFor(() =>
      expect(screen.queryByText("quais oportunidades estão paradas?")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Faça uma pergunta para começar.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apagar conversa/i })).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Conversa apagada.");
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThan(leiturasAntes));
  });

  it("recusa do banco mantém a conversa na tela e avisa", async () => {
    apagarConversa.mockReset();
    apagarConversa.mockRejectedValue(new Error("Só quem abriu a conversa pode apagá-la."));
    const user = await abrirPipelineParado();

    await user.click(screen.getByRole("button", { name: /apagar conversa/i }));
    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Só quem abriu a conversa pode apagá-la."),
    );
    expect(screen.getByText("quais oportunidades estão paradas?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apagar conversa/i })).toBeInTheDocument();
  });

  it("conversa sem título: o diálogo pergunta por 'esta conversa'", async () => {
    const user = userEvent.setup();
    listar.mockResolvedValue([{ id: "c2", titulo: null }]);
    carregar.mockResolvedValue([]);
    renderizar();

    await user.click(await screen.findByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "(sem título)" }));
    await user.click(await screen.findByRole("button", { name: /apagar conversa/i }));

    expect(screen.getByRole("alertdialog", { name: "Apagar esta conversa?" })).toBeInTheDocument();
  });
});

describe("renomear a conversa aberta em /ai (A1.6)", () => {
  beforeEach(() => {
    renomearConversa.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  const AVISO_EM_BRANCO = "O nome da conversa não pode ficar em branco.";

  async function abrirPipelineParado() {
    const user = userEvent.setup();
    listar.mockResolvedValue([{ id: "c1", titulo: "Pipeline parado" }]);
    carregar.mockResolvedValue([
      {
        id: "m0",
        papel: "user" as const,
        conteudo: "quais oportunidades estão paradas?",
        criadaEm: "2026-10-06T12:00:00.000Z",
      },
    ]);
    renderizar();

    await user.click(await screen.findByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Pipeline parado" }));
    await screen.findByText("quais oportunidades estão paradas?");
    return user;
  }

  it("sem conversa aberta, o botão não aparece", async () => {
    listar.mockResolvedValue([{ id: "c1", titulo: "Pipeline parado" }]);
    renderizar();

    await screen.findByRole("combobox");
    expect(screen.queryByRole("button", { name: /renomear conversa/i })).not.toBeInTheDocument();
  });

  it("salvar grava pelo id, avisa uma vez, fecha e relê a lista", async () => {
    renomearConversa.mockResolvedValue(undefined);
    const user = await abrirPipelineParado();
    const leiturasAntes = listar.mock.calls.length;

    await user.click(screen.getByRole("button", { name: /renomear conversa/i }));
    const campo = screen.getByLabelText("Nome da conversa");
    expect(campo).toHaveValue("Pipeline parado");
    expect(campo).toHaveAttribute("maxlength", "60");
    await user.clear(campo);
    await user.type(campo, "Funil de outubro");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(renomearConversa).toHaveBeenCalledWith("c1", "Funil de outubro"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Conversa renomeada."));
    await waitFor(() =>
      expect(screen.queryByLabelText("Nome da conversa")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThan(leiturasAntes));
    expect(renomearConversa).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("recusa do banco avisa uma vez e mantém o diálogo aberto com o texto", async () => {
    renomearConversa.mockRejectedValue(new Error("Só quem abriu a conversa pode renomeá-la."));
    const user = await abrirPipelineParado();

    await user.click(screen.getByRole("button", { name: /renomear conversa/i }));
    const campo = screen.getByLabelText("Nome da conversa");
    await user.clear(campo);
    await user.type(campo, "Funil de outubro");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Só quem abriu a conversa pode renomeá-la."),
    );
    expect(screen.getByLabelText("Nome da conversa")).toHaveValue("Funil de outubro");
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("nome em branco trava o Salvar, diz por quê e liga a frase ao campo", async () => {
    const user = await abrirPipelineParado();

    await user.click(screen.getByRole("button", { name: /renomear conversa/i }));
    const campo = screen.getByLabelText("Nome da conversa");
    expect(campo).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();

    await user.clear(campo);

    expect(screen.getByText(AVISO_EM_BRANCO)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription(AVISO_EM_BRANCO);
  });

  it("conversa sem título: abre sem acusar erro, mas o Salvar já fica travado", async () => {
    const user = userEvent.setup();
    listar.mockResolvedValue([{ id: "c2", titulo: null }]);
    carregar.mockResolvedValue([]);
    renderizar();

    await user.click(await screen.findByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "(sem título)" }));
    await user.click(await screen.findByRole("button", { name: /renomear conversa/i }));

    const campo = screen.getByLabelText("Nome da conversa");
    expect(campo).toHaveValue("");
    expect(screen.queryByText(AVISO_EM_BRANCO)).not.toBeInTheDocument();
    expect(campo).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    await user.type(campo, "x");
    await user.clear(campo);
    expect(screen.getByText(AVISO_EM_BRANCO)).toBeInTheDocument();
  });

  it("Enter no campo salva; em branco, não grava", async () => {
    renomearConversa.mockResolvedValue(undefined);
    const user = await abrirPipelineParado();

    await user.click(screen.getByRole("button", { name: /renomear conversa/i }));
    const campo = screen.getByLabelText("Nome da conversa");
    await user.clear(campo);
    await user.keyboard("{Enter}");
    expect(renomearConversa).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nome da conversa")).toBeInTheDocument();

    await user.type(campo, "Funil de outubro{Enter}");
    await waitFor(() => expect(renomearConversa).toHaveBeenCalledWith("c1", "Funil de outubro"));
    expect(renomearConversa).toHaveBeenCalledTimes(1);
  });

  it("reabrir mostra o nome de agora, não o rascunho que ficou", async () => {
    const user = await abrirPipelineParado();

    await user.click(screen.getByRole("button", { name: /renomear conversa/i }));
    await user.clear(screen.getByLabelText("Nome da conversa"));
    await user.type(screen.getByLabelText("Nome da conversa"), "rascunho");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("Nome da conversa")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /renomear conversa/i }));
    expect(screen.getByLabelText("Nome da conversa")).toHaveValue("Pipeline parado");
    expect(renomearConversa).not.toHaveBeenCalled();
  });

  it("Esc fecha o diálogo parado; durante a gravação, não", async () => {
    let terminar: () => void = () => undefined;
    renomearConversa.mockReturnValue(
      new Promise<void>((resolve) => {
        terminar = resolve;
      }),
    );
    const user = await abrirPipelineParado();

    await user.click(screen.getByRole("button", { name: /renomear conversa/i }));
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByLabelText("Nome da conversa")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /renomear conversa/i }));
    const campo = screen.getByLabelText("Nome da conversa");
    await user.clear(campo);
    await user.type(campo, "Funil de outubro");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(renomearConversa).toHaveBeenCalledTimes(1));

    await user.keyboard("{Escape}");
    expect(screen.getByLabelText("Nome da conversa")).toHaveValue("Funil de outubro");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    await act(async () => terminar());
    await waitFor(() =>
      expect(screen.queryByLabelText("Nome da conversa")).not.toBeInTheDocument(),
    );
  });

  it("🔴 trocar de conversa com o diálogo aberto fecha o diálogo e não grava na outra", async () => {
    const user = userEvent.setup();
    let terminarALeituraDeB: () => void = () => undefined;
    const leituraDeB = new Promise<readonly unknown[]>((resolve) => {
      terminarALeituraDeB = () =>
        resolve([
          {
            id: "m1",
            papel: "user" as const,
            conteudo: "pergunta da conversa B",
            criadaEm: "2026-10-06T12:00:00.000Z",
          },
        ]);
    });
    listar.mockResolvedValue([
      { id: "c1", titulo: "Pipeline parado" },
      { id: "c2", titulo: "Funil de setembro" },
    ]);
    carregar.mockImplementation(({ data }: { data: { conversaId: string } }) =>
      data.conversaId === "c1"
        ? Promise.resolve([
            {
              id: "m0",
              papel: "user" as const,
              conteudo: "pergunta da conversa A",
              criadaEm: "2026-10-06T12:00:00.000Z",
            },
          ])
        : leituraDeB,
    );
    renomearConversa.mockResolvedValue(undefined);
    renderizar();

    await user.click(await screen.findByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Pipeline parado" }));
    await screen.findByText("pergunta da conversa A");

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Funil de setembro" }));
    await user.click(screen.getByRole("button", { name: /renomear conversa/i }));
    expect(screen.getByLabelText("Nome da conversa")).toHaveValue("Pipeline parado");

    await act(async () => terminarALeituraDeB());
    await screen.findByText("pergunta da conversa B");

    expect(screen.queryByLabelText("Nome da conversa")).not.toBeInTheDocument();
    expect(renomearConversa).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /renomear conversa/i }));
    expect(screen.getByLabelText("Nome da conversa")).toHaveValue("Funil de setembro");
  });

  it("o botão fica desabilitado enquanto a pergunta está sendo respondida", async () => {
    vi.mocked(aiAnalyze).mockReturnValueOnce(new Promise<never>(() => undefined));
    await abrirPipelineParado();
    expect(screen.getByRole("button", { name: /renomear conversa/i })).toBeEnabled();

    const caixa = screen.getByRole("textbox", { name: /pergunta para o assistente/i });
    fireEvent.change(caixa, { target: { value: "e as tarefas?" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /renomear conversa/i })).toBeDisabled(),
    );
  });
});
