import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContratoParaLigar } from "@/modules/contracts/api/contracts.repository";
import type { OportunidadeListada } from "@/modules/pipeline/api/pipeline.repository";
import { brl } from "@/shared/lib/format";

import type { PropostaListada } from "../api/proposals.repository";
import type { ItemDaProposta } from "../domain/grupos";

const propsDoCliente = vi.fn();
const propsDoCadastro = vi.fn();
vi.mock("./cliente-da-proposta", () => ({
  ClienteDaProposta: (props: unknown) => {
    propsDoCliente(props);
    return null;
  },
}));
vi.mock("@/modules/contracts/ui/contract-form", () => ({
  ContractForm: (props: unknown) => {
    propsDoCadastro(props);
    return null;
  },
}));

type Produto = { id: string; frente: string; preco: number; frentesDoCombo: string[] | null };
let catalogo: Produto[];
let contratosDoCliente: ContratoParaLigar[] | undefined;
let contratosComErro: boolean;
let contratosAtualizando: boolean;
vi.mock("@/modules/contracts/hooks/use-contracts", () => ({
  useProdutosAtivos: () => ({ data: catalogo, isError: false, isPending: false }),
  useContratosDoCliente: (clienteId: string | null) => ({
    data: clienteId === null ? undefined : contratosDoCliente,
    isError: clienteId !== null && contratosComErro,
    isPending: false,
    isFetching: contratosAtualizando,
  }),
}));

let itens: ItemDaProposta[] | undefined;
let itensComErro: boolean;
const mutate = vi.fn();
vi.mock("../hooks/use-proposals", () => ({
  useItensDaProposta: (id: string | null) => ({
    data: id === null ? undefined : itens,
    isError: itensComErro,
    isPending: false,
  }),
  useRegistrarContratoDaProposta: () => ({ mutate, isPending: false }),
}));

const { AceiteDaProposta } = await import("./aceite-da-proposta");

const OPORTUNIDADE = { id: "o1", nome: "Acme" } as unknown as OportunidadeListada;

const PROPOSTA = {
  id: "p1",
  numero: 7,
  versao: 1,
  status: "enviada",
  validaAte: "2026-10-19",
  escopo: null,
  prazoEntregaDias: 30,
  formaPagamento: "pix",
  parcelasProjeto: 3,
  fidelidadeMeses: 12,
  enviadaEm: "2026-10-04T15:00:00Z",
  aceitaEm: null,
  recusadaEm: null,
  criadaEm: "2026-10-04T14:00:00Z",
  totalMensal: 3000,
  totalProjeto: 4500,
  vencida: false,
  ultima: true,
  clienteId: null,
} satisfies PropostaListada;

const COM_CLIENTE = { ...PROPOSTA, clienteId: "c1" };

function item(parcial: Partial<ItemDaProposta> & Pick<ItemDaProposta, "id">): ItemDaProposta {
  return {
    produtoId: "tra",
    nome: "Tráfego",
    descricao: null,
    frente: "trafego",
    frentesDoCombo: null,
    linhaDeNegocio: "demanda",
    tipo: "mrr",
    precoCatalogo: 797,
    valor: 797,
    ordem: 1,
    contratoId: null,
    ...parcial,
  };
}

const COMBO = item({
  id: "combo",
  produtoId: "combo-3",
  nome: "Combo 3 Frentes",
  frente: "posicionamento",
  frentesDoCombo: ["posicionamento", "trafego", "comercial"],
  precoCatalogo: 3193,
  valor: 3000,
});
const SISTEMA = item({
  id: "s",
  produtoId: "sis",
  nome: "Sistema",
  frente: "sistemas",
  linhaDeNegocio: "sistemas",
  tipo: "tcv",
  precoCatalogo: 5000,
  valor: 4500,
  ordem: 2,
});

