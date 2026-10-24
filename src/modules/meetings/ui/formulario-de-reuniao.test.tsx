import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Reuniao } from "../api/meetings.repository";

const criar = { mutate: vi.fn(), isPending: false };
const atualizar = { mutate: vi.fn(), isPending: false };
let conflitosEncontrados: readonly string[] = [];
let conflitosFalharam = false;
const useConflitosFalso = vi.fn((..._args: unknown[]) => ({
  data: conflitosEncontrados,
  isError: conflitosFalharam,
}));

const buscaDeOportunidades = {
  data: { itens: [{ id: "opp-1", nome: "Prospect Acme" }], haMais: false },
  isError: false,
  isFetching: false,
};

vi.mock("../hooks/use-meetings", () => ({
  useCriarReuniao: () => criar,
  useAtualizarReuniao: () => atualizar,
  useConflitos: (...args: unknown[]) => useConflitosFalso(...args),
  useBuscaDeOportunidades: () => buscaDeOportunidades,
}));

const perfilFalso = {
  papel: "member" as string | null,
  meuId: "eu-1" as string | null,
  carregando: false,
};
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => perfilFalso }));

const { FormularioDeReuniao } = await import("./formulario-de-reuniao");

const CLIENTES = [{ id: "cli-1", nome: "Clínica Vida" }];
const PESSOAS = [
  { id: "p1", nome: "Augusto" },
  { id: "p2", nome: "Bia" },
];

const JANELA = { desde: "2026-09-01", ate: "2026-12-31" };

function renderFormulario(
  reuniao: Reuniao | null = null,
  extras: { aoFechar?: () => void; pessoas?: typeof PESSOAS } = {},
) {
  return render(
    <FormularioDeReuniao
      aberto
      reuniao={reuniao}
      aoFechar={extras.aoFechar ?? (() => undefined)}
      clientes={CLIENTES}
      pessoas={extras.pessoas ?? PESSOAS}
      janela={JANELA}
    />,
  );
}

async function preencherCamposBase(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/título/i), "Reunião de teste");
  await user.type(screen.getByLabelText(/data/i), "2026-10-05");
  await user.type(screen.getByLabelText(/hora/i), "14:00");
}

const REUNIAO_EXISTENTE: Reuniao = {
  id: "m1",
  titulo: "Kickoff Acme",
  tipo: "kickoff_cliente",
  startsAt: "2026-10-05T17:00:00.000Z",
  duracaoMinutos: 45,
  clienteId: "cli-1",
  clienteNome: "Clínica Vida",
  oportunidadeId: null,
  oportunidadeNome: null,
  organizadorId: "org-1",
  local: "Sala 2",
  notas: "Levar proposta",
  canceladaEm: null,
  motivoDoCancelamento: null,
  participantes: [{ id: "p2", nome: "Bia" }],
  cancelamentosDesfeitos: [],
};

beforeEach(() => {
  criar.mutate.mockReset();
  atualizar.mutate.mockReset();
  useConflitosFalso.mockClear();
  perfilFalso.meuId = "eu-1";
  perfilFalso.papel = "member";
  conflitosEncontrados = [];
  conflitosFalharam = false;
});

describe("FormularioDeReuniao — vínculo por tipo", () => {
  it("tipo com cliente mostra o seletor de cliente, não o de oportunidade", () => {
    renderFormulario();
    expect(screen.getByLabelText(/^cliente$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^oportunidade$/i)).not.toBeInTheDocument();
  });

  it("proposta para prospect mostra o seletor de oportunidade, não o de cliente", async () => {
    const user = userEvent.setup();
    renderFormulario();

    await user.selectOptions(screen.getByLabelText(/^tipo$/i), "proposta_para_prospect");

    expect(screen.getByLabelText(/^oportunidade$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^cliente$/i)).not.toBeInTheDocument();
  });

  it("tipo interno não mostra nem cliente nem oportunidade", async () => {
    const user = userEvent.setup();
    renderFormulario();

    await user.selectOptions(screen.getByLabelText(/^tipo$/i), "interna_de_time");

    expect(screen.queryByLabelText(/^cliente$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^oportunidade$/i)).not.toBeInTheDocument();
  });
});

describe("FormularioDeReuniao — Salvar bloqueado pelo vínculo", () => {
  it("fica desabilitado sem o cliente e habilita ao escolher um", async () => {
    const user = userEvent.setup();
    renderFormulario();
    await preencherCamposBase(user);

    const salvar = screen.getByRole("button", { name: /salvar/i });
    expect(salvar).toBeDisabled();

    await user.selectOptions(screen.getByLabelText(/^cliente$/i), "cli-1");
    expect(salvar).not.toBeDisabled();
  });
});

