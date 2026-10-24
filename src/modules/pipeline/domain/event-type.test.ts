import { describe, expect, it } from "vitest";

import { Constants } from "@/shared/types/database.types";

import {
  ehToque,
  rotuloDoTipoDeEvento,
  TIPOS_DE_EVENTO,
  TIPOS_DE_TOQUE,
  TIPOS_REGISTRAVEIS,
  verboDoTipoDeEvento,
  type TipoDeEvento,
} from "./event-type";

const DO_BANCO = Constants.public.Enums.opportunity_event_type;

describe("a lista acompanha o enum do banco", () => {
  it("TIPOS_DE_EVENTO é exatamente o enum, na mesma ordem", () => {
    expect([...TIPOS_DE_EVENTO]).toEqual([...DO_BANCO]);
  });

  it("todo tipo do banco tem rótulo e verbo", () => {
    DO_BANCO.forEach((tipo) => {
      expect(rotuloDoTipoDeEvento(tipo as TipoDeEvento), tipo).toBeTruthy();
      expect(verboDoTipoDeEvento(tipo as TipoDeEvento), tipo).toBeTruthy();
    });
  });

  it("WhatsApp tem rótulo e verbo próprios na timeline", () => {
    expect(rotuloDoTipoDeEvento("whatsapp")).toBe("WhatsApp");
    expect(verboDoTipoDeEvento("whatsapp")).toBe("mandou WhatsApp");
  });
});

describe("o que conta como toque — D-033", () => {
  it("os cinco contatos contam (D-033 ampliada pela D-059)", () => {
    expect(ehToque("call")).toBe(true);
    expect(ehToque("meeting")).toBe(true);
    expect(ehToque("proposal_sent")).toBe(true);
    expect(ehToque("note")).toBe(true);
    expect(ehToque("whatsapp")).toBe(true);
  });

  it("mudança de etapa NÃO conta", () => {
    expect(ehToque("stage_change")).toBe(false);
  });

  it("TIPOS_DE_TOQUE é o enum menos stage_change — derivado, não copiado", () => {
    expect([...TIPOS_DE_TOQUE].sort()).toEqual(
      DO_BANCO.filter((t) => t !== "stage_change")
        .map((t) => t)
        .sort(),
    );
  });

  it("todo tipo do banco que não é stage_change é toque", () => {
    DO_BANCO.forEach((tipo) => {
      expect(ehToque(tipo as TipoDeEvento), tipo).toBe(tipo !== "stage_change");
    });
  });
});

describe("TIPOS_REGISTRAVEIS", () => {
  it("não oferece mudança de etapa para registro manual", () => {
    expect(TIPOS_REGISTRAVEIS).not.toContain("stage_change");
  });

  it("oferece os cinco contatos, com WhatsApp", () => {
    expect([...TIPOS_REGISTRAVEIS].sort()).toEqual(
      ["call", "meeting", "note", "proposal_sent", "whatsapp"].sort(),
    );
  });
});
