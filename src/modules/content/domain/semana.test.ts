import { describe, expect, it } from "vitest";

import {
  agruparPorDia,
  diaDoPost,
  diasDaSemana,
  limitesDaSemana,
  rotuloDaSemana,
  rotuloDoDia,
} from "./semana";

describe("semana", () => {
  it("sete dias, de segunda a domingo", () => {
    expect(diasDaSemana("2026-09-28")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  it("limites são meia-noite de SP em UTC, fim exclusivo", () => {
    expect(limitesDaSemana("2026-09-28")).toEqual({
      de: "2026-09-28T03:00:00.000Z",
      ate: "2026-10-05T03:00:00.000Z",
    });
  });

  it("post das 23:30 de domingo em SP fica no domingo, não na segunda (UTC)", () => {
    expect(diaDoPost("2026-10-05T02:30:00.000Z")).toBe("2026-10-04");
    const grupos = agruparPorDia(
      [
        { id: "tarde", agendadoPara: "2026-10-04T21:00:00.000Z" },
        { id: "noite", agendadoPara: "2026-10-05T02:30:00.000Z" },
        { id: "manha", agendadoPara: "2026-10-04T12:00:00.000Z" },
        { id: "outra-semana", agendadoPara: "2026-10-05T03:00:00.000Z" },
      ],
      "2026-09-28",
    );
    expect(grupos.get("2026-10-04")?.map((p) => p.id)).toEqual(["manha", "tarde", "noite"]);
    expect([...grupos.values()].flat().map((p) => p.id)).not.toContain("outra-semana");
    expect(grupos.size).toBe(7);
  });

  it("rótulos", () => {
    expect(rotuloDaSemana("2026-09-28")).toBe("28/09/2026 a 04/10/2026");
    expect(rotuloDoDia("2026-10-04")).toBe("dom 04/10");
    expect(rotuloDoDia("2026-09-28")).toBe("seg 28/09");
  });
});
