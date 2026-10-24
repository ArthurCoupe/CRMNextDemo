import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const AUGUSTO = "3f1b8c02-91d4-4a67-b0e5-2c7a9d4e6f81";
const FERNANDO = "e2f9a173-5c48-4b20-9d6f-1a7e3c8b5042";
const DESLIGADA = "4b7c2e19-8d05-4f36-a1e2-9c3b6d8f0a52";
const CARLA = "9d6e0b24-7a13-4c58-8f2e-3b1a5c7d9e40";

const PADRAO_AUGUSTO = {
  id: "p1",
  linhaDeNegocio: "sistemas",
  perfilId: AUGUSTO,
  beneficiario: "Augusto",
  tipo: "producao",
  percentual: 15,
};
const PADRAO_FERNANDO = {
  id: "p2",
  linhaDeNegocio: "sistemas",
  perfilId: FERNANDO,
  beneficiario: "Fernando",
  tipo: "producao",
  percentual: 80,
};
const PESSOAS = [
  { id: AUGUSTO, nome: "Augusto", ativo: true },
  { id: FERNANDO, nome: "Fernando", ativo: true },
  { id: CARLA, nome: "Carla", ativo: true },
];

const ANTERIOR_AUGUSTO = {
  linhaDeNegocio: "sistemas",
  perfilId: AUGUSTO,
  tipo: "producao",
  percentual: 15,
};
const ANTERIOR_FERNANDO = {
  linhaDeNegocio: "sistemas",
  perfilId: FERNANDO,
  tipo: "producao",
  percentual: 80,
};

const atualizar = { mutateAsync: vi.fn(), isPending: false };
const adicionar = { mutateAsync: vi.fn(), isPending: false };
const desativar = { mutateAsync: vi.fn(), isPending: false };
let padroes: unknown[] = [PADRAO_AUGUSTO];

const pronto = (data: unknown) => ({ data, isError: false, isPending: false });