describe("FormularioDeReuniao, oportunidade escolhida pela busca", () => {
  it("Salvar fica desabilitado sem a oportunidade e o payload leva a escolhida", async () => {
    const user = userEvent.setup();
    renderFormulario();
    await preencherCamposBase(user);
    await user.selectOptions(screen.getByLabelText(/^tipo$/i), "proposta_para_prospect");

    const salvar = screen.getByRole("button", { name: /salvar/i });
    expect(salvar).toBeDisabled();

    await user.type(screen.getByLabelText(/^oportunidade$/i), "acme");
    await user.click(screen.getByRole("button", { name: "Prospect Acme" }));
    expect(screen.getByLabelText(/^oportunidade$/i)).toHaveValue("Prospect Acme");
    expect(salvar).not.toBeDisabled();

    await user.click(salvar);
    const [payload] = criar.mutate.mock.calls[0] as [Record<string, unknown>];
    expect(payload.oportunidadeId).toBe("opp-1");
    expect(payload.clienteId).toBeNull();
  });

  it("editar reunião com oportunidade mostra a já vinculada, sem precisar buscar", () => {
    renderFormulario({
      ...REUNIAO_EXISTENTE,
      tipo: "proposta_para_prospect",
      clienteId: null,
      clienteNome: null,
      oportunidadeId: "opp-9",
      oportunidadeNome: "Prospect Antiga",
    });

    expect(screen.getByLabelText(/^oportunidade$/i)).toHaveValue("Prospect Antiga");
    expect(screen.getByRole("button", { name: /salvar/i })).not.toBeDisabled();
  });

  it("Trocar, fechar e reabrir a mesma reunião volta a oportunidade gravada", async () => {
    const user = userEvent.setup();
    const props = {
      reuniao: {
        ...REUNIAO_EXISTENTE,
        tipo: "proposta_para_prospect" as const,
        clienteId: null,
        clienteNome: null,
        oportunidadeId: "opp-9",
        oportunidadeNome: "Prospect Antiga",
      },
      aoFechar: () => undefined,
      clientes: CLIENTES,
      pessoas: PESSOAS,
      janela: JANELA,
    };
    const { rerender } = render(<FormularioDeReuniao aberto {...props} />);

    await user.click(screen.getByRole("button", { name: "Trocar" }));
    expect(screen.getByLabelText(/^oportunidade$/i)).toHaveValue("");

    rerender(<FormularioDeReuniao aberto={false} {...props} />);
    rerender(<FormularioDeReuniao aberto {...props} />);

    expect(screen.getByLabelText(/^oportunidade$/i)).toHaveValue("Prospect Antiga");
  });

  it("trocar para tipo de cliente e voltar não traz a oportunidade de volta", async () => {
    const user = userEvent.setup();
    renderFormulario();
    await user.selectOptions(screen.getByLabelText(/^tipo$/i), "proposta_para_prospect");
    await user.type(screen.getByLabelText(/^oportunidade$/i), "acme");
    await user.click(screen.getByRole("button", { name: "Prospect Acme" }));

    await user.selectOptions(screen.getByLabelText(/^tipo$/i), "kickoff_cliente");
    await user.selectOptions(screen.getByLabelText(/^tipo$/i), "proposta_para_prospect");

    expect(screen.getByLabelText(/^oportunidade$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^oportunidade$/i)).not.toHaveAttribute("readonly");
  });
});

describe("FormularioDeReuniao — trocar de tipo limpa o vínculo que deixou de valer", () => {
  it("client_id não vai no payload depois de trocar para tipo interno", async () => {
    const user = userEvent.setup();
    renderFormulario();
    await preencherCamposBase(user);
    await user.selectOptions(screen.getByLabelText(/^cliente$/i), "cli-1");

    await user.selectOptions(screen.getByLabelText(/^tipo$/i), "interna_de_time");

    await user.selectOptions(screen.getByLabelText(/^tipo$/i), "kickoff_cliente");
    expect(screen.getByLabelText(/^cliente$/i)).toHaveValue("");

    await user.selectOptions(screen.getByLabelText(/^tipo$/i), "interna_de_time");
    const salvar = screen.getByRole("button", { name: /salvar/i });
    expect(salvar).not.toBeDisabled();
    await user.click(salvar);

    expect(criar.mutate).toHaveBeenCalledTimes(1);
    const [payload] = criar.mutate.mock.calls[0] as [Record<string, unknown>];
    expect(payload.clienteId).toBeNull();
    expect(payload.tipo).toBe("interna_de_time");
  });
});

