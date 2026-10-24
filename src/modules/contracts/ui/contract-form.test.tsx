import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { somaDias, todaySP } from "@/shared/lib/date";

import type { ContratoListado } from "../api/contracts.repository";
import type { ContratoInicial } from "../domain/contract";

type Opcao = { id: string; nome: string; [extra: string]: unknown };
type ConsultaDeOpcoes = {
  data: Opcao[] | undefined;
  isError: boolean;
  isPending: boolean;
};

const pronta = (data: Opcao[]): ConsultaDeOpcoes => ({
  data,
  isError: false,
  isPending: false,
});
const comErro = (): ConsultaDeOpcoes => ({ data: undefined, isError: true, isPending: false });

type ConsultaDeVendas = {
  data:
    | {
        ganhas: { id: string; nome: string }[];
        origens: { vendaId: string; vendaNome: string; clienteId: string }[];
      }
    | undefined;
  isError: boolean;
  isPending: boolean;
};
let vendas: ConsultaDeVendas;

let clientes: ConsultaDeOpcoes;
let produtos: ConsultaDeOpcoes;
const mutateAsync = vi.fn();
const apagarMutate = vi.fn();

vi.mock("../hooks/use-contracts", () => ({
  useApagarContrato: () => ({ mutate: apagarMutate, isPending: false }),
  useClientesParaSelecao: () => clientes,
  useProdutosAtivos: () => produtos,
  useSaveContract: () => ({ mutateAsync, isPending: false }),
  useVendasParaContrato: () => vendas,
}));

vi.mock("./contract-shares-section", () => ({
  ContractSharesSection: () => null,
}));

const baseDoSimulador = vi.fn();
vi.mock("@/modules/financial/ui/simulador-liquido", () => ({
  SimuladorDeLiquido: ({ base }: { base: unknown }) => {
    baseDoSimulador(base);
    return null;
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const { ContractForm } = await import("./contract-form");

const CONTRATO_COMPLETO: ContratoListado = {
  id: "contrato-1",
  clienteId: "cliente-1",
  nome: "Combo 3 Frentes",
  tipo: "mrr",
  linhaDeNegocio: "demanda",
  valorMensal: 1000,
  valorTotal: null,
  mesesDeCobranca: null,
  cobrancaAtiva: true,
  firme: true,
  status: "active",
  nomeDoCliente: "Cliente Teste",
  inicio: "2026-01-01",
  fim: null,
  meioDePagamento: "pix",
  parcelas: null,
  comissionavel: true,
  prazoDeEntrega: null,
  observacoes: null,
  itens: [{ frente: "posicionamento", produtoId: "produto-1", valor: 1000 }],
  duracaoMeses: null,
  mesesDeFidelidade: null,
  motivoDaPausa: null,
  oportunidadeId: null,
};

const CONTRATO_TCV: ContratoListado = {
  ...CONTRATO_COMPLETO,
  id: "contrato-2",
  tipo: "tcv",
  valorMensal: null,
  valorTotal: 12000,
  mesesDeCobranca: 6,
  prazoDeEntrega: "2026-12-31",
  itens: [{ frente: "posicionamento", produtoId: "produto-1", valor: 12000 }],
};

const AVISO_DE_CLIENTES = /Não foi possível ler a lista de clientes/;
const AVISO_DE_PRODUTOS = /Não foi possível ler o catálogo de produtos/;

const ROTULO_DO_PRAZO = "Prazo de entrega (opcional)";

function abrir(contrato: ContratoListado = CONTRATO_COMPLETO) {
  return render(<ContractForm aberto aoFechar={vi.fn()} contrato={contrato} />);
}

function botaoSalvar() {
  return screen.getByRole("button", { name: "Salvar contrato" });
}

beforeEach(() => {
  mutateAsync.mockReset();
  apagarMutate.mockReset();
  baseDoSimulador.mockReset();
  clientes = pronta([{ id: "cliente-1", nome: "Cliente Teste" }]);
  produtos = pronta([{ id: "produto-1", nome: "Gestão de tráfego" }]);
  vendas = { data: { ganhas: [], origens: [] }, isError: false, isPending: false };
});

describe("ContractForm — lista de opções que falhou não vira lista vazia", () => {
  it("linha de base: com as duas listas lidas, o contrato completo salva", () => {
    abrir();

    expect(botaoSalvar()).toBeEnabled();
    expect(screen.queryByText(AVISO_DE_CLIENTES)).not.toBeInTheDocument();
    expect(screen.queryByText(AVISO_DE_PRODUTOS)).not.toBeInTheDocument();
  });

  it("🔴 catálogo de produtos em erro: o campo diz que falhou, e salvar trava", () => {
    produtos = comErro();
    abrir();

    expect(screen.getByText(AVISO_DE_PRODUTOS)).toBeInTheDocument();
    expect(screen.queryByText(/Preço de tabela é sugestão/)).not.toBeInTheDocument();

    expect(botaoSalvar()).toBeDisabled();
  });

  it("🔴 lista de clientes em erro: o campo diz que falhou, e salvar trava", () => {
    clientes = comErro();
    abrir();

    expect(screen.getByText(AVISO_DE_CLIENTES)).toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();
  });

  it("🔴 o Salvar travado DIZ por que, ao lado dele — e nomeia qual lista falhou", () => {
    produtos = comErro();
    abrir();

    expect(screen.getByText(/Não é possível salvar/)).toBeInTheDocument();
    expect(screen.getByText(/o catálogo de produtos não pôde ser lido/)).toBeInTheDocument();
    expect(screen.queryByText(/a lista de clientes não pôde ser lida/)).not.toBeInTheDocument();
  });

  it("as duas listas em erro: a explicação do rodapé fala das duas", () => {
    produtos = comErro();
    clientes = comErro();
    abrir();

    expect(
      screen.getByText(/nem a lista de clientes nem o catálogo de produtos puderam ser lidos/),
    ).toBeInTheDocument();
  });

  it("no caminho feliz o rodapé NÃO carrega explicação nenhuma", () => {
    abrir();

    expect(screen.queryByText(/Não é possível salvar/)).not.toBeInTheDocument();
  });

  it("erro na leitura vence dado velho em cache — o `?? []` não é o único caminho", () => {
    produtos = {
      data: [{ id: "produto-1", nome: "Gestão de tráfego" }],
      isError: true,
      isPending: false,
    };
    abrir();

    expect(screen.getByText(AVISO_DE_PRODUTOS)).toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();
  });
});

describe("ContractForm — prazo de entrega, que é de ENTREGA e não de cobrança", () => {
  it("TCV: o campo existe, é data nativa e vem com o que o banco tem", () => {
    abrir(CONTRATO_TCV);

    const campo = screen.getByLabelText(ROTULO_DO_PRAZO);
    expect(campo).toHaveAttribute("type", "date");
    expect(campo).toHaveValue("2026-12-31");
  });

  it("TCV: o rótulo diz que é entrega, não cobrança — a distinção do §4.3", () => {
    abrir(CONTRATO_TCV);

    expect(screen.getByText(/não de cobrança/)).toBeInTheDocument();
    expect(screen.getByText(/alerta de atraso/)).toBeInTheDocument();
    expect(screen.getByText(/enquanto o contrato não for cancelado/)).toBeInTheDocument();
  });

  it("🔴 TCV: a data digitada chega ao save — o campo não é só decoração", async () => {
    abrir(CONTRATO_TCV);

    fireEvent.change(screen.getByLabelText(ROTULO_DO_PRAZO), {
      target: { value: "2026-11-30" },
    });
    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "tcv", prazoDeEntrega: "2026-11-30" }),
    );
  });

  it("TCV: esvaziar o campo grava null, não a data velha nem string vazia", async () => {
    abrir(CONTRATO_TCV);

    fireEvent.change(screen.getByLabelText(ROTULO_DO_PRAZO), { target: { value: "" } });
    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ prazoDeEntrega: null }));
  });

  it("🔴 MRR: o campo não aparece, e a data que sobrou no rascunho NÃO é gravada", async () => {
    abrir({ ...CONTRATO_COMPLETO, prazoDeEntrega: "2026-12-31" });

    expect(screen.queryByLabelText(ROTULO_DO_PRAZO)).not.toBeInTheDocument();

    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "mrr", prazoDeEntrega: null }),
    );
  });
});

