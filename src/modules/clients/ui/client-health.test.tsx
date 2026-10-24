import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EntradaDeSaude } from "../domain/health";
import { ListaDeSinais } from "./client-health";

function entrada(over: Partial<EntradaDeSaude> = {}): EntradaDeSaude {
  return {
    status: "active",
    diasSemContato: 2,
    diasParaFimDeCobranca: 200,
    diasDesdeEntrada: 400,
    diasPausado: null,
    temResponsavel: true,
    cobrancaVisivel: true,
    contratosAtivos: 1,
    ...over,
  };
}

function frase(over: Partial<EntradaDeSaude> = {}): string {
  render(<ListaDeSinais sinais={[]} entrada={entrada(over)} />);
  return screen.getByText(/Nenhum sinal de risco/).textContent ?? "";
}

describe("ListaDeSinais — frase sem sinais (CLI-2)", () => {
  it("com tudo medido, afirma as três coisas", () => {
    const texto = frase();
    expect(texto).toMatch(/contato recente/i);
    expect(texto).toMatch(/cobrança em dia/i);
    expect(texto).toMatch(/responsável definido/i);
  });

  it("sem timeline não afirma contato recente", () => {
    const texto = frase({ diasSemContato: null });
    expect(texto).toMatch(/sem timeline registrada/i);
    expect(texto).not.toMatch(/contato recente/i);
  });

  it("sem contrato ativo não afirma cobrança em dia", () => {
    const texto = frase({ contratosAtivos: 0 });
    expect(texto).not.toMatch(/cobrança em dia/i);
  });

  it("sem responsável não afirma responsável definido", () => {
    const texto = frase({ status: "churned", temResponsavel: false, contratosAtivos: 0 });
    expect(texto).not.toMatch(/responsável definido/i);
  });

  it("leitura parcial mostra o aviso, não a frase positiva", () => {
    render(<ListaDeSinais sinais={[]} entrada={entrada({ cobrancaVisivel: false })} parcial />);
    expect(screen.queryByText(/Nenhum sinal de risco/)).toBeNull();
    expect(screen.getByText(/Avaliação incompleta/)).toBeInTheDocument();
  });
});
