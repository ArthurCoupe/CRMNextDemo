import { describe, expect, it } from "vitest";

import { todaySP } from "@/shared/lib/date";

import {
  agruparPorResponsavel,
  chaveDoAviso,
  deveAvisarSeguranca,
  ehSegundaFeira,
  diferencaEmDias,
  emailDeLeadsFrios,
  emailDePrimeiroContatoVencido,
  etapaParada,
  EXPLICACAO_DO_AVISO,
  janelaDeAlertas,
  LEADS_FRIOS_NO_EMAIL,
  montarDigest,
  type OportunidadeFria,
  PRIMEIROS_CONTATOS_NO_EMAIL,
  type PrimeiroContatoVencido,
  querReceber,
  ROTULO_DO_AVISO,
  type TarefaDoDigest,
  TIPOS_DE_AVISO,
} from "./notificacoes";

function tarefa(p: Partial<TarefaDoDigest> & { prazo: string }): TarefaDoDigest {
  return { id: "t1", titulo: "Tarefa", cliente: null, ...p };
}

describe("janelaDeAlertas", () => {
  it("deriva as cinco datas de UM dia civil", () => {
    expect(janelaDeAlertas("2026-08-19")).toEqual({
      amanha: "2026-08-20",
      ontem: "2026-08-18",
      limiteDeOnboarding: "2026-08-16",
      limiteDeLeadFrio: "2026-08-04",
      limiteDeContrato: "2026-09-18",
    });
  });

  it("atravessa a virada de mês e a de ano sem erro de calendário", () => {
    expect(janelaDeAlertas("2026-03-01").ontem).toBe("2026-02-28");
    expect(janelaDeAlertas("2024-03-01").ontem).toBe("2024-02-29");
    expect(janelaDeAlertas("2026-01-01").ontem).toBe("2025-12-31");
    expect(janelaDeAlertas("2026-12-31").amanha).toBe("2027-01-01");
  });
});

describe("🔴 o dia civil às 23h e à 01h de São Paulo", () => {
  const vinteETresHoraDeSP = new Date("2026-08-19T23:30:00-03:00");
  const umaHoraDoDiaSeguinte = new Date("2026-08-20T01:30:00-03:00");

  it("são dois dias civis diferentes, e o UTC não distingue", () => {
    expect(todaySP(vinteETresHoraDeSP)).toBe("2026-08-19");
    expect(todaySP(umaHoraDoDiaSeguinte)).toBe("2026-08-20");

    expect(vinteETresHoraDeSP.toISOString().slice(0, 10)).toBe("2026-08-20");
    expect(umaHoraDoDiaSeguinte.toISOString().slice(0, 10)).toBe("2026-08-20");
  });

  it("a tarefa de 19/08 está no dia às 23h e ATRASADA à 01h", () => {
    const t = [tarefa({ prazo: "2026-08-19", titulo: "Proposta" })];

    const antes = montarDigest(t, todaySP(vinteETresHoraDeSP));
    expect(antes?.paraHoje).toHaveLength(1);
    expect(antes?.atrasadas).toHaveLength(0);

    const depois = montarDigest(t, todaySP(umaHoraDoDiaSeguinte));
    expect(depois?.paraHoje).toHaveLength(0);
    expect(depois?.atrasadas[0].diasDeAtraso).toBe(1);
  });

  it("a chave muda com o dia civil, não com o dia UTC", () => {
    const a = chaveDoAviso("digest", "p1", todaySP(vinteETresHoraDeSP));
    const b = chaveDoAviso("digest", "p1", todaySP(umaHoraDoDiaSeguinte));
    expect(a).not.toBe(b);
    expect(vinteETresHoraDeSP.toISOString().slice(0, 10)).toBe(
      umaHoraDoDiaSeguinte.toISOString().slice(0, 10),
    );
  });
});

