import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";

import type {
  ClienteListado,
  PaginaDeClientes,
  ResponsavelDeCliente,
} from "../api/clients.repository";
import type { ContextoDeAcesso } from "../domain/access";
import type { GanhaSemContrato } from "../domain/vinculo";
import { useClients, useGanhasSemContrato, useResponsaveisPossiveis } from "../hooks/use-clients";
import { useEventos } from "@/modules/pipeline/hooks/use-pipeline";
import { ClientDrawer } from "./client-drawer";
import { ClientsPage } from "./clients-page";

const perfil = { papel: "owner" as string };
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => perfil,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/modules/pipeline/hooks/use-pipeline", () => ({
  useEventos: vi.fn(),
}));

vi.mock("@/modules/proposals/ui/contratos-da-proposta-a-criar", () => ({
  ContratosDaPropostaACriar: () => null,
}));

const { propsDoContrato } = vi.hoisted(() => ({ propsDoContrato: vi.fn() }));
vi.mock("@/modules/contracts/ui/contract-form", () => ({
  ContractForm: (props: { aberto: boolean }) => {
    propsDoContrato(props);
    return null;
  },
}));

vi.mock("../hooks/use-clients", () => {
  const mutacaoInerte = { mutate: () => {}, isPending: false };
  return {
    useClients: vi.fn(),
    useResponsaveisPossiveis: vi.fn(),
    useDefinirResponsavel: () => mutacaoInerte,
    useDefinirPastaDoDrive: () => mutacaoInerte,
    useDefinirConfidencialidade: () => mutacaoInerte,
    useAtualizarDadosDoCliente: () => mutacaoInerte,
    useDefinirStatusDoCliente: () => mutacaoInerte,
    useDefinirAssinatura: () => mutacaoInerte,
    useCorrigirDataDoStatus: () => mutacaoInerte,
    useCorrecoesDeData: () => ({ data: [], isPending: false, isError: false }),
    useApagarCliente: () => mutacaoInerte,
    useDesfazerFechamento: () => mutacaoInerte,
    useCriarCliente: () => mutacaoInerte,
    useGanhasSemContrato: vi.fn(),
  };
});

function consultaFalsa<T>(
  estado: "erro" | "carregando" | "pronto",
  data?: T,
): UseQueryResult<T, Error> {
  return {
    isError: estado === "erro",
    isPending: estado === "carregando",
    isPlaceholderData: false,
    data: estado === "pronto" ? data : undefined,
  } as unknown as UseQueryResult<T, Error>;
}

const PAGINA_VAZIA: PaginaDeClientes = {
  clientes: [],
  total: 0,
  pagina: 1,
  totalDePaginas: 1,
};

const SEM_RESPONSAVEIS: ResponsavelDeCliente[] = [];

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
  vendasDeOrigem: [{ id: "oportunidade-1", nome: "Acme" }],
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

const CONTEXTO_OWNER: ContextoDeAcesso = { papel: "owner", usuarioId: "user-1" };

beforeEach(() => {
  vi.resetAllMocks();
  perfil.papel = "owner";
  vi.mocked(useResponsaveisPossiveis).mockReturnValue(
    consultaFalsa<ResponsavelDeCliente[]>("pronto", SEM_RESPONSAVEIS),
  );
  vi.mocked(useEventos).mockReturnValue(consultaFalsa("pronto", []));
  vi.mocked(useGanhasSemContrato).mockReturnValue(consultaFalsa<GanhaSemContrato[]>("pronto", []));
});

describe("ClientsPage — erro antes de vazio", () => {
  it("consulta em erro NÃO afirma que não há cliente", () => {
    vi.mocked(useClients).mockReturnValue(consultaFalsa<PaginaDeClientes>("erro"));

    render(<ClientsPage />);

    expect(screen.getByText(/Não foi possível ler a lista de clientes/)).toBeInTheDocument();
    expect(screen.queryByText("Nenhum cliente encontrado")).not.toBeInTheDocument();
  });

  it("consulta pronta e sem linhas continua afirmando que não há cliente", () => {
    vi.mocked(useClients).mockReturnValue(consultaFalsa<PaginaDeClientes>("pronto", PAGINA_VAZIA));

    render(<ClientsPage />);

    expect(screen.getByText("Nenhum cliente encontrado")).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível ler a lista de clientes/)).not.toBeInTheDocument();
  });

  it("consulta carregando não mostra nem a falha nem o vazio", () => {
    vi.mocked(useClients).mockReturnValue(consultaFalsa<PaginaDeClientes>("carregando"));

    render(<ClientsPage />);

    expect(screen.getByText("Carregando clientes…")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum cliente encontrado")).not.toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível ler a lista de clientes/)).not.toBeInTheDocument();
  });

  it("falha só na lista de responsáveis avisa, sem derrubar a lista de clientes", () => {
    vi.mocked(useClients).mockReturnValue(consultaFalsa<PaginaDeClientes>("pronto", PAGINA_VAZIA));
    vi.mocked(useResponsaveisPossiveis).mockReturnValue(
      consultaFalsa<ResponsavelDeCliente[]>("erro"),
    );

    render(<ClientsPage />);

    expect(screen.getByText("Lista de responsáveis indisponível")).toBeInTheDocument();
    expect(screen.getByText("Nenhum cliente encontrado")).toBeInTheDocument();
  });
});

