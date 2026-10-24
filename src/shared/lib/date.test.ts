import { describe, expect, it } from "vitest";

import {
  dataEHoraSP,
  daysOverdue,
  diasCivisAte,
  diasCivisDesde,
  ehDataCivil,
  ehDataCivilPlausivel,
  formatDate,
  formatDateTime,
  formatMonth,
  horaSP,
  horarioCurtoSP,
  inicioDaSemanaSP,
  isOverdue,
  paraInstante,
  somaDias,
  todaySP,
} from "./date";

describe("todaySP", () => {
  it("02:00 UTC ainda é o dia ANTERIOR em SP (23:00)", () => {
    expect(todaySP(new Date("2026-07-31T02:00:00Z"))).toBe("2026-07-30");
  });

  it("12:00 UTC é o mesmo dia em SP (09:00)", () => {
    expect(todaySP(new Date("2026-07-31T12:00:00Z"))).toBe("2026-07-31");
  });
});

describe("horaSP", () => {
  it("11:00 UTC é 8h em SP", () => {
    expect(horaSP(new Date("2026-08-30T11:00:00Z"))).toBe(8);
  });

  it("02:00 UTC é 23h do dia ANTERIOR em SP", () => {
    expect(horaSP(new Date("2026-08-30T02:00:00Z"))).toBe(23);
  });
});

describe("formatDate", () => {
  it("🔴 timestamptz de 02:00 UTC exibe o dia anterior em SP", () => {
    expect(formatDate("2026-07-31T02:00:00Z")).toBe("30/07/2026");
  });

  it("🔴 coluna `date` (YYYY-MM-DD) NÃO desloca: é data civil, não instante", () => {
    expect(formatDate("2026-07-31")).toBe("31/07/2026");
  });

  it("nulo, undefined e vazio viram hífen", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate("")).toBe("-");
  });
});

describe("formatDateTime", () => {
  it("formata o instante em SP, não no fuso da máquina", () => {
    expect(formatDateTime("2026-07-31T02:30:00Z")).toBe("30/07/2026, 23:30");
  });
});

describe("formatMonth", () => {
  it("timestamptz perto da virada usa o mês de SP", () => {
    expect(formatMonth("2026-08-01T02:00:00Z")).toBe("julho de 2026");
  });

  it("data civil usa o próprio mês da string", () => {
    expect(formatMonth("2026-08-01")).toBe("agosto de 2026");
  });
});

describe("daysOverdue — a virada de dia que quebra a conta por instantes", () => {
  const VENCIMENTO = "2026-07-29";

  it("🔴 vencida ONTEM é 1 às 23h de SP", () => {
    expect(daysOverdue(VENCIMENTO, new Date("2026-07-31T02:00:00Z"))).toBe(1);
  });

  it("🔴 vencida ONTEM continua 1 à 01h de SP — mesma resposta nas duas horas", () => {
    expect(daysOverdue(VENCIMENTO, new Date("2026-07-30T04:00:00Z"))).toBe(1);
  });

  it("vence HOJE não está vencida", () => {
    expect(daysOverdue("2026-07-30", new Date("2026-07-30T04:00:00Z"))).toBe(0);
    expect(isOverdue("2026-07-30", new Date("2026-07-30T04:00:00Z"))).toBe(false);
  });

  it("vencimento futuro é 0, nunca negativo", () => {
    expect(daysOverdue("2026-12-25", new Date("2026-07-31T12:00:00Z"))).toBe(0);
  });

  it("entrada que não é data civil devolve 0 em vez de NaN", () => {
    expect(daysOverdue("banana", new Date())).toBe(0);
  });
});

