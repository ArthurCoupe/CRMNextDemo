import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PapelDoUsuario } from "@/hooks/use-profile";

import type { ContratoListado, PaginaDeContratos } from "../api/contracts.repository";

const consulta = {
  data: undefined as PaginaDeContratos | undefined,
  isPending: false,
  isError: false,
};

const perfil: { papel: PapelDoUsuario | null; carregando: boolean } = {
  papel: "owner",
  carregando: false,
};
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => perfil }));

vi.mock("../hooks/use-contracts", () => ({
  useContracts: () => consulta,
  useClientesParaSelecao: () => ({ data: [], isPending: false, isError: false }),
  useProdutosAtivos: () => ({ data: [], isPending: false, isError: false }),
  useSaveContract: () => ({ mutate: vi.fn(), isPending: false }),
}));
const propsDoFormulario = vi.fn();
vi.mock("./contract-form", () => ({
  ContractForm: (props: unknown) => {
    propsDoFormulario(props);
    return <div data-testid="contract-form" />;
  },
}));

const { ContractsPage } = await import("./contracts-page");

const CONTRATO: ContratoListado = {
  id: "c1",
  clienteId: "cli-1",
  nome: "Gestão de tráfego",
  tipo: "mrr",
  linhaDeNegocio: "demanda",
  valorMensal: 4500,
  valorTotal: null,
  mesesDeCobranca: null,
  cobrancaAtiva: true,
  firme: true,
  status: "active",
  nomeDoCliente: "Cliente Um",
  inicio: "2026-01-01",
  fim: null,
  meioDePagamento: "pix",
  parcelas: null,
  comissionavel: true,
  prazoDeEntrega: null,
  observacoes: null,
  itens: [{ frente: "trafego", produtoId: null, valor: 4500 }],
  duracaoMeses: null,
  mesesDeFidelidade: null,
  motivoDaPausa: null,
  oportunidadeId: null,
};

beforeEach(() => {
  propsDoFormulario.mockReset();
  consulta.data = undefined;
  consulta.isPending = false;
  consulta.isError = false;
  perfil.papel = "owner";
  perfil.carregando = false;
});

describe("ContractsPage — os três casos que colapsavam em um", () => {
  it("🔴 em ERRO não diz 'Nenhum contrato' e não oferece 'Novo contrato'", () => {
    consulta.isError = true;

    render(<ContractsPage />);

    expect(screen.queryByText("Nenhum contrato")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Novo contrato/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível ler a lista de contratos/)).toBeInTheDocument();
  });

  it("vazio genuíno continua dizendo 'Nenhum contrato' e oferecendo o cadastro", () => {
    consulta.data = { contratos: [], truncada: false };

    render(<ContractsPage />);

    expect(screen.getByText("Nenhum contrato")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Novo contrato/ }).length).toBeGreaterThan(0);
  });

  it("carregando não afirma nem erro nem vazio", () => {
    consulta.isPending = true;

    render(<ContractsPage />);

    expect(screen.queryByText("Nenhum contrato")).not.toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível ler/)).not.toBeInTheDocument();
  });

  it("🔴 o formulário NÃO desmonta quando a lista entra em erro", () => {
    consulta.data = { contratos: [CONTRATO], truncada: false };
    const { rerender } = render(<ContractsPage />);
    expect(screen.getByTestId("contract-form")).toBeInTheDocument();

    consulta.isError = true;
    rerender(<ContractsPage />);

    expect(screen.getByTestId("contract-form")).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível ler a lista de contratos/)).toBeInTheDocument();
  });

  it("pronto com dado lista o contrato", () => {
    consulta.data = { contratos: [CONTRATO], truncada: false };

    render(<ContractsPage />);

    expect(screen.getByText("Cliente Um")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum contrato")).not.toBeInTheDocument();
  });

  it("filtro que não casa nada segue distinto do vazio — e sem botão de criar", async () => {
    consulta.data = { contratos: [CONTRATO], truncada: false };
    const user = userEvent.setup();

    render(<ContractsPage />);

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "Sistemas" }));

    expect(screen.getByText("Nenhum contrato nesses filtros")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum contrato")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Novo contrato/ })).toHaveLength(1);
  });

  it("lista truncada avisa que há contrato fora da tabela", () => {
    consulta.data = { contratos: [CONTRATO], truncada: true };

    render(<ContractsPage />);

    expect(screen.getByText(/teto de leitura/)).toBeInTheDocument();
    expect(screen.getByText("Cliente Um")).toBeInTheDocument();
  });

  it("lista completa não inventa aviso de teto", () => {
    consulta.data = { contratos: [CONTRATO], truncada: false };

    render(<ContractsPage />);

    expect(screen.queryByText(/teto de leitura/)).not.toBeInTheDocument();
  });

  it("🔴 em ERRO o aviso de teto some — no erro a tabela não afirma nada", () => {
    consulta.data = { contratos: [CONTRATO], truncada: true };
    consulta.isError = true;

    render(<ContractsPage />);

    expect(screen.queryByText(/teto de leitura/)).not.toBeInTheDocument();
  });
});

