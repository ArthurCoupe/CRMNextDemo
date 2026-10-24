import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const listasDoFormulario = {
  clientes: { data: [] as unknown[], isError: false },
  pessoas: { data: [] as unknown[], isError: false },
};

const cancelar = { mutate: vi.fn(), isPending: false };
const apagar = { mutate: vi.fn(), isPending: false };
const desfazer = { mutate: vi.fn(), isPending: false };
const criar = { mutate: vi.fn(), isPending: false };
const atualizar = { mutate: vi.fn(), isPending: false };

vi.mock("../hooks/use-meetings", () => ({
  useReunioes: vi.fn(() => ({ data: [], isLoading: false, isPending: false, isError: false })),
  useCancelarReuniao: () => cancelar,
  useApagarReuniao: () => apagar,
  useDesfazerCancelamento: () => desfazer,
  useCriarReuniao: () => criar,
  useAtualizarReuniao: () => atualizar,
  useConflitos: () => ({ data: [] }),
  useClientesParaSelecao: () => listasDoFormulario.clientes,
  useBuscaDeOportunidades: vi.fn(() => ({ data: undefined, isError: false, isFetching: false })),
  useStaffParaSelecao: () => listasDoFormulario.pessoas,
  usePreparacao: vi.fn(() => ({
    data: undefined,
    isPending: true,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  })),
}));

const papelFalso = { papel: "member" as string | null, meuId: "organizador-1", carregando: false };
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => papelFalso }));

const { MeetingsPage } = await import("./meetings-page");
const { useBuscaDeOportunidades, useReunioes, usePreparacao } =
  await import("../hooks/use-meetings");
const { formatDateTime } = await import("@/shared/lib/date");
const { MENSAGEM_DO_TETO_DE_REUNIOES } = await import("../domain/meeting");

