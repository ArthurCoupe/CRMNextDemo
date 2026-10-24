import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mesEAno } from "../domain/expenses";
import { hojeEmSaoPaulo, indiceDoMes, primeiroDiaDoMes } from "../domain/mes-civil";

const resultadoPorBu = vi.fn();
const resultadoConsolidado = vi.fn();
const custoPorBu = vi.fn();

const CONSULTA_VAZIA = { data: undefined, isPending: false, isError: false };
const CONSULTA_LISTA_VAZIA = { data: [], isPending: false, isError: false };
const RESULTADO_SEM_LINHA = {
  data: { linhas: [], congelado: false },
  isPending: false,
  isError: false,
};

let projecaoConsulta: { data: unknown; isPending: boolean; isError: boolean };
let historicoConsulta: { data: unknown; isPending: boolean; isError: boolean } =
  CONSULTA_LISTA_VAZIA;
const regravar = { mutate: vi.fn(), isPending: false };

vi.mock("../hooks/use-financial", () => ({
  useProjetosAtrasados: () => CONSULTA_LISTA_VAZIA,
}));

vi.mock("../hooks/use-expenses", () => ({
  useProjecaoDeCusto: () => projecaoConsulta,
  useQuedaDeCusto: () => CONSULTA_LISTA_VAZIA,
}));

vi.mock("../hooks/use-result", () => ({
  useResultadoPorBu: (mes: string | null) => resultadoPorBu(mes),
  useResultadoConsolidado: (mes: string | null) => resultadoConsolidado(mes),
  useCustoPorBu: (mes: string | null) => custoPorBu(mes),
  useHistoricoDeResultado: () => historicoConsulta,
  useBreakEven: () => CONSULTA_VAZIA,
  useMetaDeMrr: () => CONSULTA_VAZIA,
  useEncerramentosAutomaticos: () => CONSULTA_LISTA_VAZIA,
  useReverterEncerramento: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  useRegravarMes: () => regravar,
}));

const { Resultado } = await import("./resultado");

function mesEsperado(): string {
  const indice = indiceDoMes(hojeEmSaoPaulo());
  if (indice === null) throw new Error("hojeEmSaoPaulo() nao devolveu ISO valido");
  return primeiroDiaDoMes(indice);
}

beforeEach(() => {
  resultadoPorBu.mockReset();
  resultadoConsolidado.mockReset();
  custoPorBu.mockReset();
  resultadoPorBu.mockReturnValue(RESULTADO_SEM_LINHA);
  resultadoConsolidado.mockReturnValue(CONSULTA_VAZIA);
  custoPorBu.mockReturnValue(CONSULTA_LISTA_VAZIA);
  historicoConsulta = CONSULTA_LISTA_VAZIA;
  regravar.mutate.mockReset();
  regravar.isPending = false;
});

afterEach(cleanup);

describe("Resultado — mes local independe da projecao (FIN-6)", () => {
  it("projecao OK: a matriz consulta o mes civil de hoje", () => {
    projecaoConsulta = { data: [{ mes: "2020-01-01" }], isPending: false, isError: false };

    render(<Resultado />);

    expect(resultadoPorBu).toHaveBeenCalledWith(mesEsperado());
    expect(screen.queryByText(/Não foi possível ler a projeção de custo/)).not.toBeInTheDocument();
  });

  it("🔴 projecao em ERRO: a matriz continua consultando o mes local, sem travar em esqueleto", () => {
    projecaoConsulta = { data: undefined, isPending: false, isError: true };

    render(<Resultado />);

    expect(resultadoPorBu).toHaveBeenCalledWith(mesEsperado());
    expect(resultadoPorBu).not.toHaveBeenCalledWith(null);

    expect(screen.getByText(/Não foi possível ler a projeção de custo/)).toBeInTheDocument();

    expect(
      screen.getByText("Nenhuma linha de negócio com movimento neste mês."),
    ).toBeInTheDocument();
  });
});

describe("Regravar mês (D-069, C1)", () => {
  const MES_FECHADO = {
    mes: "2026-08-01",
    receitaLiquida: 1000,
    custoTotal: 400,
    resultado: 600,
    congelado: true,
    parcial: false,
  };

  it("mês com snapshot regrava só com motivo, e o clique não troca o mês selecionado", async () => {
    const user = userEvent.setup();
    projecaoConsulta = { data: [], isPending: false, isError: false };
    historicoConsulta = { data: [MES_FECHADO], isPending: false, isError: false };
    render(<Resultado />);

    await user.click(
      screen.getByRole("button", { name: `Regravar o snapshot de ${mesEAno("2026-08-01")}` }),
    );
    const confirmar = screen.getByRole("button", { name: "Regravar mês" });
    expect(confirmar).toBeDisabled();

    const campo = screen.getByLabelText("Motivo da regravação");
    await user.type(campo, "   ");
    expect(confirmar).toBeDisabled();

    await user.clear(campo);
    await user.type(campo, "Contrato de agosto corrigido");
    await user.click(confirmar);

    expect(regravar.mutate).toHaveBeenCalledWith({
      mes: "2026-08-01",
      motivo: "Contrato de agosto corrigido",
    });
    expect(resultadoPorBu).not.toHaveBeenCalledWith("2026-08-01");
  });

  it("durante a gravação a confirmação trava, mesmo com motivo", async () => {
    const user = userEvent.setup();
    regravar.isPending = true;
    projecaoConsulta = { data: [], isPending: false, isError: false };
    historicoConsulta = { data: [MES_FECHADO], isPending: false, isError: false };
    render(<Resultado />);

    await user.click(
      screen.getByRole("button", { name: `Regravar o snapshot de ${mesEAno("2026-08-01")}` }),
    );
    await user.type(screen.getByLabelText("Motivo da regravação"), "Contrato de agosto corrigido");

    const confirmar = screen.getByRole("button", { name: "Regravar mês" });
    expect(confirmar).toBeDisabled();
    await user.click(confirmar);
    expect(regravar.mutate).not.toHaveBeenCalled();
  });

  it.each([
    ["reconstruído", { congelado: false, parcial: false }],
    ["parcial", { congelado: true, parcial: true }],
  ])("mês %s não oferece regravar", (_nome, estado) => {
    projecaoConsulta = { data: [], isPending: false, isError: false };
    historicoConsulta = { data: [{ ...MES_FECHADO, ...estado }], isPending: false, isError: false };
    render(<Resultado />);
    expect(screen.queryByRole("button", { name: /Regravar o snapshot/ })).not.toBeInTheDocument();
  });
});
