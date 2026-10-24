import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContratoACriar } from "../api/proposals.repository";
import type { ItemDaProposta } from "../domain/grupos";

const propsDoCadastro = vi.fn();
vi.mock("@/modules/contracts/ui/contract-form", () => ({
  ContractForm: (props: unknown) => {
    propsDoCadastro(props);
    return null;
  },
}));
let catalogo: { data: [] | undefined; isError: boolean };
vi.mock("@/modules/contracts/hooks/use-contracts", () => ({
  useProdutosAtivos: () => ({ ...catalogo, isPending: false }),
}));
vi.mock("../api/proposals.repository", () => ({ registrarContratoDaProposta: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let aCriar: {
  data: ContratoACriar[] | undefined;
  isError: boolean;
  error: Error | null;
  isFetching: boolean;
};
let itens: ItemDaProposta[] | undefined;
let itensComErro: boolean;
let itensAtualizando: boolean;
vi.mock("../hooks/use-proposals", async () => {
  const real =
    await vi.importActual<typeof import("../hooks/use-proposals")>("../hooks/use-proposals");
  return {
    ...real,
    useContratosACriar: () => aCriar,
    useItensDaProposta: () => ({
      data: itens,
      isError: itensComErro,
      isPending: false,
      isFetching: itensAtualizando,
    }),
  };
});

const repo = await import("../api/proposals.repository");
const ligarNoBanco = vi.mocked(repo.registrarContratoDaProposta);
const { CHAVE_DAS_LIGACOES_PENDENTES } = await import("../hooks/use-proposals");
const { ContratosDaPropostaACriar } = await import("./contratos-da-proposta-a-criar");

const CONDICOES = {
  formaPagamento: "pix",
  prazoEntregaDias: 30,
  parcelasProjeto: 3,
  fidelidadeMeses: 12,
} as const;

const MENSAL: ContratoACriar = {
  propostaId: "p1",
  numero: 7,
  versao: 1,
  tipo: "mrr",
  linhaDeNegocio: "demanda",
  valor: 900,
  ...CONDICOES,
  oportunidadeId: "venda-p",
};
const PROJETO: ContratoACriar = { ...MENSAL, tipo: "tcv", linhaDeNegocio: "sistemas", valor: 4500 };

const PAINEL = "O contrato foi criado, mas a proposta não foi ligada a ele.";
const REPETIR = "Ligar o contrato criado à proposta";
const CONFIRMA_DISPENSA =
  "Dispensar o aviso? O contrato já criado continua no cliente. Criar de novo cria outro contrato.";

function item(parcial: Partial<ItemDaProposta> & Pick<ItemDaProposta, "id">): ItemDaProposta {
  return {
    produtoId: "tra",
    nome: "Tráfego",
    descricao: null,
    frente: "trafego",
    frentesDoCombo: null,
    linhaDeNegocio: "demanda",
    tipo: "mrr",
    precoCatalogo: 900,
    valor: 900,
    ordem: 1,
    contratoId: null,
    ...parcial,
  };
}

function ultimas() {
  return propsDoCadastro.mock.calls[propsDoCadastro.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  >;
}

let qc: QueryClient;
function envoltorio({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
function renderizar() {
  return render(
    <ContratosDaPropostaACriar
      clienteId="c1"
      clienteNome="Acme"
      vendas={[{ id: "venda-p", nome: "Acme site" }]}
    />,
    { wrapper: envoltorio },
  );
}
function botoesCriar() {
  return screen.getAllByRole("button", { name: "Criar contrato" });
}

function criarContrato() {
  fireEvent.click(botoesCriar()[0]!);
  act(() => (ultimas().aoContratoCriado as (id: string) => void)("k9"));
}

async function falharLigacao() {
  ligarNoBanco.mockRejectedValueOnce(new Error("rede"));
  criarContrato();
  await screen.findByText(PAINEL);
}

async function semPainel() {
  await waitFor(() => expect(screen.queryByText(PAINEL)).not.toBeInTheDocument());
}

beforeEach(() => {
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  propsDoCadastro.mockReset();
  ligarNoBanco.mockReset();
  aCriar = { data: [MENSAL, PROJETO], isError: false, error: null, isFetching: false };
  catalogo = { data: [], isError: false };
  itensAtualizando = false;
  itensComErro = false;
  itens = [
    item({ id: "m" }),
    item({
      id: "s",
      produtoId: "sis",
      frente: "sistemas",
      linhaDeNegocio: "sistemas",
      tipo: "tcv",
      valor: 4500,
    }),
  ];
});

describe("ContratosDaPropostaACriar", () => {
  it("nada pendente: a seção não aparece", () => {
    aCriar = { data: [], isError: false, error: null, isFetching: false };
    const { container } = renderizar();
    expect(container).toBeEmptyDOMElement();
  });

  it("um título por proposta e um botão por grupo, sem painel de ligação", () => {
    renderizar();
    expect(
      screen.getByRole("heading", { name: "Contratos da proposta Nº 0007 v1 a criar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Demanda mensal")).toBeInTheDocument();
    expect(screen.getByText("Sistemas projeto")).toBeInTheDocument();
    expect(botoesCriar()).toHaveLength(2);
    expect(screen.queryByText(PAINEL)).not.toBeInTheDocument();
  });

  it("Criar contrato abre o cadastro com o grupo certo e o cliente da ficha", () => {
    renderizar();
    fireEvent.click(botoesCriar()[1]!);
    expect(ultimas()).toMatchObject({
      aberto: true,
      inicial: {
        clienteId: "c1",
        venda: { id: "venda-p", nome: "Acme site" },
        contrato: {
          nome: "Acme · Sistemas projeto",
          tipo: "tcv",
          valor: 4500,
          mesesDeCobranca: 3,
          prazoDeEntregaDias: 30,
          mesesDeFidelidade: null,
        },
      },
    });
  });

  it("venda fora da lista da ficha: o contrato ainda vai com a venda da proposta", () => {
    render(<ContratosDaPropostaACriar clienteId="c1" clienteNome="Acme" vendas={[]} />, {
      wrapper: envoltorio,
    });
    fireEvent.click(botoesCriar()[0]!);
    expect(ultimas()).toMatchObject({
      inicial: { venda: { id: "venda-p", nome: "Venda da proposta" } },
    });
  });

  it("controle: ligação que dá certo não deixa painel", async () => {
    ligarNoBanco.mockResolvedValueOnce(undefined);
    renderizar();
    criarContrato();
    await waitFor(() => expect(ligarNoBanco).toHaveBeenCalledWith("p1", "k9"));
    await waitFor(() => {
      for (const botao of botoesCriar()) expect(botao).toBeEnabled();
    });
    expect(screen.queryByText(PAINEL)).not.toBeInTheDocument();
  });

  it("ligação que falha vira 'Ligar o contrato criado à proposta', e Criar contrato trava", async () => {
    renderizar();
    await falharLigacao();
    expect(ligarNoBanco).toHaveBeenCalledWith("p1", "k9");
    for (const botao of botoesCriar()) expect(botao).toBeDisabled();

    ligarNoBanco.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: REPETIR }));
    await semPainel();
    expect(ligarNoBanco).toHaveBeenCalledTimes(2);
    expect(ligarNoBanco).toHaveBeenLastCalledWith("p1", "k9");
    await waitFor(() => {
      for (const botao of botoesCriar()) expect(botao).toBeEnabled();
    });
  });

  it("a ligação pendente sobrevive a fechar e reabrir a ficha", async () => {
    const primeira = renderizar();
    await falharLigacao();
    primeira.unmount();

    renderizar();
    expect(screen.getByText(PAINEL)).toBeInTheDocument();
    for (const botao of botoesCriar()) expect(botao).toBeDisabled();

    ligarNoBanco.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: REPETIR }));
    await semPainel();
    expect(ligarNoBanco).toHaveBeenLastCalledWith("p1", "k9");
  });

  it("ficha fechada no meio da ligação: a falha ainda marca a pendência", async () => {
    let falhar: (erro: Error) => void = () => {};
    ligarNoBanco.mockReturnValueOnce(
      new Promise<void>((_, rejeitar) => {
        falhar = rejeitar;
      }),
    );
    const primeira = renderizar();
    criarContrato();
    await waitFor(() => expect(ligarNoBanco).toHaveBeenCalledWith("p1", "k9"));
    primeira.unmount();

    await act(async () => falhar(new Error("rede")));
    renderizar();
    expect(await screen.findByText(PAINEL)).toBeInTheDocument();
    for (const botao of botoesCriar()) expect(botao).toBeDisabled();
  });

  it("Dispensar pede confirmação: o primeiro clique não limpa e Criar contrato segue travado", async () => {
    renderizar();
    await falharLigacao();
    fireEvent.click(screen.getByRole("button", { name: "Dispensar" }));
    expect(screen.getByText(CONFIRMA_DISPENSA)).toBeInTheDocument();
    expect(screen.getByText(PAINEL)).toBeInTheDocument();
    expect(qc.getQueryData(CHAVE_DAS_LIGACOES_PENDENTES)).toEqual({ p1: "k9" });
    for (const botao of botoesCriar()) expect(botao).toBeDisabled();
  });

  it("'Sim, dispensar' tira o painel e devolve o Criar contrato, sem nova ligação", async () => {
    renderizar();
    await falharLigacao();
    fireEvent.click(screen.getByRole("button", { name: "Dispensar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, dispensar" }));
    await semPainel();
    for (const botao of botoesCriar()) expect(botao).toBeEnabled();
    expect(ligarNoBanco).toHaveBeenCalledTimes(1);
  });

  it("'Cancelar' volta ao painel sem limpar", async () => {
    renderizar();
    await falharLigacao();
    fireEvent.click(screen.getByRole("button", { name: "Dispensar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText(CONFIRMA_DISPENSA)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: REPETIR })).toBeEnabled();
    expect(qc.getQueryData(CHAVE_DAS_LIGACOES_PENDENTES)).toEqual({ p1: "k9" });
    for (const botao of botoesCriar()) expect(botao).toBeDisabled();
  });

  it("ficha reaberta com a repetição em voo: Ligar e Dispensar travam", async () => {
    const primeira = renderizar();
    await falharLigacao();
    ligarNoBanco.mockReturnValueOnce(new Promise<void>(() => {}));
    fireEvent.click(screen.getByRole("button", { name: REPETIR }));
    await waitFor(() => expect(ligarNoBanco).toHaveBeenCalledTimes(2));
    primeira.unmount();

    renderizar();
    expect(screen.getByText(PAINEL)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: REPETIR })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dispensar" })).toBeDisabled();
  });

  describe("Criar contrato trava enquanto algo corre (contrato duplicado)", () => {
    it("ligação em curso", async () => {
      ligarNoBanco.mockReturnValueOnce(new Promise<void>(() => {}));
      renderizar();
      criarContrato();
      await waitFor(() => {
        for (const botao of botoesCriar()) expect(botao).toBeDisabled();
      });
      expect(screen.queryByText(PAINEL)).not.toBeInTheDocument();
    });

    it("itens da proposta recarregando", () => {
      itensAtualizando = true;
      renderizar();
      for (const botao of botoesCriar()) expect(botao).toBeDisabled();
    });

    it("lista de contratos a criar recarregando", () => {
      aCriar = { ...aCriar, isFetching: true };
      renderizar();
      for (const botao of botoesCriar()) expect(botao).toBeDisabled();
    });

    it("ficha reaberta com a ligação ainda em voo: trava até a ligação responder", async () => {
      let responder: () => void = () => {};
      ligarNoBanco.mockReturnValueOnce(
        new Promise<void>((resolver) => {
          responder = resolver;
        }),
      );
      const primeira = renderizar();
      criarContrato();
      await waitFor(() => expect(ligarNoBanco).toHaveBeenCalledWith("p1", "k9"));
      primeira.unmount();

      renderizar();
      for (const botao of botoesCriar()) expect(botao).toBeDisabled();

      await act(async () => responder());
      await waitFor(() => {
        for (const botao of botoesCriar()) expect(botao).toBeEnabled();
      });
      expect(screen.queryByText(PAINEL)).not.toBeInTheDocument();
    });

    it("controle: nada correndo, botões livres", () => {
      renderizar();
      for (const botao of botoesCriar()) expect(botao).toBeEnabled();
    });
  });

  describe("aviso de leitura dos itens: dado antes do erro", () => {
    const AVISO_DOS_ITENS = /Não foi possível ler os itens da proposta ou o catálogo/;

    it("refetch dos itens que falha com dado na mão: sem aviso", () => {
      itensComErro = true;
      renderizar();
      expect(screen.queryByText(AVISO_DOS_ITENS)).not.toBeInTheDocument();
      for (const botao of botoesCriar()) expect(botao).toBeEnabled();
    });

    it("controle: itens sem dado e com erro mostram o aviso", () => {
      itens = undefined;
      itensComErro = true;
      renderizar();
      expect(screen.getByText(AVISO_DOS_ITENS)).toBeInTheDocument();
    });

    it("catálogo sem dado e com erro mostra o aviso, e 'Criar contrato' fica travado", () => {
      catalogo = { data: undefined, isError: true };
      renderizar();
      expect(screen.getByText(AVISO_DOS_ITENS)).toBeInTheDocument();
      for (const botao of botoesCriar()) expect(botao).toBeDisabled();
    });

    it("refetch do catálogo que falha com dado na mão: sem aviso", () => {
      catalogo = { data: [], isError: true };
      renderizar();
      expect(screen.queryByText(AVISO_DOS_ITENS)).not.toBeInTheDocument();
    });
  });

  it("refetch que falha com dado na mão mantém a seção montada", () => {
    aCriar = {
      data: [MENSAL, PROJETO],
      isError: true,
      error: new Error("falhou"),
      isFetching: false,
    };
    renderizar();
    expect(botoesCriar()).toHaveLength(2);
    expect(propsDoCadastro).toHaveBeenCalled();
    expect(
      screen.queryByText(/Não foi possível ler os contratos da proposta a criar/),
    ).not.toBeInTheDocument();
  });

  it("erro de leitura sem dado diz que não leu", () => {
    aCriar = { data: undefined, isError: true, error: new Error("falhou"), isFetching: false };
    renderizar();
    expect(
      screen.getByText(/Não foi possível ler os contratos da proposta a criar/),
    ).toBeInTheDocument();
  });
});