describe("FormularioDeReuniao — payload de criação", () => {
  it("leva starts_at convertido por paraInstante e não leva organizer_id", async () => {
    const user = userEvent.setup();
    renderFormulario();
    await preencherCamposBase(user);
    await user.selectOptions(screen.getByLabelText(/^cliente$/i), "cli-1");

    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(criar.mutate).toHaveBeenCalledTimes(1);
    const [payload] = criar.mutate.mock.calls[0] as [Record<string, unknown>];
    expect(payload.startsAt).toBe("2026-10-05T17:00:00.000Z");
    expect(payload).not.toHaveProperty("organizerId");
    expect(payload).not.toHaveProperty("organizer_id");
  });
});

describe("FormularioDeReuniao — aviso de conflito", () => {
  it("aparece quando useConflitos acha alguém, e não bloqueia o salvar", async () => {
    conflitosEncontrados = ["p2"];
    const user = userEvent.setup();
    renderFormulario();
    await preencherCamposBase(user);
    await user.selectOptions(screen.getByLabelText(/^cliente$/i), "cli-1");
    await user.click(screen.getByLabelText("Bia"));

    expect(await screen.findByText(/conflito de horário/i)).toBeInTheDocument();
    expect(screen.getByText(/conflito de horário/i)).toHaveTextContent("Bia");
    expect(screen.getByRole("button", { name: /salvar/i })).not.toBeDisabled();
  });
});

describe("FormularioDeReuniao — a consulta de conflito falhou", () => {
  it("avisa que não checou, sem acusar conflito e sem bloquear o salvar", async () => {
    conflitosFalharam = true;
    const user = userEvent.setup();
    renderFormulario();
    await preencherCamposBase(user);
    await user.selectOptions(screen.getByLabelText(/^cliente$/i), "cli-1");
    await user.click(screen.getByLabelText("Bia"));

    expect(await screen.findByText(/não deu para checar conflitos/i)).toBeInTheDocument();
    expect(screen.queryByText(/conflito de horário/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /salvar/i })).not.toBeDisabled();
  });
});

describe("FormularioDeReuniao — duração espelha a CHECK do banco", () => {
  it("1441 minutos desabilita o salvar; 1440 habilita", async () => {
    const user = userEvent.setup();
    renderFormulario();
    await preencherCamposBase(user);
    await user.selectOptions(screen.getByLabelText(/^cliente$/i), "cli-1");
    const duracao = screen.getByLabelText(/duração/i);

    await user.clear(duracao);
    await user.type(duracao, "1441");
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();

    await user.clear(duracao);
    await user.type(duracao, "1440");
    expect(screen.getByRole("button", { name: /salvar/i })).not.toBeDisabled();
  });
});

describe("FormularioDeReuniao — modo edição", () => {
  it("preenche os campos com a reunião recebida", () => {
    renderFormulario(REUNIAO_EXISTENTE);

    expect(screen.getByLabelText(/título/i)).toHaveValue("Kickoff Acme");
    expect(screen.getByLabelText(/^tipo$/i)).toHaveValue("kickoff_cliente");
    expect(screen.getByLabelText(/^cliente$/i)).toHaveValue("cli-1");
    expect(screen.getByLabelText(/data/i)).toHaveValue("2026-10-05");
    expect(screen.getByLabelText(/hora/i)).toHaveValue("14:00");
    expect(screen.getByLabelText(/duração/i)).toHaveValue(45);
    expect(screen.getByLabelText(/local/i)).toHaveValue("Sala 2");
    expect(screen.getByLabelText(/notas/i)).toHaveValue("Levar proposta");
    expect(screen.getByLabelText("Bia")).toBeChecked();
    expect(screen.getByLabelText("Augusto")).not.toBeChecked();

    expect(screen.getByRole("button", { name: /salvar/i })).not.toBeDisabled();
  });
});

describe("conflito: a propria reuniao nao conta contra ela mesma", () => {
  it("em edição, manda o id da reunião editada para a RPC excluir", () => {
    renderFormulario(REUNIAO_EXISTENTE);

    const chamadas: unknown[][] = useConflitosFalso.mock.calls;
    expect(chamadas.length).toBeGreaterThan(0);
    for (const args of chamadas) {
      expect(args[3]).toBe("m1");
    }
  });

  it("em criação, manda null — não existe reunião a excluir", () => {
    renderFormulario(null);

    const chamadas: unknown[][] = useConflitosFalso.mock.calls;
    expect(chamadas.length).toBeGreaterThan(0);
    for (const args of chamadas) {
      expect(args[3]).toBeNull();
    }
  });
});

