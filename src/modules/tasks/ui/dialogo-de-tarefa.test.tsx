import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tarefa } from "../domain/task";
import {
  DialogoDeTarefa,
  FECHAMENTO_BARRADO,
  LINK_EM_EDICAO,
  PENDENTE_AO_FECHAR,
  PENDENTE_NAO_INCLUIDO,
} from "./dialogo-de-tarefa";

type Opcoes = { onSuccess?: () => void } | undefined;
const daCerto = (_v: unknown, opcoes: Opcoes) => opcoes?.onSuccess?.();

const atualizarMutate = vi.fn();
const apagarMutate = vi.fn();
const incluirPessoaMutate = vi.fn();
const removerPessoaMutate = vi.fn();
const incluirLinkMutate = vi.fn();
const removerLinkMutate = vi.fn();
const atualizarLinkMutate = vi.fn();
const atualizarLinkEstado = { isPending: false };

const TIME_PADRAO: readonly { id: string; nome: string }[] = [
  { id: "user-1", nome: "Fulano" },
  { id: "user-2", nome: "Beltrana" },
  { id: "user-3", nome: "Ciclano" },
];
const time: {
  data: readonly { id: string; nome: string }[] | undefined;
  isPending: boolean;
  isError: boolean;
} = { data: TIME_PADRAO, isPending: false, isError: false };
const catalogo = {
  data: [
    { categoria: "Comercial", tipo: "Follow-up" },
    { categoria: "Comercial", tipo: "Proposta" },
    { categoria: "Site · web", tipo: "Desenvolver site" },
  ],
  isPending: false,
  isError: false,
};
const clientes = { data: [{ id: "c1", nome: "Acme" }], isPending: false, isError: false };

vi.mock("../hooks/use-tasks", () => ({
  useAtualizarTarefa: () => ({ mutate: atualizarMutate, isPending: false }),
  useApagarTarefa: () => ({ mutate: apagarMutate, isPending: false }),
  useAdicionarParticipantes: () => ({ mutate: incluirPessoaMutate, isPending: false }),
  useRemoverParticipante: () => ({ mutate: removerPessoaMutate, isPending: false }),
  useAdicionarLink: () => ({ mutate: incluirLinkMutate, isPending: false }),
  useRemoverLink: () => ({ mutate: removerLinkMutate, isPending: false }),
  useAtualizarLink: () => ({
    mutate: atualizarLinkMutate,
    isPending: atualizarLinkEstado.isPending,
  }),
  usePessoasDoTime: () => time,
  useCatalogoDeTarefas: () => catalogo,
  useClientesParaSelecao: () => clientes,
}));

const perfil = { papel: "owner" as string | null, meuId: "user-1" as string | null };
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => perfil }));

const TAREFA: Tarefa = {
  id: "tarefa-1",
  titulo: "Revisar contrato",
  descricao: null,
  categoria: "Comercial",
  tipo: "Follow-up",
  responsavelId: "user-1",
  responsavel: "Fulano",
  clienteId: null,
  cliente: null,
  coluna: "todo",
  prioridade: "media",
  prazo: "2026-09-10",
  recorrencia: "nenhuma",
  raizRecorrente: null,
  criadoPor: "user-9",
  participantes: [],
  links: [],
  pastaDoDriveDoCliente: null,
};

const onFechar = vi.fn();

const MUTATES = [
  atualizarMutate,
  apagarMutate,
  incluirPessoaMutate,
  removerPessoaMutate,
  incluirLinkMutate,
  removerLinkMutate,
  atualizarLinkMutate,
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of MUTATES) m.mockReset();
  atualizarLinkEstado.isPending = false;
  perfil.papel = "owner";
  perfil.meuId = "user-1";
  time.data = TIME_PADRAO;
  time.isPending = false;
  time.isError = false;
});

function abrir(tarefa: Tarefa = TAREFA) {
  return render(<DialogoDeTarefa tarefa={tarefa} onFechar={onFechar} />);
}

const salvar = () => screen.getByRole("button", { name: "Salvar" });
const comoMember = (meuId: string) => {
  perfil.papel = "member";
  perfil.meuId = meuId;
};

