import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render as renderizar,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampoDoPipeline, RascunhoDeCampo } from "../domain/campos";
import {
  MAXIMO_DE_CAMPOS,
  MAXIMO_DE_ESTAGIOS,
  MAXIMO_DE_PIPELINES,
  MOTIVOS_POR_TIPO,
} from "../domain/limites";
import { ORDEM_DOS_ESTAGIOS, rotuloDoEstagio } from "../domain/stage";

const criarPipeline = vi.fn();
const renomearPipeline = vi.fn();
const arquivarPipeline = vi.fn();
const apagarPipeline = vi.fn();
const salvarEstagios = vi.fn();
const salvarMotivos = vi.fn();
const toastError = vi.fn();

const PIPELINE = "10000000-0000-4000-8000-000000000001";

const CAMPOS: readonly CampoDoPipeline[] = [
  {
    id: "c1",
    pipelineId: PIPELINE,
    nome: "Tem site?",
    tipo: "sim_nao",
    opcoes: null,
    obrigatorio: true,
    ordem: 0,
    ativo: true,
  },
  {
    id: "c2",
    pipelineId: PIPELINE,
    nome: "Nicho de atuação",
    tipo: "lista",
    opcoes: ["Clínica", "Varejo", "Serviços"],
    obrigatorio: false,
    ordem: 1,
    ativo: true,
  },
];

const ESTAGIOS = ORDEM_DOS_ESTAGIOS.map((tipo, i) => ({
  id: `e-${tipo}`,
  pipelineId: PIPELINE,
  nome: rotuloDoEstagio(tipo),
  ordem: i + 1,
  tipo,
}));

const MOTIVOS = [
  { id: "m1", pipelineId: PIPELINE, tipo: "perda", rotulo: "Preço", ordem: 1, ativo: true },
  { id: "m2", pipelineId: PIPELINE, tipo: "perda", rotulo: "Desengajou", ordem: 2, ativo: true },
  { id: "m3", pipelineId: PIPELINE, tipo: "descarte", rotulo: "Sem verba", ordem: 1, ativo: true },
];

const pipelines = {
  data: [
    { id: PIPELINE, nome: "Comercial", ordem: 0, ativo: true },
    { id: "p2", nome: "Parcerias antigas", ordem: 1, ativo: false },
  ] as unknown,
  isPending: false,
  isError: false,
};
const estagios = { data: ESTAGIOS as unknown, isPending: false, isError: false, dataUpdatedAt: 1 };
const motivos = { data: MOTIVOS as unknown, isPending: false, isError: false, dataUpdatedAt: 1 };
const perfil = { papel: "owner" as string | null, meuId: "p1" };

vi.mock("../api/pipeline.repository", () => ({
  atualizarDadosDaOportunidade: vi.fn(),
  atualizarDatasDeReuniao: vi.fn(),
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
vi.mock("../hooks/use-pipeline", async (importOriginal) => {
  const real = await importOriginal<typeof import("../hooks/use-pipeline")>();
  return {
    usePipelines: () => pipelines,
    useEstagios: () => estagios,
    useMotivos: () => motivos,
    useCriarPipeline: () => ({ mutate: criarPipeline, isPending: false }),
    useRenomearPipeline: () => ({ mutate: renomearPipeline, isPending: false }),
    useArquivarPipeline: () => ({ mutate: arquivarPipeline, isPending: false }),
    useApagarPipeline: () => ({ mutate: apagarPipeline, isPending: false }),
    useSalvarEstagios: () => ({ mutate: salvarEstagios, isPending: false }),
    useSalvarMotivos: () => ({ mutate: salvarMotivos, isPending: false }),
    useCampos: real.useCampos,
    useSalvarCampos: real.useSalvarCampos,
  };
});
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => perfil }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (m: string) => toastError(m) } }));
const handlersDeTipo = new Map<string, (valor: string) => void>();
vi.mock("@/components/ui/select", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/components/ui/select")>();
  const Select: typeof real.Select = (props) => {
    if (typeof props.value === "string" && props.onValueChange) {
      handlersDeTipo.set(props.value, props.onValueChange);
    }
    return <real.Select {...props} />;
  };
  return { ...real, Select };
});

const { listarCampos, salvarCampos } = await import("../api/pipelines.repository");
const { PipelinesSettings } = await import("./pipelines-settings");

const COMERCIAL = { id: PIPELINE, nome: "Comercial", ordem: 0, ativo: true };
const ARQUIVADO = { id: "p2", nome: "Parcerias antigas", ordem: 1, ativo: false };
const PARCERIAS = { id: "p3", nome: "Parcerias", ordem: 2, ativo: true };

