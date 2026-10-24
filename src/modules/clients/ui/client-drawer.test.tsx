import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { CODIGO_SEM_PERMISSAO } from "@/shared/lib/permissao";
import type { ContextoDeAcesso } from "../domain/access";
import type { ClienteListado } from "../api/clients.repository";
import {
  apagarCliente,
  atualizarDadosDoCliente,
  corrigirDataDoStatus,
  definirAssinatura,
  definirConfidencialidade,
  definirPastaDoDrive,
  definirResponsavel,
  definirStatusDoCliente,
  listarCorrecoesDeData,
  listarResponsaveisPossiveis,
} from "../api/clients.repository";
import { ClientDrawer } from "./client-drawer";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../api/clients.repository", () => ({
  apagarCliente: vi.fn(),
  atualizarDadosDoCliente: vi.fn(),
  corrigirDataDoStatus: vi.fn(),
  listarCorrecoesDeData: vi.fn(),
  definirAssinatura: vi.fn(),
  definirPastaDoDrive: vi.fn(),
  definirConfidencialidade: vi.fn(),
  definirResponsavel: vi.fn(),
  definirStatusDoCliente: vi.fn(),
  desfazerFechamento: vi.fn(),
  listarClientes: vi.fn(),
  listarGanhasSemContrato: vi.fn(),
  listarResponsaveisPossiveis: vi.fn(),
}));

let resultadoDoApagarNoBanco: { status: number; corpo: unknown } = {
  status: 200,
  corpo: [{ contratos_apagados: 0, jornadas_apagadas: 0, posts_apagados: 0 }],
};

const pedidosAoBanco: Array<{ url: string; corpo: unknown }> = [];

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const real = createClient("http://exemplo.invalido", "chave-publica-de-teste", {
    global: {
      fetch: ((url: string, init?: RequestInit) => {
        pedidosAoBanco.push({ url: String(url), corpo: JSON.parse(String(init?.body ?? "null")) });
        return Promise.resolve(
          new Response(JSON.stringify(resultadoDoApagarNoBanco.corpo), {
            status: resultadoDoApagarNoBanco.status,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }) as unknown as typeof globalThis.fetch,
    },
  });
  return { supabaseV2: { rpc: real.rpc.bind(real) } };
});

const { apagarCliente: apagarClienteReal } = await vi.importActual<
  typeof import("../api/clients.repository")
>("../api/clients.repository");

vi.mock("@/modules/pipeline/hooks/use-pipeline", () => ({
  useEventos: vi.fn(() => ({ data: [], isLoading: false })),
  chavesDoPipeline: { raiz: ["opportunities"] },
}));

vi.mock("@/modules/contracts/hooks/use-contracts", () => ({
  chavesDeContratos: { lista: ["contracts"], clientes: ["contracts", "clientes-para-selecao"] },
}));

vi.mock("@/modules/onboarding/hooks/use-onboarding", () => ({
  chavesDoOnboarding: { raiz: ["onboarding"] },
}));

vi.mock("@/modules/content/hooks/use-content", () => ({
  chavesDoConteudo: { raiz: ["content"] },
}));
vi.mock("@/modules/tasks/hooks/use-tasks", () => ({
  chavesDeTarefa: { raiz: ["tasks"] },
}));
vi.mock("@/modules/meetings/hooks/use-meetings", () => ({
  chavesDeReunioes: { raiz: ["reunioes"] },
}));

const propsDosContratosACriar = vi.fn();
vi.mock("@/modules/proposals/ui/contratos-da-proposta-a-criar", () => ({
  ContratosDaPropostaACriar: (props: unknown) => {
    propsDosContratosACriar(props);
    return null;
  },
}));

const PASTA_A = "abcdefghij1234567890";
const PASTA_B = "zyxwvutsrq0987654321";

const CLIENTE: ClienteListado = {
  id: "cliente-1",
  nome: "Cliente Teste",
  segmento: null,
  nicho: null,
  status: "active",
  contatoNome: null,
  contatoEmail: null,
  contatoTelefone: null,
  responsavelId: "user-1",
  responsavelNome: "Fulano",
  vendasDeOrigem: [],
  pastaDoDrive: null,
  confidencial: false,
  confidencialNota: null,
  assinadoEm: null,
  encerradoEm: null,
  pausadoEm: null,
  criadoEm: "2026-01-01T00:00:00Z",
  contratos: [],
  ultimoEventoEm: null,
  proximoFimDeCobranca: null,
  contratosAtivosVisiveis: 0,
};

const CLIENTE_COM_PASTA: ClienteListado = {
  ...CLIENTE,
  id: "cliente-2",
  pastaDoDrive: PASTA_A,
};

const CLIENTE_CONFIDENCIAL: ClienteListado = {
  ...CLIENTE,
  id: "cliente-3",
  confidencial: true,
  confidencialNota: "nota antiga",
};

const CONTEXTO_OWNER: ContextoDeAcesso = { papel: "owner", usuarioId: "user-1" };

const CONTEXTO_MANAGER: ContextoDeAcesso = { papel: "manager", usuarioId: "user-1" };
const CLIENTE_DO_MANAGER: ClienteListado = { ...CLIENTE, responsavelId: "user-1" };
const CLIENTE_REATRIBUIDO: ClienteListado = { ...CLIENTE_DO_MANAGER, responsavelId: "outro-user" };

const CONTEXTO_SEM_PERMISSAO: ContextoDeAcesso = { papel: "member", usuarioId: "user-1" };

const PLACEHOLDER_DRIVE = "Cole o link ou o ID da pasta do Drive";
const PLACEHOLDER_NOTA = "Ex.: contato só pelo privado, pelo sócio, no telefone da Next.";

function renderDrawer(
  aoFechar: () => void,
  cliente: ClienteListado = CLIENTE,
  contexto: ContextoDeAcesso = CONTEXTO_OWNER,
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={qc}>
      <ClientDrawer cliente={cliente} contexto={contexto} aoFechar={aoFechar} />
    </QueryClientProvider>,
  );
  return {
    ...utils,
    trocarCliente: (novoCliente: ClienteListado | null) =>
      utils.rerender(
        <QueryClientProvider client={qc}>
          <ClientDrawer cliente={novoCliente} contexto={contexto} aoFechar={aoFechar} />
        </QueryClientProvider>,
      ),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarResponsaveisPossiveis).mockResolvedValue([]);
  vi.mocked(definirPastaDoDrive).mockResolvedValue(undefined);
  vi.mocked(definirConfidencialidade).mockResolvedValue(undefined);
  vi.mocked(definirResponsavel).mockResolvedValue(undefined);
  vi.mocked(atualizarDadosDoCliente).mockResolvedValue(undefined);
  vi.mocked(definirAssinatura).mockResolvedValue(undefined);
  vi.mocked(definirStatusDoCliente).mockResolvedValue(undefined);
  vi.mocked(corrigirDataDoStatus).mockResolvedValue(undefined);
  vi.mocked(listarCorrecoesDeData).mockResolvedValue([]);
  resultadoDoApagarNoBanco = {
    status: 200,
    corpo: [{ contratos_apagados: 0, jornadas_apagadas: 0, posts_apagados: 0 }],
  };
  pedidosAoBanco.length = 0;
  vi.mocked(apagarCliente).mockImplementation(apagarClienteReal);
});