describe("Salvar manda só o que mudou", () => {
  it("Salvar começa desabilitado e habilita depois de uma edição", async () => {
    const user = userEvent.setup();
    abrir();

    expect(salvar()).toBeDisabled();
    await user.type(screen.getByLabelText("Título"), " novo");
    expect(salvar()).toBeEnabled();
  });

  it("🔴 só o título mudou: só o título vai ao banco", async () => {
    const user = userEvent.setup();
    abrir();

    await user.clear(screen.getByLabelText("Título"));
    await user.type(screen.getByLabelText("Título"), "Revisar contrato novo");
    await user.click(salvar());

    expect(atualizarMutate).toHaveBeenCalledWith(
      { id: "tarefa-1", campos: { titulo: "Revisar contrato novo" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("deu certo: o diálogo fecha", async () => {
    atualizarMutate.mockImplementation(daCerto);
    const user = userEvent.setup();
    abrir();

    await user.type(screen.getByLabelText("Título"), " novo");
    await user.click(salvar());

    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("🔴 falhou: o diálogo fica aberto com o que foi digitado", async () => {
    atualizarMutate.mockImplementation(() => undefined);
    const user = userEvent.setup();
    abrir();

    await user.type(screen.getByLabelText("Título"), " novo");
    await user.click(salvar());

    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Título")).toHaveValue("Revisar contrato novo");
  });

  it("trocar o responsável manda { responsavelId }", async () => {
    const user = userEvent.setup();
    abrir();

    await user.selectOptions(screen.getByLabelText("Responsável"), "user-2");
    await user.click(salvar());

    expect(atualizarMutate).toHaveBeenCalledWith(
      { id: "tarefa-1", campos: { responsavelId: "user-2" } },
      expect.anything(),
    );
  });

  it("🔴 trocar a categoria limpa o tipo, e Salvar pede o tipo antes de gravar", async () => {
    const user = userEvent.setup();
    abrir();

    await user.selectOptions(screen.getByLabelText("Categoria"), "Site · web");
    expect(screen.getByLabelText("Tipo")).toHaveValue("");
    await user.click(salvar());
    expect(screen.getByText("Escolha o tipo da tarefa.")).toBeInTheDocument();
    expect(atualizarMutate).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("Tipo"), "Desenvolver site");
    await user.click(salvar());
    expect(atualizarMutate).toHaveBeenCalledWith(
      { id: "tarefa-1", campos: { categoria: "Site · web", tipo: "Desenvolver site" } },
      expect.anything(),
    );
  });

  it("🔴 título em branco não grava", async () => {
    const user = userEvent.setup();
    abrir();

    await user.clear(screen.getByLabelText("Título"));
    await user.click(salvar());

    expect(screen.getByText("O título da tarefa não pode ficar em branco.")).toBeInTheDocument();
    expect(atualizarMutate).not.toHaveBeenCalled();
  });

  it("🔴 o Prazo é um input nativo de data, não texto livre", () => {
    abrir();

    expect(screen.getByLabelText("Prazo")).toHaveAttribute("type", "date");
  });

  it("🔴 prazo com ano pela metade não grava", async () => {
    const user = userEvent.setup();
    abrir();

    fireEvent.change(screen.getByLabelText("Prazo"), { target: { value: "0002-09-10" } });
    await user.click(salvar());

    expect(screen.getByText("Prazo inválido. Use um ano entre 2000 e 2100.")).toBeInTheDocument();
    expect(atualizarMutate).not.toHaveBeenCalled();
  });

  it("prazo plausível grava { prazo }, e limpar grava null", async () => {
    const user = userEvent.setup();
    abrir();

    fireEvent.change(screen.getByLabelText("Prazo"), { target: { value: "2026-10-20" } });
    await user.click(salvar());
    expect(atualizarMutate).toHaveBeenLastCalledWith(
      { id: "tarefa-1", campos: { prazo: "2026-10-20" } },
      expect.anything(),
    );

    fireEvent.change(screen.getByLabelText("Prazo"), { target: { value: "" } });
    await user.click(salvar());
    expect(atualizarMutate).toHaveBeenLastCalledWith(
      { id: "tarefa-1", campos: { prazo: null } },
      expect.anything(),
    );
  });

  it("🔴 descrição acima de 2000 caracteres não grava e o texto fica na caixa", async () => {
    const user = userEvent.setup();
    abrir();
    const longa = "a".repeat(2001);

    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: longa } });
    await user.click(salvar());

    expect(
      screen.getByText("Descrição com 2001 caracteres: o limite é 2000. Encurte para gravar."),
    ).toBeInTheDocument();
    expect(atualizarMutate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Descrição")).toHaveValue(longa);
  });

  it("com 2000 caracteres exatos, grava (o positivo ao lado)", async () => {
    const user = userEvent.setup();
    abrir();
    const exata = "a".repeat(2000);

    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: exata } });
    await user.click(salvar());

    expect(atualizarMutate).toHaveBeenCalledWith(
      { id: "tarefa-1", campos: { descricao: exata } },
      expect.anything(),
    );
  });

  it("descrição vai sem espaço nas pontas, e apagar todo o texto grava null", async () => {
    const user = userEvent.setup();
    abrir({ ...TAREFA, descricao: "texto antigo" });

    await user.clear(screen.getByLabelText("Descrição"));
    await user.type(screen.getByLabelText("Descrição"), "  ligar amanhã  ");
    await user.click(salvar());
    expect(atualizarMutate).toHaveBeenLastCalledWith(
      { id: "tarefa-1", campos: { descricao: "ligar amanhã" } },
      expect.anything(),
    );

    await user.clear(screen.getByLabelText("Descrição"));
    await user.click(salvar());
    expect(atualizarMutate).toHaveBeenLastCalledWith(
      { id: "tarefa-1", campos: { descricao: null } },
      expect.anything(),
    );
  });
});

describe("fechar com edição pendente", () => {
  it("sem edição, Esc fecha", async () => {
    const user = userEvent.setup();
    abrir();

    await user.keyboard("{Escape}");

    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("🔴 com edição, Esc não fecha e diz como sair", async () => {
    const user = userEvent.setup();
    abrir();

    await user.type(screen.getByLabelText("Título"), " novo");
    await user.keyboard("{Escape}");

    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByText(FECHAMENTO_BARRADO)).toBeInTheDocument();
    expect(FECHAMENTO_BARRADO).toBe(
      "Há alterações não salvas. Salve, ou feche pelo X para descartar.",
    );
  });

  const cliqueFora = async () => {
    await new Promise((r) => setTimeout(r, 0));
    const fundo = screen.getByRole("dialog").previousElementSibling as HTMLElement;
    fireEvent.pointerDown(fundo);
    fireEvent.click(fundo);
  };

  it("🔴 com edição, clique fora não fecha e diz como sair", async () => {
    const user = userEvent.setup();
    abrir();

    await user.type(screen.getByLabelText("Título"), " novo");
    await cliqueFora();

    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByText(FECHAMENTO_BARRADO)).toBeInTheDocument();
  });

  it("sem edição, clique fora fecha (o positivo ao lado)", async () => {
    abrir();

    await cliqueFora();

    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("com edição, o X descarta e fecha", async () => {
    const user = userEvent.setup();
    abrir();

    await user.type(screen.getByLabelText("Título"), " novo");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  describe("link ou participante escolhido e não incluído", () => {
    type Usuario = ReturnType<typeof userEvent.setup>;
    const PENDENTES: readonly [string, (user: Usuario) => Promise<void>][] = [
      ["nome do link", (user) => user.type(screen.getByLabelText("Nome do link"), "Briefing")],
      [
        "endereço do link",
        (user) => user.type(screen.getByLabelText("Endereço do link"), "https://a.com"),
      ],
      [
        "pessoa escolhida",
        (user) => user.selectOptions(screen.getByLabelText("Pessoa para incluir"), "user-2"),
      ],
    ];

    it.each(PENDENTES)("🔴 %s: Esc não fecha e diz como sair", async (_caso, preencher) => {
      const user = userEvent.setup();
      abrir();

      await preencher(user);
      await user.keyboard("{Escape}");

      expect(onFechar).not.toHaveBeenCalled();
      expect(screen.getByText(PENDENTE_AO_FECHAR)).toBeInTheDocument();
      expect(screen.queryByText(FECHAMENTO_BARRADO)).not.toBeInTheDocument();
    });

    it.each(PENDENTES)("🔴 %s: clique fora não fecha e diz como sair", async (_caso, preencher) => {
      const user = userEvent.setup();
      abrir();

      await preencher(user);
      await cliqueFora();

      expect(onFechar).not.toHaveBeenCalled();
      expect(screen.getByText(PENDENTE_AO_FECHAR)).toBeInTheDocument();
      expect(screen.queryByText(FECHAMENTO_BARRADO)).not.toBeInTheDocument();
    });

    it("🔴 campo editado e link pendente: Esc avisa das alterações não salvas (o aviso de antes)", async () => {
      const user = userEvent.setup();
      abrir();

      await user.type(screen.getByLabelText("Título"), " novo");
      await user.type(screen.getByLabelText("Nome do link"), "Briefing");
      await user.keyboard("{Escape}");

      expect(onFechar).not.toHaveBeenCalled();
      expect(screen.getByText(FECHAMENTO_BARRADO)).toBeInTheDocument();
      expect(screen.queryByText(PENDENTE_AO_FECHAR)).not.toBeInTheDocument();
    });

    type Passo = (user: Usuario) => Promise<void>;
    const caixa =
      (rotulo: string, texto: string): Passo =>
      (user) =>
        user.type(screen.getByLabelText(rotulo), texto);
    const pessoa =
      (id: string): Passo =>
      (user) =>
        user.selectOptions(screen.getByLabelText("Pessoa para incluir"), id);
    const MEXE: readonly [string, Passo, Passo][] = [
      ["nome do link", caixa("Nome do link", "Briefing"), caixa("Nome do link", "s")],
      [
        "endereço do link",
        caixa("Endereço do link", "https://a.com"),
        caixa("Endereço do link", "/x"),
      ],
      ["pessoa escolhida", pessoa("user-2"), pessoa("user-3")],
    ];

    it.each(MEXE)(
      "🔴 %s: mexer na caixa depois do Esc barrado tira o aviso",
      async (_caso, preencher, mexe) => {
        const user = userEvent.setup();
        abrir();

        await preencher(user);
        await user.keyboard("{Escape}");
        expect(screen.getByText(PENDENTE_AO_FECHAR)).toBeInTheDocument();
        await mexe(user);

        expect(screen.queryByText(PENDENTE_AO_FECHAR)).not.toBeInTheDocument();
      },
    );

    it.each(MEXE)(
      "🔴 %s: mexer na caixa depois do Salvar recusado tira a recusa",
      async (_caso, preencher, mexe) => {
        const user = userEvent.setup();
        abrir();

        await user.type(screen.getByLabelText("Título"), " novo");
        await preencher(user);
        await user.click(salvar());
        expect(screen.getByText(PENDENTE_NAO_INCLUIDO)).toBeInTheDocument();
        await mexe(user);

        expect(screen.queryByText(PENDENTE_NAO_INCLUIDO)).not.toBeInTheDocument();
      },
    );

    it.each(PENDENTES)("🔴 %s: Salvar recusa, não grava e não fecha", async (_caso, preencher) => {
      atualizarMutate.mockImplementation(daCerto);
      const user = userEvent.setup();
      abrir();

      await user.type(screen.getByLabelText("Título"), " novo");
      await preencher(user);
      await user.click(salvar());

      expect(screen.getByText(PENDENTE_NAO_INCLUIDO)).toBeInTheDocument();
      expect(atualizarMutate).not.toHaveBeenCalled();
      expect(onFechar).not.toHaveBeenCalled();
    });

    it("com as caixas vazias, Salvar grava e fecha (o positivo ao lado)", async () => {
      atualizarMutate.mockImplementation(daCerto);
      const user = userEvent.setup();
      abrir();

      await user.type(screen.getByLabelText("Título"), " novo");
      await user.click(salvar());

      expect(atualizarMutate).toHaveBeenCalledTimes(1);
      expect(onFechar).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(PENDENTE_NAO_INCLUIDO)).not.toBeInTheDocument();
    });

    it("a mensagem diz o que fazer", () => {
      expect(PENDENTE_NAO_INCLUIDO).toBe(
        "Há link ou participante escolhido e não incluído: inclua ou limpe antes de salvar.",
      );
      expect(PENDENTE_AO_FECHAR).toBe(
        "Há link ou participante escolhido e não incluído: inclua, limpe ou feche pelo X para descartar.",
      );
    });
  });
});

describe("responsável — lista falhando (I2) e pessoa fora da lista", () => {
  it("🔴 lista em erro: avisa e trava o seletor (não vira 'Sem responsável' de um clique)", () => {
    time.data = undefined;
    time.isError = true;
    abrir();

    expect(
      screen.getByText(/Não foi possível ler a lista de quem pode ser responsável/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Responsável")).toBeDisabled();
  });

  it("lista lida: nem aviso nem trava (o positivo ao lado)", () => {
    abrir();

    expect(
      screen.queryByText(/Não foi possível ler a lista de quem pode ser responsável/),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Responsável")).toBeEnabled();
  });

  it("🔴 responsável fora da lista aparece no seletor, rotulado e desabilitado", () => {
    abrir({ ...TAREFA, responsavelId: "user-9", responsavel: "Sicrana" });

    expect(screen.getByRole("option", { name: "Sicrana (fora da lista)" })).toBeDisabled();
    expect(screen.getByLabelText("Responsável")).toHaveDisplayValue("Sicrana (fora da lista)");
  });

  it("responsável ativo não ganha o rótulo", () => {
    abrir();

    expect(screen.queryByRole("option", { name: /fora da lista/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Responsável")).toHaveDisplayValue("Fulano");
  });

  it("enquanto a lista carrega, ninguém é marcado como fora da lista", () => {
    time.data = undefined;
    time.isPending = true;
    abrir({ ...TAREFA, responsavelId: "user-9", responsavel: "Sicrana" });

    expect(screen.queryByText(/fora da lista/)).not.toBeInTheDocument();
  });

  it("🔴 lista em erro: o seletor travado mostra o nome do responsável, não 'Sem responsável'", () => {
    time.data = undefined;
    time.isError = true;
    abrir();

    expect(screen.getByLabelText("Responsável")).toBeDisabled();
    expect(screen.getByLabelText("Responsável")).toHaveDisplayValue("Fulano");
  });

  it("🔴 lista carregando: o seletor travado mostra o nome do responsável", () => {
    time.data = undefined;
    time.isPending = true;
    abrir();

    expect(screen.getByLabelText("Responsável")).toBeDisabled();
    expect(screen.getByLabelText("Responsável")).toHaveDisplayValue("Fulano");
  });

  it("lista em erro mas com dado antigo: o responsável aparece uma vez só", () => {
    time.isError = true;
    abrir();

    expect(screen.getAllByRole("option", { name: "Fulano" })).toHaveLength(1);
    expect(screen.getByLabelText("Responsável")).toHaveDisplayValue("Fulano");
  });

  it("tarefa sem responsável continua mostrando 'Sem responsável' com a lista em erro", () => {
    time.data = undefined;
    time.isError = true;
    abrir({ ...TAREFA, responsavelId: null, responsavel: null });

    expect(screen.getByLabelText("Responsável")).toHaveDisplayValue("Sem responsável");
  });
});

describe("quem vê o quê (D-066)", () => {
  it("🔴 member que não responde nem participa: só leitura, sem Salvar nem Apagar", () => {
    comoMember("user-2");
    abrir();

    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apagar tarefa" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Pessoa para incluir")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome do link")).not.toBeInTheDocument();
  });

  it("owner vê edição, seletor de responsável e Apagar (o positivo ao lado)", () => {
    abrir();

    expect(screen.getByLabelText("Título")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Responsável" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apagar tarefa" })).toBeInTheDocument();
  });

  it("🔴 member responsável edita, mas não troca o responsável nem apaga", () => {
    comoMember("user-1");
    abrir();

    expect(screen.getByLabelText("Título")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Responsável" })).not.toBeInTheDocument();
    expect(screen.getByText("Responsável: Fulano")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apagar tarefa" })).not.toBeInTheDocument();
  });

  it("🔴 participante edita como o responsável", () => {
    comoMember("user-2");
    abrir({ ...TAREFA, participantes: [{ id: "user-2", nome: "Beltrana", ativo: true }] });

    expect(screen.getByLabelText("Título")).toBeInTheDocument();
    expect(screen.getByLabelText("Pessoa para incluir")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do link")).toBeInTheDocument();
  });

  it("member que criou e não participa vê Apagar, mas não edita", () => {
    comoMember("user-9");
    abrir();

    expect(screen.getByRole("button", { name: "Apagar tarefa" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
  });

  it("🔴 member que criou e não edita inclui e remove participantes; o resto fica só leitura", async () => {
    comoMember("user-9");
    const user = userEvent.setup();
    abrir({ ...TAREFA, participantes: [{ id: "user-2", nome: "Beltrana", ativo: true }] });

    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome do link")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Pessoa para incluir"), "user-3");
    await user.click(screen.getByRole("button", { name: "Incluir participante" }));
    await user.click(screen.getByRole("button", { name: "Remover Beltrana" }));

    expect(incluirPessoaMutate).toHaveBeenCalledWith(
      { taskId: "tarefa-1", profileIds: ["user-3"] },
      expect.anything(),
    );
    expect(removerPessoaMutate).toHaveBeenCalledWith({ taskId: "tarefa-1", profileId: "user-2" });
  });

  it("🔴 card de onboarding: quem criou não vê Apagar", () => {
    comoMember("user-9");
    abrir({ ...TAREFA, categoria: "Onboarding · método", tipo: "Kickoff" });

    expect(screen.queryByRole("button", { name: "Apagar tarefa" })).not.toBeInTheDocument();
  });

  it("🔴 responsável desativado (papel null, sessão válida): só leitura", () => {
    perfil.papel = null;
    perfil.meuId = "user-1";
    abrir();

    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apagar tarefa" })).not.toBeInTheDocument();
  });

  it("manager vê o seletor de responsável", () => {
    perfil.papel = "manager";
    perfil.meuId = "user-5";
    abrir();

    expect(screen.getByRole("combobox", { name: "Responsável" })).toBeInTheDocument();
  });
});

describe("apagar", () => {
  it("🔴 pede confirmação nomeando a tarefa, e fecha quando apaga", async () => {
    apagarMutate.mockImplementation(daCerto);
    const user = userEvent.setup();
    abrir();

    await user.click(screen.getByRole("button", { name: "Apagar tarefa" }));
    expect(screen.getByText('Apagar "Revisar contrato"?')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apagar" }));

    expect(apagarMutate).toHaveBeenCalledWith(
      "tarefa-1",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("🔴 o banco recusou (sem onSuccess): o diálogo não fecha", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(screen.getByRole("button", { name: "Apagar tarefa" }));
    await user.click(screen.getByRole("button", { name: "Apagar" }));

    expect(apagarMutate).toHaveBeenCalledTimes(1);
    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Revisar contrato" })).toBeInTheDocument();
  });

  it("🔴 Cancelar na confirmação não apaga e não fecha o diálogo", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(screen.getByRole("button", { name: "Apagar tarefa" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(apagarMutate).not.toHaveBeenCalled();
    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Revisar contrato" })).toBeInTheDocument();
  });
});

describe("participantes", () => {
  const secao = () => within(screen.getByRole("region", { name: "Participantes" }));

  it("lista quem participa, marca o inativo, e remove", async () => {
    const user = userEvent.setup();
    abrir({
      ...TAREFA,
      participantes: [
        { id: "user-2", nome: "Beltrana", ativo: true },
        { id: "user-8", nome: "Sicrana", ativo: false },
      ],
    });

    expect(secao().getByText("Beltrana")).toBeInTheDocument();
    expect(secao().getByText("(inativo)")).toBeInTheDocument();
    await user.click(secao().getByRole("button", { name: "Remover Beltrana" }));

    expect(removerPessoaMutate).toHaveBeenCalledWith({ taskId: "tarefa-1", profileId: "user-2" });
  });

  it("🔴 incluir oferece só quem não é responsável nem participante, e limpa depois", async () => {
    incluirPessoaMutate.mockImplementation(daCerto);
    const user = userEvent.setup();
    abrir({ ...TAREFA, participantes: [{ id: "user-2", nome: "Beltrana", ativo: true }] });
    const seletor = secao().getByLabelText("Pessoa para incluir");

    expect(
      within(seletor)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Escolha…", "Ciclano"]);
    expect(secao().getByRole("button", { name: "Incluir participante" })).toBeDisabled();

    await user.selectOptions(seletor, "user-3");
    await user.click(secao().getByRole("button", { name: "Incluir participante" }));

    expect(incluirPessoaMutate).toHaveBeenCalledWith(
      { taskId: "tarefa-1", profileIds: ["user-3"] },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(seletor).toHaveValue("");
  });

  const INCLUIDA_POR_OUTRO: Tarefa = {
    ...TAREFA,
    participantes: [{ id: "user-2", nome: "Beltrana", ativo: true }],
  };

  it("🔴 a escolhida sai dos candidatos na releitura: o seletor volta a 'Escolha…' e o Esc fecha", async () => {
    const user = userEvent.setup();
    const { rerender } = abrir();
    await user.selectOptions(secao().getByLabelText("Pessoa para incluir"), "user-2");

    rerender(<DialogoDeTarefa tarefa={INCLUIDA_POR_OUTRO} onFechar={onFechar} />);
    const seletor = secao().getByLabelText("Pessoa para incluir");

    expect(seletor).toHaveValue("");
    expect((seletor as HTMLSelectElement).selectedOptions[0]?.textContent).toBe("Escolha…");
    expect(secao().getByRole("button", { name: "Incluir participante" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("🔴 a escolhida sai dos candidatos na releitura: Salvar grava o título sem recusa", async () => {
    atualizarMutate.mockImplementation(daCerto);
    const user = userEvent.setup();
    const { rerender } = abrir();
    await user.type(screen.getByLabelText("Título"), " novo");
    await user.selectOptions(secao().getByLabelText("Pessoa para incluir"), "user-2");

    rerender(<DialogoDeTarefa tarefa={INCLUIDA_POR_OUTRO} onFechar={onFechar} />);
    await user.click(salvar());

    expect(screen.queryByText(PENDENTE_NAO_INCLUIDO)).not.toBeInTheDocument();
    expect(atualizarMutate).toHaveBeenCalledTimes(1);
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("a escolhida segue nos candidatos na releitura: continua pendente (o positivo ao lado)", async () => {
    const user = userEvent.setup();
    const { rerender } = abrir();
    await user.selectOptions(secao().getByLabelText("Pessoa para incluir"), "user-2");

    rerender(
      <DialogoDeTarefa tarefa={{ ...TAREFA, titulo: "Revisar contrato" }} onFechar={onFechar} />,
    );
    await user.keyboard("{Escape}");

    expect(secao().getByLabelText("Pessoa para incluir")).toHaveValue("user-2");
    expect(onFechar).not.toHaveBeenCalled();
  });

  it("sem participantes, diz isso", () => {
    abrir();

    expect(secao().getByText("Sem participantes.")).toBeInTheDocument();
  });

  it("quem só lê vê a lista, sem botão de remover nem seletor", () => {
    comoMember("user-5");
    abrir({ ...TAREFA, participantes: [{ id: "user-2", nome: "Beltrana", ativo: true }] });

    expect(secao().getByText("Beltrana")).toBeInTheDocument();
    expect(secao().queryByRole("button", { name: /Remover/ })).not.toBeInTheDocument();
    expect(secao().queryByLabelText("Pessoa para incluir")).not.toBeInTheDocument();
  });
});

describe("links", () => {
  const secao = () => within(screen.getByRole("region", { name: "Links" }));
  const COM_LINKS: Tarefa = {
    ...TAREFA,
    pastaDoDriveDoCliente: "https://drive.google.com/drive/folders/abc",
    links: [{ id: "l1", rotulo: "Briefing", url: "https://docs.google.com/x" }],
  };

  it("🔴 a pasta do Drive vem primeiro, e todo link abre em aba nova sem opener", () => {
    abrir(COM_LINKS);
    const ancoras = secao().getAllByRole("link");

    expect(ancoras.map((a) => a.textContent)).toEqual(["Pasta do cliente no Drive", "Briefing"]);
    expect(ancoras[0]).toHaveAttribute("href", "https://drive.google.com/drive/folders/abc");
    for (const a of ancoras) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("🔴 o host aparece ao lado do rótulo, e o texto do link segue sendo o rótulo", () => {
    abrir({
      ...TAREFA,
      links: [
        { id: "l1", rotulo: "Briefing", url: "https://docs.google.com/x" },
        { id: "l2", rotulo: "Pasta", url: "https://drive.google.com.evil.example/x" },
      ],
    });

    expect(secao().getByText("· docs.google.com")).toBeInTheDocument();
    expect(secao().getByText("· drive.google.com.evil.example")).toBeInTheDocument();
    expect(secao().getByRole("link", { name: "Pasta" })).toBeInTheDocument();
  });

  it("🔴 o host não é cortado (o fim é o domínio que importa), e a âncora traz o endereço no title", () => {
    const url = "https://drive.google.com.um-subdominio-bem-comprido.evil.example/x";
    abrir({ ...TAREFA, links: [{ id: "l2", rotulo: "Pasta", url }] });
    const host = secao().getByText("· drive.google.com.um-subdominio-bem-comprido.evil.example");

    expect(host).not.toHaveClass("truncate");
    expect(host).toHaveClass("break-all");
    expect(secao().getByRole("link", { name: "Pasta" })).toHaveAttribute("title", url);
  });

  it("remover link manda o id", async () => {
    const user = userEvent.setup();
    abrir(COM_LINKS);

    await user.click(secao().getByRole("button", { name: "Remover link Briefing" }));

    expect(removerLinkMutate).toHaveBeenCalledWith("l1");
  });

  it("🔴 http:// é recusado antes do banco, com a mensagem", async () => {
    const user = userEvent.setup();
    abrir();

    await user.type(secao().getByLabelText("Nome do link"), "Site");
    await user.type(secao().getByLabelText("Endereço do link"), "http://a.com");
    await user.click(secao().getByRole("button", { name: "Incluir link" }));

    expect(
      secao().getByText("O link precisa começar com https:// e ter até 2.000 caracteres."),
    ).toBeInTheDocument();
    expect(incluirLinkMutate).not.toHaveBeenCalled();
  });

  it("link válido vai sem espaço nas pontas, e os campos limpam depois", async () => {
    incluirLinkMutate.mockImplementation(daCerto);
    const user = userEvent.setup();
    abrir();

    await user.type(secao().getByLabelText("Nome do link"), " Briefing ");
    await user.type(secao().getByLabelText("Endereço do link"), " https://docs.google.com/x ");
    await user.click(secao().getByRole("button", { name: "Incluir link" }));

    expect(incluirLinkMutate).toHaveBeenCalledWith(
      { taskId: "tarefa-1", rotulo: "Briefing", url: "https://docs.google.com/x" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(secao().getByLabelText("Nome do link")).toHaveValue("");
    expect(secao().getByLabelText("Endereço do link")).toHaveValue("");
  });

  it("sem links e sem pasta: diz que não há, e nenhum atalho aparece", () => {
    abrir();

    expect(secao().getByText("Sem links.")).toBeInTheDocument();
    expect(secao().queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("editar link (entrega B)", () => {
  const secao = () => within(screen.getByRole("region", { name: "Links" }));
  const COM_LINK: Tarefa = {
    ...TAREFA,
    links: [{ id: "l1", rotulo: "Briefing", url: "https://docs.google.com/x" }],
  };
  const editar = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(secao().getByRole("button", { name: "Editar link Briefing" }));

  it("abrir a edição mostra o rótulo e o endereço atuais", async () => {
    const user = userEvent.setup();
    abrir(COM_LINK);

    await editar(user);

    expect(secao().getByLabelText("Nome do link Briefing")).toHaveValue("Briefing");
    expect(secao().getByLabelText("Endereço do link Briefing")).toHaveValue(
      "https://docs.google.com/x",
    );
  });

  it("os campos do editor têm placeholder, como a linha de inclusão", async () => {
    const user = userEvent.setup();
    abrir(COM_LINK);
    await editar(user);

    expect(secao().getByLabelText("Nome do link Briefing")).toHaveAttribute(
      "placeholder",
      "Nome do link",
    );
    expect(secao().getByLabelText("Endereço do link Briefing")).toHaveAttribute(
      "placeholder",
      "https://",
    );
  });

  it("salvar manda o id e os valores sem espaço nas pontas, e a edição fecha", async () => {
    atualizarLinkMutate.mockImplementation(daCerto);
    const user = userEvent.setup();
    abrir(COM_LINK);
    await editar(user);

    const nome = secao().getByLabelText("Nome do link Briefing");
    const endereco = secao().getByLabelText("Endereço do link Briefing");
    await user.clear(nome);
    await user.type(nome, " Contrato ");
    await user.clear(endereco);
    await user.type(endereco, " https://docs.google.com/y ");
    await user.click(secao().getByRole("button", { name: "Salvar link" }));

    expect(atualizarLinkMutate).toHaveBeenCalledWith(
      { id: "l1", rotulo: "Contrato", url: "https://docs.google.com/y" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(secao().queryByLabelText("Nome do link Briefing")).not.toBeInTheDocument();
  });

  it("gravação que falha deixa a edição aberta com o que foi digitado", async () => {
    const user = userEvent.setup();
    abrir(COM_LINK);
    await editar(user);

    const nome = secao().getByLabelText("Nome do link Briefing");
    await user.clear(nome);
    await user.type(nome, "Contrato");
    await user.click(secao().getByRole("button", { name: "Salvar link" }));

    expect(atualizarLinkMutate).toHaveBeenCalledTimes(1);
    expect(secao().getByLabelText("Nome do link Briefing")).toHaveValue("Contrato");
  });

  it("javascript: é recusado antes do banco, com a frase", async () => {
    const user = userEvent.setup();
    abrir(COM_LINK);
    await editar(user);

    const endereco = secao().getByLabelText("Endereço do link Briefing");
    await user.clear(endereco);
    await user.type(endereco, "javascript:alert(1)");
    await user.click(secao().getByRole("button", { name: "Salvar link" }));

    expect(
      secao().getByText("O link precisa começar com https:// e ter até 2.000 caracteres."),
    ).toBeInTheDocument();
    expect(atualizarLinkMutate).not.toHaveBeenCalled();
  });

  it("Cancelar descarta o que foi digitado, fecha sem gravar, e o Salvar volta a gravar o título", async () => {
    atualizarMutate.mockImplementation(daCerto);
    const user = userEvent.setup();
    abrir(COM_LINK);
    await editar(user);

    await user.type(secao().getByLabelText("Nome do link Briefing"), "X");
    await user.click(secao().getByRole("button", { name: "Cancelar" }));
    expect(atualizarLinkMutate).not.toHaveBeenCalled();
    expect(secao().getByRole("link", { name: "Briefing" })).toBeInTheDocument();

    await editar(user);
    expect(secao().getByLabelText("Nome do link Briefing")).toHaveValue("Briefing");
    expect(secao().getByLabelText("Endereço do link Briefing")).toHaveValue(
      "https://docs.google.com/x",
    );
    await user.click(secao().getByRole("button", { name: "Cancelar" }));

    await user.type(screen.getByLabelText("Título"), " novo");
    await user.click(salvar());
    expect(atualizarMutate).toHaveBeenCalledTimes(1);
  });

  it("quem só lê não vê o lápis; o owner vê (o positivo ao lado)", () => {
    comoMember("user-5");
    const { unmount } = abrir(COM_LINK);
    expect(secao().queryByRole("button", { name: /Editar link/ })).not.toBeInTheDocument();
    unmount();

    perfil.papel = "owner";
    perfil.meuId = "user-1";
    abrir(COM_LINK);
    expect(secao().getByRole("button", { name: "Editar link Briefing" })).toBeInTheDocument();
  });

  it("com um link em edição, Esc não fecha e diz como sair", async () => {
    const user = userEvent.setup();
    abrir(COM_LINK);
    await editar(user);

    await user.keyboard("{Escape}");

    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByText(LINK_EM_EDICAO)).toBeInTheDocument();
    expect(LINK_EM_EDICAO).toBe("Há um link em edição: salve ou cancele a edição do link.");
  });

  it("título editado e link em edição: Salvar recusa e diz por quê, sem gravar", async () => {
    const user = userEvent.setup();
    abrir(COM_LINK);

    await user.type(screen.getByLabelText("Título"), " novo");
    await editar(user);
    await user.click(salvar());

    expect(atualizarMutate).not.toHaveBeenCalled();
    expect(screen.getByText(LINK_EM_EDICAO)).toBeInTheDocument();
  });

  it("a releitura sem o link fecha a edição e o Esc volta a fechar", async () => {
    const user = userEvent.setup();
    const { rerender } = abrir(COM_LINK);
    await editar(user);

    rerender(<DialogoDeTarefa tarefa={{ ...COM_LINK, links: [] }} onFechar={onFechar} />);
    expect(secao().queryByLabelText("Nome do link Briefing")).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("com dois links, editar um trava o lápis do outro", async () => {
    const user = userEvent.setup();
    abrir({
      ...TAREFA,
      links: [
        { id: "l1", rotulo: "Briefing", url: "https://docs.google.com/x" },
        { id: "l2", rotulo: "Site", url: "https://a.com" },
      ],
    });

    await editar(user);

    expect(secao().getByRole("button", { name: "Editar link Site" })).toBeDisabled();
  });

  it("gravando, os campos e os botões travam: dois cliques em Salvar link gravam uma vez só", async () => {
    const user = userEvent.setup();
    const { rerender } = abrir(COM_LINK);
    await editar(user);
    const nome = secao().getByLabelText("Nome do link Briefing");
    const endereco = secao().getByLabelText("Endereço do link Briefing");
    const salvarLink = () => secao().getByRole("button", { name: "Salvar link" });
    const cancelar = () => secao().getByRole("button", { name: "Cancelar" });

    expect(nome).toBeEnabled();
    expect(endereco).toBeEnabled();
    expect(salvarLink()).toBeEnabled();
    expect(cancelar()).toBeEnabled();
    await user.click(salvarLink());
    expect(atualizarLinkMutate).toHaveBeenCalledTimes(1);

    atualizarLinkEstado.isPending = true;
    rerender(<DialogoDeTarefa tarefa={COM_LINK} onFechar={onFechar} />);
    await user.click(salvarLink());

    expect(atualizarLinkMutate).toHaveBeenCalledTimes(1);
    expect(nome).toBeDisabled();
    expect(endereco).toBeDisabled();
    expect(salvarLink()).toBeDisabled();
    expect(cancelar()).toBeDisabled();
  });
});

describe("avisos de recorrência", () => {
  const RAIZ: Tarefa = { ...TAREFA, recorrencia: "mensal", raizRecorrente: null };
  const FILHA: Tarefa = { ...TAREFA, recorrencia: "mensal", raizRecorrente: "raiz-1" };

  it("🔴 na RAIZ, o dia do prazo ancora o mês", () => {
    abrir(RAIZ);

    expect(
      screen.getByText(
        "Raiz da recorrência: o dia deste prazo ancora o dia do mês das próximas ocorrências.",
      ),
    ).toBeInTheDocument();
  });

  it("🔴 na FILHA, a próxima nasce do maior prazo da corrente", () => {
    abrir(FILHA);

    expect(
      screen.getByText(
        "Tarefa recorrente: a próxima ocorrência nasce do maior prazo da corrente, inclusive este.",
      ),
    ).toBeInTheDocument();
  });

  it("tarefa não recorrente não mostra aviso nenhum", () => {
    abrir();

    expect(screen.queryByText(/recorrência|recorrente/)).not.toBeInTheDocument();
  });

  it("🔴 o aviso também aparece para quem só lê", () => {
    comoMember("user-5");
    abrir(RAIZ);

    expect(screen.getByText(/Raiz da recorrência/)).toBeInTheDocument();
  });

  it("🔴 recorrente aberta avisa que a descrição passa adiante", () => {
    abrir(RAIZ);

    expect(
      screen.getByText("Tarefa recorrente: esta descrição passa para a próxima ocorrência."),
    ).toBeInTheDocument();
  });

  it("recorrente já concluída não avisa da descrição (a próxima já nasceu)", () => {
    abrir({ ...RAIZ, coluna: "done" });

    expect(screen.queryByText(/esta descrição passa/)).not.toBeInTheDocument();
  });
});

describe("recorrência editável (A1.3)", () => {
  const AO_CONCLUIR =
    "A nova recorrência (Toda semana) vale quando esta tarefa for concluída: se não houver outra ocorrência aberta desta tarefa, a próxima nasce com ela e passa a regra adiante.";
  const PARA_AQUI =
    "Ao concluir esta tarefa, ela não gera a próxima ocorrência. Se não houver outra ocorrência aberta desta tarefa, a corrente para aqui.";
  const JA_CONCLUIDA =
    "Esta tarefa já está concluída: a recorrência nova não cria nem muda ocorrência agora. Para mudar a corrente, edite a ocorrência aberta, se houver.";

  it("trocar a recorrência manda só ela ao banco", async () => {
    const user = userEvent.setup();
    abrir();

    await user.selectOptions(screen.getByLabelText("Recorrência"), "mensal");
    await user.click(salvar());

    expect(atualizarMutate).toHaveBeenCalledWith(
      { id: "tarefa-1", campos: { recorrencia: "mensal" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("tarefa aberta que passa a repetir: vale ao concluir", async () => {
    const user = userEvent.setup();
    abrir();

    await user.selectOptions(screen.getByLabelText("Recorrência"), "semanal");

    expect(screen.getByText(AO_CONCLUIR)).toBeInTheDocument();
  });

  it("ocorrência filha que deixa de repetir: a corrente para ao concluir", async () => {
    const user = userEvent.setup();
    abrir({ ...TAREFA, recorrencia: "mensal", raizRecorrente: "raiz-1" });

    await user.selectOptions(screen.getByLabelText("Recorrência"), "nenhuma");

    expect(screen.getByText(PARA_AQUI)).toBeInTheDocument();
  });

  it("tarefa já concluída: avisa que nada muda agora", async () => {
    const user = userEvent.setup();
    abrir({ ...TAREFA, coluna: "done" });

    await user.selectOptions(screen.getByLabelText("Recorrência"), "semanal");

    expect(screen.getByText(JA_CONCLUIDA)).toBeInTheDocument();
  });

  it("tarefa já concluída sem mudar a recorrência: sem o aviso de concluída", async () => {
    const user = userEvent.setup();
    abrir({ ...TAREFA, coluna: "done" });

    expect(screen.queryByText(JA_CONCLUIDA)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Recorrência"), "semanal");
    expect(screen.getByText(JA_CONCLUIDA)).toBeInTheDocument();
  });

  it("mudar a recorrência e voltar ao original: o aviso some e o Salvar trava", async () => {
    const user = userEvent.setup();
    abrir();

    await user.selectOptions(screen.getByLabelText("Recorrência"), "semanal");
    expect(screen.getByText(AO_CONCLUIR)).toBeInTheDocument();
    expect(salvar()).toBeEnabled();

    await user.selectOptions(screen.getByLabelText("Recorrência"), "nenhuma");
    expect(screen.queryByText(AO_CONCLUIR)).not.toBeInTheDocument();
    expect(salvar()).toBeDisabled();
  });

  it("🔴 a tarefa relida com outra recorrência não faz o aviso mentir: ele compara com o retrato", async () => {
    const user = userEvent.setup();
    const { rerender } = abrir();

    rerender(<DialogoDeTarefa tarefa={{ ...TAREFA, recorrencia: "mensal" }} onFechar={onFechar} />);

    expect(screen.getByLabelText("Recorrência")).toHaveValue("nenhuma");
    expect(salvar()).toBeDisabled();
    expect(screen.queryByText(/a corrente para aqui/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Recorrência"), "semanal");
    expect(screen.getByText(AO_CONCLUIR)).toBeInTheDocument();
  });

  it("o negativo ao lado: sem mudança, sem aviso de mudança e Salvar travado", () => {
    abrir();

    expect(screen.getByLabelText("Recorrência")).toHaveValue("nenhuma");
    expect(screen.queryByText(/vale quando esta tarefa for concluída/)).not.toBeInTheDocument();
    expect(salvar()).toBeDisabled();
  });

  it("member que é o responsável vê o seletor de recorrência", () => {
    comoMember("user-1");
    abrir();

    expect(screen.getByLabelText("Recorrência")).toBeInTheDocument();
  });

  it("member que é participante vê o seletor de recorrência", () => {
    comoMember("user-5");
    abrir({ ...TAREFA, participantes: [{ id: "user-5", nome: "Eva", ativo: true }] });

    expect(screen.getByLabelText("Recorrência")).toBeInTheDocument();
  });

  it("member que não edita vê a recorrência só como texto", () => {
    comoMember("user-5");
    abrir({ ...TAREFA, recorrencia: "quinzenal" });

    expect(screen.getByText("A cada 15 dias")).toBeInTheDocument();
    expect(screen.queryByLabelText("Recorrência")).not.toBeInTheDocument();
  });
});

describe("só leitura", () => {
  beforeEach(() => comoMember("user-5"));

  it("🔴 vê a descrição com a quebra de linha e nenhuma caixa de texto", () => {
    abrir({ ...TAREFA, descricao: "linha 1\nlinha 2" });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/linha 1/)).toHaveClass("whitespace-pre-wrap");
  });

  it("sem descrição e sem prazo, diz isso", () => {
    abrir({ ...TAREFA, prazo: null });

    expect(screen.getByText("Sem descrição.")).toBeInTheDocument();
    expect(screen.getByText("Sem prazo")).toBeInTheDocument();
  });

  it("diz a coluna, sem mandar mover", () => {
    abrir();

    expect(screen.getByText("Coluna: A fazer")).toBeInTheDocument();
  });
});

describe("tarefa que saiu da lista da rota", () => {
  const SAIU =
    "Esta tarefa saiu desta lista: pode ter sido concluída, repassada ou apagada. Participantes e links mexidos aqui só aparecem quando ela voltar.";

  it("🔴 avisa que saiu, e segue com o que foi digitado", async () => {
    const user = userEvent.setup();
    const { rerender } = abrir();
    await user.type(screen.getByLabelText("Título"), " novo");

    rerender(<DialogoDeTarefa tarefa={TAREFA} onFechar={onFechar} foraDaLista />);

    expect(screen.getByText(SAIU)).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Revisar contrato novo");
  });

  it("🔴 fora da lista, Salvar grava o título mudado uma vez, pelo id", async () => {
    const user = userEvent.setup();
    render(<DialogoDeTarefa tarefa={TAREFA} onFechar={onFechar} foraDaLista />);

    await user.type(screen.getByLabelText("Título"), " novo");
    await user.click(salvar());

    expect(atualizarMutate).toHaveBeenCalledTimes(1);
    expect(atualizarMutate).toHaveBeenCalledWith(
      { id: "tarefa-1", campos: { titulo: "Revisar contrato novo" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("na lista, sem aviso (o positivo ao lado)", () => {
    abrir();

    expect(screen.queryByText(/saiu desta lista/)).not.toBeInTheDocument();
  });
});

it("quem edita lê a coluna e onde mudá-la", () => {
  abrir();

  expect(screen.getByText("Coluna: A fazer · mova pelo quadro.")).toBeInTheDocument();
});