let qc = new QueryClient();
function Provedor({ children }: { readonly children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const render = (ui: ReactElement) => renderizar(ui, { wrapper: Provedor });

beforeEach(() => {
  vi.clearAllMocks();
  handlersDeTipo.clear();
  perfil.papel = "owner";
  pipelines.isError = false;
  pipelines.data = [COMERCIAL, ARQUIVADO];
  estagios.isError = false;
  estagios.data = ESTAGIOS;
  motivos.data = MOTIVOS;
  qc = new QueryClient();
  vi.mocked(listarCampos)
    .mockReset()
    .mockResolvedValue([...CAMPOS]);
  vi.mocked(salvarCampos).mockReset().mockResolvedValue(undefined);
});

const botao = (nome: string | RegExp) => screen.getByRole("button", { name: nome });

async function abrirEditorDoComercial() {
  const user = userEvent.setup();
  render(<PipelinesSettings />);
  await user.click(botao("Editar Comercial"));
  return user;
}

describe("card de Pipelines — quem vê o quê", () => {
  it("(a) member vê a lista (nome, nº de estágios, situação) e NENHUM botão", () => {
    perfil.papel = "member";
    render(<PipelinesSettings />);

    expect(screen.getByText("Comercial")).toBeInTheDocument();
    expect(screen.getByText("Parcerias antigas")).toBeInTheDocument();
    expect(screen.getAllByText("8 estágios")).toHaveLength(2);
    expect(screen.getByText("arquivado")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("owner vê Novo pipeline, Editar e Arquivar/Reativar", () => {
    render(<PipelinesSettings />);

    expect(botao("Novo pipeline")).toBeInTheDocument();
    expect(botao("Editar Comercial")).toBeInTheDocument();
    expect(botao("Arquivar Comercial")).toBeInTheDocument();
    expect(botao("Reativar Parcerias antigas")).toBeInTheDocument();
  });

  it("manager também edita (podeEditar = owner ou manager)", () => {
    perfil.papel = "manager";
    render(<PipelinesSettings />);

    expect(botao("Novo pipeline")).toBeInTheDocument();
  });

  it("Arquivar chama arquivarPipeline com ativo: false; Reativar com true", async () => {
    pipelines.data = [COMERCIAL, ARQUIVADO, PARCERIAS];
    const user = userEvent.setup();
    render(<PipelinesSettings />);

    await user.click(botao("Arquivar Comercial"));
    expect(arquivarPipeline).toHaveBeenCalledWith({ id: PIPELINE, ativo: false });

    await user.click(botao("Reativar Parcerias antigas"));
    expect(arquivarPipeline).toHaveBeenCalledWith({ id: "p2", ativo: true });
  });

  it("em ERRO não afirma que não há pipelines", () => {
    pipelines.isError = true;
    render(<PipelinesSettings />);

    expect(screen.getByText(/não foi possível ler/i)).toBeInTheDocument();
    expect(screen.queryByText("Comercial")).toBeNull();
  });

  it("🔴 único pipeline ativo: 'Arquivar' trava e o title diz por quê — com dois ativos, destrava", () => {
    const { unmount } = render(<PipelinesSettings />);
    expect(botao("Arquivar Comercial")).toBeDisabled();
    expect(botao("Arquivar Comercial")).toHaveAttribute(
      "title",
      "Único pipeline ativo; reative outro antes",
    );
    expect(botao("Reativar Parcerias antigas")).toBeEnabled();
    unmount();

    pipelines.data = [COMERCIAL, ARQUIVADO, PARCERIAS];
    render(<PipelinesSettings />);
    expect(botao("Arquivar Comercial")).toBeEnabled();
    expect(botao("Arquivar Comercial")).not.toHaveAttribute("title");
  });
});

describe("apagar pipeline (D-067)", () => {
  it("🔴 pipeline que não é o padrão ganha 'Apagar'; o padrão não", () => {
    pipelines.data = [COMERCIAL, ARQUIVADO, PARCERIAS];
    render(<PipelinesSettings />);

    expect(botao("Apagar Parcerias")).toBeInTheDocument();
    expect(botao("Apagar Parcerias antigas")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apagar Comercial" })).toBeNull();
  });

  it("manager também apaga; member não vê o botão", () => {
    perfil.papel = "manager";
    const { unmount } = render(<PipelinesSettings />);
    expect(botao("Apagar Parcerias antigas")).toBeInTheDocument();
    unmount();

    perfil.papel = "member";
    render(<PipelinesSettings />);
    expect(screen.queryByRole("button", { name: "Apagar Parcerias antigas" })).toBeNull();
  });

  it("🔴 confirmar no diálogo chama apagarPipeline com o id; cancelar não", async () => {
    pipelines.data = [COMERCIAL, ARQUIVADO, PARCERIAS];
    const user = userEvent.setup();
    render(<PipelinesSettings />);

    await user.click(botao("Apagar Parcerias"));
    expect(screen.getByRole("alertdialog", { name: 'Apagar "Parcerias"?' })).toBeInTheDocument();
    expect(screen.getByText(/estágios, os motivos de saída e os campos/)).toBeInTheDocument();
    await user.click(botao("Cancelar"));
    expect(apagarPipeline).not.toHaveBeenCalled();

    await user.click(botao("Apagar Parcerias"));
    await user.click(botao("Sim, apagar"));
    expect(apagarPipeline).toHaveBeenCalledTimes(1);
    expect(apagarPipeline).toHaveBeenCalledWith("p3");
  });
});

describe("(e) tetos da tela seguem os tetos de leitura", () => {
  const pipelinesAteh = (quantos: number) =>
    Array.from({ length: quantos }, (_, i) => ({
      id: i === 0 ? PIPELINE : `p-${i}`,
      nome: i === 0 ? "Comercial" : `Pipeline ${i}`,
      ordem: i,
      ativo: i % 2 === 0,
    }));

  const estagiosExtras = (quantos: number) => [
    ...ESTAGIOS,
    ...Array.from({ length: quantos - ESTAGIOS.length }, (_, i) => ({
      id: `e-extra-${i}`,
      pipelineId: PIPELINE,
      nome: `Extra ${i + 1}`,
      ordem: ESTAGIOS.length + i + 1,
      tipo: "prospeccao" as const,
    })),
  ];
  const motivosDePerda = (quantos: number) => [
    ...MOTIVOS.filter((m) => m.tipo === "descarte"),
    ...Array.from({ length: quantos }, (_, i) => ({
      id: `m-perda-${i}`,
      pipelineId: PIPELINE,
      tipo: "perda",
      rotulo: `Perda ${i + 1}`,
      ordem: i + 1,
      ativo: true,
    })),
  ];

  it("🔴 50 pipelines (ativos + arquivados; teto de leitura 50): 'Novo pipeline' trava e o title explica; com 49, livre", () => {
    pipelines.data = pipelinesAteh(MAXIMO_DE_PIPELINES);
    const { unmount } = render(<PipelinesSettings />);

    expect(botao("Novo pipeline")).toBeDisabled();
    expect(botao("Novo pipeline")).toHaveAttribute(
      "title",
      `Máximo de ${MAXIMO_DE_PIPELINES} pipelines, contando arquivados`,
    );
    unmount();

    pipelines.data = pipelinesAteh(MAXIMO_DE_PIPELINES - 1);
    render(<PipelinesSettings />);

    expect(botao("Novo pipeline")).toBeEnabled();
    expect(botao("Novo pipeline")).not.toHaveAttribute("title");
  });

  it("🔴 30 estágios no rascunho (teto de leitura 30, o que a RPC aceita): 'Adicionar estágio' trava e o title explica; com 29, livre", async () => {
    estagios.data = estagiosExtras(MAXIMO_DE_ESTAGIOS);
    const { unmount } = render(<PipelinesSettings />);
    await userEvent.setup().click(botao("Editar Comercial"));

    expect(botao("Adicionar estágio")).toBeDisabled();
    expect(botao("Adicionar estágio")).toHaveAttribute(
      "title",
      `Máximo de ${MAXIMO_DE_ESTAGIOS} estágios por pipeline`,
    );
    unmount();

    estagios.data = estagiosExtras(MAXIMO_DE_ESTAGIOS - 1);
    render(<PipelinesSettings />);
    await userEvent.setup().click(botao("Editar Comercial"));

    expect(botao("Adicionar estágio")).toBeEnabled();
    expect(botao("Adicionar estágio")).not.toHaveAttribute("title");
  });

  it("🔴 20 motivos de perda (teto de leitura 40, os dois tipos): a lista de perda trava, a de descarte segue livre; com 19, as duas livres", async () => {
    motivos.data = motivosDePerda(MOTIVOS_POR_TIPO);
    const { unmount } = render(<PipelinesSettings />);
    await userEvent.setup().click(botao("Editar Comercial"));

    const perda = () => screen.getByRole("group", { name: "Motivos de perda" });
    const descarte = () => screen.getByRole("group", { name: "Motivos de descarte" });
    expect(within(perda()).getByRole("button", { name: "Adicionar motivo" })).toBeDisabled();
    expect(within(perda()).getByRole("button", { name: "Adicionar motivo" })).toHaveAttribute(
      "title",
      `Máximo de ${MOTIVOS_POR_TIPO} motivos de perda`,
    );
    expect(within(descarte()).getByRole("button", { name: "Adicionar motivo" })).toBeEnabled();
    unmount();

    motivos.data = motivosDePerda(MOTIVOS_POR_TIPO - 1);
    render(<PipelinesSettings />);
    await userEvent.setup().click(botao("Editar Comercial"));

    expect(within(perda()).getByRole("button", { name: "Adicionar motivo" })).toBeEnabled();
    expect(within(descarte()).getByRole("button", { name: "Adicionar motivo" })).toBeEnabled();
  });

  it("🔴 o Select de tipo ignora valor fora do enum — e aceita um de dentro (o positivo)", async () => {
    await abrirEditorDoComercial();
    const trocarTipoDeAbordagem = handlersDeTipo.get("abordagem");
    expect(trocarTipoDeAbordagem).toBeDefined();

    act(() => trocarTipoDeAbordagem?.("invalido"));
    expect(screen.getByRole("combobox", { name: "Tipo de Abordagem" })).toHaveTextContent(
      "Abordagem",
    );
    fireEvent.click(botao("Salvar estágios"));
    const [vars] = salvarEstagios.mock.calls[0] as [{ estagios: ReadonlyArray<{ tipo: string }> }];
    expect(vars.estagios[1]?.tipo).toBe("abordagem");

    act(() => trocarTipoDeAbordagem?.("r1"));
    expect(screen.getByRole("combobox", { name: "Tipo de Abordagem" })).toHaveTextContent(
      rotuloDoEstagio("r1"),
    );
  });
});

describe("(b) editor de estágios", () => {
  it("🔴 remover o estágio fechado: 'Salvar estágios' desabilita e o problema aparece", async () => {
    const user = await abrirEditorDoComercial();

    expect(botao("Salvar estágios")).toBeEnabled();
    await user.click(botao("Remover Fechado"));

    expect(screen.getByText("Falta um estágio do tipo fechado.")).toBeInTheDocument();
    expect(botao("Salvar estágios")).toBeDisabled();
    fireEvent.click(botao("Salvar estágios"));
    expect(salvarEstagios).not.toHaveBeenCalled();
  });

  it("rascunho válido: renomear + subir → salvarEstagios recebe [{id, nome, tipo}] na ordem da tela", async () => {
    const user = await abrirEditorDoComercial();

    fireEvent.change(screen.getByLabelText("Nome do estágio 1"), {
      target: { value: "  Lista fria " },
    });
    await user.click(botao("Subir Abordagem"));

    expect(screen.queryByText(/Falta|Só pode|sem nome|mesmo nome/)).toBeNull();
    expect(botao("Salvar estágios")).toBeEnabled();
    await user.click(botao("Salvar estágios"));

    expect(salvarEstagios).toHaveBeenCalledTimes(1);
    const [vars] = salvarEstagios.mock.calls[0] as [
      { pipelineId: string; estagios: ReadonlyArray<{ id?: string; nome: string; tipo: string }> },
    ];
    expect(vars.pipelineId).toBe(PIPELINE);
    expect(vars.estagios.slice(0, 3)).toEqual([
      { id: "e-abordagem", nome: "Abordagem", tipo: "abordagem" },
      { id: "e-prospeccao", nome: "Lista fria", tipo: "prospeccao" },
      { id: "e-qualificacao", nome: "Qualificação", tipo: "qualificacao" },
    ]);
    expect(vars.estagios).toHaveLength(8);
  });

  it("Adicionar estágio entra sem id e o Select oferece os 8 tipos com rótulo", async () => {
    const user = await abrirEditorDoComercial();

    await user.click(botao("Adicionar estágio"));
    fireEvent.change(screen.getByLabelText("Nome do estágio 9"), {
      target: { value: "Follow-up longo" },
    });

    await user.click(screen.getByRole("combobox", { name: "Tipo de Follow-up longo" }));
    const opcoes = await screen.findAllByRole("option");
    expect(opcoes.map((o) => o.textContent)).toEqual(ORDEM_DOS_ESTAGIOS.map(rotuloDoEstagio));
    await user.click(screen.getByRole("option", { name: "Qualificação" }));

    await user.click(botao("Salvar estágios"));
    const [vars] = salvarEstagios.mock.calls[0] as [
      { estagios: ReadonlyArray<{ id?: string; nome: string; tipo: string }> },
    ];
    expect(vars.estagios[8]).toEqual({
      id: undefined,
      nome: "Follow-up longo",
      tipo: "qualificacao",
    });
  });

  it("🔴 nome repetido: desabilita com 'Dois estágios com o mesmo nome.'", async () => {
    await abrirEditorDoComercial();

    fireEvent.change(screen.getByLabelText("Nome do estágio 1"), {
      target: { value: " abordagem " },
    });

    expect(screen.getByText("Dois estágios com o mesmo nome.")).toBeInTheDocument();
    expect(botao("Salvar estágios")).toBeDisabled();
  });

  it("Renomear vazio: toast e NENHUM PATCH (o CHECK do banco pede 1-60)", async () => {
    const user = await abrirEditorDoComercial();

    await user.clear(screen.getByLabelText("Nome do pipeline"));
    await user.tab();

    expect(toastError).toHaveBeenCalledWith("O nome tem de 1 a 60 caracteres.");
    expect(renomearPipeline).not.toHaveBeenCalled();
  });

  it("Renomear grava ao sair do campo", async () => {
    const user = await abrirEditorDoComercial();

    const campo = screen.getByLabelText("Nome do pipeline");
    await user.clear(campo);
    await user.type(campo, "Vendas");
    await user.tab();

    expect(renomearPipeline).toHaveBeenCalledWith({ id: PIPELINE, nome: "Vendas" });
  });
});

describe("o rascunho e o refetch", () => {
  it("refetch com o MESMO conteúdo (array novo) mantém o rascunho de estágios e de motivos", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PipelinesSettings />);
    await user.click(botao("Editar Comercial"));
    fireEvent.change(screen.getByLabelText("Nome do estágio 1"), {
      target: { value: "Lista fria" },
    });
    fireEvent.change(screen.getByLabelText("Motivo de perda 1"), {
      target: { value: "Caro demais" },
    });

    estagios.data = ESTAGIOS.map((e) => ({ ...e }));
    motivos.data = MOTIVOS.map((m) => ({ ...m }));
    estagios.dataUpdatedAt += 1;
    motivos.dataUpdatedAt += 1;
    rerender(<PipelinesSettings />);

    expect(screen.getByLabelText("Nome do estágio 1")).toHaveValue("Lista fria");
    expect(screen.getByLabelText("Motivo de perda 1")).toHaveValue("Caro demais");
  });

  it("refetch REAL dos campos com o mesmo conteúdo (array novo) mantém o rascunho de campos", async () => {
    const { rerender } = render(<PipelinesSettings />);
    await userEvent.setup().click(botao("Editar Comercial"));
    fireEvent.change(await screen.findByLabelText("Nome do campo 1"), {
      target: { value: "Site" },
    });

    vi.mocked(listarCampos).mockResolvedValue(CAMPOS.map((c) => ({ ...c })));
    await act(() => qc.invalidateQueries({ queryKey: ["pipelines", PIPELINE, "campos"] }));
    rerender(<PipelinesSettings />);

    expect(listarCampos).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Nome do campo 1")).toHaveValue("Site");
  });

  it("🔴 refetch com conteúdo DIFERENTE descarta o rascunho e mostra o dado novo", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PipelinesSettings />);
    await user.click(botao("Editar Comercial"));
    fireEvent.change(screen.getByLabelText("Nome do estágio 1"), {
      target: { value: "Lista fria" },
    });
    fireEvent.change(screen.getByLabelText("Motivo de perda 1"), {
      target: { value: "Caro demais" },
    });

    estagios.data = ESTAGIOS.map((e, i) => (i === 1 ? { ...e, nome: "Primeiro toque" } : e));
    motivos.data = MOTIVOS.map((m) => (m.id === "m2" ? { ...m, ativo: false } : m));
    estagios.dataUpdatedAt += 1;
    motivos.dataUpdatedAt += 1;
    rerender(<PipelinesSettings />);

    expect(screen.getByLabelText("Nome do estágio 1")).toHaveValue("Prospecção");
    expect(screen.getByLabelText("Nome do estágio 2")).toHaveValue("Primeiro toque");
    expect(screen.getByLabelText("Motivo de perda 1")).toHaveValue("Preço");
    expect(screen.getByRole("switch", { name: "Desengajou ativo" })).not.toBeChecked();
  });
});

describe("(c) Novo pipeline", () => {
  it("chama criarPipeline com o nome e os 8 estágios padrão (rótulos de stage.ts)", async () => {
    const user = userEvent.setup();
    render(<PipelinesSettings />);

    await user.click(botao("Novo pipeline"));
    expect(botao("Criar pipeline")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nome do novo pipeline"), {
      target: { value: "  Parcerias  " },
    });
    fireEvent.change(screen.getByLabelText("Nome do estágio 1"), {
      target: { value: " Lista fria " },
    });
    expect(botao("Criar pipeline")).toBeEnabled();
    await user.click(botao("Criar pipeline"));

    expect(criarPipeline).toHaveBeenCalledWith(
      {
        nome: "Parcerias",
        estagios: ORDEM_DOS_ESTAGIOS.map((tipo) => ({
          nome: tipo === "prospeccao" ? "Lista fria" : rotuloDoEstagio(tipo),
          tipo,
        })),
      },
      expect.anything(),
    );
  });

  it("🔴 os estágios iniciais são editáveis e o mesmo portão vale antes de criar", async () => {
    const user = userEvent.setup();
    render(<PipelinesSettings />);

    await user.click(botao("Novo pipeline"));
    fireEvent.change(screen.getByLabelText("Nome do novo pipeline"), { target: { value: "P" } });
    await user.click(botao("Remover Perdido"));

    expect(screen.getByText("Falta um estágio do tipo perdido.")).toBeInTheDocument();
    expect(botao("Criar pipeline")).toBeDisabled();
  });
});

describe("(d) editor de motivos", () => {
  it("🔴 rótulo repetido em perda: 'Salvar motivos' desabilita e o problema aparece", async () => {
    await abrirEditorDoComercial();

    expect(botao("Salvar motivos")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Motivo de perda 2"), {
      target: { value: "preço " },
    });

    expect(screen.getByText("Dois motivos de perda com o mesmo rótulo.")).toBeInTheDocument();
    expect(botao("Salvar motivos")).toBeDisabled();
    fireEvent.click(botao("Salvar motivos"));
    expect(salvarMotivos).not.toHaveBeenCalled();
  });

  it("rascunho válido: renomear, desativar e adicionar → salvarMotivos recebe [{id?, tipo, rotulo, ativo}]", async () => {
    const user = await abrirEditorDoComercial();

    fireEvent.change(screen.getByLabelText("Motivo de perda 2"), {
      target: { value: "Sumiu" },
    });
    await user.click(screen.getByRole("switch", { name: "Preço ativo" }));
    const descarte = screen.getByRole("group", { name: "Motivos de descarte" });
    await user.click(within(descarte).getByRole("button", { name: "Adicionar motivo" }));
    fireEvent.change(screen.getByLabelText("Motivo de descarte 2"), {
      target: { value: "Curioso" },
    });

    expect(botao("Salvar motivos")).toBeEnabled();
    await user.click(botao("Salvar motivos"));

    expect(salvarMotivos).toHaveBeenCalledWith({
      pipelineId: PIPELINE,
      motivos: [
        { id: "m1", tipo: "perda", rotulo: "Preço", ativo: false },
        { id: "m2", tipo: "perda", rotulo: "Sumiu", ativo: true },
        { id: "m3", tipo: "descarte", rotulo: "Sem verba", ativo: true },
        { id: undefined, tipo: "descarte", rotulo: "Curioso", ativo: true },
      ],
    });
  });

  it("🔴 desativar o único motivo de descarte: desabilita com 'Falta pelo menos um motivo ativo de descarte.'", async () => {
    const user = await abrirEditorDoComercial();

    await user.click(screen.getByRole("switch", { name: "Sem verba ativo" }));

    expect(screen.getByText("Falta pelo menos um motivo ativo de descarte.")).toBeInTheDocument();
    expect(botao("Salvar motivos")).toBeDisabled();
  });
});

