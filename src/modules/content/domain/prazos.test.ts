import { describe, expect, it } from "vitest";

import {
  diasNoStatus,
  estaAtrasado,
  resumoDosAvisos,
  textoDoAguardando,
  textoDosAtrasados,
} from "./prazos";

const AGORA = new Date("2026-10-04T15:00:00Z");

describe("prazos", () => {
  it("atrasado: horário passado e não publicado", () => {
    expect(estaAtrasado({ status: "rascunho", agendadoPara: "2026-10-04T14:59:00Z" }, AGORA)).toBe(
      true,
    );
    expect(estaAtrasado({ status: "agendado", agendadoPara: "2026-10-01T12:00:00Z" }, AGORA)).toBe(
      true,
    );
    expect(estaAtrasado({ status: "publicado", agendadoPara: "2026-10-01T12:00:00Z" }, AGORA)).toBe(
      false,
    );
    expect(estaAtrasado({ status: "rascunho", agendadoPara: "2026-10-04T15:01:00Z" }, AGORA)).toBe(
      false,
    );
    expect(estaAtrasado({ status: "rascunho", agendadoPara: "banana" }, AGORA)).toBe(false);
  });

  it("dias no status contam dias civis de SP", () => {
    expect(diasNoStatus("2026-10-04T12:00:00Z", AGORA)).toBe(0);
    expect(diasNoStatus("2026-10-01T15:00:00Z", AGORA)).toBe(3);
    expect(diasNoStatus("2026-10-04T02:30:00Z", new Date("2026-10-04T03:30:00Z"))).toBe(1);
  });

  it("resumo conta atrasados e quem aguarda o cliente, com o mais antigo", () => {
    const resumo = resumoDosAvisos(
      [
        {
          status: "rascunho",
          agendadoPara: "2026-10-01T12:00:00Z",
          statusDesde: "2026-09-30T12:00:00Z",
        },
        {
          status: "em_aprovacao",
          agendadoPara: "2026-10-10T12:00:00Z",
          statusDesde: "2026-10-01T12:00:00Z",
        },
        {
          status: "em_aprovacao",
          agendadoPara: "2026-10-10T12:00:00Z",
          statusDesde: "2026-10-04T12:00:00Z",
        },
        {
          status: "publicado",
          agendadoPara: "2026-09-01T12:00:00Z",
          statusDesde: "2026-09-01T12:00:00Z",
        },
      ],
      AGORA,
    );
    expect(resumo).toEqual({ atrasados: 1, aguardando: 2, aguardandoHaMaisDias: 3 });
  });

  it("textos dos avisos", () => {
    expect(textoDosAtrasados(1)).toBe("1 post atrasado");
    expect(textoDosAtrasados(3)).toBe("3 posts atrasados");
    expect(textoDoAguardando(1, 0)).toBe("1 post aguardando o cliente · desde hoje");
    expect(textoDoAguardando(2, 1)).toBe("2 posts aguardando o cliente · há 1 dia");
    expect(textoDoAguardando(2, 4)).toBe("2 posts aguardando o cliente · há 4 dias");
  });
});
