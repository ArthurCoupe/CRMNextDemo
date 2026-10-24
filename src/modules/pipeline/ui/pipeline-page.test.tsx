import type { DragEndEvent } from "@dnd-kit/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PapelDoUsuario } from "@/hooks/use-profile";

import type { OportunidadeListada } from "../api/pipeline.repository";
import {
  atualizarEmLote,
  lerPrimeiroContato,
  listarOportunidades,
  listarResponsaveis,
  moverParaEstagio,
} from "../api/pipeline.repository";
import { listarCampos, listarEstagios, listarPipelines } from "../api/pipelines.repository";
import { PIPELINE_PADRAO, type EstagioDoPipeline, type Pipeline } from "../domain/pipeline";
import { ORDEM_DOS_ESTAGIOS } from "../domain/stage";
import { chavesDoPipeline } from "../hooks/use-pipeline";

const dnd: { aoSoltar: ((evento: DragEndEvent) => void) | null } = { aoSoltar: null };
const droppables: Array<{ id: unknown; data?: unknown }> = [];

const perfil: { papel: PapelDoUsuario | null } = { papel: "owner" };

const busca: { pipeline: string | undefined } = { pipeline: undefined };
const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => busca,
  useNavigate: () => navigate,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("@dnd-kit/core", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("@dnd-kit/core")>()),
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd: (evento: DragEndEvent) => void;
  }) => {
    dnd.aoSoltar = onDragEnd;
    return <div>{children}</div>;
  },
  useDroppable: (args: { id: unknown; data?: unknown }) => {
    droppables.push(args);
    return { setNodeRef: () => {}, isOver: false };
  },
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    setActivatorNodeRef: () => {},
    transform: null,
    isDragging: false,
  }),
  useSensor: () => null,
  useSensors: () => [],
  PointerSensor: {},
  KeyboardSensor: {},
}));

vi.mock("../api/pipeline.repository", () => ({
  apagarOportunidade: vi.fn(),
  atualizarDadosDaOportunidade: vi.fn(),
  atualizarDatasDeReuniao: vi.fn(),
  atualizarEmLote: vi.fn(),
  atualizarNutricao: vi.fn(),
  carregarCatalogo: vi.fn(),
  corrigirMotivoDeSaida: vi.fn(),
  criarOportunidade: vi.fn(),
  importarOportunidades: vi.fn(),
  listarEventos: vi.fn(),
  listarOportunidades: vi.fn(),
  listarResponsaveis: vi.fn(),
  lerAtividadeSemanal: vi.fn(),
  lerFechamentosPorCampanha: vi.fn(),
  lerFunilPorCanal: vi.fn(),
  lerMixDeOportunidades: vi.fn(),
  lerPrimeiroContato: vi.fn(),
  lerTempoAtePrimeiroContato: vi.fn(),
  moverParaEstagio: vi.fn(),
  registrarToque: vi.fn(),
  responderPergunta: vi.fn(),
  vincularRef: vi.fn(),
}));

vi.mock("../api/pipelines.repository", () => ({
  apagarPipeline: vi.fn(),
  arquivarPipeline: vi.fn(),
  criarPipeline: vi.fn(),
  listarCampos: vi.fn(),
  listarEstagios: vi.fn(),
  listarMotivos: vi.fn(),
  listarPipelines: vi.fn(),
  renomearPipeline: vi.fn(),
  salvarCampos: vi.fn(),
  salvarEstagios: vi.fn(),
  salvarMotivos: vi.fn(),
}));

vi.mock("@/hooks/use-profile", () => ({ useProfile: () => perfil }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, session: null, loading: false }),
}));

