import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LiquidoDoContrato } from "../api/fiscal.repository";
import { FaturamentoLiquido } from "./faturamento-liquido";

const LINHA: LiquidoDoContrato = {
  contratoId: "c1",
  clienteId: "cl1",
  cliente: "Padaria do Zé",
  contrato: "Tráfego",
  meioDePagamento: "pix",
  parcelas: 1,
  bruto: 1000,
  imposto: 60,
  taxaVariavel: 0,
  taxaFixa: 0,
  liquido: 940,
  taxaVariavelPct: 0,
  impostoPct: 6,
  provisoria: false,
  tipo: "mrr",
  faturaNoMes: true,
  inicioFuturo: false,
};

const TOTAL = { bruto: 1000, deducoes: 60, liquido: 940, contratos: 1 };

function rodape() {
  return screen.getByText(/Participação de equipe não está deduzida/).closest("p");
}

describe("Faturamento líquido — o rodapé diz por que a linha está fora do total (FIN-5)", () => {
  it("🔴 contrato com início futuro: 'ainda não começou', sem prometer o job", () => {
    render(
      <FaturamentoLiquido
        linhas={[
          LINHA,
          { ...LINHA, contratoId: "c2", cliente: "Futura", faturaNoMes: false, inicioFuturo: true },
        ]}
        total={TOTAL}
        estado="pronto"
      />,
    );

    expect(screen.getByText("ainda não começou")).toBeInTheDocument();
    expect(rodape()).toHaveTextContent(/Um contrato ainda não começou a faturar/);
    expect(rodape()).not.toHaveTextContent(/cobrança acabou/);
    expect(rodape()).not.toHaveTextContent(/06:00/);
  });

  it("TCV que já encerrou a cobrança: 'a cobrança acabou' e o job das 06:00", () => {
    render(
      <FaturamentoLiquido
        linhas={[
          LINHA,
          { ...LINHA, contratoId: "c2", cliente: "Vencido", tipo: "tcv", faturaNoMes: false },
        ]}
        total={TOTAL}
        estado="pronto"
      />,
    );

    expect(screen.getByText("não fatura neste mês")).toBeInTheDocument();
    expect(rodape()).toHaveTextContent(/Um contrato já encerrou a janela de cobrança/);
    expect(rodape()).toHaveTextContent(/06:00/);
    expect(rodape()).not.toHaveTextContent(/ainda não começou/);
  });

  it("🔴 MRR que já encerrou: o job NÃO é prometido — MRR encerra pela ficha", () => {
    render(
      <FaturamentoLiquido
        linhas={[LINHA, { ...LINHA, contratoId: "c2", cliente: "Vencido", faturaNoMes: false }]}
        total={TOTAL}
        estado="pronto"
      />,
    );

    expect(rodape()).toHaveTextContent(/Um contrato já encerrou a janela de cobrança/);
    expect(rodape()).toHaveTextContent(/ficha do contrato/);
    expect(rodape()).not.toHaveTextContent(/06:00/);
  });

  it("os dois casos juntos: cada frase conta os seus", () => {
    render(
      <FaturamentoLiquido
        linhas={[
          { ...LINHA, contratoId: "c2", faturaNoMes: false, inicioFuturo: true },
          { ...LINHA, contratoId: "c3", faturaNoMes: false, inicioFuturo: true },
          { ...LINHA, contratoId: "c4", tipo: "tcv", faturaNoMes: false },
        ]}
        total={TOTAL}
        estado="pronto"
      />,
    );

    expect(rodape()).toHaveTextContent(/2 contratos ainda não começaram a faturar/);
    expect(rodape()).toHaveTextContent(/Um contrato já encerrou a janela de cobrança/);
  });

  it("todo mundo faturando: nenhuma das duas frases", () => {
    render(<FaturamentoLiquido linhas={[LINHA]} total={TOTAL} estado="pronto" />);

    expect(rodape()).not.toHaveTextContent(/não começou|encerrou/);
  });
});
