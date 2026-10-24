import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import type { PapelDoUsuario } from "@/hooks/use-profile";
import { listarScriptsDeWhatsApp } from "@/modules/scripts/api/scripts.repository";

import type { EventoDaOportunidade, OportunidadeListada } from "../api/pipeline.repository";
import { listarCampos, listarMotivos, listarPipelines } from "../api/pipelines.repository";
import type { CampoDoPipeline } from "../domain/campos";
import type { MotivoDeSaida } from "../domain/pipeline";
import { rotuloDoEstagio, significadoDoEstagio } from "../domain/stage";
import {
  apagarOportunidade,
  atualizarDadosDaOportunidade,
  atualizarDatasDeReuniao,
  atualizarNutricao,
  carregarCatalogo,
  corrigirMotivoDeSaida,
  corrigirTextoDoEvento,
  listarEventos,
  listarResponsaveis,
  moverParaEstagio,
  registrarToque,
  responderPergunta,
  vincularRef,
} from "../api/pipeline.repository";
import { OpportunityDrawer } from "./opportunity-drawer";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({
    to,
    search,
    children,
    className,
  }: {
    to: string;
    search?: { cliente?: string };
    children?: ReactNode;
    className?: string;
  }) => (
    <a href={search?.cliente ? `${to}?cliente=${search.cliente}` : to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, session: null, loading: false }),
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

vi.mock("../api/pipeline.repository", () => ({
  apagarOportunidade: vi.fn(),
  atualizarDadosDaOportunidade: vi.fn(),
  atualizarDatasDeReuniao: vi.fn(),
  atualizarNutricao: vi.fn(),
  carregarCatalogo: vi.fn(),
  corrigirMotivoDeSaida: vi.fn(),
  corrigirTextoDoEvento: vi.fn(),
  listarEventos: vi.fn(),
  listarResponsaveis: vi.fn(),
  lerPrimeiroContato: vi.fn(),
  lerTempoAtePrimeiroContato: vi.fn(),
  moverParaEstagio: vi.fn(),
  registrarToque: vi.fn(),
  responderPergunta: vi.fn(),
  vincularRef: vi.fn(),
}));

vi.mock("@/modules/scripts/api/scripts.repository", () => ({
  atualizarScript: vi.fn(),
  criarScript: vi.fn(),
  definirSituacaoDoScript: vi.fn(),
  listarMaisUsados: vi.fn(),
  listarNichos: vi.fn(),
  listarScripts: vi.fn(),
  listarScriptsDeWhatsApp: vi.fn(),
  registrarUso: vi.fn(),
}));

const propsDoBlocoDePropostas = vi.fn();
vi.mock("@/modules/proposals/ui/bloco-de-propostas", () => ({
  BlocoDePropostas: (props: unknown) => {
    propsDoBlocoDePropostas(props);
    return null;
  },
}));

const propsDoDesfazer = vi.fn();
vi.mock("@/modules/clients/ui/desfazer-fechamento", () => ({
  DesfazerFechamento: (props: unknown) => {
    propsDoDesfazer(props);
    return <button type="button">Desfazer fechamento</button>;
  },
}));

document.addEventListener(
  "click",
  (evento) => {
    if (evento.target instanceof Element && evento.target.closest("a") !== null) {
      evento.preventDefault();
    }
  },
  { capture: true },
);

const PIPELINE = "10000000-0000-4000-8000-000000000001";

const MOTIVOS: MotivoDeSaida[] = [
  { id: "m-preco", pipelineId: PIPELINE, tipo: "perda", rotulo: "Preço", ordem: 1, ativo: true },
  {
    id: "m-conc",
    pipelineId: PIPELINE,
    tipo: "perda",
    rotulo: "Escolheu concorrente",
    ordem: 2,
    ativo: true,
  },
  {
    id: "m-verba",
    pipelineId: PIPELINE,
    tipo: "descarte",
    rotulo: "Sem verba",
    ordem: 1,
    ativo: true,
  },
  {
    id: "m-nunca",
    pipelineId: PIPELINE,
    tipo: "descarte",
    rotulo: "Nunca respondeu",
    ordem: 2,
    ativo: true,
  },
  {
    id: "m-dado",
    pipelineId: PIPELINE,
    tipo: "descarte",
    rotulo: "Dado de contato inválido",
    ordem: 3,
    ativo: true,
  },
];

const OPORTUNIDADE: OportunidadeListada = {
  id: "oportunidade-1",
  nome: "Padaria do Zé",
  segmento: null,
  nicho: null,
  estagio: "qualificacao",
  pipelineId: PIPELINE,
  estagioId: "estagio-qualificacao",
  estagioNome: "Qualificação",
  estagioMudouEm: "2026-01-01T00:00:00Z",
  responsavelId: null,
  responsavelNome: null,
  contatoNome: null,
  contatoEmail: null,
  contatoTelefone: "5511999999990",
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

const RESPONSAVEIS = [
  { id: "user-1", nome: "Fulano", ativo: true },
  { id: "user-2", nome: "Beltrano", ativo: true },
];

function renderDrawer(
  aoFechar: () => void,
  oportunidade: OportunidadeListada | null = OPORTUNIDADE,
  podeEditar = true,
  papel: PapelDoUsuario | null = null,
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <OpportunityDrawer
        oportunidade={oportunidade}
        aoFechar={aoFechar}
        podeEditar={podeEditar}
        papel={papel}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarScriptsDeWhatsApp).mockResolvedValue([]);
  vi.mocked(apagarOportunidade).mockResolvedValue(undefined);
  vi.mocked(atualizarDadosDaOportunidade).mockResolvedValue(undefined);
  vi.mocked(atualizarDatasDeReuniao).mockResolvedValue(undefined);
  vi.mocked(atualizarNutricao).mockResolvedValue(undefined);
  vi.mocked(corrigirMotivoDeSaida).mockResolvedValue(undefined);
  vi.mocked(moverParaEstagio).mockResolvedValue(undefined);
  vi.mocked(registrarToque).mockResolvedValue(undefined);
  vi.mocked(corrigirTextoDoEvento).mockResolvedValue(undefined);
  vi.mocked(carregarCatalogo).mockResolvedValue({ version: 1, questions: [] });
  vi.mocked(listarEventos).mockResolvedValue([]);
  vi.mocked(listarCampos).mockResolvedValue([]);
  vi.mocked(listarMotivos).mockResolvedValue(MOTIVOS);
  vi.mocked(listarPipelines).mockResolvedValue([
    { id: PIPELINE, nome: "Comercial", ordem: 1, ativo: true },
  ]);
  vi.mocked(listarResponsaveis).mockResolvedValue(RESPONSAVEIS);
  vi.mocked(responderPergunta).mockResolvedValue(undefined);
  vi.mocked(vincularRef).mockResolvedValue({ status: "nao_encontrado" });
});

