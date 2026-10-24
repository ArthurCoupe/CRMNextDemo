import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CampoEditavel } from "./campo-editavel";

describe("CampoEditavel", () => {
  it("grava ao sair do campo", async () => {
    const gravar = vi.fn();
    const user = userEvent.setup();
    render(
      <CampoEditavel id="x" rotulo="Nome" valor="Antigo" disabled={false} onGravar={gravar} />,
    );

    await user.clear(screen.getByLabelText("Nome"));
    await user.type(screen.getByLabelText("Nome"), "Novo");
    await user.tab();

    expect(gravar).toHaveBeenCalledWith("Novo");
  });

  it("🔴 sair sem editar NAO grava — nao gera PATCH a cada foco", async () => {
    const gravar = vi.fn();
    const user = userEvent.setup();
    render(
      <CampoEditavel id="x" rotulo="Nome" valor="Antigo" disabled={false} onGravar={gravar} />,
    );

    await user.click(screen.getByLabelText("Nome"));
    await user.tab();

    expect(gravar).not.toHaveBeenCalled();
  });

  it("🔴 valor novo do SERVIDOR remonta o input — a tela nunca mostra o que ja nao e o gravado", () => {
    const { rerender } = render(
      <CampoEditavel id="x" rotulo="Nome" valor="Antigo" disabled={false} onGravar={vi.fn()} />,
    );
    expect(screen.getByLabelText("Nome")).toHaveValue("Antigo");

    rerender(
      <CampoEditavel
        id="x"
        rotulo="Nome"
        valor="Do servidor"
        disabled={false}
        onGravar={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Nome")).toHaveValue("Do servidor");
  });

  it("🔴 desabilitado nao grava, e o positivo ao lado prova que o teste nao passa por ausencia", async () => {
    const gravar = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <CampoEditavel id="x" rotulo="Nome" valor="A" disabled onGravar={gravar} />,
    );
    expect(screen.getByLabelText("Nome")).toBeDisabled();

    rerender(<CampoEditavel id="x" rotulo="Nome" valor="A" disabled={false} onGravar={gravar} />);
    await user.clear(screen.getByLabelText("Nome"));
    await user.type(screen.getByLabelText("Nome"), "B");
    await user.tab();

    expect(gravar).toHaveBeenCalledWith("B");
  });

  it("campo vazio grava string vazia — quem converte para null e o repositorio", async () => {
    const gravar = vi.fn();
    const user = userEvent.setup();
    render(<CampoEditavel id="x" rotulo="Nome" valor="A" disabled={false} onGravar={gravar} />);

    await user.clear(screen.getByLabelText("Nome"));
    await user.tab();

    expect(gravar).toHaveBeenCalledWith("");
  });

  it('🔴 type="date" produz um input nativo de data, não texto livre', () => {
    render(
      <CampoEditavel
        id="x"
        rotulo="Prazo"
        valor="2026-09-10"
        disabled={false}
        onGravar={vi.fn()}
        type="date"
      />,
    );

    expect(screen.getByLabelText("Prazo")).toHaveAttribute("type", "date");
  });

  it("sem `type`, o input continua texto livre — o default não muda para os outros campos", () => {
    render(
      <CampoEditavel id="x" rotulo="Nome" valor="Antigo" disabled={false} onGravar={vi.fn()} />,
    );

    expect(screen.getByLabelText("Nome")).toHaveAttribute("type", "text");
  });
});