describe("ContractForm — dinheiro digitado com ponto de milhar", () => {
  const ROTULO_MENSAL = "Valor mensal (R$)";
  const ROTULO_TOTAL = "Valor total do projeto (R$)";
  const ROTULO_DO_ITEM = "Valor da frente Posicionamento";

  function digitar(rotuloDoValor: string, texto: string) {
    fireEvent.change(screen.getByLabelText(rotuloDoValor), { target: { value: texto } });
    fireEvent.change(screen.getByLabelText(ROTULO_DO_ITEM), { target: { value: texto } });
  }

  it.each([
    ["1197,00", 1197],
    ["1.197,00", 1197],
    ["24.637", 24637],
    ["1197", 1197],
    ["1197.00", 1197],
  ])("MRR: %s chega ao save como %d", async (texto, esperado) => {
    abrir();
    digitar(ROTULO_MENSAL, texto);

    expect(botaoSalvar()).toBeEnabled();
    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        valorMensal: esperado,
        itens: [expect.objectContaining({ valor: esperado })],
      }),
    );
  });

  it("🔴 TCV: 24.637 grava 24637, não 24,64 — o preço real do Sistema sob medida", async () => {
    abrir(CONTRATO_TCV);
    digitar(ROTULO_TOTAL, "24.637");

    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "tcv", valorTotal: 24637 }),
    );
  });

  it("🔴 o eco diz o que o sistema entendeu, e é ele que denuncia o erro", () => {
    abrir();
    digitar(ROTULO_MENSAL, "24.637");

    expect(screen.getByText(/24\.637,00/)).toBeInTheDocument();
    expect(screen.queryByText(/R\$\s?24,64/)).not.toBeInTheDocument();
  });

  it("🔴 TCV: o eco também existe — apagá-lo tem de deixar algo vermelho", () => {
    abrir(CONTRATO_TCV);
    digitar(ROTULO_TOTAL, "24.637");

    expect(screen.getByText(/Vai ser gravado como/)).toBeInTheDocument();
    expect(screen.getByText(/24\.637,00/)).toBeInTheDocument();
    expect(screen.queryByText(/R\$\s?24,64/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(ROTULO_TOTAL), { target: { value: "" } });
    expect(screen.queryByText(/Vai ser gravado como/)).not.toBeInTheDocument();
  });

  it("texto ilegível não grava, e a tela diz por quê", () => {
    abrir();
    fireEvent.change(screen.getByLabelText(ROTULO_MENSAL), {
      target: { value: "mil cento e noventa e sete" },
    });

    expect(screen.getByText(/Valor não reconhecido/)).toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();
  });

  it("campo vazio não ecoa nem reclama — vazio é ausência, não erro", () => {
    abrir();
    fireEvent.change(screen.getByLabelText(ROTULO_MENSAL), { target: { value: "" } });

    expect(screen.queryByText(/Valor não reconhecido/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vai ser gravado como/)).not.toBeInTheDocument();
  });

  it("🔴 o campo do item aceita o valor sendo digitado, tecla a tecla", () => {
    abrir();
    const campo = screen.getByLabelText(ROTULO_DO_ITEM);

    fireEvent.change(campo, { target: { value: "1." } });
    expect(campo).toHaveValue("1.");

    fireEvent.change(campo, { target: { value: "1.500,00" } });
    expect(campo).toHaveValue("1.500,00");

    fireEvent.blur(campo);
    expect(campo).toHaveValue("1500");
  });

  function ultimaBase() {
    const chamadas = baseDoSimulador.mock.calls;
    expect(chamadas.length).toBeGreaterThan(0);
    return chamadas[chamadas.length - 1][0] as {
      valorMensal: number | null;
      valorTotal: number | null;
    };
  }

  it("🔴 o simulador calcula sobre 1197, não sobre 1,197 — a tela não discorda de si mesma", () => {
    abrir();
    digitar(ROTULO_MENSAL, "1.197,00");

    expect(screen.getByText(/1\.197,00/)).toBeInTheDocument();
    expect(ultimaBase().valorMensal).toBe(1197);
    expect(ultimaBase().valorMensal).not.toBe(1.197);
  });

  it("TCV: o total do simulador também é o interpretado, e o mensal fica null", () => {
    abrir(CONTRATO_TCV);
    digitar(ROTULO_TOTAL, "24.637");

    expect(ultimaBase().valorTotal).toBe(24637);
    expect(ultimaBase().valorMensal).toBeNull();
  });

  it("🔴 o campo por frente avisa quando não conseguiu ler o texto", () => {
    abrir();
    const campo = screen.getByLabelText(ROTULO_DO_ITEM);

    fireEvent.change(campo, { target: { value: "mil e quinhentos" } });
    expect(screen.getByText(/Valor não reconhecido/)).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: "1.500,00" } });
    expect(screen.queryByText(/Valor não reconhecido/)).not.toBeInTheDocument();

    fireEvent.change(campo, { target: { value: "mil e quinhentos" } });
    fireEvent.blur(campo);
    expect(screen.queryByText(/Valor não reconhecido/)).not.toBeInTheDocument();
  });
});

