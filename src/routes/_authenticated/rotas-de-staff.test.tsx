import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ papel: "member", meuId: "u1", perfil: null }),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

vi.mock("@/modules/financial/hooks/use-financial", () => ({
  useMrrPorUnidade: () => ({ data: undefined, isPending: false, isError: false }),
}));
vi.mock("@/modules/pipeline/hooks/use-pipeline", () => ({
  useOportunidadesDeTodosOsPipelines: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock("@/modules/financial/ui/placar-de-metas", () => ({ PlacarDeMetas: () => null }));

vi.mock("@/modules/tasks/hooks/use-tasks", () => ({
  useTarefas: () => ({ data: undefined, isPending: false, isError: false }),
  useCatalogoDeTarefas: () => ({ data: undefined, isPending: false, isError: false }),
  useClientesParaSelecao: () => ({ data: undefined, isPending: false, isError: false }),
  usePessoasDoTime: () => ({ data: undefined, isPending: false, isError: false }),
  useCriarTarefa: () => ({ mutate: vi.fn(), isPending: false }),
  useMoverTarefa: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));
vi.mock("@/modules/tasks/ui/quadro-de-tarefas", () => ({ QuadroDeTarefas: () => null }));
vi.mock("@/modules/tasks/ui/formulario-de-tarefa", () => ({ FormularioDeTarefa: () => null }));
vi.mock("@/modules/tasks/ui/dialogo-de-tarefa", () => ({ DialogoDeTarefa: () => null }));

vi.mock("@/modules/clients/ui/clients-page", () => ({ ClientsPage: () => null }));
vi.mock("@/modules/pipeline/ui/pipeline-page", () => ({ PipelinePage: () => null }));

vi.mock("@/modules/onboarding/hooks/use-onboarding", () => ({
  useClientesComJornada: () => ({ data: undefined, isPending: false, isError: false }),
  useIniciarJornada: () => ({ mutate: vi.fn(), isPending: false }),
  useJornada: () => ({ data: undefined, isPending: false, isError: false }),
  useLiberarEtapa: () => ({ mutate: vi.fn(), isPending: false }),
  useMarcarItem: () => ({ mutate: vi.fn() }),
  useApagarJornada: () => ({ mutate: vi.fn(), isPending: false }),
  useEditarItemDaJornada: () => ({ mutate: vi.fn(), isPending: false }),
  useEditarEtapaDaJornada: () => ({ mutate: vi.fn(), isPending: false }),
  usePapeis: () => ({ data: undefined, isPending: false, isError: false }),
}));
vi.mock("@/modules/onboarding/ui/jornada", () => ({ VisaoDaJornada: () => null }));

vi.mock("@/modules/proposals/ui/impressao-da-proposta", () => ({
  ImpressaoDaProposta: () => null,
}));

vi.mock("@/modules/content/ui/pagina-de-conteudo", () => ({ PaginaDeConteudo: () => null }));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
  createServerFn: () => ({ handler: (fn: unknown) => fn }),
}));
vi.mock("@/lib/ai.functions", () => ({
  aiAnalyze: vi.fn(),
  carregarConversa: vi.fn(),
  listarConversas: vi.fn(),
}));
vi.mock("@/modules/ai/api/conversas.repository", () => ({
  apagarConversa: vi.fn(),
  renomearConversa: vi.fn(),
}));

const { Route: RotaIndex } = await import("./index");
const { Route: RotaClients } = await import("./clients");
const { Route: RotaTasks } = await import("./tasks");
const { Route: RotaOnboarding } = await import("./onboarding");
const { Route: RotaPipeline } = await import("./pipeline");
const { Route: RotaAi } = await import("./ai");
const { Route: RotaImpressao } = await import("./propostas.$id.imprimir");
const { Route: RotaConteudo } = await import("./conteudo");

async function clienteEBarrado(beforeLoad: (arg: never) => unknown): Promise<void> {
  let lancado: unknown;
  try {
    await beforeLoad({ context: { papel: "client" } } as never);
  } catch (e) {
    lancado = e;
  }
  expect(lancado).toMatchObject({
    options: { to: "/acesso-negado", search: { exigido: "owner, manager, member" } },
  });
}

async function memberPassa(beforeLoad: (arg: never) => unknown): Promise<void> {
  const resultado = await beforeLoad({ context: { papel: "member" } } as never);
  expect(resultado).toBeUndefined();
}

describe("guarda de / — Dashboard (DASH-3)", () => {
  it("client é barrado", () => clienteEBarrado(RotaIndex.options.beforeLoad!));
  it("member passa", () => memberPassa(RotaIndex.options.beforeLoad!));
});

describe("guarda de /clients (CLI-6)", () => {
  it("client é barrado", () => clienteEBarrado(RotaClients.options.beforeLoad!));
  it("member passa", () => memberPassa(RotaClients.options.beforeLoad!));
});

describe("guarda de /tasks (DASH-3)", () => {
  it("client é barrado", () => clienteEBarrado(RotaTasks.options.beforeLoad!));
  it("member passa", () => memberPassa(RotaTasks.options.beforeLoad!));
});

describe("guarda de /onboarding (DASH-3)", () => {
  it("client é barrado", () => clienteEBarrado(RotaOnboarding.options.beforeLoad!));
  it("member passa", () => memberPassa(RotaOnboarding.options.beforeLoad!));
});

describe("guarda de /pipeline (DASH-3)", () => {
  it("client é barrado", () => clienteEBarrado(RotaPipeline.options.beforeLoad!));
  it("member passa", () => memberPassa(RotaPipeline.options.beforeLoad!));
});

describe("guarda de /ai (DASH-3)", () => {
  it("client é barrado", () => clienteEBarrado(RotaAi.options.beforeLoad!));
  it("member passa", () => memberPassa(RotaAi.options.beforeLoad!));
});

describe("guarda de /propostas/$id/imprimir (D-064)", () => {
  it("client é barrado", () => clienteEBarrado(RotaImpressao.options.beforeLoad!));
  it("member passa", () => memberPassa(RotaImpressao.options.beforeLoad!));
});

describe("guarda de /conteudo (D-065)", () => {
  it("client é barrado", () => clienteEBarrado(RotaConteudo.options.beforeLoad!));
  it("member passa", () => memberPassa(RotaConteudo.options.beforeLoad!));
});