describe("pipeline e estágio nomeado na ficha (pipelines editáveis, 2026-09-20)", () => {
  it("badge do título = NOME do estágio (tipo no title); descrição só com o pipeline", async () => {
    renderDrawer(vi.fn(), { ...OPORTUNIDADE, estagio: "r1", estagioNome: "Briefing" });

    expect(await screen.findByText("Pipeline: Comercial")).toBeInTheDocument();
    const badge = screen.getByText("Briefing");
    expect(badge).toHaveAttribute("title", significadoDoEstagio("r1"));
    expect(screen.queryByText(rotuloDoEstagio("r1"))).toBeNull();
    expect(screen.queryByText(/Estágio:/)).toBeNull();
  });

  it("🔴 a lista de pipelines FALHOU: a descrição diz que não leu, não fica em '…' para sempre", async () => {
    vi.mocked(listarPipelines).mockRejectedValue(
      Object.assign(new Error("permission denied"), { code: "42501" }),
    );
    renderDrawer(vi.fn());

    expect(await screen.findByText("Pipeline: não foi possível ler")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline: …")).toBeNull();
  });

  it("stage_change na timeline usa o `content` do gatilho (nomes do pipeline) e cai nos rótulos do tipo sem ele", async () => {
    vi.mocked(listarEventos).mockResolvedValue([
      {
        id: "e-1",
        tipo: "stage_change",
        deEstagio: "prospeccao",
        paraEstagio: "r1",
        conteudo: "Contato → Diagnóstico inicial",
        autorId: null,
        autorNome: null,
        editadoEm: null,
        editadoPorNome: null,
        conteudoOriginal: null,
        correcoes: [],
        criadoEm: "2026-09-20T12:00:00Z",
      },
      {
        id: "e-2",
        tipo: "stage_change",
        deEstagio: "prospeccao",
        paraEstagio: "r1",
        conteudo: null,
        autorId: null,
        autorNome: null,
        editadoEm: null,
        editadoPorNome: null,
        conteudoOriginal: null,
        correcoes: [],
        criadoEm: "2026-09-19T12:00:00Z",
      },
    ]);
    renderDrawer(vi.fn());

    expect(await screen.findByText("Contato → Diagnóstico inicial")).toBeInTheDocument();
    expect(screen.getByText("Prospecção → R1 · Diagnóstico")).toBeInTheDocument();
  });
});

describe("edita os dados de identificação da oportunidade", () => {
  it("corrige o telefone do contato", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    const campo = screen.getByLabelText("Telefone");
    await user.clear(campo);
    await user.type(campo, "5511999999999");
    await user.tab();

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        contatoTelefone: "5511999999999",
      }),
    );
  });

  it("🔴 Esc salva a edição em curso, mesmo sem sair do campo", async () => {
    const aoFechar = vi.fn();
    renderDrawer(aoFechar);

    const input = screen.getByLabelText("Telefone");
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "5511999999999" } });

    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        contatoTelefone: "5511999999999",
      }),
    );
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("🔴 sair do campo sem mudar nada não dispara mutação", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    await user.click(screen.getByLabelText("Nome"));
    await user.tab();

    expect(atualizarDadosDaOportunidade).not.toHaveBeenCalled();
  });

  it("🔴 quem não pode editar vê os valores e nenhum campo do bloco Dados fica habilitado", () => {
    renderDrawer(vi.fn(), OPORTUNIDADE, false);

    expect(screen.getByDisplayValue("5511999999990")).toBeInTheDocument();
    expect(screen.getByLabelText("Telefone")).toBeDisabled();
    expect(screen.getByLabelText("Nome")).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: /Responsável/i })).toBeNull();
    expect(screen.getByText("Sem responsável")).toBeInTheDocument();
  });

  it("🔴 abrir a ficha NÃO foca nem seleciona o texto do campo Nome", () => {
    renderDrawer(vi.fn());

    const campoNome = screen.getByLabelText("Nome") as HTMLInputElement;
    expect(document.activeElement).not.toBe(campoNome);
    expect(campoNome.selectionStart).toBe(campoNome.selectionEnd);
  });

  it("troca o responsável pelo Select", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    await user.click(screen.getByRole("combobox", { name: /Responsável/i }));
    await user.click(screen.getByRole("option", { name: "Beltrano" }));

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        responsavelId: "user-2",
      }),
    );
  });

  it("🔴 'Sem responsável' grava null, não a string do sentinela", async () => {
    const user = userEvent.setup();
    const COM_RESPONSAVEL: OportunidadeListada = { ...OPORTUNIDADE, responsavelId: "user-1" };
    renderDrawer(vi.fn(), COM_RESPONSAVEL);

    await user.click(screen.getByRole("combobox", { name: /Responsável/i }));
    await user.click(screen.getByRole("option", { name: "Sem responsável" }));

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        responsavelId: null,
      }),
    );
  });

  it("o responsável desativado aparece marcado, em vez de o campo abrir em branco", async () => {
    const user = userEvent.setup();
    vi.mocked(listarResponsaveis).mockResolvedValue([
      { id: "user-1", nome: "Fulano", ativo: false },
      { id: "user-2", nome: "Beltrano", ativo: true },
    ]);
    renderDrawer(vi.fn(), {
      ...OPORTUNIDADE,
      responsavelId: "user-1",
      responsavelNome: "Fulano",
    });

    await waitFor(() => expect(listarResponsaveis).toHaveBeenCalledWith("user-1"));

    const gatilho = screen.getByRole("combobox", { name: /Responsável/i });
    await waitFor(() => expect(gatilho).toHaveTextContent("Fulano (desativada)"));

    await user.click(gatilho);
    expect(screen.getByRole("option", { name: "Fulano (desativada)" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    const ativo = screen.getByRole("option", { name: "Beltrano" });
    expect(ativo).not.toHaveAttribute("aria-disabled", "true");
  });

  it("🔴 o campo mostra o responsável gravado enquanto a lista ainda carrega", async () => {
    vi.mocked(listarResponsaveis).mockReturnValue(new Promise<never>(() => {}));
    renderDrawer(vi.fn(), {
      ...OPORTUNIDADE,
      responsavelId: "user-1",
      responsavelNome: "Fulano",
    });

    const gatilho = await screen.findByRole("combobox", { name: /Responsável/i });
    expect(gatilho).toHaveTextContent("Fulano");
    expect(gatilho).toBeDisabled();
  });

  it("duas oportunidades não compartilham a lista: cada uma consulta com o seu responsável", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const A: OportunidadeListada = { ...OPORTUNIDADE, responsavelId: "user-1" };
    const B: OportunidadeListada = {
      ...OPORTUNIDADE,
      id: "oportunidade-2",
      responsavelId: "user-2",
    };

    const tela = render(
      <QueryClientProvider client={qc}>
        <OpportunityDrawer oportunidade={A} aoFechar={vi.fn()} podeEditar />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(listarResponsaveis).toHaveBeenCalledWith("user-1"));

    tela.rerender(
      <QueryClientProvider client={qc}>
        <OpportunityDrawer oportunidade={B} aoFechar={vi.fn()} podeEditar />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(listarResponsaveis).toHaveBeenCalledWith("user-2"));
  });

  it("a lista de responsáveis falhando trava o Select, em vez de oferecer escolha sobre lista incompleta", async () => {
    vi.mocked(listarResponsaveis).mockRejectedValue(new Error("falhou"));
    renderDrawer(vi.fn());

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Responsável/i })).toBeDisabled(),
    );
  });

  it("grava o próximo follow-up pelo campo de data", async () => {
    renderDrawer(vi.fn());
    const campo = screen.getByLabelText("Próximo follow-up");

    fireEvent.change(campo, { target: { value: "2026-10-05" } });
    fireEvent.blur(campo);

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        proximoFollowup: "2026-10-05",
      }),
    );
  });

  it("🔴 ano pela metade não grava: avisa e não chama o repositório", () => {
    renderDrawer(vi.fn());
    const campo = screen.getByLabelText("Próximo follow-up");

    fireEvent.change(campo, { target: { value: "0002-10-05" } });
    fireEvent.blur(campo);

    expect(atualizarDadosDaOportunidade).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Data inválida. Use um ano entre 2000 e 2100.");
  });

  it("aviso de falha nomeia o campo — mesma forma de client-drawer.tsx", async () => {
    vi.mocked(atualizarDadosDaOportunidade).mockRejectedValue(
      new Error("Editar os dados da oportunidade é do owner e do manager."),
    );
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    const campo = screen.getByLabelText("Segmento");
    await user.type(campo, "Alimentação");
    await user.tab();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Editar os dados da oportunidade é do owner e do manager.",
      ),
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("🔴 closed_mrr, closed_tcv e estágio continuam só leitura — não viram CampoEditavel nem Select", () => {
    const FECHADA: OportunidadeListada = { ...OPORTUNIDADE, fechadoMrr: 1000, fechadoTcv: 30000 };
    renderDrawer(vi.fn(), FECHADA);

    expect(screen.getByText(/R\$ 1\.000,00\/mês/)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 30\.000,00/)).toBeInTheDocument();

    expect(screen.queryByDisplayValue(/1\.000,00/)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/30\.000,00/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /est[aá]gio/i })).not.toBeInTheDocument();
  });
});