describe("ClientDrawer — sem guard, salva no blur", () => {
  it("fecha no estado limpo, sem ninguém ter tocado em nada", () => {
    const aoFechar = vi.fn();
    renderDrawer(aoFechar);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("fecha mesmo com o campo do Drive no meio de uma edição não salva", () => {
    const aoFechar = vi.fn();
    renderDrawer(aoFechar);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER_DRIVE), {
      target: { value: PASTA_A },
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("fecha mesmo depois de o blur tentar salvar e a mutation falhar", async () => {
    const aoFechar = vi.fn();
    vi.mocked(definirPastaDoDrive).mockRejectedValue(new Error("Falha simulada"));
    renderDrawer(aoFechar);

    const input = screen.getByPlaceholderText(PLACEHOLDER_DRIVE);
    fireEvent.change(input, { target: { value: PASTA_A } });
    fireEvent.blur(input);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("blur salva quando o valor muda", async () => {
    renderDrawer(vi.fn());
    const input = screen.getByPlaceholderText(PLACEHOLDER_DRIVE);

    fireEvent.change(input, { target: { value: PASTA_A } });
    fireEvent.blur(input);

    await waitFor(() => expect(definirPastaDoDrive).toHaveBeenCalledWith("cliente-1", PASTA_A));
  });

  it("blur não grava nada quando o valor não mudou", async () => {
    renderDrawer(vi.fn());
    const input = screen.getByPlaceholderText(PLACEHOLDER_DRIVE);

    fireEvent.blur(input);

    fireEvent.change(input, { target: { value: PASTA_A } });
    fireEvent.blur(input);

    await waitFor(() => expect(definirPastaDoDrive).toHaveBeenCalledWith("cliente-1", PASTA_A));
    expect(definirPastaDoDrive).toHaveBeenCalledTimes(1);
  });

  it("valor não vazio e não reconhecido no blur não grava, não apaga o id já gravado, e o texto fica onde estava", async () => {
    renderDrawer(vi.fn(), CLIENTE_COM_PASTA);
    const input = screen.getByPlaceholderText(PLACEHOLDER_DRIVE);

    fireEvent.change(input, { target: { value: "isso não é um link nem um id" } });
    fireEvent.blur(input);

    expect(toast.error).toHaveBeenCalledWith(
      "Isso não parece um link nem um ID de pasta do Drive. Confira o valor colado e tente de novo.",
    );
    expect(screen.getByRole("link", { name: /Abrir pasta no Drive/ })).toHaveAttribute(
      "href",
      `https://drive.google.com/drive/folders/${PASTA_A}`,
    );
    expect(screen.getByDisplayValue("isso não é um link nem um id")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: PASTA_B } });
    fireEvent.blur(input);

    await waitFor(() => expect(definirPastaDoDrive).toHaveBeenCalledWith("cliente-2", PASTA_B));
    expect(definirPastaDoDrive).toHaveBeenCalledTimes(1);
  });

  it("Esc salva a edição em curso e fecha a ficha", async () => {
    const aoFechar = vi.fn();
    renderDrawer(aoFechar);

    const input = screen.getByPlaceholderText(PLACEHOLDER_DRIVE);
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: PASTA_A } });

    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => expect(definirPastaDoDrive).toHaveBeenCalledWith("cliente-1", PASTA_A));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("campo esvaziado limpa a pasta gravada", async () => {
    renderDrawer(vi.fn(), CLIENTE_COM_PASTA);
    const input = screen.getByPlaceholderText(PLACEHOLDER_DRIVE);

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    await waitFor(() => expect(definirPastaDoDrive).toHaveBeenCalledWith("cliente-2", ""));
  });

  it("colar a URL da pasta que já está gravada não regrava nada", async () => {
    renderDrawer(vi.fn(), CLIENTE_COM_PASTA);
    const input = screen.getByPlaceholderText(PLACEHOLDER_DRIVE);

    fireEvent.change(input, {
      target: { value: `https://drive.google.com/drive/folders/${PASTA_A}?usp=sharing` },
    });
    fireEvent.blur(input);

    fireEvent.change(input, { target: { value: PASTA_B } });
    fireEvent.blur(input);

    await waitFor(() => expect(definirPastaDoDrive).toHaveBeenCalledWith("cliente-2", PASTA_B));
    expect(definirPastaDoDrive).toHaveBeenCalledTimes(1);
  });

  it("o interruptor de confidencialidade não manda a nota junto", async () => {
    renderDrawer(vi.fn(), CLIENTE_CONFIDENCIAL);

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(definirConfidencialidade).toHaveBeenCalledWith("cliente-3", false, undefined),
    );
  });

  it("editar a nota e clicar no interruptor é UM gesto: as duas gravações acontecem, em ordem, e `confidencial` fica no valor clicado", async () => {
    let liberarNota: () => void = () => {};
    const gravacaoDaNota = new Promise<void>((resolve) => {
      liberarNota = resolve;
    });
    vi.mocked(definirConfidencialidade).mockImplementationOnce(() => gravacaoDaNota);

    renderDrawer(vi.fn(), CLIENTE_CONFIDENCIAL);

    const nota = screen.getByPlaceholderText(PLACEHOLDER_NOTA);
    fireEvent.change(nota, { target: { value: "nota nova" } });
    fireEvent.blur(nota);
    await waitFor(() =>
      expect(definirConfidencialidade).toHaveBeenCalledWith("cliente-3", true, "nota nova"),
    );

    const interruptor = screen.getByRole("switch");
    expect(interruptor).not.toBeDisabled();
    fireEvent.click(interruptor);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(definirConfidencialidade).toHaveBeenCalledTimes(1);

    liberarNota();

    await waitFor(() => expect(definirConfidencialidade).toHaveBeenCalledTimes(2));
    expect(definirConfidencialidade).toHaveBeenNthCalledWith(2, "cliente-3", false, undefined);
  });

  it("falha do salvamento avisa mesmo se a ficha fechar antes da resposta", async () => {
    vi.mocked(definirPastaDoDrive).mockRejectedValue(new Error("Falha simulada"));
    const { trocarCliente } = renderDrawer(vi.fn(), CLIENTE_COM_PASTA);

    const input = screen.getByPlaceholderText(PLACEHOLDER_DRIVE);
    fireEvent.change(input, { target: { value: PASTA_B } });
    fireEvent.blur(input);

    trocarCliente(null);
    expect(screen.queryByPlaceholderText(PLACEHOLDER_DRIVE)).not.toBeInTheDocument();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha simulada"));
  });

  it("nota suja, confidencialidade desligada por fora (refetch) — a Textarea some e o Dialog fecha", () => {
    const aoFechar = vi.fn();
    const { trocarCliente } = renderDrawer(aoFechar, CLIENTE_CONFIDENCIAL);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER_NOTA), {
      target: { value: "nota nova, nunca salva" },
    });

    trocarCliente({ ...CLIENTE_CONFIDENCIAL, confidencial: false });

    expect(screen.queryByPlaceholderText(PLACEHOLDER_NOTA)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("Drive sujo, responsável reatribuído por fora (RLS permite) — o editor colapsa pro link e o Dialog fecha", () => {
    const aoFechar = vi.fn();
    const { trocarCliente } = renderDrawer(aoFechar, CLIENTE_DO_MANAGER, CONTEXTO_MANAGER);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER_DRIVE), {
      target: { value: PASTA_A },
    });

    trocarCliente(CLIENTE_REATRIBUIDO);

    expect(screen.queryByPlaceholderText(PLACEHOLDER_DRIVE)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});

describe("ficha do cliente edita os dados de identificacao", () => {
  const CLIENTE_COM_EMAIL_ERRADO: ClienteListado = {
    ...CLIENTE,
    id: "cliente-4",
    contatoEmail: "contato@epresa.com",
  };

  it("corrige o e-mail do contato", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), CLIENTE_COM_EMAIL_ERRADO);

    const campo = screen.getByLabelText(/E-mail/);
    await user.clear(campo);
    await user.type(campo, "contato@empresa.com");
    await user.tab();

    await waitFor(() =>
      expect(atualizarDadosDoCliente).toHaveBeenCalledWith("cliente-4", {
        contatoEmail: "contato@empresa.com",
      }),
    );
  });

  it("🔴 quem nao pode editar ve os valores e nenhum campo habilitado", () => {
    renderDrawer(vi.fn(), CLIENTE_COM_EMAIL_ERRADO, CONTEXTO_SEM_PERMISSAO);

    expect(screen.getByDisplayValue("contato@epresa.com")).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/)).toBeDisabled();
  });

  it("🔴 sair do campo sem mudar nada NAO dispara mutacao", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), CLIENTE_COM_EMAIL_ERRADO);

    await user.click(screen.getByLabelText(/E-mail/));
    await user.tab();

    expect(atualizarDadosDoCliente).not.toHaveBeenCalled();
  });

  it("🔴 o título da ficha é só texto — sem campo dentro, e o nome acessível do diálogo não esvazia enquanto o campo Nome é editado", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), CLIENTE_COM_EMAIL_ERRADO);

    expect(screen.getByRole("dialog", { name: /Cliente Teste/ })).toBeInTheDocument();

    const titulo = screen.getByRole("heading", { name: /Cliente Teste/ });
    expect(within(titulo).queryByRole("textbox")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Nome"));
    expect(screen.getByRole("dialog", { name: /Cliente Teste/ })).toBeInTheDocument();
  });

  it("🔴 abrir a ficha NÃO foca nem seleciona o texto do campo Nome", () => {
    renderDrawer(vi.fn(), CLIENTE_COM_EMAIL_ERRADO);

    const campoNome = screen.getByLabelText("Nome") as HTMLInputElement;
    expect(document.activeElement).not.toBe(campoNome);
    expect(campoNome.selectionStart).toBe(campoNome.selectionEnd);
  });
});

