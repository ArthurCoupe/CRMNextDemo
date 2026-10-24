import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OpportunityCard } from "./opportunity-card";
import { TECLAS_DO_BOARD } from "./teclado-do-board";

const OPORTUNIDADE = {
  id: "86e00000-0000-4000-8000-000000000001",
  nome: "julio",
  estagio: "qualificacao",
  contatoNome: null,
  responsavelNome: null,
  responsavelId: null,
  linhaDeNegocio: null,
  frentesEsperadas: null,
  proximoFollowUp: null,
  respostas: [],
  fechadoMrr: null,
  fechadoTcv: null,
  clienteId: null,
} as unknown as Parameters<typeof OpportunityCard>[0]["oportunidade"];

function Board({
  aoAbrir,
  aoIniciarArrasto,
}: {
  aoAbrir: (o: unknown) => void;
  aoIniciarArrasto: () => void;
}) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: TECLAS_DO_BOARD }),
  );

  return (
    <DndContext sensors={sensores} onDragStart={aoIniciarArrasto}>
      <OpportunityCard oportunidade={OPORTUNIDADE} aoAbrir={aoAbrir} podeArrastar />
    </DndContext>
  );
}

async function encerrarArrasto(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Escape}");
}

async function montar() {
  const aoAbrir = vi.fn();
  const aoIniciarArrasto = vi.fn();
  const user = userEvent.setup();
  render(<Board aoAbrir={aoAbrir} aoIniciarArrasto={aoIniciarArrasto} />);

  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button"));

  return { user, aoAbrir, aoIniciarArrasto };
}

describe("o board é operável por teclado", () => {
  it("o card é alcançável por Tab e se anuncia como arrastável", async () => {
    await montar();

    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("aria-roledescription", "draggable");
    expect(card).toHaveAttribute("tabindex", "0");
  });

  it("🔴 Space PEGA o card — e não abre a ficha", async () => {
    const { user, aoAbrir, aoIniciarArrasto } = await montar();

    await user.keyboard(" ");

    expect(aoIniciarArrasto).toHaveBeenCalledTimes(1);
    expect(aoAbrir).not.toHaveBeenCalled();

    await encerrarArrasto(user);
  });

  it("🔴 Enter ABRE a ficha — e não pega o card", async () => {
    const { user, aoAbrir, aoIniciarArrasto } = await montar();

    await user.keyboard("{Enter}");

    expect(aoAbrir).toHaveBeenCalledTimes(1);
    expect(aoIniciarArrasto).not.toHaveBeenCalled();
  });

  it("com o default do dnd-kit, Enter deixaria de abrir a ficha — a prova da troca", async () => {
    const aoAbrir = vi.fn();
    const user = userEvent.setup();

    function BoardPadrao() {
      const sensores = useSensors(useSensor(KeyboardSensor));
      return (
        <DndContext sensors={sensores}>
          <OpportunityCard oportunidade={OPORTUNIDADE} aoAbrir={aoAbrir} podeArrastar />
        </DndContext>
      );
    }

    render(<BoardPadrao />);
    await user.tab();
    await user.keyboard("{Enter}");

    expect(aoAbrir).not.toHaveBeenCalled();

    await encerrarArrasto(user);
  });

  it("Escape cancela o arrasto que Space começou", async () => {
    const { user, aoIniciarArrasto } = await montar();

    await user.keyboard(" ");
    expect(aoIniciarArrasto).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");

    await user.keyboard(" ");
    expect(aoIniciarArrasto).toHaveBeenCalledTimes(2);

    await encerrarArrasto(user);
  });

  it("🔴 a TELA registra o sensor — sem isto, tudo acima prova outro board", async () => {
    const fonte = readFileSync(
      join(process.cwd(), "src", "modules", "pipeline", "ui", "pipeline-page.tsx"),
      "utf-8",
    );

    expect(fonte, "pipeline-page.tsx deixou de registrar o KeyboardSensor").toMatch(
      /useSensor\(\s*KeyboardSensor/,
    );
    expect(
      fonte,
      "o KeyboardSensor da tela não usa TECLAS_DO_BOARD — cair no default do " +
        "dnd-kit devolve Enter ao arrasto e o card para de abrir a ficha",
    ).toMatch(/keyboardCodes:\s*TECLAS_DO_BOARD/);
  });

  it("`member` não arrasta — sem `podeArrastar`, Space não pega nada", async () => {
    const aoAbrir = vi.fn();
    const aoIniciarArrasto = vi.fn();
    const user = userEvent.setup();

    function BoardSemEscrita() {
      const sensores = useSensors(useSensor(KeyboardSensor, { keyboardCodes: TECLAS_DO_BOARD }));
      return (
        <DndContext sensors={sensores} onDragStart={aoIniciarArrasto}>
          <OpportunityCard oportunidade={OPORTUNIDADE} aoAbrir={aoAbrir} podeArrastar={false} />
        </DndContext>
      );
    }

    render(<BoardSemEscrita />);
    await user.tab();
    await user.keyboard(" ");

    expect(aoIniciarArrasto).not.toHaveBeenCalled();
  });
});