describe("A1.1: valor estimado, origem, indicação, observações e frentes", () => {
  const ILEGIVEL =
    "Valor estimado não reconhecido. Use vírgula ou ponto para os centavos: 1.500,00 ou 1500.";
  const tique = () => new Promise((resolver) => setTimeout(resolver, 0));

  it("origem e indicado por gravam ao sair do campo", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    await user.type(screen.getByLabelText("Origem do lead"), "Feira");
    await user.tab();
    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        origem: "Feira",
      }),
    );

    await user.type(screen.getByLabelText("Indicado por"), "Carla");
    await user.tab();
    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        indicadoPor: "Carla",
      }),
    );
  });

  it.each([
    ["1.500,00", 1500],
    ["1500", 1500],
    ["1500,5", 1500.5],
  ])("valor estimado %s grava %s", async (digitado, esperado) => {
    renderDrawer(vi.fn());
    const campo = screen.getByLabelText("Valor estimado (R$)");

    fireEvent.change(campo, { target: { value: digitado } });
    fireEvent.blur(campo);

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        valorEstimado: esperado,
      }),
    );
    await tique();
    expect(campo).toHaveValue(digitado);
  });

  it.each(["R$ 5.000", "abc", "1,2,3"])(
    "valor estimado ilegível %s não grava, avisa e volta ao valor de antes",
    async (digitado) => {
      renderDrawer(vi.fn());
      const campo = screen.getByLabelText("Valor estimado (R$)");

      fireEvent.change(campo, { target: { value: digitado } });
      fireEvent.blur(campo);
      await tique();

      expect(atualizarDadosDaOportunidade).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(ILEGIVEL);
      expect(campo).toHaveValue("");
    },
  );

  it("valor estimado ilegível com valor gravado volta ao gravado, não ao vazio", async () => {
    renderDrawer(vi.fn(), { ...OPORTUNIDADE, valorEstimado: 5000 });
    const campo = screen.getByLabelText("Valor estimado (R$)");

    fireEvent.change(campo, { target: { value: "abc" } });
    fireEvent.blur(campo);
    await tique();

    expect(atualizarDadosDaOportunidade).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(ILEGIVEL);
    expect(campo).toHaveValue("5000");
    expect(
      screen.getByText(/R\$ 5\.000,00\. Estimativa: não entra no MRR nem no TCV\./),
    ).toBeInTheDocument();
  });

  it.each([
    ["99999999999", 99999999999],
    ["", null],
  ])(
    "recusa do servidor ao gravar %j devolve o campo ao valor gravado e avisa uma vez",
    async (digitado, enviado) => {
      vi.mocked(atualizarDadosDaOportunidade).mockRejectedValue(
        new Error("Editar os dados da oportunidade é do owner e do manager."),
      );
      renderDrawer(vi.fn(), { ...OPORTUNIDADE, valorEstimado: 5000 });
      const campo = screen.getByLabelText("Valor estimado (R$)");

      fireEvent.change(campo, { target: { value: digitado } });
      fireEvent.blur(campo);

      await waitFor(() =>
        expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
          valorEstimado: enviado,
        }),
      );
      await waitFor(() => expect(campo).toHaveValue("5000"));
      expect(toast.error).toHaveBeenCalledTimes(1);
    },
  );

  it("apagar o valor quando o campo já está vazio não grava nem avisa", async () => {
    renderDrawer(vi.fn());
    const campo = screen.getByLabelText("Valor estimado (R$)");

    fireEvent.change(campo, { target: { value: "   " } });
    fireEvent.blur(campo);
    await tique();

    expect(atualizarDadosDaOportunidade).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("valor estimado igual não grava; apagado grava null; o eco diz que é estimativa", async () => {
    renderDrawer(vi.fn(), { ...OPORTUNIDADE, valorEstimado: 5000 });
    const campo = screen.getByLabelText("Valor estimado (R$)");

    expect(campo).toHaveValue("5000");
    expect(
      screen.getByText(/R\$ 5\.000,00\. Estimativa: não entra no MRR nem no TCV\./),
    ).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: "5.000,00" } });
    fireEvent.blur(campo);
    await tique();
    expect(atualizarDadosDaOportunidade).not.toHaveBeenCalled();

    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.blur(campo);
    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        valorEstimado: null,
      }),
    );
  });

  it("marcar uma frente grava a lista inteira, na ordem das frentes", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), { ...OPORTUNIDADE, frentesEsperadas: ["comercial"] });

    const trafego = screen.getByRole("checkbox", { name: "Frente esperada: Tráfego" });
    await user.click(trafego);

    expect(trafego).toBeChecked();
    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        frentesEsperadas: ["trafego", "comercial"],
      }),
    );
  });

  it("desmarcar a única frente grava lista vazia", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), { ...OPORTUNIDADE, frentesEsperadas: ["trafego"] });

    await user.click(screen.getByRole("checkbox", { name: "Frente esperada: Tráfego" }));

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        frentesEsperadas: [],
      }),
    );
  });

  it("recusa do banco volta a caixa e avisa uma vez", async () => {
    vi.mocked(atualizarDadosDaOportunidade).mockRejectedValue(
      new Error("Editar os dados da oportunidade é do owner e do manager."),
    );
    const user = userEvent.setup();
    renderDrawer(vi.fn(), { ...OPORTUNIDADE, frentesEsperadas: ["comercial"] });

    const trafego = screen.getByRole("checkbox", { name: "Frente esperada: Tráfego" });
    await user.click(trafego);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Editar os dados da oportunidade é do owner e do manager.",
      ),
    );
    await waitFor(() => expect(trafego).not.toBeChecked());
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("o servidor muda as frentes (refetch, outra pessoa): as caixas acompanham", () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const tela = (oportunidade: OportunidadeListada) => (
      <QueryClientProvider client={qc}>
        <OpportunityDrawer oportunidade={oportunidade} aoFechar={vi.fn()} podeEditar />
      </QueryClientProvider>
    );
    const caixa = (frente: string) =>
      screen.getByRole("checkbox", { name: `Frente esperada: ${frente}` });
    const { rerender } = render(tela({ ...OPORTUNIDADE, frentesEsperadas: ["comercial"] }));

    expect(caixa("Comercial")).toBeChecked();
    expect(caixa("Tráfego")).not.toBeChecked();

    rerender(tela({ ...OPORTUNIDADE, frentesEsperadas: ["trafego", "sistemas"] }));

    expect(caixa("Comercial")).not.toBeChecked();
    expect(caixa("Tráfego")).toBeChecked();
    expect(caixa("Sistemas")).toBeChecked();
  });

  it("observações têm teto de 5000 caracteres", () => {
    renderDrawer(vi.fn());

    expect(screen.getByLabelText("Observações")).toHaveAttribute("maxlength", "5000");
  });

  it("observações: sair sem mudar não grava; mudar grava", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), { ...OPORTUNIDADE, observacoes: "Cliente prefere WhatsApp" });
    const campo = screen.getByLabelText("Observações");

    expect(campo).toHaveValue("Cliente prefere WhatsApp");
    await user.click(campo);
    await user.tab();
    await tique();
    expect(atualizarDadosDaOportunidade).not.toHaveBeenCalled();

    fireEvent.change(campo, { target: { value: "Ligar depois das 14h, pelo WhatsApp" } });
    fireEvent.blur(campo);
    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        observacoes: "Ligar depois das 14h, pelo WhatsApp",
      }),
    );
  });

  it("member (sem podeEditar) vê os valores e nenhum controle novo", () => {
    renderDrawer(
      vi.fn(),
      {
        ...OPORTUNIDADE,
        origem: "Feira",
        valorEstimado: 5000,
        frentesEsperadas: ["trafego", "sistemas"],
        observacoes: "Ligar depois das 14h",
      },
      false,
    );

    expect(screen.getByLabelText("Origem do lead")).toBeDisabled();
    expect(screen.getByLabelText("Origem do lead")).toHaveValue("Feira");
    expect(screen.getByLabelText("Indicado por")).toBeDisabled();
    expect(screen.getByLabelText("Observações")).toBeDisabled();
    expect(screen.queryByLabelText("Valor estimado (R$)")).not.toBeInTheDocument();
    expect(screen.getByText(/R\$ 5\.000,00/)).toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox", { name: /Frente esperada/ })).toHaveLength(0);
    expect(screen.getByText("Tráfego, Sistemas")).toBeInTheDocument();
  });
});