function reuniao(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "r1",
    titulo: "Kickoff Acme",
    tipo: "kickoff_cliente" as const,
    startsAt: "2026-09-10T14:00:00.000Z",
    duracaoMinutos: 60,
    clienteId: "c1",
    clienteNome: "Acme",
    oportunidadeId: null,
    oportunidadeNome: null,
    organizadorId: "organizador-1",
    local: null,
    notas: null,
    canceladaEm: null,
    motivoDoCancelamento: null,
    participantes: [],
    cancelamentosDesfeitos: [],
    ...overrides,
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MeetingsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-09-09T12:00:00.000Z"));
  papelFalso.papel = "member";
  papelFalso.meuId = "organizador-1";
  listasDoFormulario.clientes = { data: [], isError: false };
  listasDoFormulario.pessoas = { data: [], isError: false };
  cancelar.mutate.mockClear();
  apagar.mutate.mockClear();
  desfazer.mutate.mockClear();
  desfazer.isPending = false;
  vi.mocked(useReunioes).mockReturnValue({
    data: [],
    isLoading: false,
    isPending: false,
    isError: false,
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

function comPassadaEFutura() {
  vi.mocked(useReunioes).mockReturnValue({
    data: [
      reuniao({ id: "passada", titulo: "Reunião passada", startsAt: "2020-01-01T12:00:00.000Z" }),
      reuniao({ id: "futura", titulo: "Reunião futura", startsAt: "2099-01-01T12:00:00.000Z" }),
    ],
    isLoading: false,
    isPending: false,
    isError: false,
  } as never);
}

describe("passadas recolhidas (achado 6 da revisão adversarial)", () => {
  it("passada não aparece antes do clique, e a futura aparece", () => {
    comPassadaEFutura();

    renderPage();

    expect(screen.getByText("Reunião futura")).toBeInTheDocument();
    expect(screen.queryByText("Reunião passada")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mostrar passadas \(1\)/ })).toBeInTheDocument();
  });

  it("o toggle abre as passadas, e elas ficam ABAIXO das futuras", async () => {
    comPassadaEFutura();
    const user = userEvent.setup();

    renderPage();
    await user.click(screen.getByRole("button", { name: /Mostrar passadas/ }));

    const titulos = screen.getAllByText(/Reunião (passada|futura)/).map((el) => el.textContent);
    expect(titulos).toContain("Reunião passada");
    expect(titulos.indexOf("Reunião futura")).toBeLessThan(titulos.indexOf("Reunião passada"));
    expect(screen.getByRole("button", { name: /Ocultar passadas/ })).toBeInTheDocument();
  });

  it("sem reunião passada, o toggle não existe", () => {
    vi.mocked(useReunioes).mockReturnValue({
      data: [
        reuniao({ id: "futura", titulo: "Reunião futura", startsAt: "2099-01-01T12:00:00.000Z" }),
      ],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    expect(screen.queryByRole("button", { name: /passadas/ })).not.toBeInTheDocument();
  });
});

describe("erro de leitura", () => {
  it("mostra FalhaAoLer e nunca 'nenhuma reunião'", () => {
    vi.mocked(useReunioes).mockReturnValue({
      data: undefined,
      isLoading: false,
      isPending: false,
      isError: true,
    } as never);

    renderPage();

    expect(screen.getByText(/Não foi possível ler/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhuma reunião/i)).not.toBeInTheDocument();
  });

  it("MEET-2: erro do teto mostra a própria mensagem, não 'falha de conexão'", () => {
    vi.mocked(useReunioes).mockReturnValue({
      data: undefined,
      isLoading: false,
      isPending: false,
      isError: true,
      error: new Error(MENSAGEM_DO_TETO_DE_REUNIOES),
    } as never);

    renderPage();

    expect(screen.getByText(MENSAGEM_DO_TETO_DE_REUNIOES)).toBeInTheDocument();
    expect(screen.queryByText(/falha de conexão/i)).not.toBeInTheDocument();
  });

  it("MEET-2: outro erro mantém o texto padrão de FalhaAoLer", () => {
    vi.mocked(useReunioes).mockReturnValue({
      data: undefined,
      isLoading: false,
      isPending: false,
      isError: true,
      error: new Error("A lista de reuniões veio no teto"),
    } as never);

    renderPage();

    expect(screen.getByText(/falha de conexão/i)).toBeInTheDocument();
  });
});

describe("estado vazio", () => {
  it("quem pode criar vê texto de criar o primeiro", () => {
    papelFalso.papel = "manager";
    renderPage();
    expect(screen.getByText(/crie a primeira/i)).toBeInTheDocument();
  });

  it("quem não pode criar vê texto diferente, sem convite para criar", () => {
    papelFalso.papel = "client";
    renderPage();
    expect(screen.queryByText(/crie a primeira/i)).not.toBeInTheDocument();
    expect(screen.getByText(/nenhuma reunião de/i)).toBeInTheDocument();
  });

  it("MEET-1: o vazio diz o período exibido, não 'registrada ainda'", () => {
    renderPage();

    expect(screen.getByText("Nenhuma reunião de 09/08/2026 a 09/12/2026")).toBeInTheDocument();
    expect(screen.queryByText(/registrada ainda/i)).not.toBeInTheDocument();
  });
});

describe("MEET-1: filtro de período", () => {
  it("as duas datas nascem com a janela padrão e alimentam a consulta", () => {
    renderPage();

    expect(screen.getByLabelText(/^desde$/i)).toHaveValue("2026-08-09");
    expect(screen.getByLabelText(/^até$/i)).toHaveValue("2026-12-09");

    const filtros = vi.mocked(useReunioes).mock.calls.at(-1)?.[0];
    expect(filtros?.desde).toBe("2026-08-09T03:00:00.000Z");
    expect(filtros?.ate).toBe("2026-12-10T02:59:59.999Z");
  });

  it("mudar 'Até' refaz a consulta com o novo limite", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/^até$/i), { target: { value: "2027-01-31" } });

    const filtros = vi.mocked(useReunioes).mock.calls.at(-1)?.[0];
    expect(filtros?.ate).toBe("2027-02-01T02:59:59.999Z");
    expect(filtros?.desde).toBe("2026-08-09T03:00:00.000Z");
  });

  it("ano implausível não muda a janela nem derruba a tela; ano plausível muda", () => {
    renderPage();
    const desde = screen.getByLabelText(/^desde$/i);

    expect(() => fireEvent.change(desde, { target: { value: "0002-08-09" } })).not.toThrow();
    expect(desde).toHaveValue("0002-08-09");
    expect(vi.mocked(useReunioes).mock.calls.at(-1)?.[0]?.desde).toBe("2026-08-09T03:00:00.000Z");
    expect(screen.getByText(/de 09\/08\/2026 a 09\/12\/2026/)).toBeInTheDocument();

    fireEvent.change(desde, { target: { value: "2026-08-01" } });
    expect(vi.mocked(useReunioes).mock.calls.at(-1)?.[0]?.desde).toBe("2026-08-01T03:00:00.000Z");
  });

  it("com reuniões na lista, o rodapé diz o período exibido", () => {
    comPassadaEFutura();
    renderPage();

    expect(screen.getByText(/de 09\/08\/2026 a 09\/12\/2026/)).toBeInTheDocument();
  });
});