vi.mock("./dialogo-de-ganho", () => ({
  DialogoDeGanho: ({ ganhando }: { ganhando: unknown }) =>
    ganhando === null ? null : <div data-testid="dialogo-de-ganho" />,
}));
vi.mock("./dialogo-de-motivo", () => ({
  DialogoDeMotivo: ({ saindo }: { saindo: unknown }) =>
    saindo === null ? null : <div data-testid="dialogo-de-motivo" />,
}));
vi.mock("./new-opportunity-form", () => ({ NewOpportunityForm: () => null }));
vi.mock("./importacao-de-csv", () => ({ ImportacaoDeCsv: () => null }));
const propsDoDrawer = vi.fn();
vi.mock("./opportunity-drawer", () => ({
  OpportunityDrawer: (props: unknown) => {
    propsDoDrawer(props);
    return null;
  },
}));
vi.mock("./placar-semanal", () => ({ PlacarSemanal: () => null }));

const { PipelinePage } = await import("./pipeline-page");

const ESTAGIOS: EstagioDoPipeline[] = ORDEM_DOS_ESTAGIOS.map((tipo, i) => ({
  id: `estagio-${tipo}`,
  pipelineId: PIPELINE_PADRAO,
  nome: tipo,
  ordem: i + 1,
  tipo,
}));

const SEGUNDO_PIPELINE = "20000000-0000-4000-8000-000000000002";
const PIPELINES: Pipeline[] = [
  { id: PIPELINE_PADRAO, nome: "Comercial", ordem: 1, ativo: true },
  { id: SEGUNDO_PIPELINE, nome: "Parcerias", ordem: 2, ativo: true },
];
const ESTAGIOS_DO_SEGUNDO: EstagioDoPipeline[] = (
  [
    ["Contato", "prospeccao"],
    ["Proposta", "r1"],
    ["Ganho", "fechado"],
    ["Perdido", "perdido"],
    ["Fora do alvo", "descartado"],
  ] as const
).map(([nome, tipo], i) => ({
  id: `p2-${tipo}`,
  pipelineId: SEGUNDO_PIPELINE,
  nome,
  ordem: i + 1,
  tipo,
}));

const OPORTUNIDADE: OportunidadeListada = {
  id: "oportunidade-1",
  nome: "Padaria do Zé",
  segmento: null,
  nicho: null,
  estagio: "qualificacao",
  pipelineId: PIPELINE_PADRAO,
  estagioId: "estagio-qualificacao",
  estagioNome: "Qualificação",
  estagioMudouEm: "2026-01-01T00:00:00Z",
  responsavelId: null,
  responsavelNome: null,
  contatoNome: null,
  contatoEmail: null,
  contatoTelefone: null,
  origem: null,
  canal: null,
  indicadoPor: null,
  linhaDeNegocio: null,
  frentesEsperadas: null,
  valorEstimado: null,
  observacoes: null,
  fechadoMrr: null,
  fechadoTcv: null,
  clienteId: null,
  proximoFollowUp: null,
  r1AgendadaEm: null,
  r1RealizadaEm: null,
  r2AgendadaEm: null,
  r2RealizadaEm: null,
  motivoId: null,
  motivoRotulo: null,
  motivoObs: null,
  emNutricao: false,
  nutrirAte: null,
  atribuicao: {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    landingUrl: null,
  },
  attributionId: null,
  criadaEm: "2026-01-01T00:00:00Z",
  campos: {},
  respostas: [],
};

async function renderizarBoard(papel: PapelDoUsuario | null) {
  perfil.papel = papel;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <PipelinePage />
    </QueryClientProvider>,
  );
  await screen.findByText("Padaria do Zé");
  return qc;
}