describe("erro da ficha aparece mesmo com a ficha fechada (irmão do PIPE-2)", () => {
  it("🔴 apagar o Nome + Esc, ficha fechada antes da recusa → um toast com a frase do repositório", async () => {
    let rejeitar: ((e: Error) => void) | undefined;
    vi.mocked(atualizarDadosDoCliente).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejeitar = reject;
        }),
    );
    const { trocarCliente } = renderDrawer(vi.fn());

    const campo = screen.getByLabelText("Nome");
    campo.focus();
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.keyDown(campo, { key: "Escape" });
    await waitFor(() =>
      expect(atualizarDadosDoCliente).toHaveBeenCalledWith("cliente-1", { nome: "" }),
    );
    trocarCliente(null);
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();

    expect(rejeitar).toBeDefined();
    rejeitar?.(new Error("O nome do cliente não pode ficar em branco."));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("O nome do cliente não pode ficar em branco."),
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("com a ficha aberta, a recusa avisa UMA vez — não em dobro", async () => {
    vi.mocked(definirStatusDoCliente).mockRejectedValueOnce(
      new Error("Você não pode mudar o status deste cliente."),
    );
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    await user.click(screen.getByRole("combobox", { name: /status/i }));
    await user.click(screen.getByRole("option", { name: /Pausado/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Você não pode mudar o status deste cliente."),
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe("assinado em", () => {
  it("owner grava a data civil como veio do input, sem fuso", async () => {
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_OWNER);

    const campo = screen.getByLabelText(/Assinado em/);
    expect(campo).toHaveAttribute("type", "date");
    fireEvent.change(campo, { target: { value: "2026-09-01" } });
    fireEvent.blur(campo);

    await waitFor(() => expect(definirAssinatura).toHaveBeenCalledWith("cliente-1", "2026-09-01"));
  });

  it("campo esvaziado limpa a data — `null`, não string vazia", async () => {
    renderDrawer(vi.fn(), { ...CLIENTE, assinadoEm: "2026-09-01" }, CONTEXTO_OWNER);

    const campo = screen.getByLabelText(/Assinado em/);
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.blur(campo);

    await waitFor(() => expect(definirAssinatura).toHaveBeenCalledWith("cliente-1", null));
  });

  it("sair sem mudar não grava", () => {
    renderDrawer(vi.fn(), { ...CLIENTE, assinadoEm: "2026-09-01" }, CONTEXTO_OWNER);

    fireEvent.blur(screen.getByLabelText(/Assinado em/));

    expect(definirAssinatura).not.toHaveBeenCalled();
  });

  it("a recusa da RLS chega ao toast com a mensagem do repositório", async () => {
    vi.mocked(definirAssinatura).mockRejectedValue(
      new Error("Você não pode editar a data de assinatura deste cliente."),
    );
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_OWNER);

    const campo = screen.getByLabelText(/Assinado em/);
    fireEvent.change(campo, { target: { value: "2026-09-01" } });
    fireEvent.blur(campo);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Você não pode editar a data de assinatura deste cliente.",
      ),
    );
  });

  it("🔴 member não vê o campo — só a linha de leitura, e sem data nada aparece", () => {
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_SEM_PERMISSAO);

    expect(screen.queryByLabelText(/Assinado em/)).toBeNull();
    expect(screen.queryByText("Assinado em")).toBeNull();
  });

  it("member com data vê o valor formatado, sem input", () => {
    renderDrawer(vi.fn(), { ...CLIENTE, assinadoEm: "2026-09-01" }, CONTEXTO_SEM_PERMISSAO);

    expect(screen.queryByLabelText(/Assinado em/)).toBeNull();
    expect(screen.getByText("Assinado em")).toBeInTheDocument();
    expect(screen.getByText("01/09/2026")).toBeInTheDocument();
  });

  it("manager do próprio cliente edita; manager de cliente alheio só lê", () => {
    const { unmount } = renderDrawer(vi.fn(), CLIENTE_DO_MANAGER, CONTEXTO_MANAGER);
    expect(screen.getByLabelText(/Assinado em/)).toBeEnabled();
    unmount();

    renderDrawer(vi.fn(), CLIENTE_REATRIBUIDO, CONTEXTO_MANAGER);
    expect(screen.queryByLabelText(/Assinado em/)).toBeNull();
  });

  it("🔴 ano pela metade não grava: avisa e não chama o repositório", () => {
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_OWNER);

    const campo = screen.getByLabelText(/Assinado em/);
    fireEvent.change(campo, { target: { value: "0002-09-01" } });
    fireEvent.blur(campo);

    expect(definirAssinatura).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Data de assinatura inválida. Use um ano entre 2000 e 2100.",
    );
  });
});

