import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostDoQuadro } from "../api/content.repository";
import { CalendarioSemanal } from "./calendario-semanal";

afterEach(cleanup);

const AGORA = new Date("2026-10-04T15:00:00Z");

const NOITE = {
  id: "noite",
  clienteNome: "Acme",
  titulo: "Post da noite",
  status: "agendado",
  agendadoPara: "2026-10-05T02:30:00.000Z",
} as PostDoQuadro;

describe("CalendarioSemanal", () => {
  it("sete dias de segunda a domingo, com hoje marcado", () => {
    render(
      <CalendarioSemanal
        inicio="2026-09-28"
        carregando={false}
        posts={[]}
        agora={AGORA}
        onAbrir={vi.fn()}
        onSemana={vi.fn()}
      />,
    );
    const dias = screen.getAllByRole("listitem").filter((li) => li.dataset.dia !== undefined);
    expect(dias.map((d) => d.dataset.dia)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(dias[6]).toHaveAttribute("aria-current", "date");
    expect(screen.getByText(/seg 28\/09/)).toBeInTheDocument();
  });

  it("às 22:30 de domingo em SP (já segunda em UTC), hoje é o domingo", () => {
    render(
      <CalendarioSemanal
        inicio="2026-09-28"
        carregando={false}
        posts={[]}
        agora={new Date("2026-10-05T01:30:00Z")}
        onAbrir={vi.fn()}
        onSemana={vi.fn()}
      />,
    );
    expect(screen.getByText("dom 04/10 · hoje")).toBeInTheDocument();
    const domingo = screen.getAllByRole("listitem").find((li) => li.dataset.dia === "2026-10-04");
    expect(domingo).toHaveAttribute("aria-current", "date");
  });

  it("post das 23:30 de domingo em SP fica no domingo, com a hora de SP", async () => {
    const user = userEvent.setup();
    const onAbrir = vi.fn();
    render(
      <CalendarioSemanal
        inicio="2026-09-28"
        carregando={false}
        posts={[NOITE]}
        agora={AGORA}
        onAbrir={onAbrir}
        onSemana={vi.fn()}
      />,
    );
    const domingo = screen.getAllByRole("listitem").find((li) => li.dataset.dia === "2026-10-04");
    expect(domingo).toBeDefined();
    const botao = within(domingo as HTMLElement).getByRole("button", { name: /Post da noite/ });
    expect(botao).toHaveTextContent("23:30");
    await user.click(botao);
    expect(onAbrir).toHaveBeenCalledWith(NOITE);
  });

  it("navega entre semanas", async () => {
    const user = userEvent.setup();
    const onSemana = vi.fn();
    render(
      <CalendarioSemanal
        inicio="2026-09-28"
        carregando={false}
        posts={[]}
        agora={AGORA}
        onAbrir={vi.fn()}
        onSemana={onSemana}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Semana anterior" }));
    await user.click(screen.getByRole("button", { name: "Esta semana" }));
    await user.click(screen.getByRole("button", { name: "Próxima semana" }));
    expect(onSemana.mock.calls.map((c) => c[0])).toEqual([
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
    ]);
  });

  it("carregando não parece semana vazia: Carregando… no lugar do traço, e a navegação segue", async () => {
    const user = userEvent.setup();
    const onSemana = vi.fn();
    const { rerender } = render(
      <CalendarioSemanal
        inicio="2026-09-28"
        carregando
        posts={[]}
        agora={AGORA}
        onAbrir={vi.fn()}
        onSemana={onSemana}
      />,
    );
    expect(screen.getAllByText("Carregando…")).toHaveLength(7);
    expect(screen.queryByText("-")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próxima semana" }));
    expect(onSemana).toHaveBeenCalledWith("2026-10-05");

    rerender(
      <CalendarioSemanal
        inicio="2026-09-28"
        carregando={false}
        posts={[]}
        agora={AGORA}
        onAbrir={vi.fn()}
        onSemana={onSemana}
      />,
    );
    expect(screen.getAllByText("-")).toHaveLength(7);
    expect(screen.queryByText("Carregando…")).not.toBeInTheDocument();
  });

  it("o status também vem em texto, e o atrasado ganha o selo do cartão", () => {
    const velho = {
      id: "velho",
      clienteNome: "Acme",
      titulo: "Post velho",
      status: "rascunho",
      agendadoPara: "2026-10-01T15:00:00.000Z",
    } as PostDoQuadro;
    render(
      <CalendarioSemanal
        inicio="2026-09-28"
        carregando={false}
        posts={[velho, NOITE]}
        agora={AGORA}
        onAbrir={vi.fn()}
        onSemana={vi.fn()}
      />,
    );
    const doVelho = screen.getByRole("button", { name: /Post velho/ });
    expect(doVelho).toHaveAccessibleName(/Rascunho/);
    expect(doVelho).toHaveAccessibleName(/Atrasado/);
    const daNoite = screen.getByRole("button", { name: /Post da noite/ });
    expect(daNoite).toHaveAccessibleName(/Agendado/);
    expect(daNoite).not.toHaveAccessibleName(/Atrasado/);

    const rotulo = within(doVelho).getByText("(Rascunho)");
    expect(rotulo.closest(".sr-only")).toBeNull();
    expect(doVelho).toHaveTextContent("(Rascunho) Atrasado");
  });
});
