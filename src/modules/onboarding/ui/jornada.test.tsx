import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  DEFINA_EM_CONFIGURACOES,
  PECA_AO_OWNER,
  saidaDoAvisoDePapel,
} from "../domain/aviso-de-papel";
import type { EdicaoDoItem, EtapaDaJornada, ItemDaJornada, Jornada } from "../domain/onboarding";
import { NOTA_DO_CARTAO, VisaoDaJornada } from "./jornada";

const JORNADA: Jornada = {
  id: "j1",
  clienteId: "c1",
  cliente: "Cliente Teste",
  versaoDoMetodo: 1,
  iniciadaEm: "2026-09-01T12:00:00Z",
  concluidaEm: null,
  etapas: [
    {
      id: "e0",
      ordem: 0,
      nome: "Boas-vindas",
      descricao: "A entrada do cliente",
      periodo: "D+0 a D+3",
      responsavel: "AM",
      liberadaEm: null,
      itens: [
        {
          id: "i1",
          ordem: 0,
          titulo: "Enviar contrato assinado",
          papel: "AM",
          prazoEmDias: 2,
          tarefaId: null,
          concluidoEm: null,
        },
      ],
    },
  ],
};

function renderizar(
  ondeResolver: string | null,
  papeisComPessoaDesativada: readonly string[] = [],
) {
  render(
    <VisaoDaJornada
      jornada={JORNADA}
      papeisComPessoa={[]}
      papeisComPessoaDesativada={papeisComPessoaDesativada}
      onLiberar={vi.fn()}
      onMarcar={vi.fn()}
      liberando={false}
      podeEscrever
      ondeResolver={ondeResolver}
      podeApagar={false}
      apagando={false}
      onApagar={vi.fn()}
      papeisDisponiveis={[]}
      editando={false}
      onEditarEtapa={vi.fn()}
      onEditarItem={vi.fn()}
    />,
  );
}

describe("VisaoDaJornada — o aviso de papel sem pessoa não manda ninguém a porta trancada", () => {
  it("o FATO aparece com a instrução do owner", () => {
    renderizar(saidaDoAvisoDePapel(true, true));

    expect(screen.getByText(/Falta configurar quem responde por/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(DEFINA_EM_CONFIGURACOES.slice(0, 24)))).toBeInTheDocument();
    expect(screen.queryByText(/Peça a ele/)).not.toBeInTheDocument();
  });

  it("quem não é owner lê a saída dele, não a rota que devolve /acesso-negado", () => {
    renderizar(saidaDoAvisoDePapel(true, false));

    expect(screen.getByText(/Falta configurar quem responde por/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(PECA_AO_OWNER.slice(0, 26)))).toBeInTheDocument();
  });

  it("perfil em voo: o FATO aparece e NENHUMA instrução", () => {
    renderizar(saidaDoAvisoDePapel(false, false));

    expect(screen.getByText(/Falta configurar quem responde por/)).toBeInTheDocument();
    expect(screen.queryByText(/Defina em Configurações/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Peça a ele/)).not.toBeInTheDocument();
  });

  it("a instrução vem do que foi passado, não de texto fixo no componente", () => {
    renderizar("INSTRUCAO_QUE_SO_ESTE_TESTE_CONHECE");

    expect(screen.getByText(/INSTRUCAO_QUE_SO_ESTE_TESTE_CONHECE/)).toBeInTheDocument();
  });
});

describe("VisaoDaJornada — papel com pessoa desativada", () => {
  it("o aviso nomeia a desativação e pede troca", () => {
    renderizar(saidaDoAvisoDePapel(true, true), ["AM"]);

    expect(screen.getByText(/AM \(pessoa desativada, precisa de troca\)/)).toBeInTheDocument();
  });

  it("papel só sem pessoa não ganha o rótulo", () => {
    renderizar(saidaDoAvisoDePapel(true, true));

    expect(screen.getByText(/Falta configurar quem responde por/)).toBeInTheDocument();
    expect(screen.queryByText(/pessoa desativada/)).not.toBeInTheDocument();
  });
});

