import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostDoQuadro } from "../api/content.repository";
import { QuadroDeConteudo } from "./quadro-de-conteudo";

afterEach(cleanup);

const AGORA = new Date("2026-10-04T15:00:00Z");

function abrirMenuDeMover() {
  const gatilho = screen.getByRole("button", { name: "Mover para" });
  gatilho.focus();
  fireEvent.keyDown(gatilho, { key: "ArrowDown" });
}

function post(id: string, status: PostDoQuadro["status"], agendadoPara: string): PostDoQuadro {
  return {
    id,
    clienteId: "c1",
    clienteNome: "Acme",
    titulo: `Post ${id}`,
    legenda: null,
    formato: "reel",
    canal: "instagram",
    linkDaArte: null,
    agendadoPara,
    responsavelId: "u1",
    responsavelNome: "Ana",
    status,
    statusDesde: "2026-10-03T12:00:00Z",
    publicadoEm: status === "publicado" ? "2026-10-02T12:00:00Z" : null,
    linkPublicado: null,
    atualizadoEm: "2026-10-04T12:00:00Z",
  };
}

describe("QuadroDeConteudo", () => {
  it("quatro etapas e seis colunas com a contagem", () => {
    render(
      <QuadroDeConteudo
        posts={[
          post("a", "rascunho", "2026-10-10T12:00:00Z"),
          post("b", "rascunho", "2026-10-11T12:00:00Z"),
        ]}
        agora={AGORA}
        movendoId={undefined}
        onAbrir={vi.fn()}
        onMover={vi.fn()}
      />,
    );
    for (const etapa of ["P · Produção", "E · Envio", "CO · Correção", "L · Lançamento"]) {
      expect(screen.getByRole("region", { name: etapa })).toBeInTheDocument();
    }
    const producao = screen.getByRole("region", { name: "P · Produção" });
    expect(within(producao).getByText("2")).toBeInTheDocument();
  });

  it("o menu Mover para lista só os destinos válidos e move com o item escolhido", async () => {
    const user = userEvent.setup();
    const onMover = vi.fn();
    const aprovado = post("a", "aprovado", "2026-10-10T12:00:00Z");
    render(
      <QuadroDeConteudo
        posts={[aprovado]}
        agora={AGORA}
        movendoId={undefined}
        onAbrir={vi.fn()}
        onMover={onMover}
      />,
    );
    abrirMenuDeMover();
    expect((await screen.findAllByRole("menuitem")).map((o) => o.textContent)).toEqual([
      "Agendar",
      "Publicado",
      "Cliente pediu ajuste",
    ]);
    await user.click(screen.getByRole("menuitem", { name: "Agendar" }));
    expect(onMover).toHaveBeenCalledWith(aprovado, "agendado");
  });

  it("seta no gatilho só abre o menu: nada é gravado até escolher o item (controle: clicar grava)", async () => {
    const user = userEvent.setup();
    const onMover = vi.fn();
    const aprovado = post("a", "aprovado", "2026-10-10T12:00:00Z");
    render(
      <QuadroDeConteudo
        posts={[aprovado]}
        agora={AGORA}
        movendoId={undefined}
        onAbrir={vi.fn()}
        onMover={onMover}
      />,
    );
    abrirMenuDeMover();
    expect(await screen.findAllByRole("menuitem")).toHaveLength(3);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "ArrowDown" });
    expect(onMover).not.toHaveBeenCalled();
    await user.click(screen.getByRole("menuitem", { name: "Publicado" }));
    expect(onMover).toHaveBeenCalledTimes(1);
    expect(onMover).toHaveBeenCalledWith(aprovado, "publicado");
  });

  it("sem destino (publicado) não há gatilho; com destino, ele fica desabilitado enquanto move", () => {
    render(
      <QuadroDeConteudo
        posts={[post("a", "publicado", "2026-10-10T12:00:00Z")]}
        agora={AGORA}
        movendoId={undefined}
        onAbrir={vi.fn()}
        onMover={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Mover para" })).not.toBeInTheDocument();
    cleanup();
    render(
      <QuadroDeConteudo
        posts={[post("b", "aprovado", "2026-10-10T12:00:00Z")]}
        agora={AGORA}
        movendoId="b"
        onAbrir={vi.fn()}
        onMover={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Mover para" })).toBeDisabled();
  });

  it("atrasado aparece sem marcação; publicado não atrasa e não tem menu", () => {
    render(
      <QuadroDeConteudo
        posts={[
          post("a", "agendado", "2026-10-01T12:00:00Z"),
          post("b", "publicado", "2026-10-01T12:00:00Z"),
        ]}
        agora={AGORA}
        movendoId={undefined}
        onAbrir={vi.fn()}
        onMover={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Atrasado")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Mover para" })).toHaveLength(1);
  });

  it("clicar no cartão abre o post", async () => {
    const user = userEvent.setup();
    const onAbrir = vi.fn();
    const p = post("a", "rascunho", "2026-10-10T12:00:00Z");
    render(
      <QuadroDeConteudo
        posts={[p]}
        agora={AGORA}
        movendoId={undefined}
        onAbrir={onAbrir}
        onMover={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Post a/ }));
    expect(onAbrir).toHaveBeenCalledWith(p);
  });
});