describe("chaveDoAviso", () => {
  it("🔴 duas montagens do mesmo aviso no mesmo dia dão a MESMA chave", () => {
    expect(chaveDoAviso("digest", "p1", "2026-08-19")).toBe(
      chaveDoAviso("digest", "p1", "2026-08-19"),
    );
  });

  it("separa por tipo, por pessoa e por objeto", () => {
    expect(chaveDoAviso("digest", "p1", "2026-08-19")).not.toBe(
      chaveDoAviso("tarefa_d1", "p1", "2026-08-19"),
    );
    expect(chaveDoAviso("digest", "p1", "2026-08-19")).not.toBe(
      chaveDoAviso("digest", "p2", "2026-08-19"),
    );
    expect(chaveDoAviso("tarefa_d1", "p1", "2026-08-19", "t1")).not.toBe(
      chaveDoAviso("tarefa_d1", "p1", "2026-08-19", "t2"),
    );
  });

  it("sem objeto, a chave não ganha separador solto", () => {
    expect(chaveDoAviso("digest", "p1", "2026-08-19")).toBe("digest-p1-2026-08-19");
    expect(chaveDoAviso("tarefa_d1", "p1", "2026-08-19", "t1")).toBe("tarefa_d1-p1-2026-08-19-t1");
  });
});

describe("montarDigest", () => {
  it("🔴 pessoa sem tarefa não recebe e-mail — devolve null, não digest vazio", () => {
    expect(montarDigest([], "2026-08-19")).toBeNull();
  });

  it("tarefa só no futuro também devolve null", () => {
    expect(montarDigest([tarefa({ prazo: "2026-08-25" })], "2026-08-19")).toBeNull();
  });

  it("separa atrasadas de para-hoje e conta o atraso em dias civis", () => {
    const d = montarDigest(
      [
        tarefa({ id: "a", titulo: "Antiga", prazo: "2026-08-16" }),
        tarefa({ id: "b", titulo: "Hoje", prazo: "2026-08-19" }),
        tarefa({ id: "c", titulo: "Ontem", prazo: "2026-08-18" }),
        tarefa({ id: "d", titulo: "Futura", prazo: "2026-09-01" }),
      ],
      "2026-08-19",
    );
    expect(d?.atrasadas.map((t) => t.id)).toEqual(["a", "c"]);
    expect(d?.atrasadas.map((t) => t.diasDeAtraso)).toEqual([3, 1]);
    expect(d?.paraHoje.map((t) => t.id)).toEqual(["b"]);
  });

  it("a ordem é estável — empate de atraso desempata por título", () => {
    const d = montarDigest(
      [
        tarefa({ id: "z", titulo: "Zebra", prazo: "2026-08-18" }),
        tarefa({ id: "a", titulo: "Abacate", prazo: "2026-08-18" }),
      ],
      "2026-08-19",
    );
    expect(d?.atrasadas.map((t) => t.id)).toEqual(["a", "z"]);
  });
});

describe("diferencaEmDias", () => {
  it("conta dias civis, inclusive atravessando mês, ano e bissexto", () => {
    expect(diferencaEmDias("2026-08-19", "2026-08-19")).toBe(0);
    expect(diferencaEmDias("2026-08-18", "2026-08-19")).toBe(1);
    expect(diferencaEmDias("2026-02-28", "2026-03-01")).toBe(1);
    expect(diferencaEmDias("2024-02-28", "2024-03-01")).toBe(2);
    expect(diferencaEmDias("2025-12-31", "2026-01-01")).toBe(1);
  });

  it("é negativa quando a segunda data é anterior", () => {
    expect(diferencaEmDias("2026-08-19", "2026-08-16")).toBe(-3);
  });
});

describe("querReceber", () => {
  it("🔴 ausência de linha significa QUER RECEBER", () => {
    expect(querReceber("p1", "digest", [])).toBe(true);
  });

  it("linha desligada silencia só aquela pessoa e só aquele tipo", () => {
    const desligados = [{ profile_id: "p1", tipo: "digest" as const }];
    expect(querReceber("p1", "digest", desligados)).toBe(false);
    expect(querReceber("p1", "tarefa_d1", desligados)).toBe(true);
    expect(querReceber("p2", "digest", desligados)).toBe(true);
  });
});

