import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { CODIGO_SEM_PERMISSAO } from "@/shared/lib/permissao";

import type { PessoaCadastrada } from "../api/payroll.repository";
import { listarPerfis } from "../api/payroll.repository";
import { FormularioDePessoa } from "./formulario-de-pessoa";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../api/payroll.repository", () => ({
  atualizarPessoa: vi.fn(),
  criarPessoa: vi.fn(),
  definirSituacaoDaPessoa: vi.fn(),
  lerCustoDeFolhaPorBu: vi.fn(),
  lerEquipe: vi.fn(),
  listarPerfis: vi.fn(),
  listarPessoas: vi.fn(),
}));

vi.mock("../api/expenses.repository", () => ({
  atualizarDespesa: vi.fn(),
  criarDespesa: vi.fn(),
  definirSituacaoDaDespesa: vi.fn(),
  lerDespesasEfetivas: vi.fn(),
  lerProjecaoDeCusto: vi.fn(),
  lerQuedaDeCusto: vi.fn(),
  listarAgrupadores: vi.fn(),
  listarDespesasCadastradas: vi.fn(),
}));

const PERFIL_DESATIVADO = "3f6b8c21-9d47-4e50-b2a8-1c7e5d904f36";
const PERFIL_ATIVO = "5a2d7e88-1b34-4c96-8f07-6e3a9b2c4d15";

const LISTA = [
  { id: PERFIL_DESATIVADO, nome: "Ana Souza", ativo: false },
  { id: PERFIL_ATIVO, nome: "Bia Lima", ativo: true },
];

function pessoaVinculadaA(profileId: string, id = "pessoa-1"): PessoaCadastrada {
  return {
    id,
    profileId,
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
}

const listarPerfisFalso = vi.mocked(listarPerfis);

const RECUSA_DO_BANCO = erroDoBanco({
  code: CODIGO_SEM_PERMISSAO,
  message: "permission denied for table profiles",
});

beforeEach(() => {
  vi.clearAllMocks();
  listarPerfisFalso.mockResolvedValue(LISTA);
});

function renderFormulario(pessoa: PessoaCadastrada | null) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={cliente}>
      <FormularioDePessoa aberto onFechar={vi.fn()} pessoa={pessoa} />
    </QueryClientProvider>,
  );
  const rerender = (outra: PessoaCadastrada | null) =>
    utils.rerender(
      <QueryClientProvider client={cliente}>
        <FormularioDePessoa aberto onFechar={vi.fn()} pessoa={outra} />
      </QueryClientProvider>,
    );
  return { ...utils, rerender };
}

const campo = () => screen.getByRole("combobox", { name: "Conta no sistema" });

describe("conta desativada — o vínculo gravado aparece e continua recuperável", () => {
  it("🔴 a conta desativada é rotulada e ESCOLHÍVEL — dá para desfazer dentro do diálogo", async () => {
    const user = userEvent.setup();
    renderFormulario(pessoaVinculadaA(PERFIL_DESATIVADO));

    await waitFor(() => expect(campo()).toHaveTextContent("Ana Souza (desativada)"));

    await user.click(campo());
    await user.click(await screen.findByRole("option", { name: "Sem conta vinculada" }));
    expect(campo()).toHaveTextContent("Sem conta vinculada");

    await user.click(campo());
    await user.click(await screen.findByRole("option", { name: "Ana Souza (desativada)" }));
    expect(campo()).toHaveTextContent("Ana Souza (desativada)");
  });

  it("a conta ativa não ganha o rótulo — o gatilho mostra só o nome", async () => {
    renderFormulario(pessoaVinculadaA(PERFIL_ATIVO));

    await waitFor(() => expect(campo()).toHaveTextContent("Bia Lima"));
    expect(screen.queryByText(/\(desativada\)/)).not.toBeInTheDocument();
  });

  it("🔴 enquanto a lista carrega, o gatilho não fica em branco", () => {
    listarPerfisFalso.mockReturnValue(new Promise(() => {}));
    renderFormulario(pessoaVinculadaA(PERFIL_DESATIVADO));

    expect(campo()).toHaveTextContent("Carregando contas");
  });

  it("🔴 quando a leitura FALHA, o gatilho nomeia o vínculo em vez de esvaziar", async () => {
    listarPerfisFalso.mockRejectedValue(RECUSA_DO_BANCO);
    renderFormulario(pessoaVinculadaA(PERFIL_DESATIVADO));

    await waitFor(() =>
      expect(campo()).toHaveTextContent("Conta vinculada (não foi possível ler o nome)"),
    );
    expect(campo()).not.toHaveTextContent("Carregando contas");
    expect(screen.getByText(/Não foi possível ler as contas/)).toBeInTheDocument();
  });

  it("na criação, carregando ou não, o gatilho diz só Sem conta vinculada", () => {
    listarPerfisFalso.mockReturnValue(new Promise(() => {}));
    renderFormulario(null);

    expect(campo()).toHaveTextContent("Sem conta vinculada");
    expect(campo()).not.toHaveTextContent("Carregando contas");
  });

  it("na criação, com a leitura falhada, o gatilho diz só Sem conta vinculada", async () => {
    listarPerfisFalso.mockRejectedValue(RECUSA_DO_BANCO);
    renderFormulario(null);

    await waitFor(() =>
      expect(screen.getByText(/Não foi possível ler as contas/)).toBeInTheDocument(),
    );
    expect(campo()).toHaveTextContent("Sem conta vinculada");
    expect(campo()).not.toHaveTextContent("não foi possível ler o nome");
  });
});