describe("VisaoDaJornada: apagar a jornada", () => {
  function renderizarParaApagar(podeApagar: boolean) {
    const onApagar = vi.fn();
    render(
      <VisaoDaJornada
        jornada={JORNADA}
        papeisComPessoa={[]}
        papeisComPessoaDesativada={[]}
        onLiberar={vi.fn()}
        onMarcar={vi.fn()}
        liberando={false}
        podeEscrever
        ondeResolver={null}
        podeApagar={podeApagar}
        apagando={false}
        onApagar={onApagar}
        papeisDisponiveis={[]}
        editando={false}
        onEditarEtapa={vi.fn()}
        onEditarItem={vi.fn()}
      />,
    );
    return onApagar;
  }

  it("sem podeApagar o botão não aparece, mesmo podendo escrever", () => {
    renderizarParaApagar(false);

    expect(screen.queryByRole("button", { name: "Apagar jornada" })).not.toBeInTheDocument();
  });

  it("com podeApagar, confirmar apaga a jornada exibida, e o diálogo diz o que sai e o que fica", async () => {
    const user = userEvent.setup();
    const onApagar = renderizarParaApagar(true);

    await user.click(screen.getByRole("button", { name: "Apagar jornada" }));
    expect(
      screen.getByRole("alertdialog", { name: 'Apagar a jornada de "Cliente Teste"?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/os cartões que ela criou no quadro de tarefas/)).toBeInTheDocument();
    expect(screen.getByText(/com as ocorrências recorrentes deles/)).toBeInTheDocument();
    expect(
      screen.getByText("Depois dá para abrir uma jornada nova para o cliente."),
    ).toBeInTheDocument();
    expect(onApagar).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));

    expect(onApagar).toHaveBeenCalledTimes(1);
    expect(onApagar).toHaveBeenCalledWith("j1");
  });

  it("Cancelar no diálogo não apaga", async () => {
    const user = userEvent.setup();
    const onApagar = renderizarParaApagar(true);

    await user.click(screen.getByRole("button", { name: "Apagar jornada" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onApagar).not.toHaveBeenCalled();
  });
});

describe("VisaoDaJornada: editar etapa e item (entrega B)", () => {
  const ITEM_LIBERADO: ItemDaJornada = {
    id: "i1",
    ordem: 0,
    titulo: "Enviar contrato assinado",
    papel: "AM",
    prazoEmDias: 2,
    tarefaId: "t1",
    concluidoEm: null,
  };
  const ETAPA_LIBERADA: EtapaDaJornada = {
    id: "e0",
    ordem: 0,
    nome: "Boas-vindas",
    descricao: "A entrada do cliente",
    periodo: "D+0 a D+3",
    responsavel: "AM",
    liberadaEm: "2026-09-02T12:00:00Z",
    itens: [ITEM_LIBERADO],
  };
  const LIBERADA: Jornada = { ...JORNADA, etapas: [ETAPA_LIBERADA] };
  const OUTRO_ITEM: ItemDaJornada = {
    ...ITEM_LIBERADO,
    id: "i2",
    ordem: 1,
    titulo: "Agendar o kickoff",
    tarefaId: "t2",
  };
  const COM_DOIS_ITENS: Jornada = {
    ...JORNADA,
    etapas: [{ ...ETAPA_LIBERADA, itens: [ITEM_LIBERADO, OUTRO_ITEM] }],
  };

  function renderizarEdicao({
    podeEscrever = true,
    papeis = ["AM", "Design"],
    jornada = LIBERADA,
    editando = false,
  }: {
    podeEscrever?: boolean;
    papeis?: readonly string[];
    jornada?: Jornada;
    editando?: boolean;
  } = {}) {
    const onEditarEtapa = vi.fn();
    const onEditarItem = vi.fn();
    render(
      <VisaoDaJornada
        jornada={jornada}
        papeisComPessoa={["AM"]}
        papeisComPessoaDesativada={[]}
        onLiberar={vi.fn()}
        onMarcar={vi.fn()}
        liberando={false}
        podeEscrever={podeEscrever}
        ondeResolver={null}
        podeApagar={false}
        apagando={false}
        onApagar={vi.fn()}
        papeisDisponiveis={papeis}
        editando={editando}
        onEditarEtapa={onEditarEtapa}
        onEditarItem={onEditarItem}
      />,
    );
    return { onEditarEtapa, onEditarItem };
  }

  function renderizarComGravacaoEmVoo(jornada: Jornada = LIBERADA) {
    const onEditarEtapa = vi.fn();
    const onEditarItem = vi.fn();
    function Rota() {
      const [editando, setEditando] = useState(false);
      return (
        <VisaoDaJornada
          jornada={jornada}
          papeisComPessoa={["AM"]}
          papeisComPessoaDesativada={[]}
          onLiberar={vi.fn()}
          onMarcar={vi.fn()}
          liberando={false}
          podeEscrever
          ondeResolver={null}
          podeApagar={false}
          apagando={false}
          onApagar={vi.fn()}
          papeisDisponiveis={["AM", "Design"]}
          editando={editando}
          onEditarEtapa={(...args) => {
            setEditando(true);
            onEditarEtapa(...args);
          }}
          onEditarItem={(id, campos, aoSalvar) => {
            setEditando(true);
            onEditarItem(id, campos, () => {
              setEditando(false);
              aoSalvar();
            });
          }}
        />
      );
    }
    render(<Rota />);
    return { onEditarEtapa, onEditarItem };
  }

  it("editar a etapa manda descrição e responsável novos com o id", async () => {
    const user = userEvent.setup();
    const { onEditarEtapa } = renderizarEdicao();

    await user.click(screen.getByRole("button", { name: "Editar etapa Boas-vindas" }));
    const descricao = screen.getByLabelText("Descrição da etapa");
    expect(descricao).toHaveValue("A entrada do cliente");
    await user.clear(descricao);
    await user.type(descricao, "Kickoff e acessos");
    await user.clear(screen.getByLabelText("Responsável da etapa"));
    await user.type(screen.getByLabelText("Responsável da etapa"), "Design");
    await user.click(screen.getByRole("button", { name: "Salvar etapa" }));

    expect(onEditarEtapa).toHaveBeenCalledWith(
      "e0",
      { descricao: "Kickoff e acessos", responsavel: "Design" },
      expect.any(Function),
    );
  });

  it("o formulário fecha quando a gravação dá certo, e fica aberto quando não dá", async () => {
    const user = userEvent.setup();
    const { onEditarEtapa } = renderizarEdicao();
    await user.click(screen.getByRole("button", { name: "Editar etapa Boas-vindas" }));

    await user.click(screen.getByRole("button", { name: "Salvar etapa" }));
    expect(screen.getByLabelText("Descrição da etapa")).toBeInTheDocument();

    onEditarEtapa.mockImplementation((_id: string, _campos: unknown, aoSalvar: () => void) =>
      aoSalvar(),
    );
    await user.click(screen.getByRole("button", { name: "Salvar etapa" }));
    expect(screen.queryByLabelText("Descrição da etapa")).not.toBeInTheDocument();
  });

  it("o formulário do item fecha só quando a gravação dá certo, e o lápis volta", async () => {
    const user = userEvent.setup();
    const { onEditarItem } = renderizarEdicao();
    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));

    await user.click(screen.getByRole("button", { name: "Salvar item" }));
    expect(screen.getByLabelText("Título do item")).toBeInTheDocument();

    onEditarItem.mockImplementation((_id: string, _campos: unknown, aoSalvar: () => void) =>
      aoSalvar(),
    );
    await user.click(screen.getByRole("button", { name: "Salvar item" }));
    expect(screen.queryByLabelText("Título do item")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }),
    ).toBeInTheDocument();
  });

  it("quem não escreve não vê lápis de etapa nem de item, e o item segue visível", () => {
    renderizarEdicao({ podeEscrever: false });

    expect(screen.queryByRole("button", { name: /^Editar (etapa|item)/ })).not.toBeInTheDocument();
    expect(screen.getByText("Enviar contrato assinado")).toBeInTheDocument();
  });

  it("etapa bloqueada: a etapa se edita e o item não aparece (desvio b)", () => {
    renderizarEdicao({ jornada: JORNADA });

    expect(screen.getByRole("button", { name: "Editar etapa Boas-vindas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Editar item/ })).not.toBeInTheDocument();
  });

  it("editar o item manda título, prazo e papel com o id", async () => {
    const user = userEvent.setup();
    const { onEditarItem } = renderizarEdicao();

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    const titulo = screen.getByLabelText("Título do item");
    await user.clear(titulo);
    await user.type(titulo, "Enviar contrato");
    const prazo = screen.getByLabelText("Prazo em dias");
    await user.clear(prazo);
    await user.type(prazo, "5");
    await user.selectOptions(screen.getByLabelText("Papel"), "Design");
    await user.click(screen.getByRole("button", { name: "Salvar item" }));

    expect(onEditarItem).toHaveBeenCalledWith(
      "i1",
      { titulo: "Enviar contrato", prazoEmDias: 5, papel: "Design" },
      expect.any(Function),
    );
  });

  it("prazo vazio vai como NaN, e quem recusa é o repositório", async () => {
    const user = userEvent.setup();
    const { onEditarItem } = renderizarEdicao();

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    await user.clear(screen.getByLabelText("Prazo em dias"));
    await user.click(screen.getByRole("button", { name: "Salvar item" }));

    const campos = onEditarItem.mock.calls[0]?.[1] as EdicaoDoItem;
    expect(Number.isNaN(campos.prazoEmDias)).toBe(true);
  });

  it("o papel atual fora da lista lida continua nas opções e escolhido", async () => {
    const user = userEvent.setup();
    renderizarEdicao({ papeis: ["Design"] });

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    const papel = screen.getByLabelText("Papel");

    expect(
      within(papel)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["AM", "Design"]);
    expect(papel).toHaveValue("AM");
  });

  it("papel que saiu da lista: dá para escolher outro e gravar com ele", async () => {
    const user = userEvent.setup();
    const { onEditarItem } = renderizarEdicao({ papeis: ["Design"] });

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    await user.selectOptions(screen.getByLabelText("Papel"), "Design");
    await user.click(screen.getByRole("button", { name: "Salvar item" }));

    expect(onEditarItem).toHaveBeenCalledWith(
      "i1",
      { titulo: "Enviar contrato assinado", prazoEmDias: 2, papel: "Design" },
      expect.any(Function),
    );
  });

  it("ao abrir, o foco vai para o primeiro campo do formulário", async () => {
    const user = userEvent.setup();
    renderizarEdicao();

    await user.click(screen.getByRole("button", { name: "Editar etapa Boas-vindas" }));
    expect(screen.getByLabelText("Descrição da etapa")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    expect(screen.getByLabelText("Título do item")).toHaveFocus();
  });

  it("Cancelar fecha o item sem gravar", async () => {
    const user = userEvent.setup();
    const { onEditarItem } = renderizarEdicao();

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onEditarItem).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Título do item")).not.toBeInTheDocument();
  });

  it("Cancelar descarta o rascunho: reabrir mostra o valor gravado", async () => {
    const user = userEvent.setup();
    renderizarEdicao();

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    await user.type(screen.getByLabelText("Título do item"), " rascunho");
    expect(screen.getByLabelText("Título do item")).toHaveValue(
      "Enviar contrato assinado rascunho",
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    expect(screen.getByLabelText("Título do item")).toHaveValue("Enviar contrato assinado");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Editar etapa Boas-vindas" }));
    await user.type(screen.getByLabelText("Responsável da etapa"), " rascunho");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Editar etapa Boas-vindas" }));
    expect(screen.getByLabelText("Responsável da etapa")).toHaveValue("AM");
  });

  it("gravação que falha mantém o que foi digitado no formulário aberto", async () => {
    const user = userEvent.setup();
    const { onEditarItem, onEditarEtapa } = renderizarEdicao();

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    await user.type(screen.getByLabelText("Título do item"), " revisado");
    await user.click(screen.getByRole("button", { name: "Salvar item" }));

    expect(onEditarItem).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Título do item")).toHaveValue(
      "Enviar contrato assinado revisado",
    );

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Editar etapa Boas-vindas" }));
    await user.type(screen.getByLabelText("Responsável da etapa"), " e Design");
    await user.click(screen.getByRole("button", { name: "Salvar etapa" }));

    expect(onEditarEtapa).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Responsável da etapa")).toHaveValue("AM e Design");
  });

  it("com cartão aberto no quadro, o formulário diz o que o cartão recebe", async () => {
    const user = userEvent.setup();
    renderizarEdicao();

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));

    expect(screen.getByText(NOTA_DO_CARTAO)).toBeInTheDocument();
  });

  it("item sem cartão não mostra a nota (o negativo ao lado)", async () => {
    const user = userEvent.setup();
    renderizarEdicao({
      jornada: {
        ...LIBERADA,
        etapas: [{ ...ETAPA_LIBERADA, itens: [{ ...ITEM_LIBERADO, tarefaId: null }] }],
      },
    });

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));

    expect(screen.queryByText(NOTA_DO_CARTAO)).not.toBeInTheDocument();
  });

  it("item concluído com cartão não mostra a nota", async () => {
    const user = userEvent.setup();
    renderizarEdicao({
      jornada: {
        ...LIBERADA,
        etapas: [
          {
            ...ETAPA_LIBERADA,
            itens: [{ ...ITEM_LIBERADO, concluidoEm: "2026-09-03T12:00:00Z" }],
          },
        ],
      },
    });

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));

    expect(screen.getByLabelText("Título do item")).toBeInTheDocument();
    expect(screen.queryByText(NOTA_DO_CARTAO)).not.toBeInTheDocument();
  });

  it("campo de texto livre tem o limite que o banco recusa acima", async () => {
    const user = userEvent.setup();
    renderizarEdicao();

    await user.click(screen.getByRole("button", { name: "Editar etapa Boas-vindas" }));
    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));

    expect(screen.getByLabelText("Descrição da etapa")).toHaveAttribute("maxlength", "2000");
    expect(screen.getByLabelText("Responsável da etapa")).toHaveAttribute("maxlength", "200");
    expect(screen.getByLabelText("Título do item")).toHaveAttribute("maxlength", "200");
  });

  it("etapa com gravação em voo: campos e botões travam", async () => {
    const user = userEvent.setup();
    renderizarComGravacaoEmVoo();

    await user.click(screen.getByRole("button", { name: "Editar etapa Boas-vindas" }));
    await user.click(screen.getByRole("button", { name: "Salvar etapa" }));

    expect(screen.getByLabelText("Descrição da etapa")).toBeDisabled();
    expect(screen.getByLabelText("Responsável da etapa")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar etapa" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("item com gravação em voo: campos, seletor de papel e botões travam", async () => {
    const user = userEvent.setup();
    renderizarComGravacaoEmVoo();

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    await user.click(screen.getByRole("button", { name: "Salvar item" }));

    expect(screen.getByLabelText("Título do item")).toBeDisabled();
    expect(screen.getByLabelText("Prazo em dias")).toBeDisabled();
    expect(screen.getByLabelText("Papel")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar item" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("gravação em voo: o lápis de cada item e o da etapa ficam desabilitados", () => {
    renderizarEdicao({ jornada: COM_DOIS_ITENS, editando: true });

    expect(screen.getByRole("button", { name: "Editar etapa Boas-vindas" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Editar item Agendar o kickoff" })).toBeDisabled();
  });

  it("o negativo ao lado: sem gravação em voo, os lápis estão habilitados", () => {
    renderizarEdicao({ jornada: COM_DOIS_ITENS });

    expect(screen.getByRole("button", { name: "Editar etapa Boas-vindas" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Editar item Agendar o kickoff" })).toBeEnabled();
  });

  it("com um item em edição, o lápis do outro item da etapa trava", async () => {
    const user = userEvent.setup();
    renderizarEdicao({ jornada: COM_DOIS_ITENS });

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    const titulo = screen.getByLabelText("Título do item");
    await user.clear(titulo);
    await user.type(titulo, "Rascunho não salvo");

    const outro = screen.getByRole("button", { name: "Editar item Agendar o kickoff" });
    expect(outro).toBeDisabled();
    await user.click(outro);
    expect(screen.getByLabelText("Título do item")).toHaveValue("Rascunho não salvo");
  });

  it("o negativo ao lado: sem item em edição os dois lápis estão livres, e Cancelar libera o do outro", async () => {
    const user = userEvent.setup();
    renderizarEdicao({ jornada: COM_DOIS_ITENS });
    const lapisDoPrimeiro = () =>
      screen.getByRole("button", { name: "Editar item Enviar contrato assinado" });
    const lapisDoSegundo = () =>
      screen.getByRole("button", { name: "Editar item Agendar o kickoff" });

    expect(lapisDoPrimeiro()).toBeEnabled();
    expect(lapisDoSegundo()).toBeEnabled();

    await user.click(lapisDoPrimeiro());
    expect(lapisDoSegundo()).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(lapisDoPrimeiro()).toBeEnabled();
    expect(lapisDoSegundo()).toBeEnabled();
  });

  it("gravação do item A em voo: o lápis do item B fica travado até ela terminar", async () => {
    const user = userEvent.setup();
    const { onEditarItem } = renderizarComGravacaoEmVoo(COM_DOIS_ITENS);

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    await user.click(screen.getByRole("button", { name: "Salvar item" }));
    const aoSalvarDoPrimeiro = onEditarItem.mock.calls[0]?.[2] as () => void;
    expect(screen.getByRole("button", { name: "Editar item Agendar o kickoff" })).toBeDisabled();
    expect(screen.getByLabelText("Título do item")).toBeDisabled();

    act(() => aoSalvarDoPrimeiro());

    expect(screen.queryByLabelText("Título do item")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar item Agendar o kickoff" })).toBeEnabled();
  });

  it("o negativo ao lado: o sucesso do próprio item fecha o formulário dele", async () => {
    const user = userEvent.setup();
    const { onEditarItem } = renderizarEdicao({ jornada: COM_DOIS_ITENS });

    await user.click(screen.getByRole("button", { name: "Editar item Agendar o kickoff" }));
    await user.click(screen.getByRole("button", { name: "Salvar item" }));
    const aoSalvar = onEditarItem.mock.calls[0]?.[2] as () => void;

    act(() => aoSalvar());

    expect(screen.queryByLabelText("Título do item")).not.toBeInTheDocument();
  });

  it("o negativo ao lado: sem gravação em voo, os mesmos campos estão livres", async () => {
    const user = userEvent.setup();
    renderizarEdicao();

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));

    expect(screen.getByLabelText("Título do item")).toBeEnabled();
    expect(screen.getByLabelText("Papel")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Salvar item" })).toBeEnabled();
  });

  it("dois cliques em Salvar item com a gravação pendente gravam uma vez só", async () => {
    const user = userEvent.setup();
    const { onEditarItem } = renderizarComGravacaoEmVoo();

    await user.click(screen.getByRole("button", { name: "Editar item Enviar contrato assinado" }));
    const salvar = screen.getByRole("button", { name: "Salvar item" });
    await user.click(salvar);
    await user.click(salvar);

    expect(onEditarItem).toHaveBeenCalledTimes(1);
  });

  it("dois cliques em Salvar etapa com a gravação pendente gravam uma vez só", async () => {
    const user = userEvent.setup();
    const { onEditarEtapa } = renderizarComGravacaoEmVoo();

    await user.click(screen.getByRole("button", { name: "Editar etapa Boas-vindas" }));
    const salvar = screen.getByRole("button", { name: "Salvar etapa" });
    await user.click(salvar);
    await user.click(salvar);

    expect(onEditarEtapa).toHaveBeenCalledTimes(1);
  });
});