describe("ClientsPage — botão Novo cliente segue o papel, não só a RLS", () => {
  it("🔴 member NÃO vê o botão Novo cliente", () => {
    perfil.papel = "member";
    vi.mocked(useClients).mockReturnValue(consultaFalsa<PaginaDeClientes>("pronto", PAGINA_VAZIA));

    render(<ClientsPage />);

    expect(screen.queryByRole("button", { name: /Novo cliente/i })).not.toBeInTheDocument();
  });

  it("owner vê o botão Novo cliente", () => {
    vi.mocked(useClients).mockReturnValue(consultaFalsa<PaginaDeClientes>("pronto", PAGINA_VAZIA));

    render(<ClientsPage />);

    expect(screen.getByRole("button", { name: /Novo cliente/i })).toBeInTheDocument();
  });
});

describe("ClientDrawer — erro antes de vazio, por seção", () => {
  function abrirFicha() {
    render(<ClientDrawer cliente={CLIENTE} contexto={CONTEXTO_OWNER} aoFechar={vi.fn()} />);
  }

  it("timeline em erro NÃO afirma que a oportunidade não teve evento", () => {
    vi.mocked(useEventos).mockReturnValue(consultaFalsa("erro"));

    abrirFicha();

    expect(screen.getByText(/Não foi possível ler a timeline da venda/)).toBeInTheDocument();
    expect(screen.queryByText("Nenhum evento ainda")).not.toBeInTheDocument();
  });

  it("timeline pronta e sem eventos continua afirmando que não houve evento", () => {
    vi.mocked(useEventos).mockReturnValue(consultaFalsa("pronto", []));

    abrirFicha();

    expect(screen.getByText("Nenhum evento ainda")).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível ler a timeline da venda/)).not.toBeInTheDocument();
  });

  it("lista de responsáveis em erro avisa e trava o seletor", () => {
    vi.mocked(useResponsaveisPossiveis).mockReturnValue(
      consultaFalsa<ResponsavelDeCliente[]>("erro"),
    );

    abrirFicha();

    expect(
      screen.getByText(/Não foi possível ler a lista de quem pode ser responsável/),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Responsável/i })).toBeDisabled();
  });

  it("lista de responsáveis pronta deixa o seletor utilizável", () => {
    abrirFicha();

    expect(screen.getByRole("combobox", { name: /Responsável/i })).not.toBeDisabled();
    expect(
      screen.queryByText(/Não foi possível ler a lista de quem pode ser responsável/),
    ).not.toBeInTheDocument();
  });
});

describe("ClientsPage — ganhas esperando contrato (D-071)", () => {
  function ganha(id: string, nome: string): GanhaSemContrato {
    return {
      id,
      nome,
      contatoNome: null,
      contatoEmail: null,
      contatoTelefone: null,
      segmento: null,
      nicho: null,
      ganhaEm: "2026-10-06T15:00:00Z",
    };
  }

  function comGanhas(lista: GanhaSemContrato[]) {
    vi.mocked(useGanhasSemContrato).mockReturnValue(
      consultaFalsa<GanhaSemContrato[]>("pronto", lista),
    );
    vi.mocked(useClients).mockReturnValue(consultaFalsa<PaginaDeClientes>("pronto", PAGINA_VAZIA));
  }

  it("owner com pendências vê quantas e o atalho para cadastrar", () => {
    comGanhas([ganha("opp-1", "Acme"), ganha("opp-2", "Beta")]);

    render(<ClientsPage />);

    expect(screen.getByText("2 ganhas esperando contrato.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar contrato" })).toBeInTheDocument();
  });

  it("uma pendência fica no singular", () => {
    comGanhas([ganha("opp-1", "Acme")]);

    render(<ClientsPage />);

    expect(screen.getByText("1 ganha esperando contrato.")).toBeInTheDocument();
  });

  it("sem pendência, nenhum aviso", () => {
    comGanhas([]);

    render(<ClientsPage />);

    expect(screen.queryByText(/esperando contrato/)).toBeNull();
  });

  it("🔴 member não vê o aviso, e a lista nem é pedida para ele", () => {
    perfil.papel = "member";
    comGanhas([ganha("opp-1", "Acme")]);

    render(<ClientsPage />);

    expect(screen.queryByText(/esperando contrato/)).toBeNull();
    expect(vi.mocked(useGanhasSemContrato).mock.calls.every(([habilitado]) => !habilitado)).toBe(
      true,
    );
  });

  it("owner: a leitura das ganhas falhou e a tela diz isso, em vez de sumir com o aviso", () => {
    vi.mocked(useGanhasSemContrato).mockReturnValue(consultaFalsa<GanhaSemContrato[]>("erro"));
    vi.mocked(useClients).mockReturnValue(consultaFalsa<PaginaDeClientes>("pronto", PAGINA_VAZIA));

    render(<ClientsPage />);

    expect(
      screen.getByText("Não foi possível ler as ganhas esperando contrato."),
    ).toBeInTheDocument();
  });

  it("Cadastrar contrato abre o Novo contrato com a ganha mais antiga escolhida", async () => {
    comGanhas([ganha("opp-velha", "Antiga"), ganha("opp-nova", "Nova")]);
    render(<ClientsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar contrato" }));

    await waitFor(() =>
      expect(propsDoContrato).toHaveBeenLastCalledWith(
        expect.objectContaining({
          aberto: true,
          preEscolha: { clienteId: null, vendaId: "opp-velha" },
        }),
      ),
    );
  });
});
