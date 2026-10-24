import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { MesProjetado } from "../domain/expenses";
import { ArvoreDeGastos } from "./arvore-de-gastos";

const MES: MesProjetado = {
  mes: "2026-10-01",
  custoTotal: 1234.56,
  custoDemanda: 1234.56,
  custoSistemas: 0,
  custoCompartilhado: 0,
  despesas: 0,
  custoGastos: 0,
  custoFolha: 1234.56,
  pessoasNaFolha: 1,
  folhaDemanda: 1234.56,
  folhaSistemas: 0,
  folhaCompartilhado: 0,
};

function renderizar(mostraOrigemDaFolha: boolean) {
  render(
    <ArvoreDeGastos
      despesas={[]}
      mesCorrente={MES}
      estado="pronto"
      estadoDoTotal="pronto"
      estadoDoCadastro="pronto"
      onEditar={() => {}}
      mostraOrigemDaFolha={mostraOrigemDaFolha}
    />,
  );
}

afterEach(cleanup);

describe("ArvoreDeGastos · selo de origem da folha (D-070)", () => {
  it("quem vê a folha lê de onde ela vem", () => {
    renderizar(true);
    expect(screen.getByText("vem da aba Folha e equipe")).toBeInTheDocument();
  });

  it("quem não vê a folha não recebe o selo; a linha da Folha fica (controle)", () => {
    renderizar(false);
    expect(screen.queryByText("vem da aba Folha e equipe")).toBeNull();
    expect(screen.getByText("Folha")).toBeInTheDocument();
    expect(screen.getByText(/1 pessoa conta neste mês/)).toBeInTheDocument();
  });
});
