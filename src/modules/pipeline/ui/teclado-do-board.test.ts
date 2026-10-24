import type { Active, Over } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { ANUNCIOS_DO_BOARD, TECLAS_DO_BOARD } from "./teclado-do-board";

describe("TECLAS_DO_BOARD", () => {
  it("Enter NÃO inicia arrasto — é o que preserva a abertura da gaveta", () => {
    expect(TECLAS_DO_BOARD.start).not.toContain("Enter");
    expect(TECLAS_DO_BOARD.start).toContain("Space");
  });

  it("Escape cancela e Tab finaliza — Tab não pode deixar drag órfão", () => {
    expect(TECLAS_DO_BOARD.cancel).toContain("Escape");
    expect(TECLAS_DO_BOARD.end).toContain("Tab");
    expect(TECLAS_DO_BOARD.end).toContain("Space");
  });
});

describe("ANUNCIOS_DO_BOARD lê o nome do estágio pelo data do droppable", () => {
  const active = {
    id: "opp-1",
    data: { current: { nome: "Padaria do Zé" } },
  } as unknown as Active;
  const comNome = {
    id: "3f2b0f6e-1111-4000-8000-000000000001",
    data: { current: { nome: "Briefing", tipo: "r1" } },
  } as unknown as Over;
  const semData = {
    id: "3f2b0f6e-1111-4000-8000-000000000002",
    data: { current: undefined },
  } as unknown as Over;

  it("onDragOver anuncia o nome que veio em data, não o uuid", () => {
    expect(ANUNCIOS_DO_BOARD.onDragOver({ active, over: comNome })).toBe(
      "Padaria do Zé está sobre Briefing.",
    );
  });

  it("onDragEnd idem", () => {
    expect(ANUNCIOS_DO_BOARD.onDragEnd({ active, over: comNome })).toBe(
      "Padaria do Zé foi solta em Briefing.",
    );
  });

  it("🔴 droppable sem data NÃO lança — cai no fallback (uuid nunca é soletrado)", () => {
    expect(() => ANUNCIOS_DO_BOARD.onDragOver({ active, over: semData })).not.toThrow();
    expect(ANUNCIOS_DO_BOARD.onDragOver({ active, over: semData })).toBe(
      "Padaria do Zé está sobre um estágio sem nome.",
    );
    expect(ANUNCIOS_DO_BOARD.onDragEnd({ active, over: semData })).toBe(
      "Padaria do Zé foi solta em um estágio sem nome.",
    );
  });
});