describe("ROTULO_DO_AVISO e EXPLICACAO_DO_AVISO", () => {
  it("cobrem todo TIPOS_DE_AVISO — inclusive nutricao_vencida (F24)", () => {
    for (const tipo of TIPOS_DE_AVISO) {
      expect(ROTULO_DO_AVISO[tipo]).toBeTruthy();
      expect(EXPLICACAO_DO_AVISO[tipo]).toBeTruthy();
    }
  });

  it("🔴 lead_frio diz que é um e-mail por dia, com as oportunidades da própria pessoa", () => {
    expect(EXPLICACAO_DO_AVISO.lead_frio).toMatch(/um e-mail por dia/i);
    expect(EXPLICACAO_DO_AVISO.lead_frio).toMatch(/oportunidades suas/i);
    expect(EXPLICACAO_DO_AVISO.lead_frio).not.toMatch(/quando uma oportunidade/i);
  });

  it("🔴 nutricao_vencida nunca afirma que o prazo já passou — só que termina hoje ou já terminou", () => {
    expect(ROTULO_DO_AVISO.nutricao_vencida).not.toMatch(/vencid|venceu|passou/i);
    expect(EXPLICACAO_DO_AVISO.nutricao_vencida).toMatch(/hoje/i);
  });

  it("🔴 nutricao_vencida diz que escala para os owners — não lê como 'sua', igual lead_frio", () => {
    expect(EXPLICACAO_DO_AVISO.nutricao_vencida).toMatch(/owners/i);
    expect(EXPLICACAO_DO_AVISO.nutricao_vencida).not.toMatch(/oportunidade sua|sua oportunidade/i);
  });
});

describe("etapaParada (NOTIF-2)", () => {
  const etapa = {
    diaZero: "2026-09-01",
    tarefas: [
      { concluidaEm: null, deadlineDays: 14 },
      { concluidaEm: null, deadlineDays: 7 },
      { concluidaEm: "2026-09-02T12:00:00Z", deadlineDays: 1 },
    ],
  };

  it("dentro do prazo do método não dispara, mesmo liberada há muito", () => {
    expect(etapaParada(etapa, "2026-09-10")).toEqual({
      parada: false,
      prazo: "2026-09-08",
      pendentes: 2,
    });
  });

  it("dispara quando o prazo passou há 3 dias civis ou mais", () => {
    expect(etapaParada(etapa, "2026-09-11")).toEqual({
      parada: true,
      prazo: "2026-09-08",
      pendentes: 2,
    });
    expect(etapaParada(etapa, "2026-10-30").parada).toBe(true);
  });

  it("sem pendência não está parada e não tem prazo", () => {
    const concluida = { diaZero: "2026-09-01", tarefas: [etapa.tarefas[2]] };
    expect(etapaParada(concluida, "2026-12-01")).toEqual({
      parada: false,
      prazo: null,
      pendentes: 0,
    });
  });
});

describe("C42 · deveAvisarSeguranca (revisao semanal)", () => {
  it("2026-09-21 e segunda; 2026-09-22 e terca", () => {
    expect(ehSegundaFeira("2026-09-21")).toBe(true);
    expect(ehSegundaFeira("2026-09-22")).toBe(false);
  });

  it("so avisa na segunda E acima do limiar; controle positivo ao lado", () => {
    expect(deveAvisarSeguranca("2026-09-21", 50)).toBe(true);
    expect(deveAvisarSeguranca("2026-09-21", 49)).toBe(false);
    expect(deveAvisarSeguranca("2026-09-22", 500)).toBe(false);
    expect(deveAvisarSeguranca("2026-09-21", 3, 3)).toBe(true);
  });
});

