import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { pct } from "@/shared/lib/format";

import type { LinhaDoPrimeiroContato } from "../api/pipeline.repository";
import { TempoAtePrimeiroContato } from "./tempo-ate-primeiro-contato";

const linha = (p: Partial<LinhaDoPrimeiroContato> & { canal: string }): LinhaDoPrimeiroContato => ({
  novos: 0,
  contatados: 0,
  medianaMin: null,
  comPrazoMedido: 0,
  noPrazo: 0,
  ...p,
});

function linhaDaTabela(rotulo: string) {
  return within(screen.getByText(rotulo).closest("tr") as HTMLElement);
}

describe("TempoAtePrimeiroContato", () => {
  it("erro antes do vazio: diz que não leu, não que não houve lead", () => {
    render(<TempoAtePrimeiroContato linhas={[]} estado="erro" />);
    expect(
      screen.getByText(/Não foi possível ler o tempo até o primeiro contato/),
    ).toBeInTheDocument();
  });

  it("canais na ordem da comparação e Sem atribuição por último, venha como vier do banco", () => {
    render(
      <TempoAtePrimeiroContato
        estado="pronto"
        linhas={[
          linha({ canal: "sem_atribuicao", novos: 1 }),
          linha({ canal: "outbound", novos: 1 }),
          linha({ canal: "pago", novos: 5 }),
          linha({ canal: "indicacao", novos: 1 }),
        ]}
      />,
    );
    const rotulos = screen
      .getAllByRole("row")
      .slice(1)
      .map((tr) => tr.querySelector("td")?.textContent);
    expect(rotulos).toEqual(["Indicação", "Tráfego pago", "Outbound", "Sem atribuição"]);
  });

  it("linha com prazo: contagens, mediana em horas úteis e % no prazo", () => {
    render(
      <TempoAtePrimeiroContato
        estado="pronto"
        linhas={[
          linha({
            canal: "pago",
            novos: 5,
            contatados: 3,
            medianaMin: 80,
            comPrazoMedido: 4,
            noPrazo: 2,
          }),
        ]}
      />,
    );
    const pago = linhaDaTabela("Tráfego pago");
    expect(pago.getByText("5")).toBeInTheDocument();
    expect(pago.getByText("3")).toBeInTheDocument();
    expect(pago.getByText("1 h 20 min")).toBeInTheDocument();
    expect(pago.getByText(pct(0.5))).toBeInTheDocument();
  });

  it("🔴 sem prazo medido ou sem contatado: traço, nunca 0% nem 0 min", () => {
    render(
      <TempoAtePrimeiroContato
        estado="pronto"
        linhas={[linha({ canal: "outbound", novos: 2, contatados: 0, medianaMin: null })]}
      />,
    );
    expect(linhaDaTabela("Outbound").getAllByText("-")).toHaveLength(2);
  });
});
