import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { criarOportunidade, listarResponsaveis, vincularRef } from "../api/pipeline.repository";
import { listarCampos, listarPipelines } from "../api/pipelines.repository";
import type { CampoDoPipeline } from "../domain/campos";
import type { Pipeline } from "../domain/pipeline";
import { NewOpportunityForm } from "./new-opportunity-form";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../api/pipelines.repository", () => ({
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

vi.mock("../api/pipeline.repository", () => ({
  atualizarDadosDaOportunidade: vi.fn(),
  atualizarDatasDeReuniao: vi.fn(),
  atualizarNutricao: vi.fn(),
  carregarCatalogo: vi.fn(),
  corrigirMotivoDeSaida: vi.fn(),
  criarOportunidade: vi.fn(),
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

const ATIVO_1 = "10000000-0000-4000-8000-000000000001";
const ATIVO_2 = "10000000-0000-4000-8000-000000000002";
const ARQUIVADO = "10000000-0000-4000-8000-00000000000a";
const ATIVOS: Pipeline[] = [
  { id: ATIVO_1, nome: "Comercial", ordem: 1, ativo: true },
  { id: ATIVO_2, nome: "Parcerias", ordem: 2, ativo: true },
];

function renderizar(pipelineIdPadrao: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <NewOpportunityForm aberto pipelineIdPadrao={pipelineIdPadrao} aoFechar={vi.fn()} />
    </QueryClientProvider>,
  );
}

async function escolherCanal(user: ReturnType<typeof userEvent.setup>, rotulo = "Indicação") {
  await user.click(screen.getByLabelText("Canal *"));
  await user.click(await screen.findByRole("option", { name: rotulo }));
}

async function preencherNomeECriar() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nome *"), "Padaria do Zé");
  await escolherCanal(user);
  const criar = screen.getByRole("button", { name: "Criar" });
  await waitFor(() => expect(criar).toBeEnabled());
  await user.click(criar);
  await waitFor(() => expect(vi.mocked(criarOportunidade)).toHaveBeenCalledTimes(1));
  return vi.mocked(criarOportunidade).mock.calls[0]?.[0];
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarCampos).mockResolvedValue([]);
  vi.mocked(listarResponsaveis).mockResolvedValue([]);
  vi.mocked(criarOportunidade).mockResolvedValue("oportunidade-nova");
});

describe("em qual pipeline a oportunidade nasce", () => {
  it("padrão ativo: nasce nele, mesmo não sendo o primeiro da lista", async () => {
    vi.mocked(listarPipelines).mockResolvedValue(ATIVOS);
    renderizar(ATIVO_2);

    expect((await preencherNomeECriar())?.pipelineId).toBe(ATIVO_2);
  });

  it("🔴 padrão ARQUIVADO (fora da lista de ativos): nasce no primeiro ativo, nunca no arquivado", async () => {
    vi.mocked(listarPipelines).mockResolvedValue(ATIVOS);
    renderizar(ARQUIVADO);

    expect((await preencherNomeECriar())?.pipelineId).toBe(ATIVO_1);
  });

  it("🔴 sem pipeline ativo nenhum: 'Criar' fica desabilitado mesmo com nome", async () => {
    vi.mocked(listarPipelines).mockResolvedValue([]);
    renderizar(ARQUIVADO);
    const user = userEvent.setup();

    await screen.findByLabelText("Nome *");
    await waitFor(() => expect(vi.mocked(listarPipelines)).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText("Nome *"), "Padaria do Zé");
    await escolherCanal(user);

    expect(screen.getByRole("button", { name: "Criar" })).toBeDisabled();
    expect(vi.mocked(criarOportunidade)).not.toHaveBeenCalled();
  });

  it("🔴 a lista de pipelines FALHOU: avisa, e o envio segue no pipeline do board", async () => {
    vi.mocked(listarPipelines).mockRejectedValue(
      Object.assign(new Error("permission denied"), { code: "42501" }),
    );
    renderizar(ATIVO_2);

    expect(
      await screen.findByText(
        "Não foi possível ler os pipelines; a oportunidade vai para o pipeline do board.",
      ),
    ).toBeInTheDocument();
    expect((await preencherNomeECriar())?.pipelineId).toBe(ATIVO_2);
  });

  it("lista ok: nenhum aviso de pipelines — o positivo do caso acima", async () => {
    vi.mocked(listarPipelines).mockResolvedValue(ATIVOS);
    renderizar(ATIVO_2);

    await waitFor(() => expect(vi.mocked(listarPipelines)).toHaveBeenCalledTimes(1));
    await screen.findByText("Parcerias");
    expect(screen.queryByText(/Não foi possível ler os pipelines/)).toBeNull();
  });
});