describe("corrige o canal e a linha de negócio", () => {
  it("troca o canal pelo Select, com o rótulo da casa", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    await user.click(screen.getByRole("combobox", { name: "Canal" }));
    await user.click(await screen.findByRole("option", { name: "Tráfego pago" }));

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        canal: "pago",
      }),
    );
  });

  it("🔴 'Sem canal' grava null — canal marcado por engano tem volta", async () => {
    const user = userEvent.setup();
    const COM_CANAL: OportunidadeListada = { ...OPORTUNIDADE, canal: "pago" };
    renderDrawer(vi.fn(), COM_CANAL);

    await user.click(screen.getByRole("combobox", { name: "Canal" }));
    await user.click(await screen.findByRole("option", { name: "Sem canal" }));

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", { canal: null }),
    );
  });

  it("🔴 'Sem linha de negócio' grava null — o gêmeo de 'Sem canal', que não tinha teste", async () => {
    const user = userEvent.setup();
    const COM_BU: OportunidadeListada = { ...OPORTUNIDADE, linhaDeNegocio: "sistemas" };
    renderDrawer(vi.fn(), COM_BU);

    await user.click(screen.getByRole("combobox", { name: "Linha de negócio" }));
    await user.click(await screen.findByRole("option", { name: "Sem linha de negócio" }));

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        linhaDeNegocio: null,
      }),
    );
  });

  it("🔴 a lista de linha de negócio NÃO oferece 'compartilhado' — a coluna recusa", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    await user.click(screen.getByRole("combobox", { name: /Linha de neg/i }));
    const opcoes = (await screen.findAllByRole("option")).map((opcao) => opcao.textContent);

    expect(opcoes).toEqual(["Sem linha de negócio", "Demanda", "Sistemas"]);
  });

  it("troca a linha de negócio", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    await user.click(screen.getByRole("combobox", { name: /Linha de neg/i }));
    await user.click(await screen.findByRole("option", { name: "Sistemas" }));

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        linhaDeNegocio: "sistemas",
      }),
    );
  });

  it("🔴 quem não pode editar lê o RÓTULO do canal, não a chave do enum", () => {
    const COM_CANAL: OportunidadeListada = { ...OPORTUNIDADE, canal: "indicacao" };
    renderDrawer(vi.fn(), COM_CANAL, false);

    expect(screen.getByText("Indicação")).toBeInTheDocument();
    expect(screen.queryByText("indicacao")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Canal" })).toBeNull();
  });
});

const PERDIDA: OportunidadeListada = {
  ...OPORTUNIDADE,
  estagio: "perdido",
  estagioId: "estagio-perdido",
  estagioNome: "Perdido",
  motivoId: "m-preco",
  motivoRotulo: "Preço",
  motivoObs: null,
};