describe("fiação: o id gravado chega ao repositório, e a chave separa uma ficha da outra", () => {
  it("🔴 a ficha aberta pede o perfil vinculado — sem isso o desativado nem vem do banco", async () => {
    renderFormulario(pessoaVinculadaA(PERFIL_DESATIVADO));

    await waitFor(() => expect(listarPerfisFalso).toHaveBeenCalledWith(PERFIL_DESATIVADO));
  });

  it("a criação de pessoa pede a lista sem vínculo", async () => {
    renderFormulario(null);

    await waitFor(() => expect(listarPerfisFalso).toHaveBeenCalledWith(null));
  });

  it("🔴 abrir outra ficha refaz a consulta — chave fixa serviria a lista da anterior", async () => {
    const { rerender } = renderFormulario(pessoaVinculadaA(PERFIL_DESATIVADO));
    await waitFor(() => expect(listarPerfisFalso).toHaveBeenCalledWith(PERFIL_DESATIVADO));

    rerender(pessoaVinculadaA(PERFIL_ATIVO, "pessoa-2"));

    await waitFor(() => expect(listarPerfisFalso).toHaveBeenCalledWith(PERFIL_ATIVO));
  });
});

describe("Início com ano pela metade", () => {
  it("🔴 trava o Salvar e diz por quê; corrigido, libera", async () => {
    renderFormulario(pessoaVinculadaA(PERFIL_ATIVO));
    const salvar = screen.getByRole("button", { name: "Salvar" });
    await waitFor(() => expect(salvar).toBeEnabled());

    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "0002-01-05" } });
    expect(screen.getByText("Data inválida. Use um ano entre 2000 e 2100.")).toBeInTheDocument();
    expect(salvar).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-01-05" } });
    expect(
      screen.queryByText("Data inválida. Use um ano entre 2000 e 2100."),
    ).not.toBeInTheDocument();
    expect(salvar).toBeEnabled();
  });
});

describe("o rascunho acompanha a ficha", () => {
  const nome = () => screen.getByLabelText("Nome");

  it("trocar a pessoa com o diálogo aberto mostra a nova", () => {
    const { rerender } = renderFormulario(pessoaVinculadaA(PERFIL_ATIVO));
    expect(nome()).toHaveValue("Ana Souza");

    rerender({ ...pessoaVinculadaA(PERFIL_ATIVO, "pessoa-2"), pessoa: "Caio Reis" });

    expect(nome()).toHaveValue("Caio Reis");
  });

  it("fechar e reabrir descarta o que foi digitado", () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const pessoa = pessoaVinculadaA(PERFIL_ATIVO);
    const tela = (aberto: boolean) => (
      <QueryClientProvider client={cliente}>
        <FormularioDePessoa aberto={aberto} onFechar={vi.fn()} pessoa={pessoa} />
      </QueryClientProvider>
    );
    const { rerender } = render(tela(true));
    fireEvent.change(nome(), { target: { value: "rascunho largado" } });
    expect(nome()).toHaveValue("rascunho largado");

    rerender(tela(false));
    rerender(tela(true));

    expect(nome()).toHaveValue("Ana Souza");
  });

  it("fluxo da página: monta fechado, edita A, fecha, edita B, fecha, abre nova", () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const a = pessoaVinculadaA(PERFIL_ATIVO);
    const b = { ...pessoaVinculadaA(PERFIL_ATIVO, "pessoa-2"), pessoa: "Caio Reis" };
    const tela = (aberto: boolean, pessoa: typeof a | null) => (
      <QueryClientProvider client={cliente}>
        <FormularioDePessoa aberto={aberto} onFechar={vi.fn()} pessoa={pessoa} />
      </QueryClientProvider>
    );
    const { rerender } = render(tela(false, null));

    rerender(tela(true, a));
    expect(nome()).toHaveValue("Ana Souza");
    rerender(tela(false, a));
    rerender(tela(true, b));
    expect(nome()).toHaveValue("Caio Reis");
    rerender(tela(false, b));
    rerender(tela(true, null));
    expect(nome()).toHaveValue("");
  });
});
