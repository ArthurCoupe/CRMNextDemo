import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { CODIGO_SEM_PERMISSAO } from "@/shared/lib/permissao";

import type { DespesaCadastrada } from "../api/expenses.repository";
import { listarAgrupadores } from "../api/expenses.repository";
import { FormularioDeDespesa } from "./formulario-de-despesa";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
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

const CARTAO_DESATIVADO = "1d8c3f60-4a29-4b71-9e05-2c6b8d7a5f13";
const CARTAO_ATIVO = "6b0e5a34-7c18-4d92-8a63-9f2d1c40e857";

const LISTA = [
  { id: CARTAO_DESATIVADO, descricao: "Cartão Inter", ativo: false },
  { id: CARTAO_ATIVO, descricao: "Cartão Itaú", ativo: true },
];

function despesaPenduradaEm(agrupadorId: string | null, id = "despesa-1"): DespesaCadastrada {
  return {
    id,
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
    agrupadorId,
    ehAgrupador: false,
    ativa: true,
    saiuEm: null,
    observacoes: null,
  };
}

const listarAgrupadoresFalso = vi.mocked(listarAgrupadores);

const RECUSA_DO_BANCO = erroDoBanco({
  code: CODIGO_SEM_PERMISSAO,
  message: "permission denied for table expenses",
});

beforeEach(() => {
  vi.clearAllMocks();
  listarAgrupadoresFalso.mockResolvedValue(LISTA);
});

function renderFormulario(despesa: DespesaCadastrada | null) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={cliente}>
      <FormularioDeDespesa aberto onFechar={vi.fn()} despesa={despesa} />
    </QueryClientProvider>,
  );
  const rerender = (outra: DespesaCadastrada | null) =>
    utils.rerender(
      <QueryClientProvider client={cliente}>
        <FormularioDeDespesa aberto onFechar={vi.fn()} despesa={outra} />
      </QueryClientProvider>,
    );
  return { ...utils, rerender };
}

const campo = () => screen.getByRole("combobox", { name: "Pendurar em" });

describe("agrupador desativado — o cartão gravado aparece e continua recuperável", () => {
  it("🔴 o cartão desativado é rotulado e ESCOLHÍVEL — dá para desfazer dentro do diálogo", async () => {
    const user = userEvent.setup();
    renderFormulario(despesaPenduradaEm(CARTAO_DESATIVADO));

    await waitFor(() => expect(campo()).toHaveTextContent("Cartão Inter (desativado)"));

    await user.click(campo());
    await user.click(await screen.findByRole("option", { name: "Nenhum (despesa avulsa)" }));
    expect(campo()).toHaveTextContent("Nenhum (despesa avulsa)");

    await user.click(campo());
    await user.click(await screen.findByRole("option", { name: "Cartão Inter (desativado)" }));
    expect(campo()).toHaveTextContent("Cartão Inter (desativado)");
  });

  it("o cartão ativo não ganha o rótulo — o gatilho mostra só a descrição", async () => {
    renderFormulario(despesaPenduradaEm(CARTAO_ATIVO));

    await waitFor(() => expect(campo()).toHaveTextContent("Cartão Itaú"));
    expect(screen.queryByText(/\(desativado\)/)).not.toBeInTheDocument();
  });

  it("🔴 enquanto a lista carrega, o gatilho não fica em branco", () => {
    listarAgrupadoresFalso.mockReturnValue(new Promise(() => {}));
    renderFormulario(despesaPenduradaEm(CARTAO_DESATIVADO));

    expect(campo()).toHaveTextContent("Carregando agrupadores");
  });

  it("🔴 quando a leitura FALHA, o gatilho diz que há agrupador em vez de esvaziar", async () => {
    listarAgrupadoresFalso.mockRejectedValue(RECUSA_DO_BANCO);
    renderFormulario(despesaPenduradaEm(CARTAO_DESATIVADO));

    await waitFor(() =>
      expect(campo()).toHaveTextContent("Agrupador gravado (não foi possível ler a descrição)"),
    );
    expect(campo()).not.toHaveTextContent("Carregando agrupadores");
    expect(screen.getByText(/Não foi possível ler os agrupadores/)).toBeInTheDocument();
  });

  it("sem agrupador gravado, carregando ou não, o gatilho diz só Nenhum", () => {
    listarAgrupadoresFalso.mockReturnValue(new Promise(() => {}));
    renderFormulario(despesaPenduradaEm(null));

    expect(campo()).toHaveTextContent("Nenhum (despesa avulsa)");
    expect(campo()).not.toHaveTextContent("Carregando agrupadores");
  });

  it("sem agrupador gravado, com a leitura falhada, o gatilho diz só Nenhum", async () => {
    listarAgrupadoresFalso.mockRejectedValue(RECUSA_DO_BANCO);
    renderFormulario(despesaPenduradaEm(null));

    await waitFor(() =>
      expect(screen.getByText(/Não foi possível ler os agrupadores/)).toBeInTheDocument(),
    );
    expect(campo()).toHaveTextContent("Nenhum (despesa avulsa)");
    expect(campo()).not.toHaveTextContent("não foi possível ler a descrição");
  });
});