describe("diasCivisAte · diasCivisDesde", () => {
  const AGORA = new Date("2026-07-31T12:00:00Z");

  it("futuro é positivo, passado é negativo, hoje é zero", () => {
    expect(diasCivisAte("2026-08-12", AGORA)).toBe(12);
    expect(diasCivisAte("2026-07-31", AGORA)).toBe(0);
    expect(diasCivisAte("2026-07-19", AGORA)).toBe(-12);
  });

  it("diasCivisDesde é o espelho — passado positivo", () => {
    expect(diasCivisDesde("2026-07-19", AGORA)).toBe(12);
    expect(diasCivisDesde("2026-07-31", AGORA)).toBe(0);
    expect(diasCivisDesde("2026-08-12", AGORA)).toBe(-12);
  });

  it("🔴 conta datas civis de SP, não instantes — mesma resposta às 23h e à 01h", () => {
    expect(diasCivisAte("2026-08-01", new Date("2026-07-31T02:00:00Z"))).toBe(2);
    expect(diasCivisAte("2026-08-01", new Date("2026-07-30T04:00:00Z"))).toBe(2);
  });

  it("aceita timestamptz e converte para o dia civil de SP", () => {
    expect(diasCivisDesde("2026-07-31T02:00:00Z", AGORA)).toBe(1);
  });

  it("entrada inválida devolve null em vez de NaN", () => {
    expect(diasCivisAte("banana", AGORA)).toBeNull();
    expect(diasCivisAte("", AGORA)).toBeNull();
    expect(diasCivisDesde("banana", AGORA)).toBeNull();
  });
});

