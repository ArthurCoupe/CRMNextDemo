import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostDoQuadro } from "../api/content.repository";
import { DialogoDeNota } from "./dialogo-de-nota";

afterEach(cleanup);

const POST = {
  id: "p1",
  titulo: "Lançamento",
  clienteNome: "Acme",
  status: "aprovado",
} as PostDoQuadro;

describe("DialogoDeNota", () => {
  it("ajuste: só registra com o pedido escrito, sem espaços nas pontas", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi.fn();
    render(
      <DialogoDeNota
        pedido={{ post: POST, para: "ajuste_pedido" }}
        enviando={false}
        onCancelar={vi.fn()}
        onConfirmar={onConfirmar}
      />,
    );
    expect(screen.getByText("O que o cliente pediu?")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Lançamento · Acme");
    const botao = screen.getByRole("button", { name: "Registrar ajuste" });
    expect(botao).toBeDisabled();
    await user.type(screen.getByLabelText("Pedido do cliente"), "  Trocar a capa  ");
    await user.click(botao);
    expect(onConfirmar).toHaveBeenCalledWith("Trocar a capa");
  });

  it("ajuste: nota acima de 2.000 caracteres avisa e não envia", () => {
    render(
      <DialogoDeNota
        pedido={{ post: POST, para: "ajuste_pedido" }}
        enviando={false}
        onCancelar={vi.fn()}
        onConfirmar={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Pedido do cliente"), {
      target: { value: "a".repeat(2001) },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("A nota pode ter até 2.000 caracteres.");
    expect(screen.getByRole("button", { name: "Registrar ajuste" })).toBeDisabled();
  });

  it("publicação: link vazio passa como nulo; http é barrado; https vai limpo", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi.fn();
    render(
      <DialogoDeNota
        pedido={{ post: POST, para: "publicado" }}
        enviando={false}
        onCancelar={vi.fn()}
        onConfirmar={onConfirmar}
      />,
    );
    const botao = screen.getByRole("button", { name: "Marcar como publicado" });
    const campo = screen.getByLabelText("Link do post (opcional)");

    await user.type(campo, "http://instagram.com/p/1");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "O link do post precisa começar com https:// e ter até 2.000 caracteres.",
    );
    expect(botao).toBeDisabled();

    await user.clear(campo);
    await user.click(botao);
    expect(onConfirmar).toHaveBeenLastCalledWith(null);

    await user.type(campo, "  https://instagram.com/p/1  ");
    await user.click(botao);
    expect(onConfirmar).toHaveBeenLastCalledWith("https://instagram.com/p/1");
  });
});