describe("(f) editor de campos personalizados", () => {
  const nome = (n: number) => screen.getByLabelText(`Nome do campo ${n}`);
  const rascunhoEnviado = (): readonly RascunhoDeCampo[] => {
    const [, rascunho] = vi.mocked(salvarCampos).mock.calls[0] as [
      string,
      readonly RascunhoDeCampo[],
    ];
    return rascunho;
  };

  async function abrirCampos() {
    const user = await abrirEditorDoComercial();
    await screen.findByLabelText("Nome do campo 1");
    return user;
  }

  it("renderiza os campos lidos (nome, tipo, obrigatório, ativo; opções só na lista) — e lê TODOS, inativos inclusive", async () => {
    await abrirCampos();

    expect(listarCampos).toHaveBeenCalledWith(PIPELINE, true);
    expect(nome(1)).toHaveValue("Tem site?");
    expect(screen.getByRole("combobox", { name: "Tipo do campo Tem site?" })).toHaveTextContent(
      "Sim/não",
    );
    expect(screen.getByRole("checkbox", { name: "Tem site? obrigatório" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Tem site? ativo" })).toBeChecked();
    expect(screen.queryByLabelText("Opções de Tem site?")).toBeNull();

    expect(nome(2)).toHaveValue("Nicho de atuação");
    expect(screen.getByLabelText("Opções de Nicho de atuação")).toHaveValue(
      "Clínica\nVarejo\nServiços",
    );
    expect(
      screen.getByRole("checkbox", { name: "Nicho de atuação obrigatório" }),
    ).not.toBeChecked();
    expect(botao("Salvar campos")).toBeEnabled();
  });

  it("falha de leitura: FalhaAoLer dos campos, sem afirmar 'nenhum campo'", async () => {
    vi.mocked(listarCampos).mockRejectedValue(
      Object.assign(new Error("permission denied"), { code: "42501" }),
    );
    await abrirEditorDoComercial();

    expect(
      await screen.findByText(/Não foi possível ler os campos personalizados/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Nenhum campo ainda.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar campos" })).toBeNull();
  });

  it("pipeline sem campo: estado vazio explícito e 'Adicionar campo' livre", async () => {
    vi.mocked(listarCampos).mockResolvedValue([]);
    await abrirEditorDoComercial();

    expect(await screen.findByText("Nenhum campo ainda.")).toBeInTheDocument();
    expect(botao("Adicionar campo")).toBeEnabled();
  });

  it("🔴 Adicionar campo entra sem nome: 'Todo campo precisa de nome.' trava o Salvar; com nome, destrava", async () => {
    const user = await abrirCampos();

    await user.click(botao("Adicionar campo"));
    expect(nome(3)).toHaveValue("");
    expect(screen.getByText("Todo campo precisa de nome.")).toBeInTheDocument();
    expect(botao("Salvar campos")).toBeDisabled();
    fireEvent.click(botao("Salvar campos"));
    expect(salvarCampos).not.toHaveBeenCalled();

    fireEvent.change(nome(3), { target: { value: "Cidade" } });
    expect(screen.queryByText("Todo campo precisa de nome.")).toBeNull();
    expect(botao("Salvar campos")).toBeEnabled();
  });

  it("🔴 30 campos no rascunho: 'Adicionar campo' trava e o title explica; com 29, livre", async () => {
    const campos = (n: number): CampoDoPipeline[] =>
      Array.from({ length: n }, (_, i) => ({
        ...CAMPOS[0],
        id: `c-${i}`,
        nome: `Campo ${i + 1}`,
        ordem: i,
        ativo: i % 2 === 0,
      }));
    vi.mocked(listarCampos).mockResolvedValue(campos(MAXIMO_DE_CAMPOS));
    const { unmount } = render(<PipelinesSettings />);
    await userEvent.setup().click(botao("Editar Comercial"));
    await screen.findByLabelText(`Nome do campo ${MAXIMO_DE_CAMPOS}`);

    expect(botao("Adicionar campo")).toBeDisabled();
    expect(botao("Adicionar campo")).toHaveAttribute(
      "title",
      `Máximo de ${MAXIMO_DE_CAMPOS} campos por pipeline.`,
    );
    unmount();

    qc = new QueryClient();
    vi.mocked(listarCampos).mockResolvedValue(campos(MAXIMO_DE_CAMPOS - 1));
    render(<PipelinesSettings />);
    await userEvent.setup().click(botao("Editar Comercial"));
    await screen.findByLabelText(`Nome do campo ${MAXIMO_DE_CAMPOS - 1}`);

    expect(botao("Adicionar campo")).toBeEnabled();
    expect(botao("Adicionar campo")).not.toHaveAttribute("title");
  });

  it("🔴 lista sem opção: 'A lista Nicho de atuação precisa de pelo menos uma opção.' trava o Salvar", async () => {
    await abrirCampos();

    fireEvent.change(screen.getByLabelText("Opções de Nicho de atuação"), {
      target: { value: "  \n\n" },
    });

    expect(
      screen.getByText("A lista Nicho de atuação precisa de pelo menos uma opção."),
    ).toBeInTheDocument();
    expect(botao("Salvar campos")).toBeDisabled();
    fireEvent.click(botao("Salvar campos"));
    expect(salvarCampos).not.toHaveBeenCalled();
  });

  it("🔴 nome repetido no rascunho trava com 'Nome de campo repetido: X.'", async () => {
    await abrirCampos();

    fireEvent.change(nome(2), { target: { value: " tem site? " } });

    expect(screen.getByText("Nome de campo repetido: tem site?.")).toBeInTheDocument();
    expect(botao("Salvar campos")).toBeDisabled();
  });

  it("rascunho válido: renomear, virar lista, desmarcar obrigatório, desativar, descer e adicionar → salvarCampos recebe o rascunho com ordem = posição e opcoes null fora de lista; depois o editor remonta com a lista refeita", async () => {
    const user = await abrirCampos();

    fireEvent.change(nome(1), { target: { value: "  Site?  " } });
    await user.click(screen.getByRole("checkbox", { name: "Site? obrigatório" }));
    await user.click(screen.getByRole("switch", { name: "Site? ativo" }));
    await user.click(botao("Descer Site?"));

    await user.click(botao("Adicionar campo"));
    fireEvent.change(nome(3), { target: { value: "Porte" } });
    await user.click(screen.getByRole("combobox", { name: "Tipo do campo Porte" }));
    const opcoes = await screen.findAllByRole("option");
    expect(opcoes.map((o) => o.textContent)).toEqual(["Texto", "Sim/não", "Lista", "Número"]);
    await user.click(screen.getByRole("option", { name: "Lista" }));
    fireEvent.change(screen.getByLabelText("Opções de Porte"), {
      target: { value: " Pequeno \nMédio\n\nGrande\n" },
    });
    await user.click(screen.getByRole("combobox", { name: "Tipo do campo Nicho de atuação" }));
    await user.click(screen.getByRole("option", { name: "Número" }));
    expect(screen.queryByLabelText("Opções de Nicho de atuação")).toBeNull();

    vi.mocked(listarCampos).mockResolvedValue([
      { ...CAMPOS[1], tipo: "numero", opcoes: null, ordem: 0 },
      { ...CAMPOS[0], nome: "Site? (servidor)", obrigatorio: false, ativo: false, ordem: 1 },
    ]);
    expect(botao("Salvar campos")).toBeEnabled();
    await user.click(botao("Salvar campos"));

    await waitFor(() => expect(salvarCampos).toHaveBeenCalledTimes(1));
    expect(vi.mocked(salvarCampos).mock.calls[0]?.[0]).toBe(PIPELINE);
    expect(rascunhoEnviado()).toEqual([
      {
        id: "c2",
        nome: "Nicho de atuação",
        tipo: "numero",
        opcoes: null,
        obrigatorio: false,
        ordem: 0,
        ativo: true,
      },
      {
        id: "c1",
        nome: "Site?",
        tipo: "sim_nao",
        opcoes: null,
        obrigatorio: false,
        ordem: 1,
        ativo: false,
      },
      {
        id: undefined,
        nome: "Porte",
        tipo: "lista",
        opcoes: ["Pequeno", "Médio", "Grande"],
        obrigatorio: false,
        ordem: 2,
        ativo: true,
      },
    ]);

    expect(await screen.findByDisplayValue("Site? (servidor)")).toBeInTheDocument();
    expect(nome(1)).toHaveValue("Nicho de atuação");
    expect(screen.queryByLabelText("Nome do campo 3")).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("🔴 23505 (nome já existe no banco): o toast diz a frase do repositório; o erro refaz a leitura e, com o banco igual, o rascunho fica", async () => {
    vi.mocked(salvarCampos).mockRejectedValue(
      new Error("Já existe um campo com esse nome neste pipeline."),
    );
    const user = await abrirCampos();

    fireEvent.change(nome(1), { target: { value: "Cidade" } });
    await user.click(botao("Salvar campos"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Já existe um campo com esse nome neste pipeline."),
    );
    await waitFor(() => expect(listarCampos).toHaveBeenCalledTimes(2));
    expect(nome(1)).toHaveValue("Cidade");
    expect(botao("Salvar campos")).toBeEnabled();
  });

  it("🔴 duas remoções, uma apagável e uma em uso: o 23514 vira toast e o editor remonta com o que o BANCO tem — sem a apagada (A), com a recusada (B) para desativar", async () => {
    const A: CampoDoPipeline = { ...CAMPOS[1], id: "c-a", nome: "Apagável", ordem: 0 };
    const B: CampoDoPipeline = { ...CAMPOS[0], id: "c-b", nome: "Em uso", ordem: 1 };
    vi.mocked(listarCampos).mockResolvedValueOnce([A, B]).mockResolvedValue([B]);
    vi.mocked(salvarCampos).mockRejectedValue(
      new Error("Este campo tem valor gravado em 3 oportunidades. Desative em vez de apagar."),
    );
    const user = await abrirCampos();

    await user.click(botao("Remover Apagável"));
    await user.click(botao("Remover Em uso"));
    expect(screen.getByText("Nenhum campo ainda.")).toBeInTheDocument();
    await user.click(botao("Salvar campos"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Este campo tem valor gravado em 3 oportunidades. Desative em vez de apagar.",
      ),
    );
    expect(rascunhoEnviado()).toEqual([]);
    expect(await screen.findByDisplayValue("Em uso")).toBeInTheDocument();
    expect(listarCampos).toHaveBeenCalledTimes(2);
    expect(screen.queryByDisplayValue("Apagável")).toBeNull();
    expect(screen.queryByLabelText("Nome do campo 2")).toBeNull();
    expect(screen.getByRole("switch", { name: "Em uso ativo" })).toBeChecked();
  });

  it("linha nova (sem id) some do rascunho ao remover, sem passar pelo banco", async () => {
    const user = await abrirCampos();

    await user.click(botao("Adicionar campo"));
    fireEvent.change(nome(3), { target: { value: "Temporário" } });
    await user.click(botao("Remover Temporário"));

    expect(screen.queryByLabelText("Nome do campo 3")).toBeNull();
    expect(botao("Salvar campos")).toBeEnabled();
  });
});