const DEMANDA_MENSAL: ContratoParaLigar = {
  id: "k5",
  nome: "Acme · Demanda mensal",
  tipo: "mrr",
  linhaDeNegocio: "demanda",
  valorMensal: 3000,
  valorTotal: null,
  oportunidadeId: null,
};
const DEMANDA_PROJETO: ContratoParaLigar = {
  id: "k6",
  nome: "Acme · Site",
  tipo: "tcv",
  linhaDeNegocio: "demanda",
  valorMensal: null,
  valorTotal: 8000,
  oportunidadeId: null,
};
const SISTEMAS_MENSAL: ContratoParaLigar = {
  id: "k7",
  nome: "Acme · Suporte",
  tipo: "mrr",
  linhaDeNegocio: "sistemas",
  valorMensal: 900,
  valorTotal: null,
  oportunidadeId: null,
};

function ultimas(espiao: ReturnType<typeof vi.fn>) {
  return espiao.mock.calls[espiao.mock.calls.length - 1]?.[0] as
    Record<string, unknown> | undefined;
}

beforeEach(() => {
  propsDoCliente.mockReset();
  propsDoCadastro.mockReset();
  mutate.mockReset();
  catalogo = [
    { id: "pos", frente: "posicionamento", preco: 1197, frentesDoCombo: null },
    { id: "tra", frente: "trafego", preco: 797, frentesDoCombo: null },
    { id: "com", frente: "comercial", preco: 1197, frentesDoCombo: null },
  ];
  itens = [SISTEMA, COMBO];
  itensComErro = false;
  contratosDoCliente = [];
  contratosComErro = false;
  contratosAtualizando = false;
});