describe("status do cliente", () => {
  it("owner muda o status para churned", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    await user.click(screen.getByRole("combobox", { name: /Status/i }));
    await user.click(screen.getByRole("option", { name: /Encerrado/i }));

    await waitFor(() =>
      expect(definirStatusDoCliente).toHaveBeenCalledWith("cliente-1", "churned"),
    );
  });

  it("🔴 os quatro valores do enum aparecem, e nenhum a mais", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn());

    await user.click(screen.getByRole("combobox", { name: /Status/i }));

    expect(screen.getAllByRole("option")).toHaveLength(4);
    for (const rotulo of [/Onboarding/i, /Ativo/i, /Pausado/i, /Encerrado/i]) {
      expect(screen.getByRole("option", { name: rotulo })).toBeInTheDocument();
    }
  });

  it("🔴 quem nao pode editar ve o status e nao troca", () => {
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_SEM_PERMISSAO);

    expect(screen.getByText(/Ativo/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Status/i })).toBeNull();
  });
});

describe("apagar cliente", () => {
  async function abrirEDigitar(user: ReturnType<typeof userEvent.setup>, texto: string) {
    await user.click(screen.getByRole("button", { name: /Apagar cliente/i }));
    await user.type(screen.getByLabelText(/para confirmar/), texto);
  }

  it("🔴 pede confirmacao antes de apagar, nomeia o cliente e diz o que sai e o que fica", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_OWNER);

    await user.click(screen.getByRole("button", { name: /Apagar cliente/i }));

    expect(apagarCliente).not.toHaveBeenCalled();
    const dialogo = screen.getByRole("alertdialog", { name: 'Apagar "Cliente Teste"?' });
    expect(dialogo).toHaveTextContent("junto com os contratos dele");
    expect(dialogo).toHaveTextContent("a jornada de onboarding com os cartões dela");
    expect(dialogo).toHaveTextContent("os posts de conteúdo");
    expect(dialogo).toHaveTextContent(
      "Ficam, sem cliente: as tarefas avulsas e as outras reuniões",
    );
    expect(dialogo).toHaveTextContent("as reuniões de cliente (kickoff, semanal");
    expect(dialogo).toHaveTextContent(
      "As vendas de origem continuam no Pipeline, em Fechado e sem contrato.",
    );
    expect(dialogo).toHaveTextContent("Mês já fechado no Financeiro não muda");
    expect(dialogo).toHaveTextContent("Não pode ser desfeito.");
    expect(dialogo).toHaveTextContent("Sim, encerrar cobrança");
    expect(dialogo).not.toHaveTextContent("recusado pelo banco");
    expect(dialogo.textContent).not.toMatch(/[—–]/);
  });

  it("🔴 Sim, apagar só libera com o nome do cliente digitado", async () => {
    const user = userEvent.setup();
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_OWNER);

    await abrirEDigitar(user, "Cliente");
    const confirmar = screen.getByRole("button", { name: /Sim, apagar/i });
    expect(confirmar).toBeDisabled();

    await user.type(screen.getByLabelText(/para confirmar/), " Teste");
    expect(confirmar).toBeEnabled();
    expect(apagarCliente).not.toHaveBeenCalled();
  });

  it("com o nome digitado, chama a RPC apagar_cliente com p_client_id e avisa o que saiu", async () => {
    resultadoDoApagarNoBanco = {
      status: 200,
      corpo: [{ contratos_apagados: 2, jornadas_apagadas: 1, posts_apagados: 3 }],
    };
    const user = userEvent.setup();
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_OWNER);

    await abrirEDigitar(user, "Cliente Teste");
    await user.click(screen.getByRole("button", { name: /Sim, apagar/i }));

    await waitFor(() => expect(apagarCliente).toHaveBeenCalledWith("cliente-1"));
    await waitFor(() =>
      expect(pedidosAoBanco).toContainEqual({
        url: expect.stringMatching(/\/rest\/v1\/rpc\/apagar_cliente$/),
        corpo: { p_client_id: "cliente-1" },
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Cliente apagado, com 2 contratos."),
    );
  });

  it("🔴 a recusa do banco (42501) chega como a frase do owner, nao como silencio nem como token", async () => {
    resultadoDoApagarNoBanco = {
      status: 403,
      corpo: { code: "42501", message: "forbidden", details: null, hint: null },
    };
    const user = userEvent.setup();
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_OWNER);

    await abrirEDigitar(user, "Cliente Teste");
    await user.click(screen.getByRole("button", { name: /Sim, apagar/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Apagar cliente é do owner. Se você cadastrou o app autenticador e entrou sem o código, saia e entre de novo digitando o código de 6 dígitos.",
      ),
    );
    expect(toast.error).not.toHaveBeenCalledWith("forbidden");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("🔴 quem nao e owner nao ve o botao", () => {
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_SEM_PERMISSAO);
    expect(screen.queryByRole("button", { name: /Apagar cliente/i })).toBeNull();
  });

  it("🔴 manager que edita o proprio cliente ainda assim nao ve o botao — a trava e do dono, nao da mesma permissao de edicao", () => {
    renderDrawer(vi.fn(), CLIENTE_DO_MANAGER, CONTEXTO_MANAGER);

    expect(screen.getByLabelText("Nome")).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: /Apagar cliente/i })).toBeNull();
  });

  it("owner ve o botao — o positivo ao lado das duas negativas acima", () => {
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_OWNER);
    expect(screen.getByRole("button", { name: /Apagar cliente/i })).toBeInTheDocument();
  });
});

