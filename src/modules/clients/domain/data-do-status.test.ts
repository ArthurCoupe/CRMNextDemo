import { describe, expect, it } from "vitest";

import { validarDataDoStatus } from "./data-do-status";

describe("validarDataDoStatus (D-069, C8)", () => {
  const HOJE = "2026-10-07";

  it("🔴 hoje passa; amanhã é futuro", () => {
    expect(validarDataDoStatus("2026-10-07", HOJE)).toBeNull();
    expect(validarDataDoStatus("2026-10-08", HOJE)).toBe("A data não pode ficar no futuro.");
  });

  it("data passada passa", () => {
    expect(validarDataDoStatus("2026-09-01", HOJE)).toBeNull();
  });

  it("vazia é recusada", () => {
    expect(validarDataDoStatus("", HOJE)).toBe("A data não pode ficar vazia.");
  });

  it("ano pela metade (Chrome) é recusado antes de gravar", () => {
    expect(validarDataDoStatus("0002-09-01", HOJE)).toBe(
      "Data inválida. Use um ano entre 2000 e 2100.",
    );
  });
});