describe("corrige o motivo de saída", () => {
  it("🔴 corrigir o motivo NÃO passa por moverParaEstagio", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), PERDIDA);

    await user.click(screen.getByRole("combobox", { name: "Motivo" }));
    await user.click(await screen.findByRole("option", { name: "Escolheu concorrente" }));

    await waitFor(() =>
      expect(corrigirMotivoDeSaida).toHaveBeenCalledWith("oportunidade-1", "estagio-perdido", {
        motivoId: "m-conc",
      }),
    );
    expect(moverParaEstagio).not.toHaveBeenCalled();
  });

  it("🔴 a lista de uma PERDIDA não oferece motivo de descarte", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), PERDIDA);

    await user.click(screen.getByRole("combobox", { name: "Motivo" }));
    const opcoes = (await screen.findAllByRole("option")).map((opcao) => opcao.textContent);

    expect(opcoes).toContain("Preço");
    expect(opcoes).toContain("Escolheu concorrente");
    expect(opcoes).not.toContain("Nunca respondeu");
    expect(opcoes).not.toContain("Sem verba");
  });

  it("a observação vai SOZINHA — o motivo não é reafirmado", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), PERDIDA);

    const campo = screen.getByLabelText("Observação do motivo");
    await user.type(campo, "  achou caro  ");
    await user.tab();

    await waitFor(() =>
      expect(corrigirMotivoDeSaida).toHaveBeenCalledWith("oportunidade-1", "estagio-perdido", {
        obs: "achou caro",
      }),
    );
  });

  it("🔴 digitar a observação E trocar o motivo: cada write leva só o seu campo", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), PERDIDA);

    await user.type(screen.getByLabelText("Observação do motivo"), "achou caro");
    await user.tab();
    await waitFor(() =>
      expect(corrigirMotivoDeSaida).toHaveBeenCalledWith("oportunidade-1", "estagio-perdido", {
        obs: "achou caro",
      }),
    );

    await user.click(screen.getByRole("combobox", { name: "Motivo" }));
    await user.click(await screen.findByRole("option", { name: "Escolheu concorrente" }));

    await waitFor(() =>
      expect(corrigirMotivoDeSaida).toHaveBeenLastCalledWith("oportunidade-1", "estagio-perdido", {
        motivoId: "m-conc",
      }),
    );
    const segundo = vi.mocked(corrigirMotivoDeSaida).mock.calls.at(-1);
    expect(segundo?.[2]).not.toHaveProperty("obs");
  });

  it("🔴 oportunidade fora de perdido/descartado não mostra motivo nenhum", () => {
    renderDrawer(vi.fn(), OPORTUNIDADE);

    expect(screen.queryByRole("combobox", { name: "Motivo" })).toBeNull();
    expect(screen.queryByLabelText("Observação do motivo")).toBeNull();
  });

  it("quem não pode editar lê o rótulo do motivo, sem controle nenhum", () => {
    renderDrawer(vi.fn(), { ...PERDIDA, motivoObs: "achou caro" }, false);

    expect(screen.getByText("Preço")).toBeInTheDocument();
    expect(screen.getByText("achou caro")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Motivo" })).toBeNull();
  });

  it("🔴 motivo inativo já gravado aparece como atual, mas não é oferecido como escolha", async () => {
    const user = userEvent.setup();
    const todos: MotivoDeSaida[] = [
      ...MOTIVOS,
      {
        id: "m-antigo",
        pipelineId: PIPELINE,
        tipo: "perda",
        rotulo: "Motivo antigo",
        ordem: 9,
        ativo: false,
      },
      {
        id: "m-outro",
        pipelineId: PIPELINE,
        tipo: "perda",
        rotulo: "Outro inativo",
        ordem: 10,
        ativo: false,
      },
    ];
    vi.mocked(listarMotivos).mockImplementation((_pipelineId, incluirInativos = false) =>
      Promise.resolve(incluirInativos ? todos : todos.filter((m) => m.ativo)),
    );
    renderDrawer(vi.fn(), { ...PERDIDA, motivoId: "m-antigo", motivoRotulo: "Motivo antigo" });

    const combobox = await screen.findByRole("combobox", { name: "Motivo" });
    await waitFor(() => expect(combobox).toHaveTextContent("Motivo antigo"));

    await user.click(combobox);
    const opcoes = (await screen.findAllByRole("option")).map((opcao) => opcao.textContent);
    expect(opcoes).toContain("Preço");
    expect(opcoes).toContain("Escolheu concorrente");
    expect(opcoes).toContain("Motivo antigo");
    expect(opcoes).not.toContain("Outro inativo");
  });

  it("descartada mostra o vocabulário de DESCARTE, e grava com o tipo certo", async () => {
    const user = userEvent.setup();
    const DESCARTADA: OportunidadeListada = {
      ...OPORTUNIDADE,
      estagio: "descartado",
      estagioId: "estagio-descartado",
      estagioNome: "Descartado",
      motivoId: "m-nunca",
      motivoRotulo: "Nunca respondeu",
    };
    renderDrawer(vi.fn(), DESCARTADA);

    await user.click(screen.getByRole("combobox", { name: "Motivo" }));
    await user.click(await screen.findByRole("option", { name: "Dado de contato inválido" }));

    await waitFor(() =>
      expect(corrigirMotivoDeSaida).toHaveBeenCalledWith("oportunidade-1", "estagio-descartado", {
        motivoId: "m-dado",
      }),
    );
  });
});