describe("vendas de origem (D-071)", () => {
  const COM_DUAS: ClienteListado = {
    ...CLIENTE,
    vendasDeOrigem: [
      { id: "venda-1", nome: "Acme site" },
      { id: "venda-2", nome: "Acme tráfego" },
    ],
  };

  it("mostra uma timeline por venda, com o nome de cada uma", async () => {
    const { useEventos } = await import("@/modules/pipeline/hooks/use-pipeline");
    renderDrawer(vi.fn(), COM_DUAS);

    expect(screen.getByText("Vendas de origem")).toBeInTheDocument();
    expect(screen.getByText("Acme site")).toBeInTheDocument();
    expect(screen.getByText("Acme tráfego")).toBeInTheDocument();
    expect(vi.mocked(useEventos)).toHaveBeenCalledWith("venda-1");
    expect(vi.mocked(useEventos)).toHaveBeenCalledWith("venda-2");
  });

  it("sem venda de origem, a seção não aparece", () => {
    renderDrawer(vi.fn(), CLIENTE);
    expect(screen.queryByText("Vendas de origem")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apagar cliente/i })).toBeInTheDocument();
  });

  it("🔴 a ficha não oferece mais Desfazer, Ligar nem Desligar, nem com venda", () => {
    renderDrawer(vi.fn(), COM_DUAS);
    expect(screen.queryByRole("button", { name: /desfazer fechamento/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /desligar/i })).toBeNull();
    expect(screen.queryByText("Oportunidade de origem")).toBeNull();
  });
});

