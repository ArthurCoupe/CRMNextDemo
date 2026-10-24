import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

type Consulta = { data: boolean | undefined; isPending: boolean; isError: boolean };

const CONSULTA_VAZIA = { data: undefined, isPending: false, isError: false };
let veFolha: Consulta = { data: undefined, isPending: true, isError: false };

vi.mock("@/modules/seguranca/ui/aviso-segundo-fator", () => ({ AvisoSegundoFator: () => null }));
vi.mock("./folha", () => ({ Folha: () => <p>conteúdo da folha</p> }));
vi.mock("./gastos", () => ({ Gastos: () => null }));
vi.mock("./resultado", () => ({ Resultado: () => null }));
vi.mock("./matriz-de-receita", () => ({ MatrizDeReceita: () => null }));
vi.mock("./faturamento-por-frente", () => ({ FaturamentoPorFrente: () => null }));
vi.mock("./faturamento-liquido", () => ({ FaturamentoLiquido: () => null }));
vi.mock("./projetos-atrasados", () => ({ ProjetosAtrasados: () => null }));
vi.mock("../hooks/use-financial", () => ({
  useMrrPorUnidade: () => CONSULTA_VAZIA,
  useTcvPorUnidade: () => CONSULTA_VAZIA,
  useReceitaPorFrente: () => CONSULTA_VAZIA,
  useProjetosAtrasados: () => CONSULTA_VAZIA,
}));
vi.mock("../hooks/use-fiscal", () => ({
  useLiquidoPorContrato: () => CONSULTA_VAZIA,
  useLiquidoTotal: () => CONSULTA_VAZIA,
}));
vi.mock("../hooks/use-result", () => ({
  hojeParaEntrega: () => "2026-10-07",
  useDefinirEntrega: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));
vi.mock("../hooks/use-payroll", () => ({ useVeFolha: () => veFolha }));

const { FinancialPage } = await import("./financial-page");

afterEach(() => {
  cleanup();
  veFolha = { data: undefined, isPending: true, isError: false };
});

describe("FinancialPage · aba Folha e equipe (D-070)", () => {
  it("aparece para quem está na lista, e abre a folha", async () => {
    veFolha = { data: true, isPending: false, isError: false };
    render(<FinancialPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Folha e equipe" }));
    expect(screen.getByText("conteúdo da folha")).toBeInTheDocument();
  });

  it("some para quem está fora da lista; as outras abas ficam (controle)", () => {
    veFolha = { data: false, isPending: false, isError: false };
    render(<FinancialPage />);
    expect(screen.queryByRole("tab", { name: "Folha e equipe" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Gastos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resultado" })).toBeInTheDocument();
  });

  it("fica fora enquanto carrega e quando a consulta falha (falha fechada)", () => {
    veFolha = { data: undefined, isPending: true, isError: false };
    render(<FinancialPage />);
    expect(screen.queryByRole("tab", { name: "Folha e equipe" })).toBeNull();
    cleanup();

    veFolha = { data: undefined, isPending: false, isError: true };
    render(<FinancialPage />);
    expect(screen.queryByRole("tab", { name: "Folha e equipe" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Gastos" })).toBeInTheDocument();
  });
});
