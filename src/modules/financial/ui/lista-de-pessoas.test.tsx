import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apagarPessoaDaFolha, type PessoaCadastrada } from "../api/payroll.repository";
import { ListaDePessoas } from "./lista-de-pessoas";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../api/payroll.repository", () => ({
  apagarPessoaDaFolha: vi.fn(),
  atualizarPessoa: vi.fn(),
  criarPessoa: vi.fn(),
  definirSituacaoDaPessoa: vi.fn(),
  lerCustoDeFolhaPorBu: vi.fn(),
  lerEquipe: vi.fn(),
  listarPerfis: vi.fn(),
  listarPessoas: vi.fn(),
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

const PESSOA: PessoaCadastrada = {
  id: "pessoa-1",
  profileId: null,
  pessoa: "Ana Souza",
  cargo: "Closer",
  vinculo: "clt",
  bu: "demanda",
  custoMensal: 5000,
  beneficios: 0,
  percentualSugerido: null,
  inicio: "2026-01-05",
  fim: null,
  ativa: true,
};

function renderLista() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <ListaDePessoas
        pessoas={[PESSOA]}
        truncada={false}
        estado="pronto"
        mostrarInativas={false}
        onAlternarInativas={vi.fn()}
        onEditar={vi.fn()}
        mesReferencia="2026-09-01"
      />
    </QueryClientProvider>,
  );
}

describe("ListaDePessoas: apagar pessoa da folha", () => {
  beforeEach(() => {
    vi.mocked(apagarPessoaDaFolha).mockReset();
    vi.mocked(apagarPessoaDaFolha).mockResolvedValue(undefined);
  });

  it("confirmar apaga pelo id da linha, depois de dizer que mês fechado não muda", async () => {
    const user = userEvent.setup();
    renderLista();

    await user.click(screen.getByRole("button", { name: "Apagar Ana Souza" }));

    expect(
      screen.getByRole("alertdialog", { name: 'Apagar "Ana Souza" da folha?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Meses já fechados não mudam/)).toBeInTheDocument();
    expect(screen.getByText(/use "Tirar da folha" em vez de apagar/)).toBeInTheDocument();
    expect(apagarPessoaDaFolha).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));

    await waitFor(() => expect(apagarPessoaDaFolha).toHaveBeenCalledTimes(1));
    expect(vi.mocked(apagarPessoaDaFolha).mock.calls[0]?.[0]).toBe("pessoa-1");
  });

  it("Cancelar não apaga, o negativo ao lado", async () => {
    const user = userEvent.setup();
    renderLista();

    await user.click(screen.getByRole("button", { name: "Apagar Ana Souza" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(apagarPessoaDaFolha).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Tirar da folha" })).toBeEnabled();
  });
});