describe("ContractForm — reativar contrato pergunta se volta a cobrar (CONTR-2)", () => {
  const PAUSADO_SEM_COBRANCA: ContratoListado = {
    ...CONTRATO_COMPLETO,
    status: "paused",
    cobrancaAtiva: false,
  };
  const ATIVO_SEM_COBRANCA: ContratoListado = {
    ...CONTRATO_COMPLETO,
    status: "active",
    cobrancaAtiva: false,
  };

  async function trocarStatusParaAtivo() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: "Ativo" }));
    return user;
  }

  it("🔴 a) pausado sem cobrança → Ativo: pergunta 'Voltar a cobrar?' e trava o Salvar até responder", async () => {
    abrir(PAUSADO_SEM_COBRANCA);
    const user = await trocarStatusParaAtivo();

    expect(screen.getByText("Voltar a cobrar?")).toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Sim, voltar a cobrar" }));
    expect(botaoSalvar()).toBeEnabled();

    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ cobrancaAtiva: true }));
  });

  it("b) pausado sem cobrança → Ativo, escolhe manter sem cobrança: Salvar habilita e o payload leva false", async () => {
    abrir(PAUSADO_SEM_COBRANCA);
    const user = await trocarStatusParaAtivo();

    await user.click(screen.getByRole("button", { name: "Não, manter sem cobrança" }));
    expect(botaoSalvar()).toBeEnabled();

    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ cobrancaAtiva: false }));
  });

  it("🔴 c) beco: contrato já ativo sem cobrança já mostra 'Voltar a cobrar?' com Salvar HABILITADO — não bloqueia edição alheia", async () => {
    abrir(ATIVO_SEM_COBRANCA);

    expect(screen.getByText("Voltar a cobrar?")).toBeInTheDocument();
    expect(botaoSalvar()).toBeEnabled();
    expect(screen.getByRole("button", { name: "Não, manter sem cobrança" })).toHaveClass(
      "bg-primary",
    );

    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ cobrancaAtiva: false }));
  });

  it("c) beco: clicar 'Sim, voltar a cobrar' muda a decisão e o payload passa a levar true", async () => {
    const user = userEvent.setup();
    abrir(ATIVO_SEM_COBRANCA);

    await user.click(screen.getByRole("button", { name: "Sim, voltar a cobrar" }));
    expect(botaoSalvar()).toBeEnabled();

    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ cobrancaAtiva: true }));
  });

  it("d) positivo: ativo com cobrança ligada não pergunta nada; pausar continua exigindo a pergunta de sempre", async () => {
    const user = userEvent.setup();
    abrir();

    expect(screen.queryByText("Voltar a cobrar?")).not.toBeInTheDocument();
    expect(botaoSalvar()).toBeEnabled();

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: "Pausado" }));

    expect(screen.getByText("Suspender a cobrança também?")).toBeInTheDocument();
    expect(screen.queryByText("Voltar a cobrar?")).not.toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();
  });
});