describe("follow-up com ano pela metade", () => {
  it("🔴 trava o Criar e avisa; corrigido, cria com o follow-up", async () => {
    vi.mocked(listarPipelines).mockResolvedValue(ATIVOS);
    renderizar(ATIVO_1);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nome *"), "Padaria do Zé");
    await escolherCanal(user);
    const criar = screen.getByRole("button", { name: "Criar" });
    await waitFor(() => expect(criar).toBeEnabled());

    fireEvent.change(screen.getByLabelText("Próximo follow-up"), {
      target: { value: "0002-10-05" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Data inválida. Use um ano entre 2000 e 2100.",
    );
    expect(criar).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Próximo follow-up"), {
      target: { value: "2026-10-05" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(criar);
    await waitFor(() => expect(vi.mocked(criarOportunidade)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(criarOportunidade).mock.calls[0]?.[0]).toMatchObject({
      proximoFollowUp: "2026-10-05",
    });
  });
});

describe("campos personalizados e nicho na nova oportunidade", () => {
  const ID_TEM_SITE = "20000000-0000-4000-8000-000000000001";
  const ID_OBS = "20000000-0000-4000-8000-000000000002";
  const CAMPOS_DO_COMERCIAL: CampoDoPipeline[] = [
    {
      id: ID_TEM_SITE,
      pipelineId: ATIVO_1,
      nome: "Tem site?",
      tipo: "sim_nao",
      opcoes: null,
      obrigatorio: true,
      ordem: 0,
      ativo: true,
    },
    {
      id: ID_OBS,
      pipelineId: ATIVO_1,
      nome: "Observação do site",
      tipo: "texto",
      opcoes: null,
      obrigatorio: false,
      ordem: 1,
      ativo: true,
    },
  ];

  beforeEach(() => {
    vi.mocked(listarPipelines).mockResolvedValue(ATIVOS);
    vi.mocked(listarCampos).mockImplementation((pipelineId) =>
      Promise.resolve(pipelineId === ATIVO_1 ? CAMPOS_DO_COMERCIAL : []),
    );
  });

  it("🔴 obrigatório sem resposta trava o Criar com a frase; respondido, cria com `campos` e `nicho`", async () => {
    renderizar(ATIVO_1);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nome *"), "Padaria do Zé");
    await escolherCanal(user);
    await user.type(screen.getByLabelText("Nicho"), "  Padaria artesanal ");

    const criar = screen.getByRole("button", { name: "Criar" });
    expect(await screen.findByRole("alert")).toHaveTextContent("O campo Tem site? é obrigatório.");
    expect(criar).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Tem site? *" }));
    await user.click(await screen.findByRole("option", { name: "Sim" }));
    expect(screen.queryByRole("alert")).toBeNull();
    await waitFor(() => expect(criar).toBeEnabled());
    await user.click(criar);

    await waitFor(() => expect(vi.mocked(criarOportunidade)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(criarOportunidade).mock.calls[0]?.[0]).toMatchObject({
      pipelineId: ATIVO_1,
      nicho: "Padaria artesanal",
      campos: { [ID_TEM_SITE]: true },
    });
    expect(listarCampos).toHaveBeenCalledWith(ATIVO_1, false);
  });

  it("🔴 obrigatório de texto preenchido só com espaços NÃO passa o portão; com texto, viaja aparado", async () => {
    const ID_CIDADE = "20000000-0000-4000-8000-000000000003";
    vi.mocked(listarCampos).mockResolvedValue([
      {
        id: ID_CIDADE,
        pipelineId: ATIVO_1,
        nome: "Cidade",
        tipo: "texto",
        opcoes: null,
        obrigatorio: true,
        ordem: 0,
        ativo: true,
      },
    ]);
    renderizar(ATIVO_1);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nome *"), "Padaria do Zé");
    await escolherCanal(user);
    await user.type(await screen.findByLabelText("Cidade *"), "   ");

    const criar = screen.getByRole("button", { name: "Criar" });
    expect(screen.getByRole("alert")).toHaveTextContent("O campo Cidade é obrigatório.");
    expect(criar).toBeDisabled();

    await user.type(screen.getByLabelText("Cidade *"), "SP ");
    expect(screen.queryByRole("alert")).toBeNull();
    await waitFor(() => expect(criar).toBeEnabled());
    await user.click(criar);

    await waitFor(() => expect(vi.mocked(criarOportunidade)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(criarOportunidade).mock.calls[0]?.[0]).toMatchObject({
      campos: { [ID_CIDADE]: "SP" },
    });
  });

  it("nicho vazio vai como null, e sem campo no pipeline `campos` vai vazio", async () => {
    renderizar(ATIVO_2);

    expect(await preencherNomeECriar()).toMatchObject({ nicho: null, campos: {} });
  });

  it("🔴 trocar de pipeline DESCARTA os valores digitados — a chave de um pipeline é 'desconhecida' no outro", async () => {
    renderizar(ATIVO_1);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nome *"), "Padaria do Zé");
    await escolherCanal(user);
    await user.type(await screen.findByLabelText("Observação do site"), "Só Instagram");
    await user.click(screen.getByRole("combobox", { name: "Tem site? *" }));
    await user.click(await screen.findByRole("option", { name: "Sim" }));

    await user.click(screen.getByLabelText("Pipeline"));
    await user.click(await screen.findByRole("option", { name: "Parcerias" }));

    expect(screen.queryByLabelText("Observação do site")).toBeNull();
    const criar = screen.getByRole("button", { name: "Criar" });
    await waitFor(() => expect(criar).toBeEnabled());
    await user.click(criar);

    await waitFor(() => expect(vi.mocked(criarOportunidade)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(criarOportunidade).mock.calls[0]?.[0]).toMatchObject({
      pipelineId: ATIVO_2,
      campos: {},
    });
  });

  it("🔴 a lista de campos FALHOU: avisa, e o envio segue (o banco é a autoridade)", async () => {
    vi.mocked(listarCampos).mockRejectedValue(
      Object.assign(new Error("permission denied"), { code: "42501" }),
    );
    renderizar(ATIVO_1);

    expect(
      await screen.findByText(/Não foi possível ler os campos personalizados do pipeline/),
    ).toBeInTheDocument();
    expect(await preencherNomeECriar()).toMatchObject({ pipelineId: ATIVO_1 });
  });
});

describe("PIPE-3: falha ao vincular o ref depois de criar", () => {
  const REF = "ref:0f1e2d3c-4b5a-4f7e-8d9c-0a1b2c3d4e5f";

  async function criarComRef() {
    const aoFechar = vi.fn();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <NewOpportunityForm aberto pipelineIdPadrao={ATIVO_1} aoFechar={aoFechar} />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nome *"), "Padaria do Zé");
    await escolherCanal(user);
    await user.type(screen.getByPlaceholderText(/Cole a mensagem com o ref/), REF);
    expect(screen.getByText("Ref reconhecido.")).toBeInTheDocument();
    const criar = screen.getByRole("button", { name: "Criar" });
    await waitFor(() => expect(criar).toBeEnabled());
    await user.click(criar);
    await waitFor(() => expect(vi.mocked(criarOportunidade)).toHaveBeenCalledTimes(1));
    return { user, aoFechar, criar };
  }

  beforeEach(() => {
    vi.mocked(listarPipelines).mockResolvedValue(ATIVOS);
  });

  it("🔴 vincular cai: o formulário fecha e limpa, o aviso diz que CRIOU, e o clique seguinte não cria de novo", async () => {
    vi.mocked(vincularRef).mockRejectedValue({ message: "Failed to fetch", code: "" });
    const { user, aoFechar, criar } = await criarComRef();

    await waitFor(() => expect(aoFechar).toHaveBeenCalledTimes(1));
    expect(toast.warning).toHaveBeenCalledWith(
      "Oportunidade criada; o ref não vinculou. Cole na ficha.",
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();

    expect(screen.getByLabelText("Nome *")).toHaveValue("");
    expect(screen.getByPlaceholderText(/Cole a mensagem com o ref/)).toHaveValue("");
    await escolherCanal(user);
    expect(criar).toBeDisabled();
    await user.click(criar);
    expect(vi.mocked(criarOportunidade)).toHaveBeenCalledTimes(1);
  });

  it("o positivo ao lado: vincular resolve → sucesso com atribuição, fecha uma vez", async () => {
    vi.mocked(vincularRef).mockResolvedValue({ status: "nao_encontrado" });
    const { aoFechar } = await criarComRef();

    await waitFor(() => expect(aoFechar).toHaveBeenCalledTimes(1));
    expect(toast.warning).toHaveBeenCalledWith(
      "Oportunidade criada, mas o ref não foi encontrado.",
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("criar cai: nada fecha, o erro é o de criar, e o ref nem é tentado", async () => {
    vi.mocked(criarOportunidade).mockRejectedValue(
      new Error("Criar oportunidade é do owner, do manager e do SDR."),
    );
    const { aoFechar } = await criarComRef();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Criar oportunidade é do owner, do manager e do SDR.",
      ),
    );
    expect(aoFechar).not.toHaveBeenCalled();
    expect(vi.mocked(vincularRef)).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nome *")).toHaveValue("Padaria do Zé");
  });
});

describe("canal obrigatório (D-063)", () => {
  beforeEach(() => {
    vi.mocked(listarPipelines).mockResolvedValue(ATIVOS);
  });

  it("🔴 sem canal: Criar trava e a frase diz por quê; com canal, cria com ele", async () => {
    renderizar(ATIVO_1);
    const user = userEvent.setup();
    await screen.findByText("Comercial");
    await user.type(screen.getByLabelText("Nome *"), "Padaria do Zé");
    const criar = screen.getByRole("button", { name: "Criar" });

    expect(
      screen.getByText("Escolha o canal: ele define o prazo do primeiro contato"),
    ).toBeInTheDocument();
    expect(criar).toBeDisabled();

    await escolherCanal(user, "Tráfego pago");
    expect(screen.queryByText(/Escolha o canal/)).toBeNull();
    await waitFor(() => expect(criar).toBeEnabled());
    await user.click(criar);

    await waitFor(() => expect(vi.mocked(criarOportunidade)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(criarOportunidade).mock.calls[0]?.[0]).toMatchObject({ canal: "pago" });
  });

  it("🔴 depois de criar, o canal volta vazio: o lead seguinte não herda o canal do anterior", async () => {
    renderizar(ATIVO_1);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nome *"), "Padaria do Zé");
    await escolherCanal(user, "Tráfego pago");
    await user.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(vi.mocked(criarOportunidade)).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText("Nome *"), "Academia Corpo");

    expect(
      screen.getByText("Escolha o canal: ele define o prazo do primeiro contato"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar" })).toBeDisabled();
  });
});
