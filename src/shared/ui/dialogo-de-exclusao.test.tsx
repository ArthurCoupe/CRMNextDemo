import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

import { DialogoDeExclusao } from "./dialogo-de-exclusao";

function montar(props: { confirmarDigitando?: string; pendente?: boolean }) {
  const confirmar = vi.fn();
  render(
    <DialogoDeExclusao
      gatilho={<Button type="button">Apagar cliente</Button>}
      titulo='Apagar "Padaria do Zé"?'
      confirmarDigitando={props.confirmarDigitando}
      pendente={props.pendente ?? false}
      onConfirmar={confirmar}
    >
      <p>Os contratos saem junto.</p>
    </DialogoDeExclusao>,
  );
  return confirmar;
}

describe("DialogoDeExclusao", () => {
  it("abre pelo gatilho, nomeia o registro e diz o que sai junto", async () => {
    const user = userEvent.setup();
    montar({});

    await user.click(screen.getByRole("button", { name: "Apagar cliente" }));

    expect(
      screen.getByRole("alertdialog", { name: 'Apagar "Padaria do Zé"?' }),
    ).toBeInTheDocument();
    expect(screen.getByText("Os contratos saem junto.")).toBeInTheDocument();
  });

  it("sem texto a digitar: Sim, apagar confirma na hora", async () => {
    const user = userEvent.setup();
    const confirmar = montar({});

    await user.click(screen.getByRole("button", { name: "Apagar cliente" }));
    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));

    expect(confirmar).toHaveBeenCalledTimes(1);
  });

  it("Cancelar não apaga", async () => {
    const user = userEvent.setup();
    const confirmar = montar({});

    await user.click(screen.getByRole("button", { name: "Apagar cliente" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(confirmar).not.toHaveBeenCalled();
  });

  it("🔴 com texto a digitar: o botão só libera quando o texto confere", async () => {
    const user = userEvent.setup();
    const confirmar = montar({ confirmarDigitando: "Padaria do Zé" });

    await user.click(screen.getByRole("button", { name: "Apagar cliente" }));
    const botao = screen.getByRole("button", { name: "Sim, apagar" });
    expect(botao).toBeDisabled();

    await user.type(screen.getByLabelText(/para confirmar/), "Padaria");
    expect(botao).toBeDisabled();

    await user.type(screen.getByLabelText(/para confirmar/), " do Zé");
    expect(botao).toBeEnabled();
    await user.click(botao);
    expect(confirmar).toHaveBeenCalledTimes(1);
  });

  it("fechar limpa o texto digitado", async () => {
    const user = userEvent.setup();
    montar({ confirmarDigitando: "Padaria do Zé" });

    await user.click(screen.getByRole("button", { name: "Apagar cliente" }));
    await user.type(screen.getByLabelText(/para confirmar/), "Padaria do Zé");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Apagar cliente" }));

    expect(screen.getByLabelText(/para confirmar/)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Sim, apagar" })).toBeDisabled();
  });

  it("pendente: não deixa confirmar duas vezes", async () => {
    const user = userEvent.setup();
    montar({ pendente: true });

    await user.click(screen.getByRole("button", { name: "Apagar cliente" }));

    expect(screen.getByRole("button", { name: "Sim, apagar" })).toBeDisabled();
  });
});