vi.mock("../hooks/use-shares", () => ({
  useTodosOsPadroes: () => pronto(padroes),
  usePessoasParaParticipacao: () => pronto(PESSOAS),
  useAtualizarPadrao: () => atualizar,
  useAdicionarPadrao: () => adicionar,
  useDesativarPadrao: () => desativar,
  useContratosSemParticipacao: () => pronto({ contratos: [], truncado: false }),
  useLimiarDeAlerta: () => pronto({ percentual: 60, confirmado: false }),
  useSalvarLimiarDeAlerta: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { DefaultSharesSettings } = await import("./default-shares-settings");
const { toast } = await import("sonner");

const FRASE_DO_PERCENTUAL =
  "O percentual precisa ser maior que 0 e no máximo 100, com até duas casas.";

beforeEach(() => {
  vi.clearAllMocks();
  atualizar.mutateAsync.mockReset();
  adicionar.mutateAsync.mockReset();
  desativar.mutateAsync.mockReset();
  padroes = [PADRAO_AUGUSTO];
});

async function digitar(rotulo: string, texto: string) {
  const user = userEvent.setup();
  const campo = screen.getByRole("spinbutton", { name: rotulo });
  await user.clear(campo);
  await user.type(campo, texto);
  return user;
}

describe("editar uma participação padrão", () => {
  it("grava o percentual novo com BU, pessoa e tipo da linha, e a linha como foi lida", async () => {
    render(<DefaultSharesSettings />);

    const user = await digitar("Percentual de Augusto em Sistemas", "20");
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(atualizar.mutateAsync).toHaveBeenCalledWith({
      id: "p1",
      anterior: ANTERIOR_AUGUSTO,
      padrao: { linhaDeNegocio: "sistemas", perfilId: AUGUSTO, tipo: "producao", percentual: 20 },
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Padrão atualizado. Contratos já criados não mudaram.",
    );
  });

  it("troca a pessoa pelo Select", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(screen.getByRole("combobox", { name: "Pessoa de Augusto em Sistemas" }));
    await user.click(await screen.findByRole("option", { name: "Fernando" }));
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(atualizar.mutateAsync).toHaveBeenCalledWith({
      id: "p1",
      anterior: ANTERIOR_AUGUSTO,
      padrao: { linhaDeNegocio: "sistemas", perfilId: FERNANDO, tipo: "producao", percentual: 15 },
    });
  });

  it("troca a linha de negócio pelo Select", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(
      screen.getByRole("combobox", { name: "Linha de negócio de Augusto em Sistemas" }),
    );
    await user.click(await screen.findByRole("option", { name: "Demanda" }));
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(atualizar.mutateAsync).toHaveBeenCalledWith({
      id: "p1",
      anterior: ANTERIOR_AUGUSTO,
      padrao: { linhaDeNegocio: "demanda", perfilId: AUGUSTO, tipo: "producao", percentual: 15 },
    });
  });

  it("troca o tipo pelo Select", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(screen.getByRole("combobox", { name: "Tipo de Augusto em Sistemas" }));
    await user.click(await screen.findByRole("option", { name: "Indicação" }));
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(atualizar.mutateAsync).toHaveBeenCalledWith({
      id: "p1",
      anterior: ANTERIOR_AUGUSTO,
      padrao: { linhaDeNegocio: "sistemas", perfilId: AUGUSTO, tipo: "indicacao", percentual: 15 },
    });
  });

  it("🔴 editar para 90% com outra de 15% na mesma BU não grava, e 85% grava", async () => {
    padroes = [PADRAO_AUGUSTO, PADRAO_FERNANDO];
    render(<DefaultSharesSettings />);

    let user = await digitar("Percentual de Fernando em Sistemas", "90");
    await user.click(screen.getAllByRole("button", { name: "Gravar" })[1]);

    expect(atualizar.mutateAsync).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/somaria 105%/));

    user = await digitar("Percentual de Fernando em Sistemas", "85");
    await user.click(screen.getAllByRole("button", { name: "Gravar" })[1]);

    expect(atualizar.mutateAsync).toHaveBeenCalledWith({
      id: "p2",
      anterior: ANTERIOR_FERNANDO,
      padrao: { linhaDeNegocio: "sistemas", perfilId: FERNANDO, tipo: "producao", percentual: 85 },
    });
  });

  it("🔴 trocar a pessoa de Fernando (80%) para Carla com 80% grava: a linha editada sai da soma", async () => {
    padroes = [PADRAO_AUGUSTO, PADRAO_FERNANDO];
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(screen.getByRole("combobox", { name: "Pessoa de Fernando em Sistemas" }));
    await user.click(await screen.findByRole("option", { name: "Carla" }));
    await user.click(screen.getAllByRole("button", { name: "Gravar" })[1]);

    expect(toast.error).not.toHaveBeenCalled();
    expect(atualizar.mutateAsync).toHaveBeenCalledWith({
      id: "p2",
      anterior: ANTERIOR_FERNANDO,
      padrao: { linhaDeNegocio: "sistemas", perfilId: CARLA, tipo: "producao", percentual: 80 },
    });
  });

  it("🔴 a trava otimista é a linha do PRIMEIRO toque: um refetch no meio não a troca", async () => {
    const { rerender } = render(<DefaultSharesSettings />);
    const user = await digitar("Percentual de Augusto em Sistemas", "20");

    padroes = [{ ...PADRAO_AUGUSTO, tipo: "venda", percentual: 30 }];
    rerender(<DefaultSharesSettings />);
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(atualizar.mutateAsync).toHaveBeenCalledWith({
      id: "p1",
      anterior: ANTERIOR_AUGUSTO,
      padrao: { linhaDeNegocio: "sistemas", perfilId: AUGUSTO, tipo: "producao", percentual: 20 },
    });
  });

  it("🔴 depois de gravar, a segunda edição da mesma linha leva a base NOVA, não a de antes do primeiro Gravar", async () => {
    const { rerender } = render(<DefaultSharesSettings />);
    let user = await digitar("Percentual de Augusto em Sistemas", "20");
    await user.click(screen.getByRole("button", { name: "Gravar" }));
    expect(atualizar.mutateAsync).toHaveBeenNthCalledWith(1, {
      id: "p1",
      anterior: ANTERIOR_AUGUSTO,
      padrao: { linhaDeNegocio: "sistemas", perfilId: AUGUSTO, tipo: "producao", percentual: 20 },
    });

    padroes = [{ ...PADRAO_AUGUSTO, percentual: 20 }];
    rerender(<DefaultSharesSettings />);
    user = await digitar("Percentual de Augusto em Sistemas", "25");
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(atualizar.mutateAsync).toHaveBeenNthCalledWith(2, {
      id: "p1",
      anterior: { ...ANTERIOR_AUGUSTO, percentual: 20 },
      padrao: { linhaDeNegocio: "sistemas", perfilId: AUGUSTO, tipo: "producao", percentual: 25 },
    });
  });

  it("tipo que não é produção avisa que o padrão não é aplicado", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    expect(screen.queryByText(/não é aplicado a contrato nenhum/)).toBeNull();
    await user.click(screen.getByRole("combobox", { name: "Tipo de Augusto em Sistemas" }));
    await user.click(await screen.findByRole("option", { name: "Venda" }));

    expect(screen.getByText(/não é aplicado a contrato nenhum/)).toBeInTheDocument();
  });

  it("🔴 percentual fora da faixa não chama o banco", async () => {
    render(<DefaultSharesSettings />);

    const user = await digitar("Percentual de Augusto em Sistemas", "0");
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(atualizar.mutateAsync).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(FRASE_DO_PERCENTUAL);
  });

  it("🔴 acima de 100 não chama o banco, e 100 grava", async () => {
    render(<DefaultSharesSettings />);

    let user = await digitar("Percentual de Augusto em Sistemas", "100.5");
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(atualizar.mutateAsync).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(FRASE_DO_PERCENTUAL);

    user = await digitar("Percentual de Augusto em Sistemas", "100");
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(atualizar.mutateAsync).toHaveBeenCalledWith({
      id: "p1",
      anterior: ANTERIOR_AUGUSTO,
      padrao: { linhaDeNegocio: "sistemas", perfilId: AUGUSTO, tipo: "producao", percentual: 100 },
    });
  });

  it("🔴 três casas não chamam o banco, e 53.02 grava", async () => {
    render(<DefaultSharesSettings />);

    let user = await digitar("Percentual de Augusto em Sistemas", "1.005");
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(atualizar.mutateAsync).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(FRASE_DO_PERCENTUAL);

    user = await digitar("Percentual de Augusto em Sistemas", "53.02");
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(atualizar.mutateAsync).toHaveBeenCalledWith({
      id: "p1",
      anterior: ANTERIOR_AUGUSTO,
      padrao: {
        linhaDeNegocio: "sistemas",
        perfilId: AUGUSTO,
        tipo: "producao",
        percentual: 53.02,
      },
    });
  });

  it("🔴 recusa do banco aparece como mensagem, não como sucesso", async () => {
    atualizar.mutateAsync.mockRejectedValueOnce(
      new Error(
        "O padrão não foi salvo: ele mudou em outra tela ou você não tem permissão. Recarregue a página e confira.",
      ),
    );
    render(<DefaultSharesSettings />);

    const user = await digitar("Percentual de Augusto em Sistemas", "20");
    await user.click(screen.getByRole("button", { name: "Gravar" }));

    expect(toast.error).toHaveBeenCalledWith(
      "O padrão não foi salvo: ele mudou em outra tela ou você não tem permissão. Recarregue a página e confira.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("pessoa desativada com padrão gravado aparece rotulada, e o campo não abre em branco", () => {
    padroes = [{ ...PADRAO_AUGUSTO, perfilId: DESLIGADA, beneficiario: "Ana" }];
    render(<DefaultSharesSettings />);

    expect(screen.getByRole("combobox", { name: "Pessoa de Ana em Sistemas" })).toHaveTextContent(
      "Ana (desativada)",
    );
  });
});