describe("lead_frio: um e-mail por pessoa, com a lista", () => {
  function lead(p: Partial<OportunidadeFria> & { id: string }): OportunidadeFria {
    return {
      nome: `Lead ${p.id}`,
      paradoDesde: "2026-09-21T15:00:00Z",
      responsavelId: "ana",
      ...p,
    };
  }

  const doze = Array.from({ length: 12 }, (_, i) =>
    lead({
      id: String(i),
      nome: `L${String(i).padStart(2, "0")}`,
      paradoDesde: `2026-09-${String(10 + i)}T15:00:00Z`,
    }),
  );

  it("agrupa por responsável ativo; sem responsável e inativo viram contagem, nunca destinatário", () => {
    const grupos = agruparPorResponsavel(
      [
        lead({ id: "1" }),
        lead({ id: "2" }),
        lead({ id: "3", responsavelId: "bia" }),
        lead({ id: "4", responsavelId: null }),
        lead({ id: "5", responsavelId: "ex" }),
        lead({ id: "6", responsavelId: "ex" }),
      ],
      new Set(["ana", "bia"]),
    );
    expect(grupos.porResponsavel.get("ana")?.map((l) => l.id)).toEqual(["1", "2"]);
    expect(grupos.porResponsavel.get("bia")?.map((l) => l.id)).toEqual(["3"]);
    expect(grupos.porResponsavel.has("ex")).toBe(false);
    expect(grupos.semResponsavel).toBe(1);
    expect([...grupos.comResponsavelInativo]).toEqual([["ex", 2]]);
  });

  it("um lead: título no singular, sem piso e sem resto no Pipeline", () => {
    const email = emailDeLeadsFrios([lead({ id: "1", nome: "Acme" })], false);
    expect(email.titulo).toBe("1 lead sem contato há 15 dias ou mais");
    expect(email.chamada).not.toMatch(/pelo menos|no Pipeline/i);
    expect(email.fatos).toEqual([{ rotulo: "Parado desde 21/09/2026", valor: "Acme" }]);
  });

  it("🔴 doze leads: mostra os 10 mais antigos, em ordem, e diz quantos ficaram no Pipeline", () => {
    const email = emailDeLeadsFrios([...doze].reverse(), false);
    expect(email.titulo).toBe("12 leads sem contato há 15 dias ou mais");
    expect(email.fatos).toHaveLength(LEADS_FRIOS_NO_EMAIL);
    expect(email.fatos[0]).toEqual({ rotulo: "Parado desde 10/09/2026", valor: "L00" });
    expect(email.fatos.map((f) => f.valor)).toEqual(doze.slice(0, 10).map((l) => l.nome));
    expect(email.chamada).toContain("mais 2 no Pipeline");
  });

  it("mesma data desempata por nome, para a lista não trocar de ordem entre passadas", () => {
    const email = emailDeLeadsFrios(
      [lead({ id: "1", nome: "Zeta" }), lead({ id: "2", nome: "Alfa" })],
      false,
    );
    expect(email.fatos.map((f) => f.valor)).toEqual(["Alfa", "Zeta"]);
  });

  it("🔴 consulta no teto: o total é piso e o texto diz 'pelo menos'; controle sem teto ao lado", () => {
    const noTeto = emailDeLeadsFrios(doze, true);
    expect(noTeto.titulo).toBe("Pelo menos 12 leads sem contato há 15 dias ou mais");
    expect(noTeto.chamada).toContain("pelo menos mais 2 no Pipeline");

    const semTeto = emailDeLeadsFrios(doze, false);
    expect(semTeto.titulo).not.toMatch(/pelo menos/i);
    expect(semTeto.chamada).not.toMatch(/pelo menos/i);
  });
});

