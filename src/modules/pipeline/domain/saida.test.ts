import { describe, expect, it } from "vitest";

import { motivoExigidoPor } from "./saida";
import { ORDEM_DOS_ESTAGIOS } from "./stage";

describe("motivoExigidoPor", () => {
  it("descartado exige motivo de descarte", () => {
    expect(motivoExigidoPor("descartado")).toBe("descarte");
  });

  it("perdido exige motivo de perda", () => {
    expect(motivoExigidoPor("perdido")).toBe("perda");
  });

  it("os outros seis tipos não exigem motivo nenhum", () => {
    const semMotivo = ORDEM_DOS_ESTAGIOS.filter(
      (estagio) => estagio !== "perdido" && estagio !== "descartado",
    );
    expect(semMotivo).toHaveLength(6);
    for (const estagio of semMotivo) {
      expect(motivoExigidoPor(estagio)).toBeNull();
    }
  });
});
