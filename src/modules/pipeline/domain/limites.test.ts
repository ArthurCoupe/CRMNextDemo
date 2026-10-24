import { describe, expect, it } from "vitest";

import {
  MAXIMO_DE_CAMPOS,
  MAXIMO_DE_ESTAGIOS,
  MAXIMO_DE_OPCOES,
  MAXIMO_DE_PIPELINES,
  MOTIVOS_POR_TIPO,
  TAMANHO_DO_TEXTO_DO_CAMPO,
  TETO_DE_CAMPOS,
  TETO_DE_ESTAGIOS,
  TETO_DE_MOTIVOS,
  TETO_DE_PIPELINES,
} from "./limites";

describe("limites", () => {
  it("MAXIMO_DE_PIPELINES é o próprio teto, e vale 50", () => {
    expect(MAXIMO_DE_PIPELINES).toBe(TETO_DE_PIPELINES);
    expect(MAXIMO_DE_PIPELINES).toBe(50);
  });

  it("MAXIMO_DE_ESTAGIOS é o próprio teto, e vale 30 (o que a RPC aceita)", () => {
    expect(MAXIMO_DE_ESTAGIOS).toBe(TETO_DE_ESTAGIOS);
    expect(MAXIMO_DE_ESTAGIOS).toBe(30);
  });

  it("os dois tipos de motivo juntos enchem o teto sem passar dele, e MOTIVOS_POR_TIPO vale 20", () => {
    expect(2 * MOTIVOS_POR_TIPO).toBeLessThanOrEqual(TETO_DE_MOTIVOS);
    expect(MOTIVOS_POR_TIPO).toBe(20);
  });

  it("MAXIMO_DE_CAMPOS é o próprio teto, e vale 30 (o que pipeline_campos_teto e problemas_dos_campos aceitam)", () => {
    expect(MAXIMO_DE_CAMPOS).toBe(TETO_DE_CAMPOS);
    expect(MAXIMO_DE_CAMPOS).toBe(30);
  });

  it("texto do campo até 500 e lista com até 30 opções — os literais da migration 20260923110000", () => {
    expect(TAMANHO_DO_TEXTO_DO_CAMPO).toBe(500);
    expect(MAXIMO_DE_OPCOES).toBe(30);
  });
});
