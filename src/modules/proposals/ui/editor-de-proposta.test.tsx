import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { brl, pct } from "@/shared/lib/format";

import type { PropostaListada } from "../api/proposals.repository";
import { NOME_DO_ITEM_EM_BRANCO, PROPOSTA_CONGELADA } from "../domain/ciclo";
import type { ItemDaProposta } from "../domain/grupos";

let itens: ItemDaProposta[] | undefined;
let itensComErro: boolean;
let itensAtualizando: boolean;
const editarProposta = vi.fn();
const adicionarItem = vi.fn();
const editarItem = vi.fn();
const removerItem = vi.fn();
const reordenarItens = vi.fn();
let reordenando = false;
vi.mock("../hooks/use-proposals", () => ({
  useItensDaProposta: () => ({
    data: itens,
    isError: itensComErro,
    error: itensComErro ? new Error("falhou") : null,
    isPending: false,
    isFetching: itensAtualizando,
  }),
  useEditarProposta: () => ({ mutate: editarProposta, isPending: false }),
  useAdicionarItem: () => ({ mutate: adicionarItem, isPending: false }),
  useEditarItem: () => ({ mutate: editarItem, isPending: false }),
  useRemoverItem: () => ({ mutate: removerItem, isPending: false }),
  useReordenarItens: () => ({ mutate: reordenarItens, isPending: reordenando }),
}));
const CATALOGO = [
  { id: "com", nome: "Comercial", preco: 1197, frente: "comercial", frentesDoCombo: null },
];
let catalogo: typeof CATALOGO | undefined;
let catalogoComErro: boolean;
vi.mock("@/modules/contracts/hooks/use-contracts", () => ({
  useProdutosAtivos: () => ({ data: catalogo, isError: catalogoComErro, isPending: false }),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

const { EditorDeProposta } = await import("./editor-de-proposta");

const reais = (valor: number) => brl(valor).replace(/\s/g, " ");

const RASCUNHO: PropostaListada = {
  id: "p1",
  numero: 7,
  versao: 1,
  status: "rascunho",
  validaAte: "2026-10-19",
  escopo: null,
  prazoEntregaDias: null,
  formaPagamento: "transferencia",
  parcelasProjeto: null,
  fidelidadeMeses: null,
  enviadaEm: null,
  aceitaEm: null,
  recusadaEm: null,
  criadaEm: "2026-10-04T14:00:00Z",
  totalMensal: 950,
  totalProjeto: 4400,
  vencida: false,
  ultima: true,
  clienteId: null,
};

function item(parcial: Partial<ItemDaProposta> & Pick<ItemDaProposta, "id">): ItemDaProposta {
  return {
    produtoId: "tra",
    nome: "Tráfego",
    descricao: null,
    frente: "trafego",
    frentesDoCombo: null,
    linhaDeNegocio: "demanda",
    tipo: "mrr",
    precoCatalogo: 1000,
    valor: 900,
    ordem: 1,
    contratoId: null,
    ...parcial,
  };
}

const MENSAL = item({ id: "m" });
const PROJETO = item({
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

function abrir(proposta: PropostaListada = RASCUNHO) {
  return render(<EditorDeProposta proposta={proposta} oportunidadeId="o1" />);
}

beforeEach(() => {
  itens = [MENSAL, PROJETO];
  itensComErro = false;
  itensAtualizando = false;
  reordenando = false;
  catalogo = CATALOGO;
  catalogoComErro = false;
  for (const f of [
    editarProposta,
    adicionarItem,
    editarItem,
    removerItem,
    reordenarItens,
    toastError,
  ])
    f.mockReset();
});

describe("itens e totais", () => {
  it("critério 3: dois grupos, o total do banco em cada um, nenhum total geral", () => {
    const { container } = abrir();
    expect(screen.getByRole("heading", { name: "Mensal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projeto" })).toBeInTheDocument();
    expect(screen.getByText(reais(950))).toBeInTheDocument();
    expect(screen.getByText(reais(4400))).toBeInTheDocument();
    expect(container.textContent).toContain(brl(950));
    expect(container.textContent).not.toMatch(/total geral/i);
    expect(container.textContent).not.toContain(brl(5350));
  });

  it("critério 4: desconto em R$ e % ao lado do item", () => {
    abrir();
    expect(
      screen.getByText(`Desconto ${reais(100)} (${pct(0.1)})`.replace(/\s/g, " ")),
    ).toBeInTheDocument();
  });

  it("Adicionar do catálogo manda o produto e a próxima ordem", async () => {
    abrir();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Adicionar do catálogo" }), {
      key: "ArrowDown",
    });
    fireEvent.click(await screen.findByRole("option", { name: /Comercial/ }));
    expect(adicionarItem).toHaveBeenCalledWith({
      propostaId: "p1",
      oportunidadeId: "o1",
      produtoId: "com",
      ordem: 3,
    });
  });

  it("Adicionar do catálogo trava com os itens recarregando ou ainda sem dado (ordem velha)", () => {
    itensAtualizando = true;
    const primeira = abrir();
    expect(screen.getByRole("combobox", { name: "Adicionar do catálogo" })).toBeDisabled();
    primeira.unmount();

    itensAtualizando = false;
    itens = undefined;
    abrir();
    expect(screen.getByRole("combobox", { name: "Adicionar do catálogo" })).toBeDisabled();
  });

  it("controle: itens lidos e parados, Adicionar do catálogo livre", () => {
    abrir();
    expect(screen.getByRole("combobox", { name: "Adicionar do catálogo" })).toBeEnabled();
  });

  it("Remover tira o item", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Remover Tráfego" }));
    expect(removerItem).toHaveBeenCalledWith({
      propostaId: "p1",
      oportunidadeId: "o1",
      itemId: "m",
    });
  });
});

describe("Review Focus 2: valor digitado", () => {
  it.each([
    ["1.500,00", 1500],
    ["1500,5", 1500.5],
    ["1500.50", 1500.5],
  ])("%s grava %s", (digitado, esperado) => {
    abrir();
    const campo = screen.getByLabelText("Valor de Tráfego");
    fireEvent.change(campo, { target: { value: digitado } });
    fireEvent.blur(campo);
    expect(editarItem).toHaveBeenCalledWith({
      propostaId: "p1",
      oportunidadeId: "o1",
      itemId: "m",
      campos: { valor: esperado },
    });
  });

  it("texto ilegível não grava e diz por quê", () => {
    abrir();
    const campo = screen.getByLabelText("Valor de Tráfego");
    fireEvent.change(campo, { target: { value: "abc" } });
    fireEvent.blur(campo);
    expect(editarItem).not.toHaveBeenCalled();
    expect(screen.getByText(/Valor não reconhecido/)).toBeInTheDocument();
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription(/Valor não reconhecido/);
  });

  it("sair sem mudar não grava", () => {
    abrir();
    fireEvent.blur(screen.getByLabelText("Valor de Tráfego"));
    expect(editarItem).not.toHaveBeenCalled();
  });
});

describe("nome e ordem do item (A1.4)", () => {
  const COMERCIAL = item({ id: "m2", nome: "Comercial", ordem: 3 });

  it("renomear grava o nome aparado", () => {
    abrir();
    const campo = screen.getByLabelText("Nome de Tráfego");

    fireEvent.change(campo, { target: { value: "  Tráfego premium  " } });
    fireEvent.blur(campo);

    expect(editarItem).toHaveBeenCalledWith(
      {
        propostaId: "p1",
        oportunidadeId: "o1",
        itemId: "m",
        campos: { nome: "Tráfego premium" },
      },
      { onError: expect.any(Function) },
    );
  });

  it("nome em branco não grava, avisa e volta ao nome antigo", () => {
    abrir();
    const campo = screen.getByLabelText("Nome de Tráfego");

    fireEvent.change(campo, { target: { value: "   " } });
    fireEvent.blur(campo);

    expect(editarItem).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(NOME_DO_ITEM_EM_BRANCO);
    expect(campo).toHaveValue("Tráfego");
  });

  it("nome recusado pelo servidor: o campo volta ao nome gravado (e antes do erro segue o digitado)", () => {
    abrir();
    const campo = screen.getByLabelText("Nome de Tráfego");

    fireEvent.change(campo, { target: { value: "Tráfego premium" } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue("Tráfego premium");

    const opcoes = editarItem.mock.calls[0]?.[1] as { onError: (erro: Error) => void };
    opcoes.onError(new Error("recusado"));

    expect(campo).toHaveValue("Tráfego");
  });

  it("nome e valor com o mesmo texto (1500) não repetem a key dos dois campos", () => {
    itens = [item({ id: "m", nome: "1500", valor: 1500 })];
    const aviso = vi.spyOn(console, "error").mockImplementation(() => undefined);

    abrir();

    expect(aviso).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nome de 1500")).toHaveValue("1500");
    expect(screen.getByLabelText("Valor de 1500")).toHaveValue("1500");
  });

  it("Subir troca com o vizinho do MESMO grupo, pulando o item do outro grupo", () => {
    itens = [MENSAL, PROJETO, COMERCIAL];
    abrir();

    fireEvent.click(screen.getByRole("button", { name: "Subir Comercial" }));

    expect(reordenarItens).toHaveBeenCalledWith({
      propostaId: "p1",
      oportunidadeId: "o1",
      mudancas: [
        { id: "m2", ordem: 1 },
        { id: "m", ordem: 3 },
      ],
    });
  });

  it("sair sem mudar o nome não grava", () => {
    abrir();

    fireEvent.blur(screen.getByLabelText("Nome de Tráfego"));

    expect(editarItem).not.toHaveBeenCalled();
  });

  it("Descer troca com o vizinho do MESMO grupo, pulando o item do outro grupo", () => {
    itens = [MENSAL, PROJETO, COMERCIAL];
    abrir();

    fireEvent.click(screen.getByRole("button", { name: "Descer Tráfego" }));

    expect(reordenarItens).toHaveBeenCalledWith({
      propostaId: "p1",
      oportunidadeId: "o1",
      mudancas: [
        { id: "m2", ordem: 1 },
        { id: "m", ordem: 3 },
      ],
    });
  });

  it("na ponta do grupo o botão trava: primeiro não sobe, último não desce", () => {
    itens = [MENSAL, PROJETO, COMERCIAL];
    abrir();

    expect(screen.getByRole("button", { name: "Subir Tráfego" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descer Tráfego" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Subir Comercial" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Descer Comercial" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Subir Sistema" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descer Sistema" })).toBeDisabled();
  });

  it("itens recarregando travam Subir e Descer (a ordem na mão pode ser velha)", () => {
    itens = [MENSAL, item({ id: "m2", nome: "Comercial", ordem: 2 })];
    itensAtualizando = true;
    abrir();

    expect(screen.getByRole("button", { name: "Descer Tráfego" })).toBeDisabled();
  });

  it("reordenação em andamento trava Subir e Descer; parada, o do meio sobe e desce", () => {
    itens = [
      MENSAL,
      item({ id: "m2", nome: "Comercial", ordem: 2 }),
      item({ id: "m3", nome: "Social", ordem: 3 }),
    ];
    const parada = abrir();
    expect(screen.getByRole("button", { name: "Subir Comercial" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Descer Comercial" })).toBeEnabled();
    parada.unmount();

    reordenando = true;
    abrir();
    expect(screen.getByRole("button", { name: "Subir Comercial" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descer Comercial" })).toBeDisabled();
  });

  it("reordenação em andamento trava o Remover (os UPDATEs correm em sequência); parada, ele fica livre", () => {
    const parada = abrir();
    expect(screen.getByRole("button", { name: "Remover Tráfego" })).toBeEnabled();
    parada.unmount();

    reordenando = true;
    abrir();
    expect(screen.getByRole("button", { name: "Remover Tráfego" })).toBeDisabled();
  });

  it("fora do rascunho: nome sem campo e sem Subir nem Descer", () => {
    abrir({ ...RASCUNHO, status: "enviada", enviadaEm: "2026-10-04T15:00:00Z" });

    expect(screen.queryByLabelText("Nome de Tráfego")).not.toBeInTheDocument();
    expect(screen.getByText("Tráfego")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Subir|Descer/ })).not.toBeInTheDocument();
  });
});

describe("condições", () => {
  it("fidelidade só com item mensal; parcelas e prazo só com item de projeto", () => {
    itens = [MENSAL];
    abrir();
    expect(screen.getByLabelText("Fidelidade (meses)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Parcelas do projeto")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Prazo de entrega (dias)")).not.toBeInTheDocument();
  });

  it("só item de projeto: parcelas e prazo aparecem, fidelidade não", () => {
    itens = [PROJETO];
    abrir();
    expect(screen.getByLabelText("Parcelas do projeto")).toBeInTheDocument();
    expect(screen.getByLabelText("Prazo de entrega (dias)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fidelidade (meses)")).not.toBeInTheDocument();
  });

  it.each([
    ["Parcelas do projeto", "parcelasProjeto"],
    ["Prazo de entrega (dias)", "prazoEntregaDias"],
  ])("%s grava em %s", (rotulo, campoEsperado) => {
    abrir();
    const campo = screen.getByLabelText(rotulo);
    fireEvent.change(campo, { target: { value: "3" } });
    fireEvent.blur(campo);
    expect(editarProposta).toHaveBeenCalledWith({
      propostaId: "p1",
      oportunidadeId: "o1",
      campos: { [campoEsperado]: 3 },
    });
  });

  it.each([
    ["12", 12],
    ["", null],
  ])("fidelidade %j grava %j", (digitado, esperado) => {
    abrir({ ...RASCUNHO, fidelidadeMeses: 6 });
    const campo = screen.getByLabelText("Fidelidade (meses)");
    fireEvent.change(campo, { target: { value: digitado } });
    fireEvent.blur(campo);
    expect(editarProposta).toHaveBeenCalledWith({
      propostaId: "p1",
      oportunidadeId: "o1",
      campos: { fidelidadeMeses: esperado },
    });
  });

  it("fidelidade fracionária não grava e avisa", () => {
    abrir();
    const campo = screen.getByLabelText("Fidelidade (meses)");
    fireEvent.change(campo, { target: { value: "2.5" } });
    fireEvent.blur(campo);
    expect(editarProposta).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Use um número inteiro maior que zero.");
  });

  it("escopo grava o texto aparado; vazio vira null", () => {
    abrir({ ...RASCUNHO, escopo: "antigo" });
    const campo = screen.getByLabelText("Escopo");
    fireEvent.change(campo, { target: { value: "  novo escopo  " } });
    fireEvent.blur(campo);
    expect(editarProposta).toHaveBeenCalledWith({
      propostaId: "p1",
      oportunidadeId: "o1",
      campos: { escopo: "novo escopo" },
    });
  });
});

describe("fora do rascunho", () => {
  it("nada editável, sem catálogo nem remover, e a frase da proposta congelada", () => {
    abrir({ ...RASCUNHO, status: "enviada", enviadaEm: "2026-10-04T15:00:00Z" });
    expect(screen.getByText(PROPOSTA_CONGELADA)).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Adicionar do catálogo" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remover/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Valor de Tráfego")).toBeDisabled();
    expect(screen.getByLabelText("Escopo")).toBeDisabled();
  });
});

describe("leitura: dado antes do erro", () => {
  it("refetch que falha com dado na mão mantém o editor e o catálogo", () => {
    itensComErro = true;
    catalogoComErro = true;
    abrir();
    expect(screen.getByLabelText("Valor de Tráfego")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Adicionar do catálogo" })).toBeEnabled();
    expect(screen.queryByText(/Não foi possível ler/)).not.toBeInTheDocument();
  });

  it("controle: itens sem dado e com erro dizem que não leram, com a mensagem", () => {
    itens = undefined;
    itensComErro = true;
    abrir();
    expect(screen.getByText(/Não foi possível ler os itens da proposta/)).toBeInTheDocument();
    expect(screen.getByText(/falhou/)).toBeInTheDocument();
  });

  it("controle: catálogo sem dado e com erro trava o Adicionar e diz que não leu", () => {
    catalogo = undefined;
    catalogoComErro = true;
    abrir();
    expect(screen.getByRole("combobox", { name: "Adicionar do catálogo" })).toBeDisabled();
    expect(screen.getByText(/Não foi possível ler o catálogo de produtos/)).toBeInTheDocument();
  });
});