function soltarEm(tipo: EstagioDoPipeline["tipo"]) {
  act(() => {
    dnd.aoSoltar?.({
      active: { id: OPORTUNIDADE.id },
      over: { id: `estagio-${tipo}` },
    } as unknown as DragEndEvent);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  dnd.aoSoltar = null;
  droppables.length = 0;
  busca.pipeline = PIPELINE_PADRAO;
  vi.mocked(listarPipelines).mockResolvedValue(PIPELINES);
  vi.mocked(listarOportunidades).mockImplementation(async (pipelineId) =>
    pipelineId === PIPELINE_PADRAO ? [OPORTUNIDADE] : [],
  );
  vi.mocked(listarEstagios).mockImplementation(async (pipelineId) =>
    pipelineId === PIPELINE_PADRAO ? ESTAGIOS : ESTAGIOS_DO_SEGUNDO,
  );
  vi.mocked(moverParaEstagio).mockResolvedValue(undefined);
  vi.mocked(listarCampos).mockResolvedValue([]);
  vi.mocked(listarResponsaveis).mockResolvedValue([
    { id: "vinicius", nome: "Vinicius", ativo: true },
    { id: "ana", nome: "Ana", ativo: true },
  ]);
  vi.mocked(atualizarEmLote).mockResolvedValue(2);
  vi.mocked(lerPrimeiroContato).mockResolvedValue([]);
});

function nomesDasColunas() {
  return screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
}

describe("o board é o do pipeline da URL, com as colunas dele", () => {
  it("🔴 ?pipeline=<p2> renderiza os estágios NOMEADOS de p2, na ordem — não os 8 rótulos fixos", async () => {
    busca.pipeline = SEGUNDO_PIPELINE;
    perfil.papel = "owner";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PipelinePage />
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { level: 2, name: "Contato" });

    expect(nomesDasColunas()).toEqual(["Contato", "Proposta", "Ganho", "Perdido", "Fora do alvo"]);
    expect(droppables).toContainEqual({
      id: "p2-prospeccao",
      data: { nome: "Contato", tipo: "prospeccao" },
    });
    expect(screen.queryByText("Prospecção")).toBeNull();
    expect(vi.mocked(listarEstagios)).toHaveBeenCalledWith(SEGUNDO_PIPELINE);
    expect(vi.mocked(listarOportunidades)).toHaveBeenCalledWith(SEGUNDO_PIPELINE);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("sem ?pipeline=, usa o primeiro ativo por ordem e grava na URL com replace", async () => {
    busca.pipeline = undefined;
    await renderizarBoard("owner");

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        search: { pipeline: PIPELINE_PADRAO },
        replace: true,
      }),
    );
    expect(nomesDasColunas()[0]).toBe(ESTAGIOS[0]?.nome);
  });

  it("o seletor troca de pipeline pela URL (push, não replace)", async () => {
    const user = userEvent.setup();
    await renderizarBoard("owner");

    await user.click(screen.getByRole("combobox", { name: "Pipeline" }));
    await user.click(await screen.findByRole("option", { name: "Parcerias" }));

    expect(navigate).toHaveBeenCalledWith({ search: { pipeline: SEGUNDO_PIPELINE } });
  });

  it("?pipeline= com id que não existe: 'Pipeline não encontrado', não um board sem colunas", async () => {
    busca.pipeline = "nao-existe";
    vi.mocked(listarEstagios).mockResolvedValue([]);
    perfil.papel = "owner";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PipelinePage />
      </QueryClientProvider>,
    );

    await screen.findByText("Pipeline não encontrado");
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  });

  it("falha ao ler os pipelines mostra FalhaAoLer, não um board vazio", async () => {
    vi.mocked(listarPipelines).mockRejectedValue({ code: "42501", message: "permission denied" });
    perfil.papel = "owner";
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <PipelinePage />
      </QueryClientProvider>,
    );

    await screen.findByText(/Não foi possível ler os pipelines/);
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  });
});

describe("PAR 1 — soltar em Fechado só pede a confirmação do ganho (D-068)", () => {
  it.each(["owner", "manager"] as const)(
    "%s abre a confirmação, e nada é gravado antes dela",
    async (papel) => {
      await renderizarBoard(papel);

      soltarEm("fechado");

      expect(screen.getByTestId("dialogo-de-ganho")).toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
      expect(vi.mocked(moverParaEstagio)).not.toHaveBeenCalled();
    },
  );
});