describe("campos personalizados na ficha", () => {
  const ID_TEM_SITE = "20000000-0000-4000-8000-000000000001";
  const ID_NICHO = "20000000-0000-4000-8000-000000000002";
  const ID_ANTIGO = "20000000-0000-4000-8000-000000000003";
  const CAMPOS: CampoDoPipeline[] = [
    {
      id: ID_TEM_SITE,
      pipelineId: PIPELINE,
      nome: "Tem site?",
      tipo: "sim_nao",
      opcoes: null,
      obrigatorio: true,
      ordem: 0,
      ativo: true,
    },
    {
      id: ID_NICHO,
      pipelineId: PIPELINE,
      nome: "Nicho de atuação",
      tipo: "lista",
      opcoes: ["Clínica", "Varejo", "Serviços"],
      obrigatorio: false,
      ordem: 1,
      ativo: true,
    },
    {
      id: ID_ANTIGO,
      pipelineId: PIPELINE,
      nome: "Campo antigo",
      tipo: "texto",
      opcoes: null,
      obrigatorio: false,
      ordem: 2,
      ativo: false,
    },
  ];

  it("o bloco aparece com os campos do pipeline, lidos COM inativos, e o valor gravado marcado", async () => {
    vi.mocked(listarCampos).mockResolvedValue(CAMPOS);
    renderDrawer(vi.fn(), { ...OPORTUNIDADE, campos: { [ID_TEM_SITE]: true } });

    expect(await screen.findByRole("switch", { name: "Tem site?" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Nicho de atuação" })).toBeInTheDocument();
    expect(listarCampos).toHaveBeenCalledWith(PIPELINE, true);
  });

  it("🔴 escolher o nicho grava o objeto MESCLADO com o 'Tem site?' já gravado", async () => {
    const user = userEvent.setup();
    vi.mocked(listarCampos).mockResolvedValue(CAMPOS);
    renderDrawer(vi.fn(), { ...OPORTUNIDADE, campos: { [ID_TEM_SITE]: true } });

    await user.click(await screen.findByRole("combobox", { name: "Nicho de atuação" }));
    await user.click(await screen.findByRole("option", { name: "Varejo" }));

    await waitFor(() =>
      expect(atualizarDadosDaOportunidade).toHaveBeenCalledWith("oportunidade-1", {
        campos: { [ID_TEM_SITE]: true, [ID_NICHO]: "Varejo" },
      }),
    );
  });

  it("🔴 campo desativado com valor: só leitura, rotulado; sem valor, some", async () => {
    vi.mocked(listarCampos).mockResolvedValue(CAMPOS);
    renderDrawer(vi.fn(), { ...OPORTUNIDADE, campos: { [ID_ANTIGO]: "valor antigo" } });

    expect(await screen.findByText(/Campo antigo/)).toHaveTextContent("campo desativado");
    expect(screen.getByText("valor antigo")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Campo antigo/)).toBeNull();
  });

  it("recusa do banco (23514 com a frase) vira toast — o drawer não engole — E a escolha recusada sai da tela", async () => {
    const user = userEvent.setup();
    vi.mocked(listarCampos).mockResolvedValue(CAMPOS);
    vi.mocked(atualizarDadosDaOportunidade).mockRejectedValue(
      new Error("O campo Nicho de atuação só aceita: Clínica, Varejo, Serviços."),
    );
    renderDrawer(vi.fn());

    await user.click(await screen.findByRole("combobox", { name: "Nicho de atuação" }));
    await user.click(await screen.findByRole("option", { name: "Varejo" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "O campo Nicho de atuação só aceita: Clínica, Varejo, Serviços.",
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Nicho de atuação" })).toHaveTextContent(
        "Sem valor",
      ),
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("🔴 a lista de campos FALHOU: diz que não leu, em vez de fingir que o pipeline não tem campo", async () => {
    vi.mocked(listarCampos).mockRejectedValue(
      Object.assign(new Error("permission denied"), { code: "42501" }),
    );
    renderDrawer(vi.fn());

    expect(
      await screen.findByText(/Não foi possível ler os campos do pipeline/),
    ).toBeInTheDocument();
  });

  it("pipeline sem campo e oportunidade sem valor: nenhum bloco", async () => {
    renderDrawer(vi.fn());

    await screen.findByText("Pipeline: Comercial");
    await waitFor(() => expect(listarCampos).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Campos do pipeline")).toBeNull();
  });
});

describe("vincular ref: o resultado chega mesmo com a ficha fechada (item 4 da fix wave)", () => {
  const REF = "ref:0123456789abcdef0123456789abcdef";

  async function colarEVincular(tela: ReturnType<typeof renderDrawer>) {
    const user = userEvent.setup();
    const caixa = await screen.findByPlaceholderText(/Cole aqui a mensagem com o ref/);
    await user.type(caixa, REF);
    await user.click(screen.getByRole("button", { name: "Vincular" }));
    await waitFor(() => expect(vincularRef).toHaveBeenCalledTimes(1));
    return tela;
  }

  it("🔴 ja_vinculado com a ficha fechada antes da resposta → um toast com a frase", async () => {
    let resolver: ((r: { status: "ja_vinculado" }) => void) | undefined;
    vi.mocked(vincularRef).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );
    const tela = await colarEVincular(renderDrawer(vi.fn()));
    tela.unmount();
    expect(resolver).toBeDefined();
    resolver?.({ status: "ja_vinculado" });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Este ref já pertence a outra oportunidade: um toque só conta uma conversão.",
      ),
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("recusa do banco (objeto cru, sem Error) com a ficha fechada → fallback da tela", async () => {
    let rejeitar: ((e: unknown) => void) | undefined;
    vi.mocked(vincularRef).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejeitar = reject;
        }),
    );
    const tela = await colarEVincular(renderDrawer(vi.fn()));
    tela.unmount();
    rejeitar?.({ message: "Failed to fetch", code: "" });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível vincular."));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("vinculado com a ficha aberta: toast de sucesso e a caixa esvazia", async () => {
    vi.mocked(vincularRef).mockResolvedValueOnce({
      status: "vinculado",
      toque: {
        attributionId: "0123456789abcdef0123456789abcdef",
        utmSource: "meta",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
        landingUrl: null,
        criadoEm: "2026-09-01T00:00:00Z",
      },
    });
    await colarEVincular(renderDrawer(vi.fn()));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Atribuição vinculada."));
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/Cole aqui a mensagem com o ref/)).toHaveValue("");
  });
});

describe("botão de WhatsApp na ficha (D-059)", () => {
  it("🔴 critério 10: quem só lê a ficha (member) vê e usa o botão", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), OPORTUNIDADE, false);

    const botao = screen.getByRole("button", { name: "WhatsApp" });
    expect(botao).toBeEnabled();
    expect(screen.getByLabelText("Telefone")).toBeDisabled();

    await user.click(botao);
    await user.click(await screen.findByRole("link", { name: "Sem script" }));
    await user.click(screen.getByRole("button", { name: "Registrar toque" }));

    await waitFor(() =>
      expect(registrarToque).toHaveBeenCalledWith(
        "oportunidade-1",
        "whatsapp",
        "WhatsApp · sem script",
      ),
    );
  });

  it("critério 13: o toque de WhatsApp aparece na timeline com o verbo próprio", async () => {
    vi.mocked(listarEventos).mockResolvedValue([
      {
        id: "e-wpp",
        tipo: "whatsapp",
        deEstagio: null,
        paraEstagio: null,
        conteudo: "WhatsApp · Abertura genérica",
        autorId: null,
        autorNome: "Fulano",
        editadoEm: null,
        editadoPorNome: null,
        conteudoOriginal: null,
        correcoes: [],
        criadoEm: "2026-09-30T12:00:00Z",
      },
    ]);
    renderDrawer(vi.fn());

    expect(await screen.findByText("WhatsApp · Abertura genérica")).toBeInTheDocument();
    expect(screen.getByText(/Fulano mandou WhatsApp/)).toBeInTheDocument();
  });

  it("🔴 critério 13: o registro manual da timeline oferece WhatsApp e grava o tipo", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    await user.click(screen.getByRole("combobox", { name: "Tipo do registro" }));
    await user.click(screen.getByRole("option", { name: "WhatsApp" }));
    await user.type(screen.getByLabelText("Descrição do registro"), "Mandei pelo celular");
    await user.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() =>
      expect(registrarToque).toHaveBeenCalledWith(
        "oportunidade-1",
        "whatsapp",
        "Mandei pelo celular",
      ),
    );
  });
});