describe("a decisão da Demanda (D-004)", () => {
  const FRASE_DA_DEMANDA =
    "Demanda não tem participação padrão (D-004): a equipe de lá é remunerada por salário fixo. Adicionar uma aqui muda essa decisão: todo contrato novo comissionável de Demanda passaria a herdá-la.";

  it("sem padrão de Demanda, diz que adicionar muda a decisão; o Select de BU oferece Demanda", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    expect(screen.getByText(FRASE_DA_DEMANDA)).toBeInTheDocument();
    expect(screen.queryByText(/inventar remuneração/)).toBeNull();
    expect(screen.queryByText(/isso é deliberado/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Adicionar participação padrão" }));
    await user.click(screen.getByRole("combobox", { name: "Linha de negócio do novo padrão" }));
    expect(await screen.findByRole("option", { name: "Demanda" })).toBeInTheDocument();
  });

  it("o positivo ao lado: com padrão de Demanda cadastrado, o parágrafo some", () => {
    padroes = [PADRAO_AUGUSTO, { ...PADRAO_FERNANDO, linhaDeNegocio: "demanda" }];
    render(<DefaultSharesSettings />);

    expect(screen.queryByText(FRASE_DA_DEMANDA)).toBeNull();
  });
});

describe("avisos usam o token de aviso", () => {
  it("o aviso do tipo sem efeito e o do limiar não confirmado usam text-warning", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    expect(screen.getByText(/ainda não foi confirmado como regra da casa/)).toHaveClass(
      "text-warning",
    );
    expect(screen.queryByText(/não é aplicado a contrato nenhum/)).toBeNull();

    await user.click(screen.getByRole("combobox", { name: "Tipo de Augusto em Sistemas" }));
    await user.click(await screen.findByRole("option", { name: "Venda" }));

    expect(screen.getByText(/não é aplicado a contrato nenhum/)).toHaveClass("text-warning");
  });
});