describe("tirar de Fechado (D-071)", () => {
  function ganha(clienteId: string | null): OportunidadeListada {
    return {
      ...OPORTUNIDADE,
      estagio: "fechado",
      estagioId: "estagio-fechado",
      estagioNome: "Fechado",
      clienteId,
    };
  }

  it("🔴 com contrato não move: avisa com a frase do banco", async () => {
    vi.mocked(listarOportunidades).mockImplementation(async (pipelineId) =>
      pipelineId === PIPELINE_PADRAO ? [ganha("cli-1")] : [],
    );
    await renderizarBoard("owner");

    soltarEm("r2");

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error).mock.calls[0]?.[0]).toBe(
      'Esta venda já tem contrato. Para tirá-la de Fechado, use "Desfazer fechamento" na ficha da oportunidade.',
    );
    expect(vi.mocked(moverParaEstagio)).not.toHaveBeenCalled();
  });

  it("sem contrato move, e o banco grava o rastro para o funil", async () => {
    vi.mocked(listarOportunidades).mockImplementation(async (pipelineId) =>
      pipelineId === PIPELINE_PADRAO ? [ganha(null)] : [],
    );
    await renderizarBoard("manager");

    soltarEm("r2");

    await waitFor(() => expect(vi.mocked(moverParaEstagio)).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAR 2 — o portão não comeu o resto do board", () => {
  it("manager continua movendo para estágio não-terminal", async () => {
    await renderizarBoard("manager");

    soltarEm("r2");

    await waitFor(() => expect(vi.mocked(moverParaEstagio)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(moverParaEstagio)).toHaveBeenCalledWith(
      OPORTUNIDADE.id,
      ESTAGIOS.find((e) => e.tipo === "r2"),
      OPORTUNIDADE.estagioId,
      null,
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("manager continua abrindo o diálogo de motivo em Perdido", async () => {
    await renderizarBoard("manager");

    soltarEm("perdido");

    await waitFor(() => expect(screen.getByTestId("dialogo-de-motivo")).toBeInTheDocument());
    expect(vi.mocked(moverParaEstagio)).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAR 3 — quem recebe o botão de criar oportunidade", () => {
  it.each(["owner", "manager"] as const)(
    "%s recebe os botões de criar e de importar",
    async (papel) => {
      await renderizarBoard(papel);

      expect(screen.getByRole("button", { name: /Nova oportunidade/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Importar CSV/ })).toBeInTheDocument();
    },
  );

  it("member não recebe o botão de criar nem o de importar", async () => {
    await renderizarBoard("member");

    expect(screen.queryByRole("button", { name: /Nova oportunidade/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Importar CSV/ })).toBeNull();
  });

  it("🔴 owner com ZERO pipeline ativo não recebe o botão: não há onde criar", async () => {
    vi.mocked(listarPipelines).mockResolvedValue([]);
    busca.pipeline = undefined;
    perfil.papel = "owner";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PipelinePage />
      </QueryClientProvider>,
    );

    await screen.findByText("Nenhum pipeline ativo");
    expect(screen.queryByRole("button", { name: /Nova oportunidade/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Importar CSV/ })).toBeNull();
  });
});

describe("PIPE-1 — erro do mover invalida o board, e não só avisa por toast", () => {
  it("🔴 card já movido por outra pessoa: toast E board invalidado", async () => {
    const qc = await renderizarBoard("manager");
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    vi.mocked(moverParaEstagio).mockRejectedValue(
      new Error("Esta oportunidade já foi movida por outra pessoa. Recarregue o board."),
    );

    soltarEm("r2");

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(invalidar).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: chavesDoPipeline.board(PIPELINE_PADRAO) }),
    );
  });
});

describe("mover com sucesso invalida o board, a timeline do card E o placar da semana", () => {
  it("🔴 as três chaves são invalidadas no onSuccess", async () => {
    const qc = await renderizarBoard("manager");
    const invalidar = vi.spyOn(qc, "invalidateQueries");

    soltarEm("r2");

    await waitFor(() => expect(vi.mocked(moverParaEstagio)).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(invalidar).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: chavesDoPipeline.board(PIPELINE_PADRAO) }),
      ),
    );
    expect(invalidar).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: chavesDoPipeline.eventos(OPORTUNIDADE.id) }),
    );
    expect(invalidar).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: chavesDoPipeline.atividade }),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});