describe("ContractsPage — quem o banco vai recusar não recebe a oferta", () => {
  it("owner vê 'Novo contrato' e o botão de editar", () => {
    perfil.papel = "owner";
    consulta.data = { contratos: [CONTRATO], truncada: false };

    render(<ContractsPage />);

    expect(screen.getByRole("button", { name: /Novo contrato/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Gestão de tráfego" })).toBeInTheDocument();
    expect(screen.queryByText(/criar e editar contrato é do/)).not.toBeInTheDocument();
  });

  it("manager não vê a ação, e vê a explicação no lugar", () => {
    perfil.papel = "manager";
    consulta.data = { contratos: [CONTRATO], truncada: false };

    render(<ContractsPage />);

    expect(screen.queryByRole("button", { name: /Novo contrato/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar Gestão de tráfego" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/criar e editar contrato é do/)).toBeInTheDocument();
    expect(screen.getByText("Cliente Um")).toBeInTheDocument();
  });

  it("papel null enquanto o perfil carrega: a ação é oferecida, e a tela não afirma nada", () => {
    perfil.papel = null;
    perfil.carregando = true;
    consulta.data = { contratos: [CONTRATO], truncada: false };

    render(<ContractsPage />);

    expect(screen.getByRole("button", { name: /Novo contrato/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Gestão de tráfego" })).toBeInTheDocument();
    expect(screen.queryByText(/criar e editar contrato é do/)).not.toBeInTheDocument();
  });

  it("papel null porque a leitura do perfil falhou: o owner NÃO perde a ação", () => {
    perfil.papel = null;
    perfil.carregando = false;
    consulta.data = { contratos: [CONTRATO], truncada: false };

    render(<ContractsPage />);

    expect(screen.getByRole("button", { name: /Novo contrato/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Gestão de tráfego" })).toBeInTheDocument();
    expect(screen.queryByText(/criar e editar contrato é do/)).not.toBeInTheDocument();
  });

  it("manager em lista vazia não é convidado a 'criar o primeiro'", () => {
    perfil.papel = "manager";
    consulta.data = { contratos: [], truncada: false };

    render(<ContractsPage />);

    expect(screen.getByText("Nenhum contrato")).toBeInTheDocument();
    expect(screen.getByText("Nenhum contrato dos clientes da sua carteira.")).toBeInTheDocument();
    expect(screen.queryByText(/Crie o primeiro/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Novo contrato/ })).not.toBeInTheDocument();
  });

  it("🔴 papel null em lista vazia não entrega a frase do manager a quem talvez seja owner", () => {
    perfil.papel = null;
    consulta.data = { contratos: [], truncada: false };

    render(<ContractsPage />);

    expect(screen.getByText("Nenhum contrato")).toBeInTheDocument();
    expect(screen.getByText("Crie o primeiro em Novo contrato.")).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhum contrato dos clientes da sua carteira."),
    ).not.toBeInTheDocument();
  });
});

describe("ContractsPage — apagar contrato segue a mesma oferta de escrita", () => {
  const ultimasProps = () =>
    propsDoFormulario.mock.calls.at(-1)?.[0] as { podeApagar?: boolean } | undefined;

  it("owner: o formulário recebe podeApagar", () => {
    perfil.papel = "owner";
    consulta.data = { contratos: [CONTRATO], truncada: false };

    render(<ContractsPage />);

    expect(ultimasProps()?.podeApagar).toBe(true);
  });

  it("🔴 manager: o formulário não oferece apagar", () => {
    perfil.papel = "manager";
    consulta.data = { contratos: [CONTRATO], truncada: false };

    render(<ContractsPage />);

    expect(ultimasProps()?.podeApagar).toBe(false);
  });
});

describe("filtro por cliente (D-069, C2)", () => {
  const OUTRO: ContratoListado = {
    ...CONTRATO,
    id: "c2",
    clienteId: "cli-2",
    nome: "Site institucional",
    nomeDoCliente: "Cliente Dois",
  };

  beforeEach(() => {
    consulta.data = { contratos: [CONTRATO, OUTRO], truncada: false };
  });

  it("com clienteId, lista só os contratos dele e oferece Ver todos", async () => {
    const user = userEvent.setup();
    const aoVerTodos = vi.fn();
    render(<ContractsPage clienteId="cli-1" aoVerTodos={aoVerTodos} />);

    expect(screen.getByText("Gestão de tráfego")).toBeInTheDocument();
    expect(screen.queryByText("Site institucional")).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando só os contratos de Cliente Um\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver todos" }));
    expect(aoVerTodos).toHaveBeenCalledTimes(1);
  });

  it("cliente sem contrato visível: aviso genérico, estado vazio e Ver todos como saída", async () => {
    const user = userEvent.setup();
    const aoVerTodos = vi.fn();
    render(<ContractsPage clienteId="cli-sem-contrato" aoVerTodos={aoVerTodos} />);

    expect(screen.getByText(/Mostrando só os contratos de um cliente\./)).toBeInTheDocument();
    expect(screen.getByText("Nenhum contrato nesses filtros")).toBeInTheDocument();
    expect(screen.queryByText("Gestão de tráfego")).not.toBeInTheDocument();
    expect(screen.queryByText("Site institucional")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver todos" }));
    expect(aoVerTodos).toHaveBeenCalledTimes(1);
  });

  it("🔴 em ERRO de leitura o aviso some e a falha de leitura aparece", () => {
    consulta.isError = true;

    render(<ContractsPage clienteId="cli-1" aoVerTodos={vi.fn()} />);

    expect(screen.queryByText(/Mostrando só os contratos/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver todos" })).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível ler a lista de contratos/)).toBeInTheDocument();
  });

  it("controle: sem clienteId, os dois aparecem e não há aviso", () => {
    render(<ContractsPage />);
    expect(screen.getByText("Gestão de tráfego")).toBeInTheDocument();
    expect(screen.getByText("Site institucional")).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando só os contratos/)).not.toBeInTheDocument();
  });
});