describe("primeiro_contato_vencido (D-063)", () => {
  const AGORA = new Date("2026-01-08T11:00:00Z");

  function vencido(
    p: Partial<PrimeiroContatoVencido & { responsavelId: string | null }> & { id: string },
  ): PrimeiroContatoVencido & { responsavelId: string | null } {
    return {
      nome: `Lead ${p.id}`,
      canal: "pago",
      venceEm: "2026-01-05T13:05:00Z",
      responsavelId: "ana",
      ...p,
    };
  }

  it("o agrupador do lead frio serve sem mudar: por responsável ativo, o resto vira contagem", () => {
    const grupos = agruparPorResponsavel(
      [
        vencido({ id: "1" }),
        vencido({ id: "2", responsavelId: null }),
        vencido({ id: "3", responsavelId: "ex" }),
      ],
      new Set(["ana"]),
    );
    expect(grupos.porResponsavel.get("ana")).toEqual([
      { id: "1", nome: "Lead 1", canal: "pago", venceEm: "2026-01-05T13:05:00Z" },
    ]);
    expect(grupos.semResponsavel).toBe(1);
    expect([...grupos.comResponsavelInativo]).toEqual([["ex", 1]]);
  });

  it("um lead: singular, com canal e 'venceu seg 10:05'", () => {
    const email = emailDePrimeiroContatoVencido([vencido({ id: "1", nome: "Acme" })], false, AGORA);
    expect(email.titulo).toBe("1 lead sem primeiro contato no prazo");
    expect(email.fatos).toEqual([{ rotulo: "Tráfego pago · venceu seg 10:05", valor: "Acme" }]);
    expect(email.chamada).not.toMatch(/no Pipeline/);
  });

  it("vencido hoje: 'venceu às HH:MM'", () => {
    const email = emailDePrimeiroContatoVencido(
      [vencido({ id: "1", canal: "inbound", venceEm: "2026-01-08T10:30:00Z" })],
      false,
      new Date("2026-01-08T15:00:00Z"),
    );
    expect(email.fatos[0]?.rotulo).toBe("Inbound / MKT · venceu às 07:30");
  });

  it(`mais de ${PRIMEIROS_CONTATOS_NO_EMAIL}: os mais antigos primeiro e "mais N no Pipeline"`, () => {
    const doze = Array.from({ length: 12 }, (_, i) =>
      vencido({
        id: String(i),
        nome: `L${String(i).padStart(2, "0")}`,
        venceEm: `2026-01-0${(i % 7) + 1}T13:05:00Z`,
      }),
    );
    const email = emailDePrimeiroContatoVencido([...doze].reverse(), false, AGORA);
    expect(email.fatos).toHaveLength(PRIMEIROS_CONTATOS_NO_EMAIL);
    expect(email.titulo).toBe("12 leads sem primeiro contato no prazo");
    expect(email.chamada).toMatch(/mais 2 no Pipeline\.$/);
    expect(email.chamada).not.toMatch(/pelo menos/i);
    expect(email.fatos.slice(0, 2).map((f) => f.valor)).toEqual(["L00", "L07"]);
  });

  it("consulta no teto: 'Pelo menos' no título e na contagem do resto", () => {
    const doze = Array.from({ length: 12 }, (_, i) => vencido({ id: String(i) }));
    const email = emailDePrimeiroContatoVencido(doze, true, AGORA);
    expect(email.titulo).toBe("Pelo menos 12 leads sem primeiro contato no prazo");
    expect(email.chamada).toMatch(/pelo menos mais 2 no Pipeline/);
  });

  it("a trava do dia e a preferência valem para o tipo novo", () => {
    expect(chaveDoAviso("primeiro_contato_vencido", "ana", "2026-01-08")).toBe(
      chaveDoAviso("primeiro_contato_vencido", "ana", "2026-01-08"),
    );
    expect(chaveDoAviso("primeiro_contato_vencido", "ana", "2026-01-08")).not.toBe(
      chaveDoAviso("primeiro_contato_vencido", "ana", "2026-01-09"),
    );
    expect(chaveDoAviso("primeiro_contato_vencido", "ana", "2026-01-08")).not.toBe(
      chaveDoAviso("lead_frio", "ana", "2026-01-08"),
    );
    const desligados = [{ profile_id: "ana", tipo: "primeiro_contato_vencido" as const }];
    expect(querReceber("ana", "primeiro_contato_vencido", desligados)).toBe(false);
    expect(querReceber("bia", "primeiro_contato_vencido", desligados)).toBe(true);
    expect(querReceber("ana", "lead_frio", desligados)).toBe(true);
  });
});
