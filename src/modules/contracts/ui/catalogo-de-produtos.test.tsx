import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogoLido, ProdutoDoCatalogoCompleto } from "../api/products.repository";

const catalogo = {
  data: undefined as CatalogoLido | undefined,
  isPending: false,
  isError: false,
};

const apagar = vi.fn();
let papel = "owner";

vi.mock("../hooks/use-products", () => ({
  useCatalogoDeProdutos: () => catalogo,
  useSalvarProduto: () => ({ mutate: vi.fn(), isPending: false }),
  useDefinirSituacaoDoProduto: () => ({ mutate: vi.fn(), isPending: false }),
  useApagarProduto: () => ({ mutate: apagar, isPending: false, variables: undefined }),
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ papel }) }));
vi.mock("./formulario-de-produto", () => ({
  FormularioDeProduto: () => <div data-testid="formulario-de-produto" />,
}));

const { CatalogoDeProdutos } = await import("./catalogo-de-produtos");

const PRODUTO: ProdutoDoCatalogoCompleto = {
  id: "p1",
  nome: "Gestão de tráfego",
  descricao: null,
  frente: "trafego",
  linhaDeNegocio: "demanda",
  tipo: "mrr",
  preco: 4500,
  frentesDoCombo: null,
  ativo: true,
  ordem: 1,
};

beforeEach(() => {
  catalogo.data = undefined;
  catalogo.isPending = false;
  catalogo.isError = false;
  apagar.mockClear();
  papel = "owner";
});

describe("CatalogoDeProdutos — o teto que não pode ser silencioso", () => {
  it("catálogo no teto avisa que há produto fora da tabela", () => {
    catalogo.data = { produtos: [PRODUTO], truncado: true };

    render(<CatalogoDeProdutos />);

    expect(screen.getByText(/atingiu o teto/)).toBeInTheDocument();
    expect(screen.getByText("Gestão de tráfego")).toBeInTheDocument();
  });

  it("catálogo completo não inventa aviso de teto", () => {
    catalogo.data = { produtos: [PRODUTO], truncado: false };

    render(<CatalogoDeProdutos />);

    expect(screen.queryByText(/atingiu o teto/)).not.toBeInTheDocument();
  });

  it("🔴 em ERRO o aviso de teto some — a tela já disse que não leu nada", () => {
    catalogo.data = { produtos: [PRODUTO], truncado: true };
    catalogo.isError = true;

    render(<CatalogoDeProdutos />);

    expect(screen.queryByText(/atingiu o teto/)).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível ler o catálogo de produtos/)).toBeInTheDocument();
  });

  it("vazio genuíno continua sendo vazio, não teto", () => {
    catalogo.data = { produtos: [], truncado: false };

    render(<CatalogoDeProdutos />);

    expect(screen.getByText("Nenhum produto cadastrado")).toBeInTheDocument();
    expect(screen.queryByText(/atingiu o teto/)).not.toBeInTheDocument();
  });
});

describe("CatalogoDeProdutos: apagar produto", () => {
  it("owner vê Apagar, e confirmar apaga pelo id do produto", async () => {
    const user = userEvent.setup();
    catalogo.data = { produtos: [PRODUTO], truncado: false };

    render(<CatalogoDeProdutos />);
    await user.click(screen.getByRole("button", { name: "Apagar Gestão de tráfego" }));

    expect(
      screen.getByRole("alertdialog", { name: 'Apagar "Gestão de tráfego"?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/já usado em contrato não se apaga/)).toBeInTheDocument();
    expect(apagar).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));

    expect(apagar).toHaveBeenCalledTimes(1);
    expect(apagar).toHaveBeenCalledWith("p1");
  });

  it("quem não é owner não vê Apagar (nem Desativar)", () => {
    papel = "manager";
    catalogo.data = { produtos: [PRODUTO], truncado: false };

    render(<CatalogoDeProdutos />);

    expect(screen.getByText("Gestão de tráfego")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apagar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desativar" })).not.toBeInTheDocument();
  });
});