describe("contratos da proposta a criar (D-064)", () => {
  it("owner vê a seção do cliente aberto", () => {
    propsDosContratosACriar.mockReset();
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_OWNER);
    expect(propsDosContratosACriar).toHaveBeenCalledWith({
      clienteId: CLIENTE.id,
      clienteNome: CLIENTE.nome,
      vendas: CLIENTE.vendasDeOrigem,
    });
  });

  it("manager não vê", () => {
    propsDosContratosACriar.mockReset();
    renderDrawer(vi.fn(), CLIENTE_DO_MANAGER, CONTEXTO_MANAGER);
    expect(propsDosContratosACriar).not.toHaveBeenCalled();
  });
});

describe("datas de pausa e encerramento (D-069, C8)", () => {
  const PAUSADO: ClienteListado = {
    ...CLIENTE,
    id: "cliente-pausado",
    status: "paused",
    pausadoEm: "2026-09-10",
  };
  const ENCERRADO: ClienteListado = {
    ...CLIENTE,
    id: "cliente-encerrado",
    status: "churned",
    encerradoEm: "2026-09-20",
  };

  beforeEach(() => {
    vi.mocked(corrigirDataDoStatus).mockReset();
    vi.mocked(corrigirDataDoStatus).mockResolvedValue(undefined);
    vi.mocked(listarCorrecoesDeData).mockReset();
    vi.mocked(listarCorrecoesDeData).mockResolvedValue([]);
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("owner corrige a data de pausa", async () => {
    renderDrawer(vi.fn(), PAUSADO, CONTEXTO_OWNER);
    const campo = screen.getByLabelText("Pausado em");
    fireEvent.change(campo, { target: { value: "2026-09-01" } });
    fireEvent.blur(campo);
    await waitFor(() =>
      expect(corrigirDataDoStatus).toHaveBeenCalledWith(
        "cliente-pausado",
        "paused_at",
        "2026-09-01",
      ),
    );
  });

  it("owner corrige a data de encerramento do cliente encerrado", async () => {
    renderDrawer(vi.fn(), ENCERRADO, CONTEXTO_OWNER);
    const campo = screen.getByLabelText("Encerrado em");
    fireEvent.change(campo, { target: { value: "2026-08-15" } });
    fireEvent.blur(campo);
    await waitFor(() =>
      expect(corrigirDataDoStatus).toHaveBeenCalledWith(
        "cliente-encerrado",
        "churned_at",
        "2026-08-15",
      ),
    );
  });

  it("🔴 R2: data no futuro avisa, não grava, e o campo volta à data do banco", () => {
    renderDrawer(vi.fn(), PAUSADO, CONTEXTO_OWNER);
    const campo = screen.getByLabelText("Pausado em");
    fireEvent.change(campo, { target: { value: "2100-01-01" } });
    expect(campo).toHaveValue("2100-01-01");
    fireEvent.blur(campo);
    expect(toast.error).toHaveBeenCalledWith("A data não pode ficar no futuro.");
    expect(corrigirDataDoStatus).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Pausado em")).toHaveValue("2026-09-10");
  });

  it("R2: campo apagado e ano pela metade avisam, não gravam, e voltam à data do banco", () => {
    renderDrawer(vi.fn(), PAUSADO, CONTEXTO_OWNER);

    fireEvent.change(screen.getByLabelText("Pausado em"), { target: { value: "" } });
    fireEvent.blur(screen.getByLabelText("Pausado em"));
    expect(toast.error).toHaveBeenLastCalledWith("A data não pode ficar vazia.");
    expect(screen.getByLabelText("Pausado em")).toHaveValue("2026-09-10");

    fireEvent.change(screen.getByLabelText("Pausado em"), { target: { value: "0002-09-01" } });
    fireEvent.blur(screen.getByLabelText("Pausado em"));
    expect(toast.error).toHaveBeenLastCalledWith("Data inválida. Use um ano entre 2000 e 2100.");
    expect(corrigirDataDoStatus).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Pausado em")).toHaveValue("2026-09-10");
  });

  it("🔴 R2: o campo de encerramento também volta à data do banco depois de uma recusa local", () => {
    renderDrawer(vi.fn(), ENCERRADO, CONTEXTO_OWNER);
    fireEvent.change(screen.getByLabelText("Encerrado em"), { target: { value: "2100-01-01" } });
    fireEvent.blur(screen.getByLabelText("Encerrado em"));
    expect(toast.error).toHaveBeenCalledWith("A data não pode ficar no futuro.");
    expect(screen.getByLabelText("Encerrado em")).toHaveValue("2026-09-20");
  });

  it("🔴 o futuro é o de São Paulo: às 22h de 07/10 lá (01h UTC de 08/10), 08/10 é futuro e 07/10 passa", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T01:00:00Z"));
    renderDrawer(vi.fn(), PAUSADO, CONTEXTO_OWNER);

    fireEvent.change(screen.getByLabelText("Pausado em"), { target: { value: "2026-10-08" } });
    fireEvent.blur(screen.getByLabelText("Pausado em"));
    expect(toast.error).toHaveBeenCalledWith("A data não pode ficar no futuro.");
    expect(corrigirDataDoStatus).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Pausado em"), { target: { value: "2026-10-07" } });
    fireEvent.blur(screen.getByLabelText("Pausado em"));
    await waitFor(() =>
      expect(corrigirDataDoStatus).toHaveBeenCalledWith(
        "cliente-pausado",
        "paused_at",
        "2026-10-07",
      ),
    );
  });

  it("manager dono do cliente vê a data, sem campo de edição", () => {
    renderDrawer(vi.fn(), { ...PAUSADO, responsavelId: "user-1" }, CONTEXTO_MANAGER);
    expect(screen.queryByLabelText("Pausado em")).not.toBeInTheDocument();
    expect(screen.getByText("Pausado em")).toBeInTheDocument();
    expect(screen.getByText("10/09/2026")).toBeInTheDocument();
  });

  it("manager dono do cliente encerrado também só lê a data de encerramento", () => {
    renderDrawer(vi.fn(), { ...ENCERRADO, responsavelId: "user-1" }, CONTEXTO_MANAGER);
    expect(screen.queryByLabelText("Encerrado em")).not.toBeInTheDocument();
    expect(screen.getByText("Encerrado em")).toBeInTheDocument();
    expect(screen.getByText("20/09/2026")).toBeInTheDocument();
  });

  it("controle: owner, mas o status não é o da data, vê só leitura (o gatilho recusaria)", () => {
    renderDrawer(
      vi.fn(),
      { ...CLIENTE, pausadoEm: "2026-09-10", encerradoEm: "2026-09-20" },
      CONTEXTO_OWNER,
    );
    expect(screen.queryByLabelText("Pausado em")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Encerrado em")).not.toBeInTheDocument();
    expect(screen.getByText("Pausado em")).toBeInTheDocument();
    expect(screen.getByText("Encerrado em")).toBeInTheDocument();
  });

  it("🔴 o campo fica travado enquanto grava e só solta depois que a releitura traz a data nova", async () => {
    let terminarAGravacao: () => void = () => {};
    vi.mocked(corrigirDataDoStatus).mockImplementation(
      () =>
        new Promise<void>((resolver) => {
          terminarAGravacao = resolver;
        }),
    );
    renderDrawer(vi.fn(), PAUSADO, CONTEXTO_OWNER);
    await waitFor(() => expect(listarCorrecoesDeData).toHaveBeenCalledTimes(1));
    let terminarARelitura: () => void = () => {};
    vi.mocked(listarCorrecoesDeData).mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          terminarARelitura = () => resolver([]);
        }),
    );

    const campo = screen.getByLabelText("Pausado em");
    fireEvent.change(campo, { target: { value: "2026-09-01" } });
    fireEvent.blur(campo);
    await waitFor(() => expect(screen.getByLabelText("Pausado em")).toBeDisabled());

    terminarAGravacao();
    await waitFor(() => expect(listarCorrecoesDeData).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Pausado em")).toBeDisabled();

    terminarARelitura();
    await waitFor(() => expect(screen.getByLabelText("Pausado em")).not.toBeDisabled());
    expect(screen.getByLabelText("Pausado em")).toHaveValue("2026-09-01");
  });

  it("🔴 R2: recusa do servidor vira um aviso com a frase dele, o campo solta e volta à data do banco", async () => {
    vi.mocked(corrigirDataDoStatus).mockRejectedValue(
      new Error("Só o owner corrige a data de pausa ou de encerramento."),
    );
    renderDrawer(vi.fn(), PAUSADO, CONTEXTO_OWNER);
    const campo = screen.getByLabelText("Pausado em");
    fireEvent.change(campo, { target: { value: "2026-09-01" } });
    expect(campo).toHaveValue("2026-09-01");
    fireEvent.blur(campo);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Só o owner corrige a data de pausa ou de encerramento.",
      ),
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByLabelText("Pausado em")).not.toBeDisabled());
    await waitFor(() => expect(screen.getByLabelText("Pausado em")).toHaveValue("2026-09-10"));
  });

  it("o rastro mostra a data anterior, a nova e quem corrigiu", async () => {
    vi.mocked(listarCorrecoesDeData).mockResolvedValue([
      {
        id: "r1",
        campo: "paused_at",
        antes: "2026-09-10",
        depois: "2026-09-01",
        corrigidoEm: "2026-10-07T13:00:00Z",
        autorNome: "Augusto",
      },
    ]);
    renderDrawer(vi.fn(), PAUSADO, CONTEXTO_OWNER);
    expect(
      await screen.findByText(
        "Data de pausa corrigida de 10/09/2026 para 01/09/2026, por Augusto em 07/10/2026, 10:00.",
      ),
    ).toBeInTheDocument();
    expect(listarCorrecoesDeData).toHaveBeenCalledWith("cliente-pausado");
  });

  it("🔴 R1: sem data anterior e sem autor, a frase não afirma o que não sabe (nem 'saiu da equipe')", async () => {
    vi.mocked(listarCorrecoesDeData).mockResolvedValue([
      {
        id: "r2",
        campo: "churned_at",
        antes: null,
        depois: "2026-08-15",
        corrigidoEm: "2026-10-07T13:00:00Z",
        autorNome: null,
      },
    ]);
    renderDrawer(vi.fn(), ENCERRADO, CONTEXTO_OWNER);
    expect(
      await screen.findByText(
        "Data de encerramento definida como 15/08/2026 (antes sem data), por autor não identificado em 07/10/2026, 10:00.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/saiu da equipe/)).not.toBeInTheDocument();
    expect(screen.queryByText(/corrigida de sem data/)).not.toBeInTheDocument();
  });

  it("R1: sem data anterior, com autor: só a parte da data muda", async () => {
    vi.mocked(listarCorrecoesDeData).mockResolvedValue([
      {
        id: "r4",
        campo: "paused_at",
        antes: null,
        depois: "2026-09-01",
        corrigidoEm: "2026-10-07T13:00:00Z",
        autorNome: "Augusto",
      },
    ]);
    renderDrawer(vi.fn(), PAUSADO, CONTEXTO_OWNER);
    expect(
      await screen.findByText(
        "Data de pausa definida como 01/09/2026 (antes sem data), por Augusto em 07/10/2026, 10:00.",
      ),
    ).toBeInTheDocument();
  });

  it("R1: com data anterior e sem autor: a frase de hoje, só com o autor não identificado", async () => {
    vi.mocked(listarCorrecoesDeData).mockResolvedValue([
      {
        id: "r5",
        campo: "paused_at",
        antes: "2026-09-10",
        depois: "2026-09-01",
        corrigidoEm: "2026-10-07T13:00:00Z",
        autorNome: null,
      },
    ]);
    renderDrawer(vi.fn(), PAUSADO, CONTEXTO_OWNER);
    expect(
      await screen.findByText(
        "Data de pausa corrigida de 10/09/2026 para 01/09/2026, por autor não identificado em 07/10/2026, 10:00.",
      ),
    ).toBeInTheDocument();
  });

  it("falha ao ler o rastro diz isso, em vez de mostrar a lista como se estivesse vazia", async () => {
    vi.mocked(listarCorrecoesDeData).mockRejectedValue(
      Object.assign(new Error("permission denied"), { code: CODIGO_SEM_PERMISSAO }),
    );
    renderDrawer(vi.fn(), PAUSADO, CONTEXTO_OWNER);
    expect(
      await screen.findByText("Não foi possível ler o histórico de correções de data."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Correções de data" })).not.toBeInTheDocument();
  });

  it("controle: sem correção nenhuma, a lista do rastro nem aparece", async () => {
    renderDrawer(vi.fn(), PAUSADO, CONTEXTO_OWNER);
    await waitFor(() => expect(listarCorrecoesDeData).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("list", { name: "Correções de data" })).not.toBeInTheDocument();
  });

  it("🔴 R3: cliente reativado (ativo) continua com o rastro legível, e sem campo de data", async () => {
    vi.mocked(listarCorrecoesDeData).mockResolvedValue([
      {
        id: "r6",
        campo: "paused_at",
        antes: "2026-09-10",
        depois: "2026-09-01",
        corrigidoEm: "2026-10-07T13:00:00Z",
        autorNome: "Augusto",
      },
    ]);
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_OWNER);
    expect(
      await screen.findByText(
        "Data de pausa corrigida de 10/09/2026 para 01/09/2026, por Augusto em 07/10/2026, 10:00.",
      ),
    ).toBeInTheDocument();
    expect(listarCorrecoesDeData).toHaveBeenCalledWith("cliente-1");
    expect(screen.queryByLabelText("Pausado em")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Encerrado em")).not.toBeInTheDocument();
  });

  it("R3: cliente ativo sem correção nenhuma não mostra a lista", async () => {
    renderDrawer(vi.fn(), CLIENTE, CONTEXTO_OWNER);
    await waitFor(() => expect(listarCorrecoesDeData).toHaveBeenCalledWith("cliente-1"));
    expect(screen.queryByRole("list", { name: "Correções de data" })).not.toBeInTheDocument();
  });

  describe("R4: só o owner edita a data (o positivo do owner está acima)", () => {
    const SEM_SESSAO: ContextoDeAcesso = { papel: null, usuarioId: null };

    it("member (sem permissão) vê a data de pausa, sem campo", () => {
      renderDrawer(vi.fn(), PAUSADO, CONTEXTO_SEM_PERMISSAO);
      expect(screen.queryByLabelText("Pausado em")).not.toBeInTheDocument();
      expect(screen.getByText("Pausado em")).toBeInTheDocument();
      expect(screen.getByText("10/09/2026")).toBeInTheDocument();
    });

    it("papel nulo (sessão carregando) vê a data de pausa, sem campo", () => {
      renderDrawer(vi.fn(), PAUSADO, SEM_SESSAO);
      expect(screen.queryByLabelText("Pausado em")).not.toBeInTheDocument();
      expect(screen.getByText("Pausado em")).toBeInTheDocument();
      expect(screen.getByText("10/09/2026")).toBeInTheDocument();
    });

    it("member e papel nulo veem a data de encerramento, sem campo", () => {
      const { unmount } = renderDrawer(vi.fn(), ENCERRADO, CONTEXTO_SEM_PERMISSAO);
      expect(screen.queryByLabelText("Encerrado em")).not.toBeInTheDocument();
      expect(screen.getByText("Encerrado em")).toBeInTheDocument();
      unmount();

      renderDrawer(vi.fn(), ENCERRADO, SEM_SESSAO);
      expect(screen.queryByLabelText("Encerrado em")).not.toBeInTheDocument();
      expect(screen.getByText("Encerrado em")).toBeInTheDocument();
    });
  });
});