describe("somaDias", () => {
  it("anda no calendário civil, não no instante", () => {
    expect(somaDias("2026-08-15", 1)).toBe("2026-08-16");
    expect(somaDias("2026-08-15", -1)).toBe("2026-08-14");
    expect(somaDias("2026-08-15", 0)).toBe("2026-08-15");
  });

  it("atravessa virada de mês e de ano", () => {
    expect(somaDias("2026-08-31", 1)).toBe("2026-09-01");
    expect(somaDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somaDias("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("acerta 29 de fevereiro em ano bissexto", () => {
    expect(somaDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(somaDias("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("não depende da hora do dia, diferente de setUTCDate sobre o instante", () => {
    const noite = new Date("2026-08-15T23:30:00-03:00");
    const errado = new Date(noite);
    errado.setUTCDate(errado.getUTCDate() + 1);

    expect(todaySP(noite)).toBe("2026-08-15");
    expect(somaDias(todaySP(noite), 1)).toBe("2026-08-16");
    expect(errado.toISOString().slice(0, 10)).toBe("2026-08-17");
  });

  it("devolve a entrada quando ela não é data civil", () => {
    expect(somaDias("banana", 1)).toBe("banana");
    expect(somaDias("", 1)).toBe("");
    expect(somaDias("2026-08-15T10:00:00Z", 1)).toBe("2026-08-15T10:00:00Z");
  });
});

describe("inicioDaSemanaSP — a contraparte de public.sp_week_start()", () => {
  it("domingo 23h em São Paulo ainda é a semana que começou na segunda anterior", () => {
    expect(inicioDaSemanaSP(new Date("2026-08-17T02:00:00Z"))).toBe("2026-08-10");
  });

  it("quarta-feira devolve a segunda da mesma semana", () => {
    expect(inicioDaSemanaSP(new Date("2026-08-19T15:04:40Z"))).toBe("2026-08-17");
  });

  it("na própria segunda, devolve o dia", () => {
    expect(inicioDaSemanaSP(new Date("2026-08-17T15:00:00Z"))).toBe("2026-08-17");
  });

  it("domingo de tarde, ainda a semana anterior — é o fim dela", () => {
    expect(inicioDaSemanaSP(new Date("2026-08-23T18:00:00Z"))).toBe("2026-08-17");
  });

  it("atravessa a virada de mês", () => {
    expect(inicioDaSemanaSP(new Date("2026-09-02T15:00:00Z"))).toBe("2026-08-31");
  });

  it("o resultado é sempre segunda-feira", () => {
    for (let dia = 10; dia <= 30; dia += 1) {
      const semana = inicioDaSemanaSP(new Date(`2026-08-${dia}T15:00:00Z`));
      expect(new Date(`${semana}T12:00:00Z`).getUTCDay(), `${semana} deveria ser segunda`).toBe(1);
    }
  });
});

describe('ehDataCivil: o formato do <input type="date">', () => {
  it("aceita YYYY-MM-DD e recusa vazio, ISO com hora e dd/mm/aaaa", () => {
    expect(ehDataCivil("2026-10-05")).toBe(true);
    expect(ehDataCivil("")).toBe(false);
    expect(ehDataCivil("2026-10-05T17:00:00.000Z")).toBe(false);
    expect(ehDataCivil("05/10/2026")).toBe(false);
  });
});

describe("ehDataCivilPlausivel: ano pela metade do Chrome nao e data", () => {
  it("recusa 0002, 0020, 0202 e 9999; aceita 2000..2100", () => {
    for (const parcial of ["0002-08-09", "0020-08-09", "0202-08-09", "9999-01-01"]) {
      expect(ehDataCivilPlausivel(parcial)).toBe(false);
    }
    expect(ehDataCivilPlausivel("2000-01-01")).toBe(true);
    expect(ehDataCivilPlausivel("2027-08-09")).toBe(true);
    expect(ehDataCivilPlausivel("2100-12-31")).toBe(true);
    expect(ehDataCivilPlausivel("")).toBe(false);
  });
});

describe("horarioCurtoSP (D-063): a hora do vencimento, com o dia só quando não é hoje", () => {
  it("hoje em São Paulo: só a hora", () => {
    expect(horarioCurtoSP("2026-01-06T17:35:00Z", new Date("2026-01-06T15:00:00Z"))).toBe("14:35");
  });

  it("23:30 de SP já é o dia seguinte em UTC, e continua sendo hoje", () => {
    expect(horarioCurtoSP("2026-01-06T02:30:00Z", new Date("2026-01-05T15:00:00Z"))).toBe("23:30");
  });

  it("até 6 dias civis, para frente ou para trás: dia da semana e hora", () => {
    expect(horarioCurtoSP("2026-01-12T12:05:00Z", new Date("2026-01-10T15:00:00Z"))).toBe(
      "seg 09:05",
    );
    expect(horarioCurtoSP("2026-01-05T13:05:00Z", new Date("2026-01-08T15:00:00Z"))).toBe(
      "seg 10:05",
    );
  });

  it("🔴 mais de 6 dias: dia e mês, nunca um dia da semana ambíguo", () => {
    expect(horarioCurtoSP("2026-01-05T13:05:00Z", new Date("2026-01-20T15:00:00Z"))).toBe(
      "05/01 10:05",
    );
  });

  it("🔴 a fronteira: 6 dias civis ainda leva o dia da semana, 7 já leva dia e mês", () => {
    const instante = "2026-01-12T12:05:00Z";
    expect(horarioCurtoSP(instante, new Date("2026-01-06T15:00:00Z"))).toBe("seg 09:05");
    expect(horarioCurtoSP(instante, new Date("2026-01-05T15:00:00Z"))).toBe("12/01 09:05");
  });

  it("instante inválido: hífen, sem lançar", () => {
    expect(horarioCurtoSP("banana", new Date("2026-01-05T15:00:00Z"))).toBe("-");
  });
});

describe("dataEHoraSP", () => {
  it("devolve a data e a hora civis de SP, inclusive depois da meia-noite em UTC", () => {
    expect(dataEHoraSP("2026-10-05T02:30:00.000Z")).toEqual({ data: "2026-10-04", hora: "23:30" });
    expect(dataEHoraSP("2026-10-05T03:00:00.000Z")).toEqual({ data: "2026-10-05", hora: "00:00" });
  });

  it("é o inverso de paraInstante em minuto cheio", () => {
    const iso = "2026-10-10T21:15:00.000Z";
    const { data, hora } = dataEHoraSP(iso);
    expect(paraInstante(data, hora)).toBe(iso);
  });
});