describe("vínculo na linha da lista", () => {
  it("proposta para prospect mostra o nome da oportunidade, não só o tipo", () => {
    vi.mocked(useReunioes).mockReturnValue({
      data: [
        reuniao({
          id: "prop",
          titulo: "Proposta Acme",
          tipo: "proposta_para_prospect",
          clienteId: null,
          clienteNome: null,
          oportunidadeId: "opp-1",
          oportunidadeNome: "Prospect Acme",
        }),
      ],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    expect(screen.getByText(/Prospect Acme/)).toBeInTheDocument();
  });
});

describe("reunião cancelada", () => {
  it("continua na lista, riscada, com o motivo", () => {
    vi.mocked(useReunioes).mockReturnValue({
      data: [
        reuniao({
          id: "cancelada",
          titulo: "Semanal cancelada",
          canceladaEm: "2026-09-08T12:00:00.000Z",
          motivoDoCancelamento: "Cliente remarcou",
        }),
      ],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    const titulo = screen.getByText("Semanal cancelada");
    expect(titulo).toHaveClass("line-through");
    expect(screen.getByText(/Cliente remarcou/)).toBeInTheDocument();
  });
});

describe("hora exibida", () => {
  it("usa formatDateTime (São Paulo), não o fuso do navegador", () => {
    const startsAt = "2026-09-10T14:00:00.000Z";
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ startsAt })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    const esperado = formatDateTime(startsAt);
    expect(
      screen.getByText((_, node) => node?.textContent?.startsWith(esperado) === true),
    ).toBeInTheDocument();
  });
});

describe("botão de cancelar", () => {
  it("organizador vê o botão de cancelar", () => {
    papelFalso.meuId = "organizador-1";
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ organizadorId: "organizador-1" })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("quem não organizou não vê o botão de cancelar", () => {
    papelFalso.meuId = "outra-pessoa";
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ organizadorId: "organizador-1" })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    expect(screen.queryByRole("button", { name: /cancelar/i })).not.toBeInTheDocument();
  });

  it("preenche o motivo, confirma e chama a mutação com id e motivo certos", async () => {
    const user = userEvent.setup();
    papelFalso.meuId = "organizador-1";
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ id: "r-cancelar", organizadorId: "organizador-1" })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));
    await user.type(screen.getByLabelText(/motivo do cancelamento/i), "Cliente remarcou");
    await user.click(screen.getByRole("button", { name: /^cancelar reunião$/i }));

    expect(cancelar.mutate).toHaveBeenCalledWith({
      id: "r-cancelar",
      motivo: "Cliente remarcou",
    });
  });

  it("não confirma com motivo vazio", async () => {
    const user = userEvent.setup();
    papelFalso.meuId = "organizador-1";
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ id: "r-vazio", organizadorId: "organizador-1" })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(screen.getByRole("button", { name: /^cancelar reunião$/i })).toBeDisabled();
    expect(cancelar.mutate).not.toHaveBeenCalled();
  });

  it("owner vê o botão de cancelar em reunião de outro organizador", () => {
    papelFalso.papel = "owner";
    papelFalso.meuId = "outra-pessoa";
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ organizadorId: "organizador-1" })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    expect(screen.getByRole("button", { name: /^cancelar$/i })).toBeInTheDocument();
  });

  it("member que não organizou não vê o botão de cancelar", () => {
    papelFalso.papel = "member";
    papelFalso.meuId = "outra-pessoa";
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ organizadorId: "organizador-1" })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    expect(screen.queryByRole("button", { name: /^cancelar$/i })).not.toBeInTheDocument();
  });
});

