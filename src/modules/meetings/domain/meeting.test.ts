import { describe, expect, it } from "vitest";

import { Constants } from "@/shared/types/database.types";

import {
  DURACAO_MAXIMA_MINUTOS,
  duracaoValida,
  MENSAGEM_DO_TETO_DE_REUNIOES,
  paraInstante,
  ReuniaoCriadaSemParticipantes,
  rotuloDoTipo,
  separarAgenda,
  sobrepoe,
  termoDaBuscaDeOportunidade,
  TETO_DE_REUNIOES,
  TIPOS_POR_GRUPO,
  vinculoExigido,
} from "./meeting";

describe("os tipos de reuniao", () => {
  it("cobre exatamente o enum do banco, sem sobra nem falta", () => {
    const noDominio = TIPOS_POR_GRUPO.flatMap((g) => g.tipos)
      .slice()
      .sort();
    const noBanco = [...Constants.public.Enums.meeting_type].sort();
    expect(noDominio).toEqual(noBanco);
  });

  it("nao repete tipo entre grupos", () => {
    const todos = TIPOS_POR_GRUPO.flatMap((g) => g.tipos);
    expect(todos.length).toBe(new Set(todos).size);
  });

  it("da rotulo em portugues a todo tipo, sem underscore sobrando", () => {
    for (const tipo of Constants.public.Enums.meeting_type) {
      const rotulo = rotuloDoTipo(tipo);
      expect(rotulo.length).toBeGreaterThan(0);
      expect(rotulo).not.toContain("_");
    }
  });
});

describe("qual vinculo cada tipo exige", () => {
  it("os sete tipos sobre cliente exigem cliente", () => {
    for (const tipo of [
      "kickoff_cliente",
      "semanal_cliente",
      "alinhamento_cliente",
      "apresentacao_de_resultados",
      "renovacao_ou_upsell",
      "entregas_do_cliente",
      "alinhamento_interno_sobre_cliente",
    ] as const) {
      expect(vinculoExigido(tipo)).toBe("cliente");
    }
  });

  it("proposta para prospect exige OPORTUNIDADE, nao cliente", () => {
    expect(vinculoExigido("proposta_para_prospect")).toBe("oportunidade");
  });

  it("os sete tipos internos nao exigem nada", () => {
    for (const tipo of [
      "interna_de_time",
      "semanal_de_time",
      "quinzenal_de_time",
      "planejamento",
      "retrospectiva",
      "um_a_um",
      "onboarding_de_colaborador",
    ] as const) {
      expect(vinculoExigido(tipo)).toBe("nenhum");
    }
  });

  it("todo tipo do banco tem uma classe, nenhum cai fora", () => {
    for (const tipo of Constants.public.Enums.meeting_type) {
      expect(["cliente", "oportunidade", "nenhum"]).toContain(vinculoExigido(tipo));
    }
  });
});

describe("juntar data e hora num instante", () => {
  it("14:30 de 15/09 em Sao Paulo e 17:30 UTC", () => {
    expect(paraInstante("2026-09-15", "14:30")).toBe("2026-09-15T17:30:00.000Z");
  });

  it("janeiro tambem e UTC-3, porque nao ha mais horario de verao", () => {
    expect(paraInstante("2026-01-15", "14:30")).toBe("2026-01-15T17:30:00.000Z");
  });

  it("hora que cruza a meia-noite em UTC continua no dia certo", () => {
    expect(paraInstante("2026-09-15", "22:00")).toBe("2026-09-16T01:00:00.000Z");
  });

  const FUSO_DO_SISTEMA = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offsetEm = () => new Date("2026-03-29T01:30:00Z").getTimezoneOffset();
  const OFFSET_DO_SISTEMA = offsetEm();

  it("🔴 02:30 de 29/03/2026 em SP e 05:30Z em qualquer fuso da maquina — inclusive Lisboa na virada", () => {
    const fusos: ReadonlyArray<readonly [string, number]> = [
      ["Europe/Lisbon", -60],
      ["America/Sao_Paulo", 180],
      ["UTC", 0],
      ["Asia/Tokyo", -540],
    ];
    try {
      for (const [fuso, offsetEsperado] of fusos) {
        process.env.TZ = fuso;
        expect(offsetEm(), `troca para ${fuso}`).toBe(offsetEsperado);
        expect(paraInstante("2026-03-29", "02:30"), fuso).toBe("2026-03-29T05:30:00.000Z");
        expect(paraInstante("2026-09-15", "14:30"), fuso).toBe("2026-09-15T17:30:00.000Z");
      }
    } finally {
      process.env.TZ = FUSO_DO_SISTEMA;
    }
  });

  it("depois da rodada de fusos, o processo esta de volta no fuso do sistema", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(FUSO_DO_SISTEMA);
    expect(offsetEm()).toBe(OFFSET_DO_SISTEMA);
  });

  it("recusa data ou hora malformada em vez de virar meia-noite em silencio", () => {
    expect(() => paraInstante("15/09/2026", "14:30")).toThrow();
    expect(() => paraInstante("2026-09-15", "25:00")).toThrow();
    expect(() => paraInstante("2026-09-15", "")).toThrow();
  });

  it("recusa dia de calendario inexistente em vez de rolar em silencio para o mes seguinte", () => {
    expect(() => paraInstante("2026-02-30", "14:30")).toThrow();
    expect(() => paraInstante("2026-02-29", "14:30")).toThrow();
    expect(() => paraInstante("2026-04-31", "14:30")).toThrow();
    expect(() => paraInstante("2026-13-01", "14:30")).toThrow();
    expect(() => paraInstante("2026-00-10", "14:30")).toThrow();
  });

  it("aceita 29 de fevereiro em ano bissexto -- a guarda nao pode recusar todo 29/02", () => {
    expect(paraInstante("2024-02-29", "14:30")).toBe("2024-02-29T17:30:00.000Z");
  });
});

