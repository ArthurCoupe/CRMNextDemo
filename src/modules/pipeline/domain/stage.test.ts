import { describe, expect, it } from "vitest";

import {
  corDoPontoDoEstagio,
  entraNoFunil,
  followUpVencido,
  ORDEM_DOS_ESTAGIOS,
  rotuloDoEstagio,
  significadoDoEstagio,
  taxaDeConversao,
  type Estagio,
} from "./stage";

describe("ORDEM_DOS_ESTAGIOS", () => {
  it("tem os 8 estágios, na ordem do processo", () => {
    expect(ORDEM_DOS_ESTAGIOS).toEqual([
      "prospeccao",
      "abordagem",
      "qualificacao",
      "r1",
      "r2",
      "fechado",
      "perdido",
      "descartado",
    ]);
  });

  it("não repete estágio", () => {
    expect(new Set(ORDEM_DOS_ESTAGIOS).size).toBe(ORDEM_DOS_ESTAGIOS.length);
  });
});

describe("rótulos e cores", () => {
  it("todo estágio tem rótulo, significado e cor", () => {
    for (const estagio of ORDEM_DOS_ESTAGIOS) {
      expect(rotuloDoEstagio(estagio)).toMatch(/\S/);
      expect(significadoDoEstagio(estagio)).toMatch(/\S/);
      expect(corDoPontoDoEstagio(estagio)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("R1 explica que é a reunião de entender o problema", () => {
    expect(significadoDoEstagio("r1")).toMatch(/entender o problema/);
  });
});

describe("entraNoFunil", () => {
  it("descartado é o ÚNICO que sai da conta", () => {
    const fora = ORDEM_DOS_ESTAGIOS.filter((estagio) => !entraNoFunil(estagio));
    expect(fora).toEqual(["descartado"]);
  });

  it("perdido ENTRA — é derrota trabalhada, não lixo", () => {
    expect(entraNoFunil("perdido")).toBe(true);
  });
});

describe("taxaDeConversao", () => {
  it("fechados sobre o universo que entra no funil", () => {
    const contagens: Partial<Record<Estagio, number>> = {
      prospeccao: 4,
      abordagem: 2,
      fechado: 2,
      perdido: 2,
    };
    expect(taxaDeConversao(contagens)).toBe(0.2);
  });

  it("descartado não muda a taxa", () => {
    const semDescartado = taxaDeConversao({ fechado: 1, perdido: 1 });
    const comDescartado = taxaDeConversao({ fechado: 1, perdido: 1, descartado: 98 });
    expect(comDescartado).toBe(semDescartado);
  });

  it("board vazio devolve null, não zero", () => {
    expect(taxaDeConversao({})).toBeNull();
    expect(taxaDeConversao({ descartado: 5 })).toBeNull();
  });
});

describe("followUpVencido", () => {
  const vencida = () => true;
  const emDia = () => false;

  it("vence em estágio de trabalho com data vencida", () => {
    expect(followUpVencido("prospeccao", "2026-07-01", vencida)).toBe(true);
    expect(followUpVencido("r2", "2026-07-01", vencida)).toBe(true);
  });

  it("sem data nunca vence", () => {
    expect(followUpVencido("prospeccao", null, vencida)).toBe(false);
  });

  it("data em dia não vence", () => {
    expect(followUpVencido("prospeccao", "2099-01-01", emDia)).toBe(false);
  });

  it("desfecho não cobra follow-up, mesmo com data vencida na linha", () => {
    expect(followUpVencido("fechado", "2026-07-01", vencida)).toBe(false);
    expect(followUpVencido("perdido", "2026-07-01", vencida)).toBe(false);
    expect(followUpVencido("descartado", "2026-07-01", vencida)).toBe(false);
  });

  it("cobre os 8 estágios sem exceção não mapeada", () => {
    for (const estagio of ORDEM_DOS_ESTAGIOS) {
      expect(typeof followUpVencido(estagio, "2026-07-01", vencida)).toBe("boolean");
    }
  });
});