describe("ContractForm — data com ano pela metade", () => {
  it("🔴 trava o Salvar e avisa; corrigida, salva", async () => {
    abrir(CONTRATO_TCV);

    fireEvent.change(screen.getByLabelText(ROTULO_DO_PRAZO), {
      target: { value: "0002-11-30" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Data inválida. Use um ano entre 2000 e 2100.",
    );
    expect(botaoSalvar()).toBeDisabled();
    fireEvent.click(botaoSalvar());
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(ROTULO_DO_PRAZO), {
      target: { value: "2026-11-30" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
  });
});

describe("ContractForm — Início vazio tem a frase certa", () => {
  it("🔴 Início apagado: 'Informe a data de início.', não a frase de ano; preenchido, some", () => {
    abrir(CONTRATO_TCV);

    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Informe a data de início.");
    expect(screen.queryByText(/Use um ano entre/)).not.toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-09-01" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Início com ano pela metade continua dizendo 'use um ano entre 2000 e 2100'", () => {
    abrir(CONTRATO_TCV);

    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "0002-09-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Data inválida. Use um ano entre 2000 e 2100.",
    );
  });
});

describe("ContractForm — FECH-4: combo com frente sem avulso ativo não rateia com peso 1", () => {
  const COMBO = {
    id: "combo",
    nome: "Combo 3 Frentes",
    frente: "posicionamento",
    linhaDeNegocio: "demanda",
    tipo: "mrr",
    preco: 3193,
    frentesDoCombo: ["posicionamento", "trafego", "comercial"],
  };
  const avulso = (id: string, nome: string, frente: string, preco: number) => ({
    id,
    nome,
    frente,
    linhaDeNegocio: "demanda",
    tipo: "mrr",
    preco,
    frentesDoCombo: null,
  });
  const POSICIONAMENTO = avulso("pos", "Posicionamento", "posicionamento", 1197);
  const TRAFEGO = avulso("tra", "Tráfego", "trafego", 797);
  const COMERCIAL = avulso("com", "Comercial", "comercial", 1197);

  async function escolherOCombo() {
    abrir();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Produto do catálogo" }), {
      key: "ArrowDown",
    });
    fireEvent.click(await screen.findByRole("option", { name: /Combo 3 Frentes/ }));
  }

  function valorDaFrente(rotulo: string) {
    return screen.getByLabelText(`Valor da frente ${rotulo}`) as HTMLInputElement;
  }

  it("🔴 Tráfego desativada: nada é rateado, a frase nomeia a frente, Salvar trava; decomposição informada libera", async () => {
    produtos = pronta([COMBO, POSICIONAMENTO, COMERCIAL]);
    await escolherOCombo();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Frente Tráfego sem preço de tabela ativo. Ative o produto no catálogo ou informe a decomposição.",
    );
    expect(valorDaFrente("Tráfego").value).toBe("");
    expect(valorDaFrente("Posicionamento").value).toBe("");
    expect(botaoSalvar()).toBeDisabled();

    fireEvent.change(valorDaFrente("Posicionamento"), { target: { value: "1.197,75" } });
    fireEvent.change(valorDaFrente("Tráfego"), { target: { value: "797,50" } });
    fireEvent.change(valorDaFrente("Comercial"), { target: { value: "1.197,75" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Soma fechada ✓")).toBeInTheDocument();
    expect(botaoSalvar()).toBeEnabled();
  });

  it("o positivo ao lado: com os três avulsos o rateio é o de sempre, sem aviso, e salva", async () => {
    produtos = pronta([COMBO, POSICIONAMENTO, TRAFEGO, COMERCIAL]);
    await escolherOCombo();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(valorDaFrente("Posicionamento").value).toBe("1197.75");
    expect(valorDaFrente("Tráfego").value).toBe("797.5");
    expect(valorDaFrente("Comercial").value).toBe("1197.75");
    expect(botaoSalvar()).toBeEnabled();
  });
});

describe("ContractForm — meses de cobrança precisa ser inteiro", () => {
  const meses = () => screen.getByLabelText("Meses de cobrança");

  it("🔴 2.5 trava o Salvar com a frase; 6 libera e salva", async () => {
    abrir(CONTRATO_TCV);
    expect(botaoSalvar()).toBeEnabled();

    fireEvent.change(meses(), { target: { value: "2.5" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Meses de cobrança precisa ser um número inteiro.",
    );
    expect(botaoSalvar()).toBeDisabled();
    fireEvent.click(botaoSalvar());
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.change(meses(), { target: { value: "6" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({ mesesDeCobranca: 6 });
  });

  it("vazio trava sem alarde — vazio é ausência, não erro", () => {
    abrir(CONTRATO_TCV);

    fireEvent.change(meses(), { target: { value: "" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();
  });
});

describe("ContractForm — contrato da proposta (D-064)", () => {
  const VENDA_DA_PROPOSTA = { id: "venda-p", nome: "Acme" };
  const INICIAL: ContratoInicial = {
    nome: "Acme · Sistemas projeto",
    tipo: "tcv",
    linhaDeNegocio: "sistemas",
    valor: 4500,
    itens: [{ frente: "sistemas", produtoId: "sis", valor: 4500 }],
    frentesSemPreco: [],
    mesesDeCobranca: 3,
    mesesDeFidelidade: null,
    meioDePagamento: "pix",
    prazoDeEntregaDias: 30,
  };

  it("abre preenchido, com o cliente travado, e entrega o contrato criado", async () => {
    mutateAsync.mockResolvedValue("k9");
    const aoContratoCriado = vi.fn();
    render(
      <ContractForm
        aberto
        aoFechar={vi.fn()}
        inicial={{ clienteId: "cliente-1", contrato: INICIAL, venda: VENDA_DA_PROPOSTA }}
        aoContratoCriado={aoContratoCriado}
      />,
    );

    expect(screen.getByDisplayValue("Acme · Sistemas projeto")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor total do projeto (R$)")).toHaveValue("4500");
    expect(screen.getByLabelText("Meses de cobrança")).toHaveValue(3);
    expect(screen.getByLabelText(ROTULO_DO_PRAZO)).toHaveValue(somaDias(todaySP(), 30));
    expect(screen.getByRole("combobox", { name: "Cliente" })).toBeDisabled();

    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(aoContratoCriado).toHaveBeenCalledWith("k9"));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        contratoId: null,
        clienteId: "cliente-1",
        tipo: "tcv",
        linhaDeNegocio: "sistemas",
        valorTotal: 4500,
        mesesDeCobranca: 3,
        meioDePagamento: "pix",
        prazoDeEntrega: somaDias(todaySP(), 30),
        itens: [{ frente: "sistemas", produtoId: "sis", valor: 4500 }],
      }),
    );
  });

  it("mensal: a fidelidade da proposta é gravada e dita na tela", async () => {
    mutateAsync.mockResolvedValue("k8");
    render(
      <ContractForm
        aberto
        aoFechar={vi.fn()}
        inicial={{
          clienteId: "cliente-1",
          contrato: {
            ...INICIAL,
            nome: "Acme · Demanda mensal",
            tipo: "mrr",
            linhaDeNegocio: "demanda",
            valor: 900,
            itens: [{ frente: "trafego", produtoId: "tra", valor: 900 }],
            mesesDeCobranca: null,
            mesesDeFidelidade: 12,
            prazoDeEntregaDias: null,
          },
          venda: VENDA_DA_PROPOSTA,
        }}
      />,
    );
    expect(screen.getByLabelText("Fidelidade (meses)")).toHaveValue("12");
    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ mesesDeFidelidade: 12 }));
  });

  it("mensal trocado para projeto na tela: a fidelidade não vai para o TCV", async () => {
    mutateAsync.mockResolvedValue("k6");
    render(
      <ContractForm
        aberto
        aoFechar={vi.fn()}
        inicial={{
          clienteId: "cliente-1",
          contrato: {
            ...INICIAL,
            nome: "Acme · Demanda mensal",
            tipo: "mrr",
            linhaDeNegocio: "demanda",
            valor: 900,
            itens: [{ frente: "trafego", produtoId: "tra", valor: 900 }],
            mesesDeCobranca: null,
            mesesDeFidelidade: 12,
            prazoDeEntregaDias: null,
          },
          venda: VENDA_DA_PROPOSTA,
        }}
      />,
    );
    const tipo = screen
      .getAllByRole("combobox")
      .find((c) => c.textContent?.includes("Mensalidade (MRR)"));
    fireEvent.keyDown(tipo!, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Projeto (TCV)" }));
    fireEvent.change(screen.getByLabelText("Valor total do projeto (R$)"), {
      target: { value: "900" },
    });
    fireEvent.change(screen.getByLabelText("Meses de cobrança"), { target: { value: "3" } });

    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({ tipo: "tcv", mesesDeFidelidade: null });
  });

  it("prazo de entrega acompanha o Início até a pessoa editar o prazo", () => {
    render(
      <ContractForm
        aberto
        aoFechar={vi.fn()}
        inicial={{ clienteId: "cliente-1", contrato: INICIAL, venda: VENDA_DA_PROPOSTA }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-02" } });
    expect(screen.getByLabelText(ROTULO_DO_PRAZO)).toHaveValue("2026-12-02");
    fireEvent.change(screen.getByLabelText(ROTULO_DO_PRAZO), { target: { value: "2026-12-20" } });
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-05" } });
    expect(screen.getByLabelText(ROTULO_DO_PRAZO)).toHaveValue("2026-12-20");
  });

  it("crédito da proposta grava 1 parcela, o que a tela mostra", async () => {
    mutateAsync.mockResolvedValue("k7");
    render(
      <ContractForm
        aberto
        aoFechar={vi.fn()}
        inicial={{
          clienteId: "cliente-1",
          contrato: { ...INICIAL, meioDePagamento: "credito" },
          venda: VENDA_DA_PROPOSTA,
        }}
      />,
    );
    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ meioDePagamento: "credito", parcelas: 1 }),
    );
  });

  const MENSAL_COM_SOMA_FECHADA: ContratoInicial = {
    ...INICIAL,
    tipo: "mrr",
    linhaDeNegocio: "demanda",
    valor: 900,
    itens: [
      { frente: "posicionamento", produtoId: null, valor: 0 },
      { frente: "trafego", produtoId: null, valor: 900 },
      { frente: "comercial", produtoId: null, valor: 0 },
    ],
    mesesDeCobranca: null,
    prazoDeEntregaDias: null,
  };

  it("frente sem preço da proposta trava o Salvar mesmo com a soma fechada", () => {
    render(
      <ContractForm
        aberto
        aoFechar={vi.fn()}
        inicial={{
          clienteId: "cliente-1",
          contrato: { ...MENSAL_COM_SOMA_FECHADA, frentesSemPreco: ["trafego"] },
          venda: VENDA_DA_PROPOSTA,
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Frente Tráfego sem preço de tabela ativo/);
    expect(botaoSalvar()).toBeDisabled();
  });

  it("controle: a mesma decomposição sem frente sem preço salva", () => {
    render(
      <ContractForm
        aberto
        aoFechar={vi.fn()}
        inicial={{
          clienteId: "cliente-1",
          contrato: MENSAL_COM_SOMA_FECHADA,
          venda: VENDA_DA_PROPOSTA,
        }}
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(botaoSalvar()).toBeEnabled();
  });

  it("edição de contrato existente não chama `aoContratoCriado`", async () => {
    mutateAsync.mockResolvedValue("contrato-1");
    const aoContratoCriado = vi.fn();
    render(
      <ContractForm
        aberto
        aoFechar={vi.fn()}
        contrato={CONTRATO_COMPLETO}
        aoContratoCriado={aoContratoCriado}
      />,
    );
    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(aoContratoCriado).not.toHaveBeenCalled();
  });

  it("D-071: a venda vem travada pelo nome e vai na gravação, sem depender da lista", async () => {
    vendas = { data: undefined, isError: true, isPending: false };
    mutateAsync.mockResolvedValue("k9");
    render(
      <ContractForm
        aberto
        aoFechar={vi.fn()}
        inicial={{ clienteId: "cliente-1", contrato: INICIAL, venda: VENDA_DA_PROPOSTA }}
        aoContratoCriado={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Venda de origem")).toHaveValue("Acme");
    expect(screen.getByLabelText("Venda de origem")).toBeDisabled();
    fireEvent.click(botaoSalvar());
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ oportunidadeId: "venda-p" }),
      ),
    );
  });
});

describe("ContractForm — apagar contrato (D-067)", () => {
  const BOTAO = { name: "Apagar contrato" };

  it("owner em contrato existente vê o botão", () => {
    render(<ContractForm aberto aoFechar={vi.fn()} contrato={CONTRATO_COMPLETO} podeApagar />);

    expect(screen.getByRole("button", BOTAO)).toBeInTheDocument();
  });

  it("🔴 no cadastro de contrato novo não há o que apagar, nem com escrita", () => {
    render(<ContractForm aberto aoFechar={vi.fn()} podeApagar />);

    expect(screen.queryByRole("button", BOTAO)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar contrato" })).toBeInTheDocument();
  });

  it("🔴 sem escrita (podeApagar ausente) o contrato existente não oferece apagar", () => {
    render(<ContractForm aberto aoFechar={vi.fn()} contrato={CONTRATO_COMPLETO} />);

    expect(screen.queryByRole("button", BOTAO)).not.toBeInTheDocument();
  });

  it("🔴 confirma só depois de digitar o nome do contrato, e diz o que sai e o que fica", async () => {
    const user = userEvent.setup();
    render(<ContractForm aberto aoFechar={vi.fn()} contrato={CONTRATO_COMPLETO} podeApagar />);

    await user.click(screen.getByRole("button", BOTAO));

    const dialogo = screen.getByRole("alertdialog", { name: 'Apagar "Combo 3 Frentes"?' });
    expect(dialogo).toHaveTextContent("os itens por frente, as participações");
    expect(dialogo).toHaveTextContent('voltam a aparecer em "Contratos da proposta a criar"');
    expect(dialogo).toHaveTextContent("Meses já fechados no Financeiro não mudam");
    expect(dialogo).toHaveTextContent("a receita e o custo de participação dele");
    expect(dialogo).toHaveTextContent('mude o status para "Encerrado"');
    expect(dialogo.textContent).not.toMatch(/[—–]/);

    const confirmar = screen.getByRole("button", { name: "Sim, apagar" });
    expect(confirmar).toBeDisabled();
    await user.type(screen.getByLabelText(/para confirmar/), "Combo 3");
    expect(confirmar).toBeDisabled();
    expect(apagarMutate).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/para confirmar/), " Frentes");
    expect(confirmar).toBeEnabled();
  });

  it("confirmado, apaga pelo id e fecha a ficha quando o banco responde", async () => {
    const aoFechar = vi.fn();
    const user = userEvent.setup();
    render(<ContractForm aberto aoFechar={aoFechar} contrato={CONTRATO_COMPLETO} podeApagar />);

    await user.click(screen.getByRole("button", BOTAO));
    await user.type(screen.getByLabelText(/para confirmar/), "Combo 3 Frentes");
    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));

    expect(apagarMutate).toHaveBeenCalledWith("contrato-1", expect.anything());
    expect(aoFechar).not.toHaveBeenCalled();
    const opcoes = apagarMutate.mock.calls[0]?.[1] as { onSuccess?: () => void } | undefined;
    opcoes?.onSuccess?.();
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("contrato sem nome pede o nome do cliente, e nunca libera com o campo vazio", async () => {
    const user = userEvent.setup();
    render(
      <ContractForm
        aberto
        aoFechar={vi.fn()}
        contrato={{ ...CONTRATO_COMPLETO, nome: "  " }}
        podeApagar
      />,
    );

    await user.click(screen.getByRole("button", BOTAO));

    expect(
      screen.getByRole("alertdialog", { name: 'Apagar "Cliente Teste"?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sim, apagar" })).toBeDisabled();
    await user.type(screen.getByLabelText(/para confirmar/), "Cliente Teste");
    expect(screen.getByRole("button", { name: "Sim, apagar" })).toBeEnabled();
  });
});

describe("ContractForm: duração e fidelidade do MRR (A1.2)", () => {
  const duracao = () => screen.getByLabelText("Duração (meses)");
  const fidelidade = () => screen.getByLabelText("Fidelidade (meses)");

  beforeEach(() => {
    mutateAsync.mockResolvedValue("contrato-1");
  });

  it("abre com o gravado; mudar e apagar grava o número e null", async () => {
    abrir({ ...CONTRATO_COMPLETO, duracaoMeses: 12, mesesDeFidelidade: 6 });
    expect(duracao()).toHaveValue("12");
    expect(fidelidade()).toHaveValue("6");

    fireEvent.change(duracao(), { target: { value: "24" } });
    fireEvent.change(fidelidade(), { target: { value: "" } });
    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({
      duracaoMeses: 24,
      mesesDeFidelidade: null,
    });
  });

  it("controle: sem mexer, salva o que estava gravado", async () => {
    abrir({ ...CONTRATO_COMPLETO, duracaoMeses: 12, mesesDeFidelidade: 6 });

    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({
      duracaoMeses: 12,
      mesesDeFidelidade: 6,
    });
  });

  it.each(["0", "-1", "2.5"])("duração %s trava o Salvar com a frase", (valor) => {
    abrir();

    fireEvent.change(duracao(), { target: { value: valor } });

    expect(
      screen.getByText("Duração precisa ser um número inteiro maior que zero."),
    ).toHaveAttribute("role", "alert");
    expect(botaoSalvar()).toBeDisabled();
    fireEvent.click(botaoSalvar());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "2.5"])("fidelidade %s trava o Salvar com a frase", (valor) => {
    abrir();

    fireEvent.change(fidelidade(), { target: { value: valor } });

    expect(
      screen.getByText("Fidelidade precisa ser um número inteiro maior que zero."),
    ).toHaveAttribute("role", "alert");
    expect(botaoSalvar()).toBeDisabled();
    fireEvent.click(botaoSalvar());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("apagar a duração grava null e mantém a fidelidade", async () => {
    abrir({ ...CONTRATO_COMPLETO, duracaoMeses: 12, mesesDeFidelidade: 6 });

    fireEvent.change(duracao(), { target: { value: "" } });
    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({
      duracaoMeses: null,
      mesesDeFidelidade: 6,
    });
  });

  it.each([
    ["duração", () => duracao(), "Duração"],
    ["fidelidade", () => fidelidade(), "Fidelidade"],
  ])("%s com texto que o navegador leria como vazio trava, não grava null", (_, campo, nome) => {
    abrir({ ...CONTRATO_COMPLETO, duracaoMeses: 12, mesesDeFidelidade: 6 });

    for (const lixo of ["12e", "1-"]) {
      fireEvent.change(campo(), { target: { value: lixo } });

      expect(campo()).toHaveValue(lixo);
      expect(
        screen.getByText(`${nome} precisa ser um número inteiro maior que zero.`),
      ).toHaveAttribute("role", "alert");
      expect(botaoSalvar()).toBeDisabled();
    }
    fireEvent.click(botaoSalvar());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("controle: o campo é de texto numérico, não de número", () => {
    abrir();

    expect(duracao()).toHaveAttribute("type", "text");
    expect(duracao()).toHaveAttribute("inputmode", "numeric");
    expect(fidelidade()).toHaveAttribute("type", "text");
    expect(fidelidade()).toHaveAttribute("inputmode", "numeric");
  });

  it("controle: no TCV os campos não aparecem e o gravado segue intacto", async () => {
    abrir({ ...CONTRATO_TCV, duracaoMeses: 6, mesesDeFidelidade: 3 });

    expect(screen.queryByLabelText("Duração (meses)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fidelidade (meses)")).not.toBeInTheDocument();
    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({
      duracaoMeses: 6,
      mesesDeFidelidade: 3,
    });
  });
});

describe("ContractForm: trocar o cliente na edição (A1.2)", () => {
  const AVISO =
    "Ao salvar, o contrato sai da ficha de Cliente Teste e vai para a de Outra Empresa. Se o responsável por Outra Empresa for gestor, ele passa a ver este contrato; se o responsável por Cliente Teste for gestor, ele deixa de ver.";

  beforeEach(() => {
    mutateAsync.mockResolvedValue("contrato-1");
    clientes = pronta([
      { id: "cliente-1", nome: "Cliente Teste" },
      { id: "cliente-2", nome: "Outra Empresa" },
    ]);
  });

  async function escolherCliente(nome: string) {
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Cliente" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: nome }));
  }

  it("avisa antes de salvar e grava o cliente novo", async () => {
    abrir();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();

    await escolherCliente("Outra Empresa");

    expect(screen.getByText(AVISO)).toBeInTheDocument();
    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ contratoId: "contrato-1", clienteId: "cliente-2" }),
    );
  });

  it("voltar ao cliente de antes tira o aviso", async () => {
    abrir();

    await escolherCliente("Outra Empresa");
    expect(screen.getByText(AVISO)).toBeInTheDocument();
    await escolherCliente("Cliente Teste");

    expect(screen.queryByText(/Ao salvar, o contrato sai da ficha/)).not.toBeInTheDocument();
  });
});

describe("ContractForm: venda de origem (D-071)", () => {
  const COM_VENDA: ContratoListado = { ...CONTRATO_COMPLETO, oportunidadeId: "venda-1" };

  beforeEach(() => {
    mutateAsync.mockResolvedValue("contrato-1");
    clientes = pronta([
      { id: "cliente-1", nome: "Cliente Teste" },
      { id: "cliente-2", nome: "Outra Empresa" },
    ]);
    vendas = {
      data: {
        ganhas: [{ id: "venda-livre", nome: "Beta" }],
        origens: [
          { vendaId: "venda-1", vendaNome: "Acme", clienteId: "cliente-1" },
          { vendaId: "venda-3", vendaNome: "Gama", clienteId: "cliente-2" },
        ],
      },
      isError: false,
      isPending: false,
    };
  });

  async function escolher(campo: string, opcao: string) {
    fireEvent.keyDown(screen.getByRole("combobox", { name: campo }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: opcao }));
  }

  async function vendaGravada(): Promise<unknown> {
    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    return (mutateAsync.mock.calls[0]?.[0] as { oportunidadeId: unknown }).oportunidadeId;
  }

  it("editar sem mexer na venda grava a venda que o contrato tem", async () => {
    abrir(COM_VENDA);
    expect(await vendaGravada()).toBe("venda-1");
  });

  it("oferece as ganhas sem contrato e as vendas do cliente, nunca a de outro cliente", async () => {
    abrir(COM_VENDA);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Venda de origem" }), {
      key: "ArrowDown",
    });
    const opcoes = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(opcoes).toEqual(["Nenhuma", "Acme", "Beta"]);
  });

  it("Nenhuma tira a venda", async () => {
    abrir(COM_VENDA);
    await escolher("Venda de origem", "Nenhuma");
    expect(await vendaGravada()).toBeNull();
  });

  it("🔴 trocar o cliente tira a venda escolhida que não é dele", async () => {
    abrir();
    await escolher("Cliente", "Cliente Teste");
    await escolher("Venda de origem", "Acme");
    await escolher("Cliente", "Outra Empresa");
    expect(await vendaGravada()).toBeNull();
  });

  it("🔴 edição: trocar o cliente mantém a venda que o contrato já tem (spec §4, o gatilho decide)", async () => {
    abrir(COM_VENDA);
    await escolher("Cliente", "Outra Empresa");
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Venda de origem" }), {
      key: "ArrowDown",
    });
    const opcoes = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(opcoes).toEqual(["Nenhuma", "Acme", "Beta", "Gama"]);
    fireEvent.keyDown(screen.getByRole("option", { name: "Acme" }), { key: "Escape" });
    expect(await vendaGravada()).toBe("venda-1");
  });

  it("ganha sem contrato continua escolhida ao trocar o cliente", async () => {
    abrir();
    await escolher("Venda de origem", "Beta");
    await escolher("Cliente", "Outra Empresa");
    expect(await vendaGravada()).toBe("venda-livre");
  });

  it("🔴 lista de vendas em erro trava o Salvar e não grava Nenhuma", () => {
    vendas = { data: undefined, isError: true, isPending: false };
    abrir(COM_VENDA);

    expect(botaoSalvar()).toBeDisabled();
    expect(screen.getByText(/a lista de vendas não pôde ser lida/)).toBeInTheDocument();
    fireEvent.click(botaoSalvar());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("positivo ao lado: com a lista lida, o mesmo contrato salva", () => {
    abrir(COM_VENDA);
    expect(botaoSalvar()).toBeEnabled();
  });

  it("pré-escolha: abre com o cliente e a venda escolhidos", () => {
    render(
      <ContractForm
        aberto
        aoFechar={vi.fn()}
        preEscolha={{ clienteId: "cliente-2", vendaId: "venda-livre" }}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Cliente" })).toHaveTextContent("Outra Empresa");
    expect(screen.getByRole("combobox", { name: "Venda de origem" })).toHaveTextContent("Beta");
    expect(screen.getByRole("combobox", { name: "Cliente" })).toBeEnabled();
  });
});