describe("duracao valida — o que o banco aceita", () => {
  it("1 e 1440 (24 h) passam; 0, negativo, NaN (campo limpo) e 1441 nao", () => {
    expect(duracaoValida(1)).toBe(true);
    expect(duracaoValida(60)).toBe(true);
    expect(duracaoValida(DURACAO_MAXIMA_MINUTOS)).toBe(true);
    expect(duracaoValida(0)).toBe(false);
    expect(duracaoValida(-30)).toBe(false);
    expect(duracaoValida(DURACAO_MAXIMA_MINUTOS + 1)).toBe(false);
    expect(duracaoValida(Number.NaN)).toBe(false);
  });
});

describe("sobreposicao de horario", () => {
  const as14 = new Date("2026-09-15T17:00:00.000Z");

  it("duas reunioes no mesmo horario sobrepoem", () => {
    expect(sobrepoe(as14, 60, as14, 60)).toBe(true);
  });

  it("uma que termina quando a outra comeca NAO sobrepoe", () => {
    const as15 = new Date("2026-09-15T18:00:00.000Z");
    expect(sobrepoe(as14, 60, as15, 60)).toBe(false);
  });

  it("sobreposicao parcial conta", () => {
    const as1430 = new Date("2026-09-15T17:30:00.000Z");
    expect(sobrepoe(as14, 60, as1430, 60)).toBe(true);
  });

  it("uma contida na outra conta", () => {
    const as1415 = new Date("2026-09-15T17:15:00.000Z");
    expect(sobrepoe(as14, 120, as1415, 15)).toBe(true);
  });
});

describe("MEET-2 e MEET-4: o que a tela reconhece", () => {
  it("a mensagem do teto cita o teto e diz o que fazer", () => {
    expect(MENSAGEM_DO_TETO_DE_REUNIOES).toContain(String(TETO_DE_REUNIOES));
    expect(MENSAGEM_DO_TETO_DE_REUNIOES).toMatch(/encurte o período/);
  });

  it("ReuniaoCriadaSemParticipantes e um Error que carrega o id parcial", () => {
    const erro = new ReuniaoCriadaSemParticipantes("r1");
    expect(erro).toBeInstanceOf(Error);
    expect(erro.reuniaoId).toBe("r1");
    expect(erro.message).toContain("sem os participantes");
  });
});

describe("separarAgenda", () => {
  const agora = Date.parse("2026-10-01T15:00:00.000Z");
  const r = (id: string, startsAt: string) => ({ id, startsAt });
  const lista = [
    r("passada-antiga", "2026-09-01T12:00:00.000Z"),
    r("futura-longe", "2026-12-01T12:00:00.000Z"),
    r("agora", "2026-10-01T15:00:00.000Z"),
    r("passada-recente", "2026-10-01T14:59:00.000Z"),
    r("futura-perto", "2026-10-02T12:00:00.000Z"),
  ];
  const ids = (g: { futuras: { id: string }[]; passadas: { id: string }[] }) => ({
    futuras: g.futuras.map((x) => x.id),
    passadas: g.passadas.map((x) => x.id),
  });

  it("futuras da mais proxima; passadas da mais recente; o instante exato e futuro", () => {
    expect(ids(separarAgenda(lista, agora))).toEqual({
      futuras: ["agora", "futura-perto", "futura-longe"],
      passadas: ["passada-recente", "passada-antiga"],
    });
  });

  it("o mesmo horario muda de grupo quando o relogio passa dele", () => {
    expect(ids(separarAgenda(lista, agora + 60_000))).toEqual({
      futuras: ["futura-perto", "futura-longe"],
      passadas: ["agora", "passada-recente", "passada-antiga"],
    });
  });

  it("nao mexe na lista recebida", () => {
    const copia = lista.map((x) => x.id);
    separarAgenda(lista, agora);
    expect(lista.map((x) => x.id)).toEqual(copia);
  });
});

describe("termoDaBuscaDeOportunidade", () => {
  it("menos de 2 letras não busca", () => {
    expect(termoDaBuscaDeOportunidade("")).toBeNull();
    expect(termoDaBuscaDeOportunidade("a")).toBeNull();
  });

  it("espaço nas pontas não conta como letra", () => {
    expect(termoDaBuscaDeOportunidade("   ")).toBeNull();
    expect(termoDaBuscaDeOportunidade(" a ")).toBeNull();
  });

  it("2 letras ou mais busca, com o termo aparado", () => {
    expect(termoDaBuscaDeOportunidade("ac")).toBe("ac");
    expect(termoDaBuscaDeOportunidade("  Clínica Vida  ")).toBe("Clínica Vida");
  });
});