describe("qualificação: o clique local vale até o servidor responder", () => {
  it("🔴 respostas novas vindas do servidor substituem a sobreposição local", async () => {
    vi.mocked(carregarCatalogo).mockResolvedValue({
      version: 1,
      questions: [
        {
          key: "investimento",
          label: "Q1 · Orçamento",
          prompt: "Existe orçamento reservado para este projeto?",
          options: [
            { label: "Não investe", points: 0, ko: true },
            { label: "Até R$ 2.000/mês", points: 1 },
            { label: "Acima de R$ 5.000/mês", points: 2 },
          ],
        },
      ],
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const tela = (oportunidade: OportunidadeListada) => (
      <QueryClientProvider client={qc}>
        <OpportunityDrawer oportunidade={oportunidade} aoFechar={vi.fn()} podeEditar />
      </QueryClientProvider>
    );
    const user = userEvent.setup();
    const { rerender } = render(tela(OPORTUNIDADE));

    await user.click(await screen.findByRole("button", { name: /Até R\$ 2\.000\/mês/ }));
    expect(screen.getByText("Tier C · 1 pts")).toBeInTheDocument();

    rerender(
      tela({
        ...OPORTUNIDADE,
        respostas: [{ questionKey: "investimento", optionIndex: 2, points: 2, isKo: false }],
      }),
    );

    expect(screen.getByText("Tier C · 2 pts")).toBeInTheDocument();
  });

  it("refetch com as mesmas respostas em outra referência (board reordenado) mantém o clique", async () => {
    vi.mocked(carregarCatalogo).mockResolvedValue({
      version: 1,
      questions: [
        {
          key: "investimento",
          label: "Q1 · Orçamento",
          prompt: "Existe orçamento reservado para este projeto?",
          options: [
            { label: "Não investe", points: 0, ko: true },
            { label: "Até R$ 2.000/mês", points: 1 },
          ],
        },
      ],
    });
    vi.mocked(responderPergunta).mockReturnValue(new Promise(() => {}));
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const tela = (oportunidade: OportunidadeListada) => (
      <QueryClientProvider client={qc}>
        <OpportunityDrawer oportunidade={oportunidade} aoFechar={vi.fn()} podeEditar />
      </QueryClientProvider>
    );
    const user = userEvent.setup();
    const { rerender } = render(tela(OPORTUNIDADE));

    await user.click(await screen.findByRole("button", { name: /Até R\$ 2\.000\/mês/ }));
    expect(screen.getByText("Tier C · 1 pts")).toBeInTheDocument();

    rerender(tela({ ...OPORTUNIDADE, respostas: [...OPORTUNIDADE.respostas] }));

    expect(screen.getByText("Tier C · 1 pts")).toBeInTheDocument();
  });
});

describe("bloco de propostas (D-064)", () => {
  it("a ficha mostra o bloco da oportunidade aberta, mesmo sem poder editar", () => {
    propsDoBlocoDePropostas.mockReset();
    renderDrawer(vi.fn(), OPORTUNIDADE, false);
    expect(propsDoBlocoDePropostas).toHaveBeenCalledWith({ oportunidade: OPORTUNIDADE });
  });
});

describe("apagar a oportunidade (D-067)", () => {
  const apagarBotao = () => screen.queryByRole("button", { name: "Apagar oportunidade" });

  it("🔴 owner e manager (podeEditar) veem o botão; member não", () => {
    const { unmount } = renderDrawer(vi.fn(), OPORTUNIDADE, true);
    expect(apagarBotao()).toBeInTheDocument();
    unmount();

    renderDrawer(vi.fn(), OPORTUNIDADE, false);
    expect(apagarBotao()).toBeNull();
  });

  it("o diálogo nomeia a oportunidade e diz o que sai junto e o que fica", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    await user.click(screen.getByRole("button", { name: "Apagar oportunidade" }));

    expect(
      screen.getByRole("alertdialog", { name: 'Apagar "Padaria do Zé"?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/timeline, as respostas de qualificação/)).toBeInTheDocument();
    expect(screen.getByText(/proposta já enviada ao cliente não se apaga/)).toBeInTheDocument();
    expect(screen.getByText(/Venda com contrato não se apaga/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/para confirmar/)).toBeNull();
    expect(apagarOportunidade).not.toHaveBeenCalled();
  });

  it("🔴 confirmar apaga pelo id, avisa e fecha a ficha", async () => {
    const user = userEvent.setup();
    const aoFechar = vi.fn();
    renderDrawer(aoFechar);

    await user.click(screen.getByRole("button", { name: "Apagar oportunidade" }));
    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));

    await waitFor(() => expect(aoFechar).toHaveBeenCalledTimes(1));
    expect(apagarOportunidade).toHaveBeenCalledWith("oportunidade-1");
    expect(toast.success).toHaveBeenCalledWith("Oportunidade apagada.");
  });

  it("🔴 a recusa do banco (proposta enviada) vira toast com a frase dele, e a ficha fica aberta", async () => {
    const frase =
      "Esta oportunidade tem proposta já enviada ao cliente (enviada, aceita ou recusada) e não pode ser excluída. Marque-a como perdida.";
    vi.mocked(apagarOportunidade).mockRejectedValue(
      Object.assign(new Error(frase), { code: "42501" }),
    );
    const user = userEvent.setup();
    const aoFechar = vi.fn();
    renderDrawer(aoFechar);

    await user.click(screen.getByRole("button", { name: "Apagar oportunidade" }));
    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(frase));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
    expect(aoFechar).not.toHaveBeenCalled();
  });
});

describe("corrigir a nota na timeline (D-069, C3)", () => {
  function nota(autorId: string, extra: Partial<EventoDaOportunidade> = {}): EventoDaOportunidade {
    return {
      id: "e-nota",
      tipo: "note",
      deEstagio: null,
      paraEstagio: null,
      conteudo: "Ligar amanhã",
      autorId,
      autorNome: "Fulano",
      editadoEm: null,
      editadoPorNome: null,
      conteudoOriginal: null,
      correcoes: [],
      criadoEm: "2026-10-01T12:00:00Z",
      ...extra,
    };
  }

  it("member autor da nota corrige: a correção vai ao repositório com a trava, a timeline é relida e só então o formulário fecha", async () => {
    const user = userEvent.setup();
    vi.mocked(listarEventos).mockResolvedValue([nota("user-1")]);
    renderDrawer(vi.fn(), OPORTUNIDADE, false);

    await user.click(await screen.findByRole("button", { name: "Corrigir" }));
    const campo = screen.getByLabelText("Texto corrigido");
    await user.clear(campo);
    await user.type(campo, "Ligar sexta");
    const leiturasAntes = vi.mocked(listarEventos).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Salvar correção" }));

    await waitFor(() =>
      expect(corrigirTextoDoEvento).toHaveBeenCalledWith("e-nota", "Ligar sexta", null),
    );
    await waitFor(() => expect(screen.queryByLabelText("Texto corrigido")).not.toBeInTheDocument());
    expect(vi.mocked(listarEventos).mock.calls.length).toBeGreaterThan(leiturasAntes);
  });

  it("nota já corrigida: a trava é o editadoEm que a tela leu", async () => {
    const user = userEvent.setup();
    vi.mocked(listarEventos).mockResolvedValue([
      nota("user-1", { editadoEm: "2026-10-02T15:30:00+00:00", conteudoOriginal: "Ligar hoje" }),
    ]);
    renderDrawer(vi.fn(), OPORTUNIDADE, false);

    await user.click(await screen.findByRole("button", { name: "Corrigir" }));
    await user.click(screen.getByRole("button", { name: "Salvar correção" }));

    await waitFor(() =>
      expect(corrigirTextoDoEvento).toHaveBeenCalledWith(
        "e-nota",
        "Ligar amanhã",
        "2026-10-02T15:30:00+00:00",
      ),
    );
  });

  it("🔴 recusa (mudou em outra tela): a frase vai ao toast, a timeline é relida e o texto digitado fica no formulário", async () => {
    const frase =
      "A nota não foi corrigida: ela mudou em outra tela, ou corrigir é de quem escreveu, do owner e do manager (mudança de etapa não se corrige).";
    vi.mocked(corrigirTextoDoEvento).mockRejectedValue(new Error(frase));
    const user = userEvent.setup();
    vi.mocked(listarEventos).mockResolvedValue([nota("user-1")]);
    renderDrawer(vi.fn(), OPORTUNIDADE, false);

    await user.click(await screen.findByRole("button", { name: "Corrigir" }));
    const campo = screen.getByLabelText("Texto corrigido");
    await user.clear(campo);
    await user.type(campo, "Ligar sexta");
    const leiturasAntes = vi.mocked(listarEventos).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Salvar correção" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(frase));
    await waitFor(() =>
      expect(vi.mocked(listarEventos).mock.calls.length).toBeGreaterThan(leiturasAntes),
    );
    expect(screen.getByLabelText("Texto corrigido")).toHaveValue("Ligar sexta");
  });

  it("member não vê Corrigir na nota de outra pessoa", async () => {
    vi.mocked(listarEventos).mockResolvedValue([nota("user-2")]);
    renderDrawer(vi.fn(), OPORTUNIDADE, false);
    expect(await screen.findByText("Ligar amanhã")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corrigir" })).not.toBeInTheDocument();
  });

  it("owner ou manager (podeEditar) vê Corrigir na nota alheia (controle)", async () => {
    vi.mocked(listarEventos).mockResolvedValue([nota("user-2")]);
    renderDrawer(vi.fn(), OPORTUNIDADE, true);
    expect(await screen.findByRole("button", { name: "Corrigir" })).toBeInTheDocument();
  });

  it("mudança de etapa nunca oferece Corrigir, nem ao owner", async () => {
    vi.mocked(listarEventos).mockResolvedValue([
      nota("user-1", {
        tipo: "stage_change",
        deEstagio: "prospeccao",
        paraEstagio: "r1",
        conteudo: "Contato → Diagnóstico inicial",
      }),
    ]);
    renderDrawer(vi.fn(), OPORTUNIDADE, true);
    expect(await screen.findByText("Contato → Diagnóstico inicial")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corrigir" })).not.toBeInTheDocument();
  });
});

describe("valor fechado leva ao contrato (D-069, C2)", () => {
  const CLIENTE_UUID = "3f2c1a4e-8b7d-4c6e-9a1f-2b3c4d5e6f70";
  const GANHA: OportunidadeListada = {
    ...OPORTUNIDADE,
    clienteId: CLIENTE_UUID,
    fechadoMrr: 1500,
    fechadoTcv: null,
  };

  it("owner vê Editar no contrato, apontando para os contratos do cliente", () => {
    renderDrawer(vi.fn(), GANHA, true, "owner");
    expect(screen.getByRole("link", { name: "Editar no contrato" })).toHaveAttribute(
      "href",
      `/contracts?cliente=${CLIENTE_UUID}`,
    );
  });

  it("owner com valor fechado só de projeto (sem recorrente) também vê o link", () => {
    renderDrawer(vi.fn(), { ...GANHA, fechadoMrr: null, fechadoTcv: 30000 }, true, "owner");
    expect(screen.getByRole("link", { name: "Editar no contrato" })).toHaveAttribute(
      "href",
      `/contracts?cliente=${CLIENTE_UUID}`,
    );
  });

  it("manager vê Ver no contrato", () => {
    renderDrawer(vi.fn(), GANHA, true, "manager");
    expect(screen.getByRole("link", { name: "Ver no contrato" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Editar no contrato" })).not.toBeInTheDocument();
  });

  it("member não vê o link", () => {
    renderDrawer(vi.fn(), GANHA, false, "member");
    expect(screen.queryByRole("link", { name: /no contrato/ })).not.toBeInTheDocument();
  });

  it("sessão ainda carregando (papel nulo) não mostra o link", () => {
    renderDrawer(vi.fn(), GANHA, false, null);
    expect(screen.queryByRole("link", { name: /no contrato/ })).not.toBeInTheDocument();
  });

  it("sem contrato ou sem valor fechado, nem o owner vê", () => {
    renderDrawer(vi.fn(), { ...GANHA, clienteId: null }, true, "owner");
    expect(screen.queryByRole("link", { name: /no contrato/ })).not.toBeInTheDocument();
    cleanup();
    renderDrawer(vi.fn(), { ...GANHA, fechadoMrr: null }, true, "owner");
    expect(screen.queryByRole("link", { name: /no contrato/ })).not.toBeInTheDocument();
    cleanup();
    renderDrawer(vi.fn(), { ...GANHA, fechadoMrr: 0, fechadoTcv: 0 }, true, "owner");
    expect(screen.queryByRole("link", { name: /no contrato/ })).not.toBeInTheDocument();
  });
});

describe("Desfazer na ficha da oportunidade (D-071)", () => {
  const COM_CONTRATO: OportunidadeListada = {
    ...OPORTUNIDADE,
    estagio: "fechado",
    clienteId: "cli-1",
  };

  it("🔴 owner, em Fechado e com contrato: monta o Desfazer desta venda", () => {
    renderDrawer(vi.fn(), COM_CONTRATO, true, "owner");
    expect(propsDoDesfazer).toHaveBeenCalledWith({
      venda: { id: COM_CONTRATO.id, nome: COM_CONTRATO.nome },
    });
    expect(screen.getByRole("button", { name: "Desfazer fechamento" })).toBeInTheDocument();
  });

  it("manager com a mesma venda não vê", () => {
    renderDrawer(vi.fn(), COM_CONTRATO, true, "manager");
    expect(propsDoDesfazer).not.toHaveBeenCalled();
  });

  it("venda sem contrato não oferece Desfazer, nem ao owner (sai pelo arrasto)", () => {
    renderDrawer(vi.fn(), { ...COM_CONTRATO, clienteId: null }, true, "owner");
    expect(propsDoDesfazer).not.toHaveBeenCalled();
  });

  it("fora de Fechado não oferece Desfazer", () => {
    renderDrawer(vi.fn(), { ...COM_CONTRATO, estagio: "r2" }, true, "owner");
    expect(propsDoDesfazer).not.toHaveBeenCalled();
  });
});