describe("botão de apagar (D-067)", () => {
  function comReunioes(...lista: ReturnType<typeof reuniao>[]) {
    vi.mocked(useReunioes).mockReturnValue({
      data: lista,
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);
  }

  it("organizador vê o botão de apagar", () => {
    papelFalso.meuId = "organizador-1";
    comReunioes(reuniao({ organizadorId: "organizador-1" }));

    renderPage();

    expect(screen.getByRole("button", { name: /^apagar$/i })).toBeInTheDocument();
  });

  it("member que não organizou não vê o botão de apagar", () => {
    papelFalso.papel = "member";
    papelFalso.meuId = "outra-pessoa";
    comReunioes(reuniao({ organizadorId: "organizador-1" }));

    renderPage();

    expect(screen.queryByRole("button", { name: /^apagar$/i })).not.toBeInTheDocument();
  });

  it("owner e manager veem o botão em reunião de outro organizador", () => {
    papelFalso.meuId = "outra-pessoa";
    comReunioes(reuniao({ organizadorId: "organizador-1" }));

    papelFalso.papel = "owner";
    const { unmount } = renderPage();
    expect(screen.getByRole("button", { name: /^apagar$/i })).toBeInTheDocument();
    unmount();

    papelFalso.papel = "manager";
    renderPage();
    expect(screen.getByRole("button", { name: /^apagar$/i })).toBeInTheDocument();
  });

  it("confirmar apaga a reunião clicada, e o diálogo nomeia a reunião e diz o que sai", async () => {
    const user = userEvent.setup();
    comReunioes(
      reuniao({ id: "r-outra", titulo: "Outra reunião", startsAt: "2026-09-11T14:00:00.000Z" }),
      reuniao({ id: "r-apagar", titulo: "Kickoff Acme", startsAt: "2026-09-12T14:00:00.000Z" }),
    );

    renderPage();

    await user.click(screen.getAllByRole("button", { name: /^apagar$/i })[1]);
    expect(screen.getByRole("alertdialog", { name: 'Apagar "Kickoff Acme"?' })).toBeInTheDocument();
    expect(screen.getByText("Apaga a reunião e a lista de participantes.")).toBeInTheDocument();
    expect(
      screen.getByText("Para manter o registro de que ela não aconteceu, use Cancelar."),
    ).toBeInTheDocument();
    expect(apagar.mutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));

    expect(apagar.mutate).toHaveBeenCalledTimes(1);
    expect(apagar.mutate).toHaveBeenCalledWith("r-apagar");
  });

  it("Cancelar no diálogo não apaga", async () => {
    const user = userEvent.setup();
    comReunioes(reuniao({ id: "r-fica" }));

    renderPage();

    await user.click(screen.getByRole("button", { name: /^apagar$/i }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(apagar.mutate).not.toHaveBeenCalled();
  });

  it("reunião cancelada também se apaga, sem mandar usar Cancelar", async () => {
    const user = userEvent.setup();
    comReunioes(
      reuniao({
        id: "r-cancelada",
        canceladaEm: "2026-09-08T12:00:00.000Z",
        motivoDoCancelamento: "Cliente remarcou",
      }),
    );

    renderPage();

    await user.click(screen.getByRole("button", { name: /^apagar$/i }));
    expect(screen.getByText("Apaga a reunião e a lista de participantes.")).toBeInTheDocument();
    expect(screen.queryByText(/use Cancelar/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));
    expect(apagar.mutate).toHaveBeenCalledWith("r-cancelada");
  });
});

describe("desfazer cancelamento (D-069, C6)", () => {
  function comReunioes(...lista: ReturnType<typeof reuniao>[]) {
    vi.mocked(useReunioes).mockReturnValue({
      data: lista,
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);
  }
  const CANCELADA_EM = "2026-09-08T12:00:00.000Z";
  const CANCELADA = reuniao({
    id: "r-cancelada",
    canceladaEm: CANCELADA_EM,
    motivoDoCancelamento: "Cliente remarcou",
  });

  it("organizador desfaz depois de confirmar, mandando o cancelada_em que a tela leu", async () => {
    const user = userEvent.setup();
    papelFalso.meuId = "organizador-1";
    comReunioes(CANCELADA);
    renderPage();

    await user.click(screen.getByRole("button", { name: "Desfazer cancelamento" }));
    expect(
      screen.getByRole("alertdialog", { name: 'Desfazer o cancelamento de "Kickoff Acme"?' }),
    ).toBeInTheDocument();
    expect(desfazer.mutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(desfazer.mutate).toHaveBeenCalledTimes(1);
    expect(desfazer.mutate).toHaveBeenCalledWith({ id: "r-cancelada", canceladaEm: CANCELADA_EM });
  });

  it("o diálogo mostra a data (São Paulo) e o motivo do cancelamento que vai sair", async () => {
    const user = userEvent.setup();
    papelFalso.meuId = "organizador-1";
    comReunioes(CANCELADA);
    renderPage();

    await user.click(screen.getByRole("button", { name: "Desfazer cancelamento" }));

    const dialogo = within(screen.getByRole("alertdialog"));
    expect(formatDateTime(CANCELADA_EM)).toContain("08/09/2026");
    expect(
      dialogo.getByText(
        `Cancelada em ${formatDateTime(CANCELADA_EM)}. Motivo: Cliente remarcou. A reunião volta à agenda, e esse cancelamento fica no histórico dela.`,
      ),
    ).toBeInTheDocument();
  });

  it("o diálogo diz 'sem motivo' quando o cancelamento não tem motivo", async () => {
    const user = userEvent.setup();
    papelFalso.meuId = "organizador-1";
    comReunioes(reuniao({ id: "r-sem-motivo", canceladaEm: CANCELADA_EM }));
    renderPage();

    await user.click(screen.getByRole("button", { name: "Desfazer cancelamento" }));

    expect(
      within(screen.getByRole("alertdialog")).getByText(/Motivo: sem motivo\./),
    ).toBeInTheDocument();
  });

  it("motivo que já termina em pontuação não ganha ponto duplo, no diálogo e na linha", async () => {
    const user = userEvent.setup();
    papelFalso.meuId = "organizador-1";
    comReunioes(
      reuniao({
        id: "r-ponto",
        canceladaEm: CANCELADA_EM,
        motivoDoCancelamento: "Cliente remarcou.",
        cancelamentosDesfeitos: [
          {
            id: "cd1",
            canceladaEm: CANCELADA_EM,
            motivo: "Vai remarcar?",
            desfeitoEm: "2026-09-08T13:00:00.000Z",
            canceladaPorNome: "Ana",
            desfeitoPorNome: "Bruno",
          },
        ],
      }),
    );
    renderPage();

    await user.click(screen.getByText("Cancelamentos desfeitos (1)"));
    expect(
      within(screen.getByRole("list", { name: "Cancelamentos desfeitos" })).getByRole("listitem")
        .textContent,
    ).toBe(
      `Cancelada por Ana em ${formatDateTime(CANCELADA_EM)}. Motivo: Vai remarcar? Desfeito por Bruno em ${formatDateTime("2026-09-08T13:00:00.000Z")}.`,
    );

    await user.click(screen.getByRole("button", { name: "Desfazer cancelamento" }));
    expect(
      within(screen.getByRole("alertdialog")).getByText(
        `Cancelada em ${formatDateTime(CANCELADA_EM)}. Motivo: Cliente remarcou. A reunião volta à agenda, e esse cancelamento fica no histórico dela.`,
      ),
    ).toBeInTheDocument();
  });

  it("🔴 a ata de cada cancelamento desfeito aparece na linha, para quem só vê a reunião", async () => {
    const user = userEvent.setup();
    papelFalso.meuId = "outra-pessoa";
    comReunioes(
      reuniao({
        id: "r-voltou",
        cancelamentosDesfeitos: [
          {
            id: "cd2",
            canceladaEm: "2026-09-10T12:00:00.000Z",
            motivo: null,
            desfeitoEm: "2026-09-10T13:00:00.000Z",
            canceladaPorNome: null,
            desfeitoPorNome: null,
          },
          {
            id: "cd1",
            canceladaEm: CANCELADA_EM,
            motivo: "Cliente remarcou",
            desfeitoEm: "2026-09-08T13:00:00.000Z",
            canceladaPorNome: "Ana",
            desfeitoPorNome: "Bruno",
          },
        ],
      }),
    );
    renderPage();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();

    await user.click(screen.getByText("Cancelamentos desfeitos (2)"));
    const itens = within(
      screen.getByRole("list", { name: "Cancelamentos desfeitos" }),
    ).getAllByRole("listitem");
    expect(itens.map((li) => li.textContent)).toEqual([
      `Cancelada por autor não identificado em ${formatDateTime("2026-09-10T12:00:00.000Z")}. Motivo: sem motivo. Desfeito por autor não identificado em ${formatDateTime("2026-09-10T13:00:00.000Z")}.`,
      `Cancelada por Ana em ${formatDateTime(CANCELADA_EM)}. Motivo: Cliente remarcou. Desfeito por Bruno em ${formatDateTime("2026-09-08T13:00:00.000Z")}.`,
    ]);
  });

  it("reunião sem cancelamento desfeito não mostra o histórico (controle)", () => {
    comReunioes(reuniao({ id: "r-nunca" }));
    renderPage();
    expect(screen.queryByText(/Cancelamentos desfeitos/)).not.toBeInTheDocument();
  });

  it("Voltar no diálogo não desfaz", async () => {
    const user = userEvent.setup();
    papelFalso.meuId = "organizador-1";
    comReunioes(CANCELADA);
    renderPage();

    await user.click(screen.getByRole("button", { name: "Desfazer cancelamento" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(desfazer.mutate).not.toHaveBeenCalled();
  });

  it("member que não organizou não vê o botão", () => {
    papelFalso.papel = "member";
    papelFalso.meuId = "outra-pessoa";
    comReunioes(CANCELADA);
    renderPage();
    expect(screen.queryByRole("button", { name: "Desfazer cancelamento" })).not.toBeInTheDocument();
    expect(screen.getByText("Kickoff Acme")).toBeInTheDocument();
  });

  it("manager vê em reunião de outro organizador", () => {
    papelFalso.papel = "manager";
    papelFalso.meuId = "outra-pessoa";
    comReunioes(CANCELADA);
    renderPage();
    expect(screen.getByRole("button", { name: "Desfazer cancelamento" })).toBeInTheDocument();
  });

  it("reunião não cancelada não oferece desfazer (controle)", () => {
    comReunioes(reuniao());
    renderPage();
    expect(screen.queryByRole("button", { name: "Desfazer cancelamento" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancelar$/i })).toBeInTheDocument();
  });

  it("reunião cancelada não oferece Cancelar nem Editar, só Desfazer", () => {
    papelFalso.meuId = "organizador-1";
    comReunioes(CANCELADA);
    renderPage();
    expect(screen.queryByRole("button", { name: /^cancelar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desfazer cancelamento" })).toBeInTheDocument();
  });

  it("o botão fica travado enquanto a gravação não termina, e livre quando termina", () => {
    papelFalso.meuId = "organizador-1";
    comReunioes(CANCELADA);

    desfazer.isPending = true;
    const { unmount } = renderPage();
    expect(screen.getByRole("button", { name: "Desfazer cancelamento" })).toBeDisabled();
    unmount();

    desfazer.isPending = false;
    renderPage();
    expect(screen.getByRole("button", { name: "Desfazer cancelamento" })).toBeEnabled();
  });

  it("a reunião cancelada no passado também oferece desfazer, nas passadas abertas", async () => {
    const user = userEvent.setup();
    papelFalso.meuId = "organizador-1";
    comReunioes(
      reuniao({
        id: "r-antiga",
        titulo: "Retro antiga",
        startsAt: "2020-01-01T12:00:00.000Z",
        canceladaEm: CANCELADA_EM,
        motivoDoCancelamento: "Cliente remarcou",
      }),
    );
    renderPage();

    await user.click(screen.getByRole("button", { name: /Mostrar passadas/ }));
    await user.click(screen.getByRole("button", { name: "Desfazer cancelamento" }));
    await user.click(screen.getByRole("button", { name: "Desfazer" }));

    expect(desfazer.mutate).toHaveBeenCalledWith({ id: "r-antiga", canceladaEm: CANCELADA_EM });
  });
});

describe("abrir o formulário", () => {
  it("'Nova reunião' abre o formulário em modo criar, com o título vazio", async () => {
    const user = userEvent.setup();
    papelFalso.papel = "manager";

    renderPage();

    await user.click(screen.getByRole("button", { name: /nova reunião/i }));

    expect(screen.getByRole("heading", { name: "Nova reunião" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^título$/i)).toHaveValue("");
  });

  it("'Editar' abre o formulário com a reunião clicada, não com outra", async () => {
    const user = userEvent.setup();
    papelFalso.papel = "manager";
    vi.mocked(useReunioes).mockReturnValue({
      data: [
        reuniao({ id: "r-a", titulo: "Kickoff Acme", organizadorId: "organizador-1" }),
        reuniao({ id: "r-b", titulo: "Retro Beta", organizadorId: "organizador-2" }),
      ],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    const botoesDeEditar = screen.getAllByRole("button", { name: /^editar$/i });
    await user.click(botoesDeEditar[1]);

    expect(screen.getByRole("heading", { name: "Editar reunião" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^título$/i)).toHaveValue("Retro Beta");
  });
});

describe("podeEditar distingue quem vê o botão de editar", () => {
  it("organizador vê o botão de editar", () => {
    papelFalso.papel = "member";
    papelFalso.meuId = "organizador-1";
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ organizadorId: "organizador-1" })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    expect(screen.getByRole("button", { name: /^editar$/i })).toBeInTheDocument();
  });

  it("member que não organizou não vê o botão de editar", () => {
    papelFalso.papel = "member";
    papelFalso.meuId = "outra-pessoa";
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ organizadorId: "organizador-1" })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
  });

  it("owner vê o botão de editar mesmo sem ter organizado", () => {
    papelFalso.papel = "owner";
    papelFalso.meuId = "outra-pessoa";
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ organizadorId: "organizador-1" })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    expect(screen.getByRole("button", { name: /^editar$/i })).toBeInTheDocument();
  });

  it("manager vê o botão de editar mesmo sem ter organizado", () => {
    papelFalso.papel = "manager";
    papelFalso.meuId = "outra-pessoa";
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ organizadorId: "organizador-1" })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    expect(screen.getByRole("button", { name: /^editar$/i })).toBeInTheDocument();
  });
});

describe("janela de datas (achado 3 da revisão adversarial)", () => {
  it("manda a MESMA janela em renders seguidos, não uma nova a cada render", async () => {
    vi.useRealTimers();
    vi.mocked(useReunioes).mockClear();
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /que eu organizo/i }));

    const chamadas = vi.mocked(useReunioes).mock.calls;
    expect(chamadas.length).toBeGreaterThanOrEqual(2);
    const primeira = chamadas[0][0];
    const ultima = chamadas[chamadas.length - 1][0];
    expect(ultima?.soMinhas).toBe(true);
    expect(ultima?.desde).toBe(primeira?.desde);
    expect(ultima?.ate).toBe(primeira?.ate);
  });

  it("pede uma janela ao hook: 1 mês atrás até 3 meses à frente", () => {
    renderPage();

    const filtros = vi.mocked(useReunioes).mock.calls[0][0];
    expect(filtros).toBeDefined();
    const desde = new Date(filtros?.desde ?? "");
    const ate = new Date(filtros?.ate ?? "");
    const agora = Date.now();

    expect(desde.getTime()).toBeLessThan(agora);
    expect(agora - desde.getTime()).toBeLessThan(40 * 24 * 60 * 60 * 1000);
    expect(ate.getTime()).toBeGreaterThan(agora);
    expect(ate.getTime() - agora).toBeGreaterThan(80 * 24 * 60 * 60 * 1000);
    expect(ate.getTime() - agora).toBeGreaterThan(agora - desde.getTime());
  });

  it("a janela acompanha o filtro 'que eu organizo', sem ser descartada", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Que eu organizo" }));

    const ultimos = vi.mocked(useReunioes).mock.calls.at(-1)?.[0];
    expect(ultimos?.soMinhas).toBe(true);
    expect(typeof ultimos?.desde).toBe("string");
    expect(typeof ultimos?.ate).toBe("string");
  });
});

describe("erro das listas do formulário (achado 7 da revisão adversarial)", () => {
  function comUmaReuniao() {
    vi.mocked(useReunioes).mockReturnValue({
      data: [reuniao({ startsAt: "2099-01-01T12:00:00.000Z" })],
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);
  }

  it("erro na lista de clientes vira texto na tela, nomeando a lista", () => {
    comUmaReuniao();
    listasDoFormulario.clientes = { data: [], isError: true };

    renderPage();

    expect(screen.getByText(/Não foi possível carregar clientes/)).toBeInTheDocument();
    expect(screen.getByText(/indisponível até recarregar a página/)).toBeInTheDocument();
  });

  it("nomeia TODAS as listas que falharam, não só a primeira", () => {
    comUmaReuniao();
    listasDoFormulario.clientes = { data: [], isError: true };
    listasDoFormulario.pessoas = { data: [], isError: true };

    renderPage();

    const aviso = screen.getByText(/Não foi possível carregar/);
    expect(aviso.textContent).toContain("clientes");
    expect(aviso.textContent).toContain("pessoas do time");
  });

  it("com as listas falhando, 'Nova reunião' e 'Editar' ficam desabilitados", () => {
    comUmaReuniao();
    listasDoFormulario.pessoas = { data: [], isError: true };

    renderPage();

    expect(screen.getByRole("button", { name: "Nova reunião" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
  });

  it("abrir a tela não consulta oportunidade nenhuma: 'Nova reunião' não depende disso", () => {
    comUmaReuniao();
    vi.mocked(useBuscaDeOportunidades).mockClear();

    renderPage();

    expect(useBuscaDeOportunidades).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Nova reunião" })).toBeEnabled();
  });

  it("sem erro nenhum, não há aviso e os botões funcionam", () => {
    comUmaReuniao();

    renderPage();

    expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova reunião" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
  });
});

describe("botão Preparar (D-060, critérios 1 e 2)", () => {
  function comReunioes(...lista: ReturnType<typeof reuniao>[]) {
    vi.mocked(useReunioes).mockReturnValue({
      data: lista,
      isLoading: false,
      isPending: false,
      isError: false,
    } as never);
  }

  it("aparece em reunião com cliente e em reunião só com lead", () => {
    comReunioes(
      reuniao({ id: "com-cliente", titulo: "Reunião com cliente" }),
      reuniao({
        id: "com-lead",
        titulo: "Reunião com lead",
        tipo: "proposta_para_prospect",
        clienteId: null,
        clienteNome: null,
        oportunidadeId: "o1",
        oportunidadeNome: "Academia",
      }),
    );
    renderPage();
    expect(screen.getAllByRole("button", { name: "Preparar" })).toHaveLength(2);
  });

  it("não aparece em reunião sem vínculo nem em reunião cancelada", () => {
    comReunioes(
      reuniao({
        id: "interna",
        titulo: "Reunião interna",
        tipo: "interna_de_time",
        clienteId: null,
        clienteNome: null,
      }),
      reuniao({
        id: "cancelada",
        titulo: "Reunião cancelada",
        canceladaEm: "2026-09-08T12:00:00.000Z",
        motivoDoCancelamento: "cliente pediu",
      }),
    );
    renderPage();
    expect(screen.queryByRole("button", { name: "Preparar" })).toBeNull();
    expect(screen.getByText("Reunião interna")).toBeInTheDocument();
    expect(screen.getByText("Reunião cancelada")).toBeInTheDocument();
  });

  it("a ficha só busca ao abrir: antes do clique o hook recebe null; depois, a reunião", () => {
    vi.mocked(usePreparacao).mockClear();
    comReunioes(reuniao());
    renderPage();

    const chamadasAntes = vi.mocked(usePreparacao).mock.calls;
    expect(chamadasAntes.length).toBeGreaterThan(0);
    expect(chamadasAntes.every(([r]) => r === null)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Preparar" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Preparação: Kickoff Acme");
    expect(vi.mocked(usePreparacao)).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "r1" }),
    );
  });
});