describe("AceiteDaProposta", () => {
  it("fechada (proposta null): nada abre", () => {
    render(<AceiteDaProposta proposta={null} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />);
    expect(propsDoCliente).not.toHaveBeenCalled();
    expect(propsDoCadastro).not.toHaveBeenCalled();
  });

  it("todos os itens já ligados (aceita noutra aba): avisa que não há item pendente, e nada abre", () => {
    itens = [
      { ...SISTEMA, contratoId: "k9" },
      { ...COMBO, contratoId: "k9" },
    ];
    render(<AceiteDaProposta proposta={PROPOSTA} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />);
    expect(
      screen.getByText("Esta proposta não tem item pendente para virar contrato."),
    ).toBeInTheDocument();
    expect(propsDoCliente).not.toHaveBeenCalled();
    expect(propsDoCadastro).not.toHaveBeenCalled();
  });

  it("sem cliente: oferece cadastrar o cliente da oportunidade, e o contrato ainda não abre", () => {
    render(<AceiteDaProposta proposta={PROPOSTA} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />);
    expect(ultimas(propsDoCliente)?.oportunidade).toBe(OPORTUNIDADE);
    expect(propsDoCadastro).not.toHaveBeenCalled();
  });

  it("🔴 cliente escolhido ali (existente ou novo): segue para o contrato do PRIMEIRO grupo, com a venda travada", () => {
    render(<AceiteDaProposta proposta={PROPOSTA} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />);
    const aoClienteEscolhido = ultimas(propsDoCliente)?.aoClienteEscolhido as (id: string) => void;

    act(() => aoClienteEscolhido("c9"));

    const props = ultimas(propsDoCadastro);
    expect(props?.aberto).toBe(true);
    expect(props?.inicial).toMatchObject({
      clienteId: "c9",
      venda: { id: "o1", nome: "Acme" },
      contrato: {
        nome: "Acme · Demanda mensal",
        tipo: "mrr",
        linhaDeNegocio: "demanda",
        valor: 3000,
        mesesDeFidelidade: 12,
        meioDePagamento: "pix",
      },
    });

    (props?.aoContratoCriado as (id: string) => void)("k1");
    expect(mutate).toHaveBeenCalledWith({ propostaId: "p1", contratoId: "k1" });
  });

  it("Cancelar no cadastro do cliente fecha o aceite", () => {
    const aoFechar = vi.fn();
    render(
      <AceiteDaProposta proposta={PROPOSTA} oportunidade={OPORTUNIDADE} aoFechar={aoFechar} />,
    );

    act(() => (ultimas(propsDoCliente)?.aoFechar as () => void)());

    expect(aoFechar).toHaveBeenCalled();
  });

  it("com cliente e sem contrato do mesmo tipo e linha: cadastro direto, com o cliente da oportunidade", () => {
    contratosDoCliente = [DEMANDA_PROJETO, SISTEMAS_MENSAL];
    render(
      <AceiteDaProposta proposta={COM_CLIENTE} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />,
    );
    const props = ultimas(propsDoCadastro);
    expect(props?.aberto).toBe(true);
    expect(props?.inicial).toMatchObject({
      clienteId: "c1",
      venda: { id: "o1", nome: "Acme" },
      contrato: { nome: "Acme · Demanda mensal" },
    });
    expect(propsDoCliente).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Ligar este contrato à proposta" }),
    ).not.toBeInTheDocument();

    (props?.aoContratoCriado as (id: string) => void)("k2");
    expect(mutate).toHaveBeenCalledWith({ propostaId: "p1", contratoId: "k2" });
  });

  it("com cliente que já tem o contrato (card arrastado para Fechado): oferece ligar, e o cadastro não abre", () => {
    contratosDoCliente = [DEMANDA_PROJETO, DEMANDA_MENSAL, SISTEMAS_MENSAL];
    const aoFechar = vi.fn();
    render(
      <AceiteDaProposta proposta={COM_CLIENTE} oportunidade={OPORTUNIDADE} aoFechar={aoFechar} />,
    );
    expect(propsDoCadastro).not.toHaveBeenCalled();
    expect(screen.queryByText("Acme · Site")).not.toBeInTheDocument();
    expect(screen.queryByText("Acme · Suporte")).not.toBeInTheDocument();
    const linha = screen.getByText("Acme · Demanda mensal").closest("li");
    expect(linha).not.toBeNull();
    expect(within(linha as HTMLElement).getByText("Demanda mensal")).toBeInTheDocument();
    expect(linha?.textContent).toContain(brl(3000));

    fireEvent.click(screen.getByRole("button", { name: "Ligar este contrato à proposta" }));

    expect(mutate).toHaveBeenCalledWith({ propostaId: "p1", contratoId: "k5" });
    expect(aoFechar).toHaveBeenCalled();
    expect(propsDoCadastro).not.toHaveBeenCalled();
  });

  it("🔴 contrato de outra venda não é oferecido; o desta venda, sim", () => {
    contratosDoCliente = [
      { ...DEMANDA_MENSAL, id: "k-outra", nome: "Acme · Outra venda", oportunidadeId: "o2" },
      { ...DEMANDA_MENSAL, id: "k-esta", nome: "Acme · Esta venda", oportunidadeId: "o1" },
    ];
    render(
      <AceiteDaProposta proposta={COM_CLIENTE} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />,
    );

    expect(screen.queryByText("Acme · Outra venda")).toBeNull();
    expect(screen.getByText("Acme · Esta venda")).toBeInTheDocument();
    expect(propsDoCadastro).not.toHaveBeenCalled();
  });

  it("só contrato de outra venda: cadastro direto, com a venda desta proposta", () => {
    contratosDoCliente = [{ ...DEMANDA_MENSAL, oportunidadeId: "o2" }];
    render(
      <AceiteDaProposta proposta={COM_CLIENTE} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />,
    );

    expect(screen.queryByRole("button", { name: "Ligar este contrato à proposta" })).toBeNull();
    expect(ultimas(propsDoCadastro)?.inicial).toMatchObject({
      clienteId: "c1",
      venda: { id: "o1", nome: "Acme" },
    });
  });

  it("'Criar outro contrato' abre o cadastro com o primeiro grupo, e fechar volta a oferecer a ligação na próxima vez", () => {
    contratosDoCliente = [DEMANDA_MENSAL];
    const aoFechar = vi.fn();
    const { rerender } = render(
      <AceiteDaProposta proposta={COM_CLIENTE} oportunidade={OPORTUNIDADE} aoFechar={aoFechar} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Criar outro contrato" }));

    const props = ultimas(propsDoCadastro);
    expect(props?.aberto).toBe(true);
    expect(props?.inicial).toMatchObject({
      clienteId: "c1",
      contrato: { nome: "Acme · Demanda mensal" },
    });
    expect(mutate).not.toHaveBeenCalled();

    (props?.aoFechar as () => void)();
    expect(aoFechar).toHaveBeenCalled();
    rerender(<AceiteDaProposta proposta={null} oportunidade={OPORTUNIDADE} aoFechar={aoFechar} />);
    propsDoCadastro.mockReset();
    rerender(
      <AceiteDaProposta proposta={COM_CLIENTE} oportunidade={OPORTUNIDADE} aoFechar={aoFechar} />,
    );
    expect(
      screen.getByRole("button", { name: "Ligar este contrato à proposta" }),
    ).toBeInTheDocument();
    expect(propsDoCadastro).not.toHaveBeenCalled();
  });

  it("lista de contratos recarregando: 'Ligar' espera a lista nova (a do cache pode trazer contrato já ligado)", () => {
    contratosDoCliente = [DEMANDA_MENSAL];
    contratosAtualizando = true;
    render(
      <AceiteDaProposta proposta={COM_CLIENTE} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Ligar este contrato à proposta" })).toBeDisabled();
  });

  it("'Cancelar' fecha sem ligar nem abrir o cadastro", () => {
    contratosDoCliente = [DEMANDA_MENSAL];
    const aoFechar = vi.fn();
    render(
      <AceiteDaProposta proposta={COM_CLIENTE} oportunidade={OPORTUNIDADE} aoFechar={aoFechar} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(aoFechar).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
    expect(propsDoCadastro).not.toHaveBeenCalled();
  });

  it("contratos do cliente sem leitura: diz que não leu, e o cadastro não abre", () => {
    contratosDoCliente = undefined;
    contratosComErro = true;
    render(
      <AceiteDaProposta proposta={COM_CLIENTE} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />,
    );
    expect(screen.getByText(/Não foi possível ler os contratos do cliente/)).toBeInTheDocument();
    expect(propsDoCadastro).not.toHaveBeenCalled();
  });

  it("refetch dos itens que falha com dado na mão mantém o fechamento montado", () => {
    itensComErro = true;
    render(<AceiteDaProposta proposta={PROPOSTA} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />);
    expect(propsDoCliente).toHaveBeenCalled();
    expect(screen.queryByText(/Não foi possível ler/)).not.toBeInTheDocument();
  });

  it("erro de leitura sem dado diz que não leu, e nada abre", () => {
    itens = undefined;
    itensComErro = true;
    render(<AceiteDaProposta proposta={PROPOSTA} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />);
    expect(
      screen.getByText(/Não foi possível ler os itens da proposta ou o catálogo/),
    ).toBeInTheDocument();
    expect(propsDoCliente).not.toHaveBeenCalled();
  });

  it("Review Focus 4: sem o avulso de Tráfego, o combo chega zerado e nomeia a frente", () => {
    catalogo = catalogo.filter((p) => p.frente !== "trafego");
    render(
      <AceiteDaProposta proposta={COM_CLIENTE} oportunidade={OPORTUNIDADE} aoFechar={vi.fn()} />,
    );
    expect(ultimas(propsDoCadastro)?.inicial).toMatchObject({
      contrato: { valor: 3000, frentesSemPreco: ["trafego"] },
    });
  });
});
