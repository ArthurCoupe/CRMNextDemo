import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { EncerramentoAutomatico } from "../api/result.repository";
import { CardsDoResultado } from "./cards-do-resultado";

const ENCERRAMENTO: EncerramentoAutomatico = {
  contractId: "c1",
  contrato: "Site",
  cliente: "Padaria",
  bu: "sistemas",
  valorTotal: 3000,
  fechadoEm: "2026-09-01",
  motivo: "tcv_vencido",
};

function renderizar(encerramentos: readonly EncerramentoAutomatico[], onReverter = vi.fn()) {
  render(
    <CardsDoResultado
      breakEven={null}
      estadoDoBreakEven="pronto"
      queda={null}
      estadoDaQueda="pronto"
      meta={undefined}
      estadoDaMeta="pronto"
      mrrFirme={null}
      atrasados={[]}
      estadoDosAtrasados="pronto"
      encerramentos={encerramentos}
      estadoDosEncerramentos="pronto"
      onReverter={onReverter}
      revertendo={undefined}
    />,
  );
  return onReverter;
}

describe("card Encerrados pelo sistema — um Reverter por linha (FIN-8)", () => {
  it("🔴 dois encerramentos, dois botões, cada um com o próprio contractId", () => {
    const onReverter = renderizar([
      ENCERRAMENTO,
      { ...ENCERRAMENTO, contractId: "c2", cliente: "Mercearia" },
    ]);

    expect(screen.getAllByRole("button", { name: /^Reverter / })).toHaveLength(2);
    expect(screen.getByText(/Padaria/)).toBeInTheDocument();
    expect(screen.getByText(/Mercearia/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reverter Mercearia · Site" }));
    expect(onReverter).toHaveBeenCalledTimes(1);
    expect(onReverter).toHaveBeenCalledWith("c2");
  });

  it("um encerramento, um botão — o positivo ao lado", () => {
    const onReverter = renderizar([ENCERRAMENTO]);

    expect(screen.getAllByRole("button", { name: /^Reverter / })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Reverter Padaria · Site" }));
    expect(onReverter).toHaveBeenCalledWith("c1");
  });

  it("nenhum encerramento: zero e sem botão", () => {
    renderizar([]);

    expect(screen.queryByRole("button", { name: /Reverter/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhum TCV foi fechado automaticamente/)).toBeInTheDocument();
  });
});