const SEGUNDA: OportunidadeListada = {
  ...OPORTUNIDADE,
  id: "oportunidade-2",
  nome: "Mercado da Ana",
  responsavelId: "vinicius",
  responsavelNome: "Vinicius",
};

async function renderizarComDois(papel: PapelDoUsuario) {
  vi.mocked(listarOportunidades).mockImplementation(async (pipelineId) =>
    pipelineId === PIPELINE_PADRAO ? [OPORTUNIDADE, SEGUNDA] : [],
  );
  await renderizarBoard(papel);
  await screen.findByText("Mercado da Ana");
}

const marcar = (nome: string) => screen.getByRole("checkbox", { name: `Selecionar ${nome}` });

async function escolherResponsavel(user: ReturnType<typeof userEvent.setup>, nome: string) {
  await user.click(screen.getByRole("combobox", { name: "Responsável" }));
  await user.click(await screen.findByRole("option", { name: nome }));
}

describe("ações em lote — seleção e alvos", () => {
  it("🔴 marcar dois cards mostra a barra; Responsável → Ana chama a RPC com os DOIS alvos e o estagioId visto", async () => {
    const user = userEvent.setup();
    await renderizarComDois("owner");
    expect(screen.queryByRole("region", { name: "Ações em lote" })).toBeNull();

    await user.click(marcar("Padaria do Zé"));
    await user.click(marcar("Mercado da Ana"));

    expect(screen.getByRole("region", { name: "Ações em lote" })).toHaveTextContent(
      "2 selecionadas",
    );
    await escolherResponsavel(user, "Ana");
    await user.click(screen.getByRole("button", { name: /^Aplica/ }));

    await waitFor(() => expect(vi.mocked(atualizarEmLote)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(atualizarEmLote)).toHaveBeenCalledWith(
      [
        { id: "oportunidade-1", stageId: "estagio-qualificacao" },
        { id: "oportunidade-2", stageId: "estagio-qualificacao" },
      ],
      { ownerId: "ana" },
    );
    await waitFor(() => expect(screen.queryByRole("region", { name: "Ações em lote" })).toBeNull());
    expect(marcar("Padaria do Zé")).not.toBeChecked();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("🔴 ruling 13: quem já tem o responsável escolhido fica FORA dos alvos", async () => {
    const user = userEvent.setup();
    await renderizarComDois("owner");

    await user.click(marcar("Padaria do Zé"));
    await user.click(marcar("Mercado da Ana"));
    await escolherResponsavel(user, "Vinicius");
    await user.click(screen.getByRole("button", { name: /^Aplica/ }));

    await waitFor(() => expect(vi.mocked(atualizarEmLote)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(atualizarEmLote)).toHaveBeenCalledWith(
      [{ id: "oportunidade-1", stageId: "estagio-qualificacao" }],
      { ownerId: "vinicius" },
    );
  });

  it("🔴 nenhum alvo muda: 'Nada a mudar.' e a RPC NÃO é chamada", async () => {
    const user = userEvent.setup();
    await renderizarComDois("owner");

    await user.click(marcar("Mercado da Ana"));
    await escolherResponsavel(user, "Vinicius");
    await user.click(screen.getByRole("button", { name: /^Aplica/ }));

    expect(toast.info).toHaveBeenCalledWith("Nada a mudar.");
    expect(vi.mocked(atualizarEmLote)).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Ações em lote" })).toBeInTheDocument();
  });

  it("Etapa aberta: quem já está na coluna fica fora; os outros vão com o estagioId de origem", async () => {
    const user = userEvent.setup();
    vi.mocked(listarOportunidades).mockImplementation(async (pipelineId) =>
      pipelineId === PIPELINE_PADRAO
        ? [OPORTUNIDADE, { ...SEGUNDA, estagio: "r1", estagioId: "estagio-r1", estagioNome: "r1" }]
        : [],
    );
    await renderizarBoard("manager");
    await screen.findByText("Mercado da Ana");

    await user.click(marcar("Padaria do Zé"));
    await user.click(marcar("Mercado da Ana"));
    await user.click(screen.getByRole("combobox", { name: "Etapa" }));
    await user.click(await screen.findByRole("option", { name: "r1" }));
    await user.click(screen.getByRole("button", { name: /^Aplica/ }));

    await waitFor(() => expect(vi.mocked(atualizarEmLote)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(atualizarEmLote)).toHaveBeenCalledWith(
      [{ id: "oportunidade-1", stageId: "estagio-qualificacao" }],
      { estagioId: "estagio-r1" },
    );
  });

  it("erro da RPC: a seleção NÃO é limpa — a pessoa vê o board recarregado e tenta de novo", async () => {
    const user = userEvent.setup();
    vi.mocked(atualizarEmLote).mockRejectedValue(
      new Error("Alguém moveu uma das oportunidades. Recarregue o board."),
    );
    await renderizarComDois("owner");

    await user.click(marcar("Padaria do Zé"));
    await escolherResponsavel(user, "Ana");
    await user.click(screen.getByRole("button", { name: /^Aplica/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("region", { name: "Ações em lote" })).toBeInTheDocument();
    expect(marcar("Padaria do Zé")).toBeChecked();
  });

  it("🔴 trocar ?pipeline= limpa a seleção", async () => {
    const user = userEvent.setup();
    perfil.papel = "owner";
    vi.mocked(listarOportunidades).mockImplementation(async (pipelineId) =>
      pipelineId === PIPELINE_PADRAO
        ? [OPORTUNIDADE, SEGUNDA]
        : [{ ...SEGUNDA, id: "op-p2", pipelineId: SEGUNDO_PIPELINE, estagioId: "p2-prospeccao" }],
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const arvore = () => (
      <QueryClientProvider client={qc}>
        <PipelinePage />
      </QueryClientProvider>
    );
    const { rerender } = render(arvore());
    await screen.findByText("Padaria do Zé");
    await user.click(marcar("Padaria do Zé"));
    expect(screen.getByRole("region", { name: "Ações em lote" })).toBeInTheDocument();

    busca.pipeline = SEGUNDO_PIPELINE;
    rerender(arvore());

    await screen.findByRole("heading", { level: 2, name: "Contato" });
    expect(screen.queryByRole("region", { name: "Ações em lote" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Selecionar Mercado da Ana" })).not.toBeChecked();
  });

  it("member não vê checkbox nem barra — a RPC recusaria com 42501 de qualquer forma", async () => {
    await renderizarComDois("member");

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("region", { name: "Ações em lote" })).toBeNull();
    expect(vi.mocked(listarResponsaveis)).not.toHaveBeenCalled();
  });

  it("owner pede a lista de responsáveis — o positivo do caso acima", async () => {
    await renderizarComDois("owner");
    await waitFor(() => expect(vi.mocked(listarResponsaveis)).toHaveBeenCalledTimes(1));
  });

  it("🔴 card marcado e depois ESCONDIDO pelo filtro fica fora do lote e da contagem da barra", async () => {
    const user = userEvent.setup();
    vi.mocked(listarOportunidades).mockImplementation(async (pipelineId) =>
      pipelineId === PIPELINE_PADRAO
        ? [OPORTUNIDADE, { ...SEGUNDA, linhaDeNegocio: "demanda" }]
        : [],
    );
    await renderizarBoard("owner");
    await screen.findByText("Mercado da Ana");

    await user.click(marcar("Padaria do Zé"));
    await user.click(marcar("Mercado da Ana"));
    expect(screen.getByRole("region", { name: "Ações em lote" })).toHaveTextContent(
      "2 selecionadas",
    );

    const filtros = screen.getAllByRole("combobox");
    await user.click(filtros[2]!);
    await user.click(await screen.findByRole("option", { name: "Demanda" }));
    expect(screen.queryByText("Padaria do Zé")).toBeNull();
    expect(screen.getByRole("region", { name: "Ações em lote" })).toHaveTextContent(
      "1 selecionada",
    );

    await escolherResponsavel(user, "Ana");
    await user.click(screen.getByRole("button", { name: /^Aplica/ }));

    await waitFor(() => expect(vi.mocked(atualizarEmLote)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(atualizarEmLote)).toHaveBeenCalledWith(
      [{ id: "oportunidade-2", stageId: "estagio-qualificacao" }],
      { ownerId: "ana" },
    );
  });

  it.each(["owner", "manager"] as const)("%s vê o checkbox — o positivo do par", async (papel) => {
    await renderizarComDois(papel);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });
});

describe("fix round 1 — nada a mudar antes do diálogo, e o foco depois da barra", () => {
  it("🔴 card já em Perdido + Etapa Perdido: 'Nada a mudar.' e o diálogo de motivo NÃO abre", async () => {
    const user = userEvent.setup();
    vi.mocked(listarOportunidades).mockImplementation(async (pipelineId) =>
      pipelineId === PIPELINE_PADRAO
        ? [{ ...OPORTUNIDADE, estagio: "perdido", estagioId: "estagio-perdido" }]
        : [],
    );
    await renderizarBoard("owner");

    await user.click(marcar("Padaria do Zé"));
    await user.click(screen.getByRole("combobox", { name: "Etapa" }));
    await user.click(await screen.findByRole("option", { name: "perdido" }));

    expect(toast.info).toHaveBeenCalledWith("Nada a mudar.");
    expect(screen.queryByTestId("dialogo-de-motivo")).toBeNull();
    expect(vi.mocked(atualizarEmLote)).not.toHaveBeenCalled();
  });

  it("🔴 Limpar devolve o foco ao botão Nova oportunidade — não ao <body>", async () => {
    const user = userEvent.setup();
    await renderizarComDois("owner");
    await user.click(marcar("Padaria do Zé"));

    await user.click(screen.getByRole("button", { name: "Limpar" }));

    expect(screen.queryByRole("region", { name: "Ações em lote" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Nova oportunidade/ }));
  });

  it("🔴 Aplicar com sucesso: a barra some e o foco vai ao botão Nova oportunidade", async () => {
    const user = userEvent.setup();
    await renderizarComDois("owner");
    await user.click(marcar("Padaria do Zé"));
    await escolherResponsavel(user, "Ana");

    await user.click(screen.getByRole("button", { name: /^Aplica/ }));

    await waitFor(() => expect(screen.queryByRole("region", { name: "Ações em lote" })).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Nova oportunidade/ }));
  });
});

describe("selo de primeiro contato no board (D-063)", () => {
  it("🔴 pede os ids do board e mostra o selo vencido no card", async () => {
    vi.mocked(lerPrimeiroContato).mockResolvedValue([
      { oportunidadeId: OPORTUNIDADE.id, venceEm: "2026-01-05T13:05:00Z", primeiroToqueEm: null },
    ]);

    await renderizarBoard("owner");

    expect(await screen.findByText(/^1º contato atrasado desde/)).toBeInTheDocument();
    expect(lerPrimeiroContato).toHaveBeenCalledWith([OPORTUNIDADE.id]);
  });

  it("🔴 a leitura do selo falha: o board aparece inteiro, sem selo, e o erro vai ao console", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(lerPrimeiroContato).mockRejectedValue(
      Object.assign(new Error("permission denied"), { code: "42501" }),
    );

    await renderizarBoard("owner");

    await waitFor(() =>
      expect(erro).toHaveBeenCalledWith("[pipeline] primeiro contato:", expect.any(Error)),
    );
    expect(screen.getByText("Padaria do Zé")).toBeInTheDocument();
    expect(screen.queryByText(/1º contato/)).toBeNull();
  });
});

describe("o drawer recebe o papel (D-069, C2)", () => {
  it.each(["owner", "manager", "member"] as const)("%s chega ao drawer", async (papel) => {
    propsDoDrawer.mockClear();
    await renderizarBoard(papel);
    expect(propsDoDrawer).toHaveBeenLastCalledWith(expect.objectContaining({ papel }));
  });
});
