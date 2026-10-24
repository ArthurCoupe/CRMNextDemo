import { describe, expect, it } from "vitest";

import {
  interpretarPassada,
  montarValorDaPassada,
  okDaPassada,
  type PlacarDaPassada,
  type UltimaPassada,
} from "./passada";

const PLACAR_OK: PlacarDaPassada = { enviados: 3, duplicados: 1, falhas: 0 };

function passadaDeSucesso(): UltimaPassada {
  return {
    dia: "2026-08-30",
    ok: true,
    terminouEm: "2026-08-30T11:46:02.123Z",
    erro: null,
    contadores: { digest: PLACAR_OK, tarefa_d1: { enviados: 0, duplicados: 0, falhas: 0 } },
    problemas: ["tarefa t1 está atrasada e não tem responsável"],
  };
}

function passadaComFalha(): UltimaPassada {
  return {
    dia: "2026-08-30",
    ok: false,
    terminouEm: "2026-08-30T11:45:16.001Z",
    erro: "profiles: JWT claims validation or parsing failed",
    contadores: {},
    problemas: [],
  };
}

describe("montarValorDaPassada -> interpretarPassada", () => {
  it("é ida e volta fiel no caso ok", () => {
    const original = passadaDeSucesso();
    expect(interpretarPassada(montarValorDaPassada(original))).toEqual(original);
  });

  it("é ida e volta fiel no caso de falha", () => {
    const original = passadaComFalha();
    expect(interpretarPassada(montarValorDaPassada(original))).toEqual(original);
  });
});

describe("interpretarPassada — formato inválido devolve null", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["string", "2026-08-30"],
    ["array", []],
    ["objeto sem dia", { ok: true, terminou_em: "x", erro: null, contadores: {}, problemas: [] }],
    [
      'ok como string "true"',
      {
        dia: "2026-08-30",
        ok: "true",
        terminou_em: "x",
        erro: null,
        contadores: {},
        problemas: [],
      },
    ],
    [
      "contadores como array",
      { dia: "2026-08-30", ok: true, terminou_em: "x", erro: null, contadores: [], problemas: [] },
    ],
    [
      "problemas com um número dentro",
      {
        dia: "2026-08-30",
        ok: true,
        terminou_em: "x",
        erro: null,
        contadores: {},
        problemas: ["ok", 42],
      },
    ],
  ])("%s", (_descricao, entrada) => {
    expect(interpretarPassada(entrada)).toBeNull();
  });

  it("um contador com campo de tipo errado invalida o todo", () => {
    expect(
      interpretarPassada({
        dia: "2026-08-30",
        ok: true,
        terminou_em: "x",
        erro: null,
        contadores: { digest: { enviados: "3", duplicados: 0, falhas: 0 } },
        problemas: [],
      }),
    ).toBeNull();
  });
});

describe("interpretarPassada — casos vazios são válidos", () => {
  it("aceita contadores: {} e problemas: []", () => {
    const entrada = {
      dia: "2026-08-30",
      ok: true,
      terminou_em: "2026-08-30T11:46:02.000Z",
      erro: null,
      contadores: {},
      problemas: [],
    };
    expect(interpretarPassada(entrada)).toEqual({
      dia: "2026-08-30",
      ok: true,
      terminouEm: "2026-08-30T11:46:02.000Z",
      erro: null,
      contadores: {},
      problemas: [],
    });
  });
});

describe("okDaPassada (NOTIF-4)", () => {
  it("é falso quando qualquer runner caiu — a linha `falha:`", () => {
    expect(okDaPassada(["falha: lead_frio: column em_nutricao does not exist"])).toBe(false);
    expect(okDaPassada(["dado: x", "teto: y", "falha: z"])).toBe(false);
  });

  it("é verdadeiro sem linha de falha — `dado:` e `teto:` não derrubam", () => {
    expect(okDaPassada([])).toBe(true);
    expect(
      okDaPassada(["dado: oportunidade o1 sem responsável", "teto: clients devolveu 500"]),
    ).toBe(true);
  });
});