describe("conflito inclui a agenda de quem está marcando (achado 10)", () => {
  it("manda o id da sessão junto dos participantes escolhidos", () => {
    renderFormulario();

    const perfis = (useConflitosFalso.mock.calls.at(-1) ?? [])[0] as string[];
    expect(perfis).toContain("eu-1");
  });

  it("não duplica quando a pessoa já está marcada como participante", () => {
    perfilFalso.meuId = "p2";

    renderFormulario(REUNIAO_EXISTENTE);

    const perfis = (useConflitosFalso.mock.calls.at(-1) ?? [])[0] as string[];
    expect(perfis.filter((id) => id === "p2")).toHaveLength(1);
  });

  it("sem sessão, a consulta segue com os participantes e não leva undefined", () => {
    perfilFalso.meuId = null;

    renderFormulario(REUNIAO_EXISTENTE);

    const perfis = (useConflitosFalso.mock.calls.at(-1) ?? [])[0] as string[];
    expect(perfis).toEqual(["p2", "org-1"]);
  });

  it("conflito do próprio organizador é mostrado como 'você', não como um uuid", () => {
    conflitosEncontrados = ["eu-1"];

    renderFormulario();

    expect(screen.getByText(/Conflito de horário: você/)).toBeInTheDocument();
  });
});

describe("MEET-3: em edição, a agenda checada é a de quem ORGANIZA, não de quem edita", () => {
  const COM_ELIAS = [...PESSOAS, { id: "org-1", nome: "Elias" }];

  it("manda o organizador da reunião e NÃO quem está editando", () => {
    renderFormulario(REUNIAO_EXISTENTE, { pessoas: COM_ELIAS });

    const perfis = (useConflitosFalso.mock.calls.at(-1) ?? [])[0] as string[];
    expect(perfis).toContain("org-1");
    expect(perfis).not.toContain("eu-1");
  });

  it("conflito do organizador é nomeado como organizador, não como 'você'", () => {
    conflitosEncontrados = ["org-1"];

    renderFormulario(REUNIAO_EXISTENTE, { pessoas: COM_ELIAS });

    const aviso = screen.getByText(/Conflito de horário/);
    expect(aviso).toHaveTextContent("Elias (organizador)");
    expect(aviso).not.toHaveTextContent("você");
  });

  it("em criação, quem marca continua na consulta", () => {
    renderFormulario(null);

    const perfis = (useConflitosFalso.mock.calls.at(-1) ?? [])[0] as string[];
    expect(perfis).toContain("eu-1");
  });
});

describe("MEET-1: a data respeita o período exibido pela tela", () => {
  it("o input de data NÃO leva min/max — o período só avisa", () => {
    renderFormulario();

    const data = screen.getByLabelText(/^data$/i);
    expect(data).not.toHaveAttribute("min");
    expect(data).not.toHaveAttribute("max");
  });

  it("data fora do período avisa que a reunião só aparece ao mudar o período, sem bloquear", async () => {
    const user = userEvent.setup();
    renderFormulario();
    await user.type(screen.getByLabelText(/título/i), "Renovação Clínica Vita");
    await user.type(screen.getByLabelText(/^data$/i), "2027-01-20");
    await user.type(screen.getByLabelText(/hora/i), "10:00");
    await user.selectOptions(screen.getByLabelText(/^cliente$/i), "cli-1");

    expect(screen.getByRole("status")).toHaveTextContent(/fora do período exibido/i);
    expect(screen.getByRole("button", { name: /salvar/i })).not.toBeDisabled();
  });

  it("ano implausível (segmento do ano pela metade) não é 'fora do período'", () => {
    renderFormulario();

    fireEvent.change(screen.getByLabelText(/^data$/i), { target: { value: "0002-08-09" } });

    expect(screen.queryByText(/fora do período exibido/i)).not.toBeInTheDocument();
  });

  it("data dentro do período não avisa nada", async () => {
    const user = userEvent.setup();
    renderFormulario();
    await preencherCamposBase(user);

    expect(screen.queryByText(/fora do período exibido/i)).not.toBeInTheDocument();
  });
});

