import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProdutoDoCatalogoCompleto } from "../api/products.repository";

const mutate = vi.fn();
vi.mock("../hooks/use-products", () => ({
  useSalvarProduto: () => ({ mutate, isPending: false }),
  useDefinirSituacaoDoProduto: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { FormularioDeProduto } = await import("./formulario-de-produto");
const { toast } = await import("sonner");

beforeEach(() => {
  vi.clearAllMocks();
  mutate.mockReset();
});

const ANTIGO: ProdutoDoCatalogoCompleto = {
  id: "p1",
  nome: "Antigo",
  descricao: null,
  frente: "trafego",
  linhaDeNegocio: "demanda",
  tipo: "mrr",
  preco: 1000,
  frentesDoCombo: null,
  ativo: true,
  ordem: 0,
};

describe("FormularioDeProduto", () => {
  it("🔴 preco vazio NAO salva — preco e a razao de existir do catalogo", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={null} aoFechar={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nome/), "Gestao de trafego");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mutate).not.toHaveBeenCalled());
  });

  it("salva o produto novo com o preco em numero, nao em texto", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={null} aoFechar={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nome/), "Gestao de trafego");
    await user.type(screen.getByLabelText(/Preço/), "2500");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mutate.mock.calls[0][0]).toMatchObject({ nome: "Gestao de trafego", preco: 2500 });
  });

  it("reabrir noutro produto nao herda o que foi digitado no anterior", async () => {
    const user = userEvent.setup();
    const produto = ANTIGO;
    const { rerender } = render(
      <FormularioDeProduto aberto produto={produto} aoFechar={vi.fn()} />,
    );

    await user.clear(screen.getByLabelText(/Nome/));
    await user.type(screen.getByLabelText(/Nome/), "Rascunho");

    rerender(
      <FormularioDeProduto
        aberto
        produto={{ ...produto, id: "p2", nome: "Outro" }}
        aoFechar={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/Nome/)).toHaveValue("Outro");
  });

  it("🔴 fechar e reabrir o MESMO produto nao herda o rascunho abandonado no Cancelar", async () => {
    const user = userEvent.setup();
    const produto = ANTIGO;

    const { rerender } = render(
      <FormularioDeProduto aberto produto={produto} aoFechar={vi.fn()} />,
    );

    await user.clear(screen.getByLabelText(/Nome/));
    await user.type(screen.getByLabelText(/Nome/), "Rascunho abandonado");

    rerender(<FormularioDeProduto aberto={false} produto={produto} aoFechar={vi.fn()} />);

    rerender(<FormularioDeProduto aberto produto={produto} aoFechar={vi.fn()} />);

    expect(screen.getByLabelText(/Nome/)).toHaveValue("Antigo");
  });

  it.each([
    ["1197,00", 1197],
    ["1.197,00", 1197],
    ["24.637", 24637],
    ["2500", 2500],
    ["670.5", 670.5],
  ])("preco digitado %s grava %d", async (digitado, esperado) => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={null} aoFechar={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nome/), "Sistema sob medida");
    await user.type(screen.getByLabelText(/Preço/), digitado);
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mutate.mock.calls[0][0]).toMatchObject({ preco: esperado });
  });

  it("🔴 o eco mostra o que o sistema entendeu — 24.637 nao vira R$ 24,64", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={null} aoFechar={vi.fn()} />);

    await user.type(screen.getByLabelText(/Preço/), "24.637");

    expect(screen.getByText(/24\.637,00/)).toBeInTheDocument();
    expect(screen.queryByText(/24,64/)).not.toBeInTheDocument();
  });

  it("texto ilegivel NAO grava, e a tela diz por que", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={null} aoFechar={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nome/), "Sistema sob medida");
    await user.type(screen.getByLabelText(/Preço/), "vinte e quatro mil");

    expect(screen.getByText(/Valor não reconhecido/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mutate).not.toHaveBeenCalled());
  });

  it("campo vazio nao ecoa nem reclama — vazio e ausencia, nao erro", () => {
    render(<FormularioDeProduto aberto produto={null} aoFechar={vi.fn()} />);

    expect(screen.queryByText(/Valor não reconhecido/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vai ser gravado como/)).not.toBeInTheDocument();
  });

  it('🔴 "Novo produto" duas vezes seguidas nao herda o rascunho da primeira', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FormularioDeProduto aberto produto={null} aoFechar={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nome/), "Rascunho abandonado");

    rerender(<FormularioDeProduto aberto={false} produto={null} aoFechar={vi.fn()} />);

    rerender(<FormularioDeProduto aberto produto={null} aoFechar={vi.fn()} />);

    expect(screen.getByLabelText(/Nome/)).toHaveValue("");
  });
});