describe("desativar e adicionar", () => {
  it("desativar chama a mutação com o id da linha", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(screen.getByRole("button", { name: "Desativar" }));

    expect(desativar.mutateAsync).toHaveBeenCalledWith("p1");
  });

  it("🔴 o aviso do Desativar diz o que saiu, para quem errou saber o que digitar de novo", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(screen.getByRole("button", { name: "Desativar" }));

    expect(toast.success).toHaveBeenCalledWith(
      "Participação padrão desativada: Augusto, Sistemas, Produção, 15%.",
    );
  });

  it("o aviso do Desativar mostra o percentual com vírgula e o tipo da linha", async () => {
    padroes = [{ ...PADRAO_AUGUSTO, tipo: "venda", percentual: 12.5 }];
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(screen.getByRole("button", { name: "Desativar" }));

    expect(toast.success).toHaveBeenCalledWith(
      "Participação padrão desativada: Augusto, Sistemas, Venda, 12,5%.",
    );
  });

  it("🔴 desativar recusado pelo banco aparece como mensagem, não como sucesso", async () => {
    desativar.mutateAsync.mockRejectedValueOnce(new Error("Nada foi alterado: só o owner."));
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(screen.getByRole("button", { name: "Desativar" }));

    expect(toast.error).toHaveBeenCalledWith("Nada foi alterado: só o owner.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("adicionar escolhe pessoa e percentual, e manda o padrão novo", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(screen.getByRole("button", { name: "Adicionar participação padrão" }));
    await user.click(screen.getByRole("combobox", { name: "Pessoa do novo padrão" }));
    await user.click(await screen.findByRole("option", { name: "Fernando" }));
    await digitar("Percentual do novo padrão", "10");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(adicionar.mutateAsync).toHaveBeenCalledWith({
      linhaDeNegocio: "sistemas",
      perfilId: FERNANDO,
      tipo: "producao",
      percentual: 10,
    });
  });

  it("🔴 adicionar sem pessoa não chama o banco", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(screen.getByRole("button", { name: "Adicionar participação padrão" }));
    await digitar("Percentual do novo padrão", "10");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(adicionar.mutateAsync).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Escolha a pessoa.");
  });

  it("🔴 adicionar acima do teto não chama o banco", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(screen.getByRole("button", { name: "Adicionar participação padrão" }));
    await user.click(screen.getByRole("combobox", { name: "Pessoa do novo padrão" }));
    await user.click(await screen.findByRole("option", { name: "Fernando" }));
    await digitar("Percentual do novo padrão", "90");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(adicionar.mutateAsync).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/somaria 105%/));
  });

  it("🔴 adicionar sem percentual não chama o banco", async () => {
    const user = userEvent.setup();
    render(<DefaultSharesSettings />);

    await user.click(screen.getByRole("button", { name: "Adicionar participação padrão" }));
    await user.click(screen.getByRole("combobox", { name: "Pessoa do novo padrão" }));
    await user.click(await screen.findByRole("option", { name: "Fernando" }));
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(adicionar.mutateAsync).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(FRASE_DO_PERCENTUAL);
  });
});