describe("MEET-4: falha DEPOIS do INSERT de meetings fecha o diálogo", () => {
  it("ReuniaoCriadaSemParticipantes no onError fecha o formulário", async () => {
    const { ReuniaoCriadaSemParticipantes } = await import("../domain/meeting");
    const aoFechar = vi.fn();
    const user = userEvent.setup();
    renderFormulario(null, { aoFechar });
    await preencherCamposBase(user);
    await user.selectOptions(screen.getByLabelText(/^cliente$/i), "cli-1");
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    const opcoes = criar.mutate.mock.calls[0][1] as { onError?: (e: unknown) => void };
    opcoes.onError?.(new ReuniaoCriadaSemParticipantes("r1"));

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("erro comum NÃO fecha o formulário", async () => {
    const aoFechar = vi.fn();
    const user = userEvent.setup();
    renderFormulario(null, { aoFechar });
    await preencherCamposBase(user);
    await user.selectOptions(screen.getByLabelText(/^cliente$/i), "cli-1");
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    const opcoes = criar.mutate.mock.calls[0][1] as { onError?: (e: unknown) => void };
    opcoes.onError?.(new Error("recusado"));

    expect(aoFechar).not.toHaveBeenCalled();
  });
});

describe("FormularioDeReuniao: organizador (D-069, C7)", () => {
  it("owner troca o organizador e o payload leva organizadorId", async () => {
    const user = userEvent.setup();
    perfilFalso.papel = "owner";
    renderFormulario(REUNIAO_EXISTENTE);

    await user.selectOptions(screen.getByLabelText(/^organizador$/i), "p1");
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(atualizar.mutate).toHaveBeenCalledWith(
      { id: "m1", dados: expect.objectContaining({ organizadorId: "p1" }) },
      expect.anything(),
    );
  });

  it("sem troca, o payload não leva organizadorId", async () => {
    const user = userEvent.setup();
    perfilFalso.papel = "owner";
    renderFormulario(REUNIAO_EXISTENTE);
    await user.click(screen.getByRole("button", { name: /salvar/i }));
    const [{ dados }] = atualizar.mutate.mock.calls[0] as [{ dados: Record<string, unknown> }];
    expect(Object.hasOwn(dados, "organizadorId")).toBe(false);
  });

  it("o organizador atual fora da lista aparece como opção selecionada", () => {
    perfilFalso.papel = "manager";
    renderFormulario(REUNIAO_EXISTENTE);
    const seletor = screen.getByLabelText(/^organizador$/i);
    expect(seletor).toHaveValue("org-1");
    expect(screen.getByRole("option", { name: "Organizador atual" })).toBeInTheDocument();
  });

  it("organizador que está na lista vem selecionado, sem a opção 'Organizador atual'", () => {
    perfilFalso.papel = "owner";
    renderFormulario({ ...REUNIAO_EXISTENTE, organizadorId: "p1" });
    const seletor = screen.getByLabelText(/^organizador$/i);
    expect(seletor).toHaveValue("p1");
    expect(screen.queryByRole("option", { name: "Organizador atual" })).not.toBeInTheDocument();
    expect(within(seletor).getAllByRole("option")).toHaveLength(PESSOAS.length);
  });

  it("trocar o organizador troca a agenda checada e o nome no aviso de conflito", async () => {
    const user = userEvent.setup();
    perfilFalso.papel = "owner";
    conflitosEncontrados = ["p1"];
    renderFormulario(REUNIAO_EXISTENTE);

    await user.selectOptions(screen.getByLabelText(/^organizador$/i), "p1");

    const perfis = (useConflitosFalso.mock.calls.at(-1) ?? [])[0] as string[];
    expect(perfis).toContain("p1");
    expect(perfis).not.toContain("org-1");
    expect(screen.getByText(/Conflito de horário/)).toHaveTextContent("Augusto (organizador)");
  });

  it("o seletor avisa que quem deixa de organizar só vê a reunião se for participante", () => {
    perfilFalso.papel = "owner";
    renderFormulario(REUNIAO_EXISTENTE);
    expect(screen.getByLabelText(/^organizador$/i)).toHaveAccessibleDescription(
      "Quem deixa de organizar só continua vendo a reunião se for participante.",
    );
  });

  it("member não vê o seletor", () => {
    renderFormulario(REUNIAO_EXISTENTE);
    expect(screen.queryByLabelText(/^organizador$/i)).not.toBeInTheDocument();
  });

  it("sessão ainda carregando (papel nulo) não vê o seletor", () => {
    perfilFalso.papel = null;
    renderFormulario(REUNIAO_EXISTENTE);
    expect(screen.queryByLabelText(/^organizador$/i)).not.toBeInTheDocument();
  });

  it("reunião nova, mesmo para o owner, não mostra o seletor", () => {
    perfilFalso.papel = "owner";
    renderFormulario(null);
    expect(screen.queryByLabelText(/^organizador$/i)).not.toBeInTheDocument();
  });
});