describe("fiação: o id gravado chega ao repositório, e a chave separa uma ficha da outra", () => {
  it("🔴 a ficha aberta pede o agrupador gravado — sem isso o desativado nem vem do banco", async () => {
    renderFormulario(despesaPenduradaEm(CARTAO_DESATIVADO));

    await waitFor(() => expect(listarAgrupadoresFalso).toHaveBeenCalledWith(CARTAO_DESATIVADO));
  });

  it("o cadastro de despesa nova pede a lista sem agrupador", async () => {
    renderFormulario(null);

    await waitFor(() => expect(listarAgrupadoresFalso).toHaveBeenCalledWith(null));
  });

  it("🔴 abrir outra ficha refaz a consulta — chave fixa serviria a lista da anterior", async () => {
    const { rerender } = renderFormulario(despesaPenduradaEm(CARTAO_DESATIVADO));
    await waitFor(() => expect(listarAgrupadoresFalso).toHaveBeenCalledWith(CARTAO_DESATIVADO));

    rerender(despesaPenduradaEm(CARTAO_ATIVO, "despesa-2"));

    await waitFor(() => expect(listarAgrupadoresFalso).toHaveBeenCalledWith(CARTAO_ATIVO));
  });
});

describe("Início com ano pela metade", () => {
  it("🔴 trava o Salvar e diz por quê; corrigido, libera", async () => {
    renderFormulario(despesaPenduradaEm(null));
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
  const descricao = () => screen.getByLabelText("Descrição");

  it("trocar a despesa com o diálogo aberto mostra a nova", () => {
    const { rerender } = renderFormulario(despesaPenduradaEm(null));
    expect(descricao()).toHaveValue("Figma");

    rerender({ ...despesaPenduradaEm(null, "despesa-2"), descricao: "Notion" });

    expect(descricao()).toHaveValue("Notion");
  });

  it("fechar e reabrir descarta o que foi digitado", () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const despesa = despesaPenduradaEm(null);
    const tela = (aberto: boolean) => (
      <QueryClientProvider client={cliente}>
        <FormularioDeDespesa aberto={aberto} onFechar={vi.fn()} despesa={despesa} />
      </QueryClientProvider>
    );
    const { rerender } = render(tela(true));
    fireEvent.change(descricao(), { target: { value: "rascunho largado" } });
    expect(descricao()).toHaveValue("rascunho largado");

    rerender(tela(false));
    rerender(tela(true));

    expect(descricao()).toHaveValue("Figma");
  });

  it("fluxo da página: monta fechado, edita A, fecha, edita B, fecha, abre nova", () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const a = despesaPenduradaEm(null);
    const b = { ...despesaPenduradaEm(null, "despesa-2"), descricao: "Notion" };
    const tela = (aberto: boolean, despesa: DespesaCadastrada | null) => (
      <QueryClientProvider client={cliente}>
        <FormularioDeDespesa aberto={aberto} onFechar={vi.fn()} despesa={despesa} />
      </QueryClientProvider>
    );
    const { rerender } = render(tela(false, null));

    rerender(tela(true, a));
    expect(descricao()).toHaveValue("Figma");
    rerender(tela(false, a));
    rerender(tela(true, b));
    expect(descricao()).toHaveValue("Notion");
    rerender(tela(false, b));
    rerender(tela(true, null));
    expect(descricao()).toHaveValue("");
  });
});
