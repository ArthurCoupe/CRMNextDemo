import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BuscaDeOportunidades, OportunidadeParaSelecao } from "../api/meetings.repository";

interface ResultadoFalso {
  data: BuscaDeOportunidades | undefined;
  isError: boolean;
  isFetching: boolean;
}

let resultado: ResultadoFalso = { data: undefined, isError: false, isFetching: false };
const useBuscaFalsa = vi.fn((_digitado: string) => resultado);

vi.mock("../hooks/use-meetings", () => ({
  useBuscaDeOportunidades: (digitado: string) => useBuscaFalsa(digitado),
}));

const { CampoDeOportunidade } = await import("./campo-de-oportunidade");

const ACME: OportunidadeParaSelecao = { id: "opp-1", nome: "Prospect Acme" };

function renderCampo(escolhida: OportunidadeParaSelecao | null = null) {
  const aoEscolher = vi.fn();
  render(<CampoDeOportunidade escolhida={escolhida} aoEscolher={aoEscolher} />);
  return { aoEscolher };
}

beforeEach(() => {
  resultado = { data: undefined, isError: false, isFetching: false };
  useBuscaFalsa.mockClear();
});

describe("CampoDeOportunidade, sem oportunidade escolhida", () => {
  it("busca pelo que foi digitado", async () => {
    const user = userEvent.setup();
    renderCampo();

    await user.type(screen.getByLabelText(/^oportunidade$/i), "acm");

    expect(useBuscaFalsa).toHaveBeenLastCalledWith("acm");
  });

  it("com menos de 2 letras pede mais e não mostra resultado antigo", async () => {
    resultado = { data: { itens: [ACME], haMais: false }, isError: false, isFetching: false };
    const user = userEvent.setup();
    renderCampo();

    await user.type(screen.getByLabelText(/^oportunidade$/i), "a");

    expect(screen.getByText("Digite ao menos 2 letras do nome.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Prospect Acme" })).not.toBeInTheDocument();
  });

  it("lista o que achou, e escolher devolve id e nome", async () => {
    resultado = { data: { itens: [ACME], haMais: false }, isError: false, isFetching: false };
    const user = userEvent.setup();
    const { aoEscolher } = renderCampo();

    await user.type(screen.getByLabelText(/^oportunidade$/i), "acme");
    await user.click(screen.getByRole("button", { name: "Prospect Acme" }));

    expect(aoEscolher).toHaveBeenCalledWith(ACME);
  });

  it("quando há mais do que as mostradas, pede para refinar", async () => {
    resultado = { data: { itens: [ACME], haMais: true }, isError: false, isFetching: false };
    const user = userEvent.setup();
    renderCampo();

    await user.type(screen.getByLabelText(/^oportunidade$/i), "pr");

    expect(
      screen.getByText("Mostrando as 20 primeiras. Digite mais do nome para achar a certa."),
    ).toBeInTheDocument();
  });

  it("sem nenhuma com esse nome, diz isso", async () => {
    resultado = { data: { itens: [], haMais: false }, isError: false, isFetching: false };
    const user = userEvent.setup();
    renderCampo();

    await user.type(screen.getByLabelText(/^oportunidade$/i), "xyz");

    expect(screen.getByText("Nenhuma oportunidade com esse nome.")).toBeInTheDocument();
  });

  it("erro da busca aparece no campo, sem lista", async () => {
    resultado = { data: undefined, isError: true, isFetching: false };
    const user = userEvent.setup();
    renderCampo();

    await user.type(screen.getByLabelText(/^oportunidade$/i), "acme");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não deu para buscar as oportunidades. Confira a conexão e digite de novo.",
    );
  });
});

describe("CampoDeOportunidade, leitor de tela", () => {
  it("a dica e o resultado da busca descrevem o campo e são anunciados", async () => {
    resultado = { data: { itens: [], haMais: false }, isError: false, isFetching: false };
    const user = userEvent.setup();
    renderCampo();
    const campo = screen.getByLabelText(/^oportunidade$/i);

    expect(campo).toHaveAccessibleDescription("Digite ao menos 2 letras do nome.");
    expect(screen.getByRole("status")).toHaveTextContent("Digite ao menos 2 letras do nome.");

    await user.type(campo, "xyz");

    expect(campo).toHaveAccessibleDescription("Nenhuma oportunidade com esse nome.");
    expect(screen.getByRole("status")).toHaveTextContent("Nenhuma oportunidade com esse nome.");
  });
});

describe("CampoDeOportunidade, com oportunidade escolhida", () => {
  it("mostra a escolhida no campo, sem buscar", () => {
    renderCampo(ACME);

    const campo = screen.getByLabelText(/^oportunidade$/i);
    expect(campo).toHaveValue("Prospect Acme");
    expect(campo).toHaveAttribute("readonly");
    expect(useBuscaFalsa).toHaveBeenLastCalledWith("");
  });

  it("Trocar limpa a escolha", async () => {
    const user = userEvent.setup();
    const { aoEscolher } = renderCampo(ACME);

    await user.click(screen.getByRole("button", { name: "Trocar" }));

    expect(aoEscolher).toHaveBeenCalledWith(null);
  });
});
