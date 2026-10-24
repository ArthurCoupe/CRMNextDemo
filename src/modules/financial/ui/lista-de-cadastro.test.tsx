import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apagarDespesa, type DespesaCadastrada } from "../api/expenses.repository";
import { ListaDeCadastro } from "./lista-de-cadastro";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../api/expenses.repository", () => ({
  apagarDespesa: vi.fn(),
  atualizarDespesa: vi.fn(),
  criarDespesa: vi.fn(),
  definirSituacaoDaDespesa: vi.fn(),
  lerDespesasEfetivas: vi.fn(),
  lerProjecaoDeCusto: vi.fn(),
  lerQuedaDeCusto: vi.fn(),
  listarAgrupadores: vi.fn(),
  listarDespesasCadastradas: vi.fn(),
}));

function despesa(sobrescreve: Partial<DespesaCadastrada>): DespesaCadastrada {
  return {
    id: "despesa-1",
    descricao: "Figma",
    valor: 120,
    categoria: "operacional",
    bu: "compartilhado",
    recorrencia: "mensal",
    parcelasTotal: null,
    parcelasPagas: 0,
    inicio: "2026-01-05",
    fim: null,
    fornecedor: null,
    meioDePagamento: null,
    agrupadorId: null,
    ehAgrupador: false,
    ativa: true,
    saiuEm: null,
    observacoes: null,
    ...sobrescreve,
  };
}

function renderLista(despesas: readonly DespesaCadastrada[]) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <ListaDeCadastro
        despesas={despesas}
        truncada={false}
        estado="pronto"
        mostrarInativas
        onAlternarInativas={vi.fn()}
        onEditar={vi.fn()}
        mesReferencia="2026-09-01"
      />
    </QueryClientProvider>,
  );
}

describe("ListaDeCadastro: a linha tirada do custo diz quando saiu", () => {
  it("inativa mostra `saiu em dd/mm/aaaa` no dia civil de São Paulo, não em UTC", () => {
    renderLista([despesa({ ativa: false, saiuEm: "2026-04-01T02:00:00+00:00" })]);

    expect(screen.getByText(/saiu em 31\/03\/2026/)).toBeInTheDocument();
  });

  it("ativa não fala em saída — o positivo ao lado", () => {
    renderLista([despesa({ ativa: true, saiuEm: null })]);

    expect(screen.queryByText(/saiu em/)).not.toBeInTheDocument();
  });
});

describe("ListaDeCadastro: apagar despesa", () => {
  beforeEach(() => {
    vi.mocked(apagarDespesa).mockReset();
    vi.mocked(apagarDespesa).mockResolvedValue(undefined);
  });

  it("confirmar apaga pelo id da linha, depois de dizer que mês fechado não muda", async () => {
    const user = userEvent.setup();
    renderLista([despesa({})]);

    await user.click(screen.getByRole("button", { name: "Apagar Figma" }));

    expect(screen.getByRole("alertdialog", { name: 'Apagar "Figma"?' })).toBeInTheDocument();
    expect(screen.getByText(/Meses já fechados não mudam/)).toBeInTheDocument();
    expect(screen.getByText(/use "Tirar do custo" em vez de apagar/)).toBeInTheDocument();
    expect(apagarDespesa).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));

    await waitFor(() => expect(apagarDespesa).toHaveBeenCalledTimes(1));
    expect(vi.mocked(apagarDespesa).mock.calls[0]?.[0]).toBe("despesa-1");
  });

  it("🔴 agrupador com despesa pendurada, mesmo tirada do custo, não oferece Apagar", () => {
    renderLista([
      despesa({ id: "cartao", descricao: "Cartão Inter", ehAgrupador: true, valor: 0 }),
      despesa({ id: "filha", descricao: "Notion", agrupadorId: "cartao", ativa: false }),
    ]);

    expect(screen.getByRole("button", { name: "Apagar Cartão Inter" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apagar Notion" })).toBeEnabled();
  });

  it("agrupador vazio oferece Apagar, o positivo ao lado", () => {
    renderLista([
      despesa({ id: "cartao", descricao: "Cartão Inter", ehAgrupador: true, valor: 0 }),
    ]);

    expect(screen.getByRole("button", { name: "Apagar Cartão Inter" })).toBeEnabled();
  });
});