const AVULSO: ProdutoDoCatalogoCompleto = {
  id: "p1",
  nome: "Frente 02 · Tráfego",
  descricao: null,
  frente: "trafego",
  linhaDeNegocio: "demanda",
  tipo: "mrr",
  preco: 797,
  frentesDoCombo: null,
  ativo: true,
  ordem: 2,
};

const COMBO: ProdutoDoCatalogoCompleto = {
  id: "c1",
  nome: "Combo 3 Frentes · semestral",
  descricao: null,
  frente: "posicionamento",
  linhaDeNegocio: "demanda",
  tipo: "mrr",
  preco: 3193,
  frentesDoCombo: ["posicionamento", "trafego", "comercial"],
  ativo: true,
  ordem: 4,
};

function enviado(): Record<string, unknown> {
  return mutate.mock.calls[0][0] as Record<string, unknown>;
}

describe("ordem no catálogo e frentes do combo (A2.3)", () => {
  it("edição mostra a ordem e manda a nova", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={AVULSO} aoFechar={vi.fn()} />);

    const ordem = screen.getByLabelText("Ordem no catálogo");
    expect(ordem).toHaveValue("2");
    await user.clear(ordem);
    await user.type(ordem, "7");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(enviado()).toMatchObject({ id: "p1", ordem: 7 });
    expect(enviado()).not.toHaveProperty("frentesDoCombo");
  });

  it("🔴 produto novo não mostra a ordem e não a manda", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={null} aoFechar={vi.fn()} />);

    expect(screen.queryByLabelText("Ordem no catálogo")).toBeNull();
    await user.type(screen.getByLabelText(/Nome/), "Gestao de trafego");
    await user.type(screen.getByLabelText(/Preço/), "2500");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(enviado()).not.toHaveProperty("ordem");
  });

  it("🔴 ordem que não é inteiro trava o Salvar", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={AVULSO} aoFechar={vi.fn()} />);

    const ordem = screen.getByLabelText("Ordem no catálogo");
    await user.clear(ordem);
    await user.type(ordem, "2,5");

    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  async function digitarOrdem(digitado: string): Promise<void> {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={AVULSO} aoFechar={vi.fn()} />);

    const ordem = screen.getByLabelText("Ordem no catálogo");
    await user.clear(ordem);
    if (digitado !== "") await user.type(ordem, digitado);
  }

  it.each([
    ["vazia", ""],
    ["negativa", "-1"],
    ["de sete dígitos", "1234567"],
  ])("🔴 ordem %s trava o Salvar e a tela diz por quê", async (_nome, digitado) => {
    await digitarOrdem(digitado);

    expect(
      screen.getByText("Use um número inteiro, sem vírgula: 0, 1, 2 e assim por diante."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it.each([
    ["zero", "0"],
    ["de seis dígitos (o teto)", "999999"],
  ])("o positivo ao lado: ordem %s libera o Salvar e não reclama", async (_nome, digitado) => {
    await digitarOrdem(digitado);

    expect(screen.queryByText(/Use um número inteiro/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
  });

  it("combo mostra as frentes marcadas, e desmarcar uma manda as outras", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={COMBO} aoFechar={vi.fn()} />);

    const trafego = screen.getByRole("checkbox", { name: "Tráfego" });
    expect(trafego).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Sistemas" })).not.toBeChecked();
    await user.click(trafego);
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(enviado()).toMatchObject({ frentesDoCombo: ["posicionamento", "comercial"] });
    expect(enviado()).not.toHaveProperty("ordem");
  });

  it("🔴 combo: mudar só o nome manda frente, BU e frentesDoCombo iguais ao lido, e não manda ordem", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={COMBO} aoFechar={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nome/), " revisado");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(enviado()).toMatchObject({
      id: "c1",
      nome: `${COMBO.nome} revisado`,
      frente: COMBO.frente,
      linhaDeNegocio: COMBO.linhaDeNegocio,
      frentesDoCombo: COMBO.frentesDoCombo,
    });
    expect(enviado()).not.toHaveProperty("ordem");
  });

  it("o positivo ao lado: avulso, mudar só o nome não manda frentesDoCombo nem ordem", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={AVULSO} aoFechar={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nome/), " revisado");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(enviado()).toMatchObject({ id: "p1", nome: `${AVULSO.nome} revisado` });
    expect(enviado()).not.toHaveProperty("frentesDoCombo");
    expect(enviado()).not.toHaveProperty("ordem");
  });

  it("mudar a ordem de um combo manda a ordem junto com o combo lido", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={COMBO} aoFechar={vi.fn()} />);

    const ordem = screen.getByLabelText("Ordem no catálogo");
    await user.clear(ordem);
    await user.type(ordem, "9");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(enviado()).toMatchObject({
      id: "c1",
      ordem: 9,
      frentesDoCombo: COMBO.frentesDoCombo,
    });
  });

  it("🔴 ordem 0 digitada manda 0: zero é mudança, não ausência", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={AVULSO} aoFechar={vi.fn()} />);

    const ordem = screen.getByLabelText("Ordem no catálogo");
    await user.clear(ordem);
    await user.type(ordem, "0");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(enviado()).toMatchObject({ ordem: 0 });
  });

  it("desmarcar e remarcar a mesma frente volta ao combo lido, na mesma ordem das frentes", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={COMBO} aoFechar={vi.fn()} />);

    await user.click(screen.getByRole("checkbox", { name: "Tráfego" }));
    await user.click(screen.getByRole("checkbox", { name: "Tráfego" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(enviado()).toMatchObject({ frentesDoCombo: COMBO.frentesDoCombo });
  });

  it("🔴 combo sem frente nenhuma trava o Salvar e diz por quê", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={COMBO} aoFechar={vi.fn()} />);

    await user.click(screen.getByRole("checkbox", { name: "Posicionamento" }));
    await user.click(screen.getByRole("checkbox", { name: "Tráfego" }));
    await user.click(screen.getByRole("checkbox", { name: "Comercial" }));

    expect(screen.getByText("Marque pelo menos uma frente do combo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("🔴 frente de outra linha de negócio trava o Salvar", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={COMBO} aoFechar={vi.fn()} />);

    await user.click(screen.getByRole("checkbox", { name: "Sistemas" }));

    expect(screen.getByText(/Sistemas não é da linha Demanda/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("🔴 trocar a Frente de Demanda para Sistemas com o combo de Demanda marcado trava o Salvar", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={COMBO} aoFechar={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Frente" }));
    await user.click(await screen.findByRole("option", { name: "Sistemas" }));

    expect(
      screen.getByText(
        "Posicionamento, Tráfego, Comercial não são da linha Sistemas: o contrato recusaria o item.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("o positivo ao lado: trocar para outra frente de Demanda mantém o Salvar livre", async () => {
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={COMBO} aoFechar={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Frente" }));
    await user.click(await screen.findByRole("option", { name: "Tráfego" }));

    expect(screen.queryByText(/o contrato recusaria o item/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
  });

  it("avulso não oferece frentes do combo", () => {
    render(<FormularioDeProduto aberto produto={AVULSO} aoFechar={vi.fn()} />);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("🔴 recusa do banco aparece como mensagem, não como sucesso", async () => {
    mutate.mockImplementation((_vars: unknown, opcoes?: { onError?: (e: unknown) => void }) =>
      opcoes?.onError?.(new Error("Nada foi alterado: só o owner edita produtos.")),
    );
    const aoFechar = vi.fn();
    const user = userEvent.setup();
    render(<FormularioDeProduto aberto produto={COMBO} aoFechar={aoFechar} />);

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(toast.error).toHaveBeenCalledWith("Nada foi alterado: só o owner edita produtos.");
    expect(aoFechar).not.toHaveBeenCalled();
  });
});
