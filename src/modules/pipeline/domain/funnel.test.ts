import { describe, expect, it } from "vitest";

import {
  contagensPorEstagio,
  ETAPAS_DA_PROGRESSAO,
  ETAPAS_DO_DENOMINADOR,
  funilEmDegraus,
  oportunidadesPorCanal,
  porCanal,
  referenciaDoFunil,
  somarBaldesDisjuntos,
  taxaDeConversaoDoCanal,
  totalDaSemana,
  type LinhaDaSemana,
  type LinhaDoFunil,
} from "./funnel";
import { ORDEM_DOS_ESTAGIOS } from "./stage";

function linha(p: Partial<LinhaDoFunil> & { estagio: LinhaDoFunil["estagio"] }): LinhaDoFunil {
  return { canal: "inbound", oportunidades: 1, oportunidadesNoCanal: 1, ...p };
}

function semana(p: Partial<LinhaDaSemana> & { responsavel: string }): LinhaDaSemana {
  return {
    semana: "2026-08-17",
    responsavelId: "p",
    toques: 0,
    r1Marcadas: 0,
    r1DistintasNaSemana: 0,
    ...p,
  };
}

describe("as duas listas de etapas respondem perguntas diferentes", () => {
  it("o denominador inclui `perdido`; a progressão não", () => {
    expect(ETAPAS_DO_DENOMINADOR).toContain("perdido");
    expect(ETAPAS_DA_PROGRESSAO).not.toContain("perdido");
  });

  it("nenhuma das duas inclui `descartado`", () => {
    expect(ETAPAS_DO_DENOMINADOR).not.toContain("descartado");
    expect(ETAPAS_DA_PROGRESSAO).not.toContain("descartado");
  });

  it("a progressão está na ordem do processo, não na alfabética", () => {
    expect([...ETAPAS_DA_PROGRESSAO]).toEqual([
      "prospeccao",
      "abordagem",
      "qualificacao",
      "r1",
      "r2",
      "fechado",
    ]);
  });

  it("são derivadas, não cópias", () => {
    ETAPAS_DA_PROGRESSAO.forEach((e) => expect(ORDEM_DOS_ESTAGIOS).toContain(e));
    ETAPAS_DO_DENOMINADOR.forEach((e) => expect(ORDEM_DOS_ESTAGIOS).toContain(e));
  });
});

describe("contagensPorEstagio", () => {
  it("soma os canais e mantém as 8 chaves", () => {
    const contagens = contagensPorEstagio([
      linha({ estagio: "r1", canal: "inbound", oportunidades: 3 }),
      linha({ estagio: "r1", canal: "pago", oportunidades: 2 }),
    ]);
    expect(contagens.r1).toBe(5);
    expect(Object.keys(contagens).sort()).toEqual([...ORDEM_DOS_ESTAGIOS].sort());
  });

  it("etapa sem nenhuma linha é 0, não ausente", () => {
    const contagens = contagensPorEstagio([linha({ estagio: "prospeccao" })]);
    expect(contagens.r2).toBe(0);
    expect("r2" in contagens).toBe(true);
  });

  it("lista vazia devolve todas as etapas em zero", () => {
    const contagens = contagensPorEstagio([]);
    expect(Object.values(contagens).every((n) => n === 0)).toBe(true);
  });
});

describe("funilEmDegraus", () => {
  it("conta quem ALCANÇOU, e a taxa é sobre a etapa anterior", () => {
    const degraus = funilEmDegraus([
      linha({ estagio: "prospeccao", oportunidades: 100 }),
      linha({ estagio: "abordagem", oportunidades: 50 }),
      linha({ estagio: "qualificacao", oportunidades: 25 }),
    ]);
    expect(degraus[0]).toEqual({ estagio: "prospeccao", oportunidades: 100, taxaDaAnterior: null });
    expect(degraus[1]).toEqual({ estagio: "abordagem", oportunidades: 50, taxaDaAnterior: 0.5 });
    expect(degraus[2]).toEqual({ estagio: "qualificacao", oportunidades: 25, taxaDaAnterior: 0.5 });
  });

  it("denominador zero devolve null, NUNCA 0", () => {
    const degraus = funilEmDegraus([linha({ estagio: "r1", oportunidades: 4 })]);
    const r1 = degraus.find((d) => d.estagio === "r1");
    expect(r1?.oportunidades).toBe(4);
    expect(r1?.taxaDaAnterior).toBeNull();
  });

  it("base inteiramente vazia não produz nenhum 0%", () => {
    const degraus = funilEmDegraus([]);
    expect(degraus.every((d) => d.oportunidades === 0)).toBe(true);
    expect(degraus.every((d) => d.taxaDaAnterior === null)).toBe(true);
  });

  it("taxa maior que 1 não é escondida — o dado é que está errado, não a conta", () => {
    const degraus = funilEmDegraus([
      linha({ estagio: "prospeccao", oportunidades: 2 }),
      linha({ estagio: "abordagem", oportunidades: 5 }),
    ]);
    expect(degraus[1].taxaDaAnterior).toBe(2.5);
  });

  it("não inclui `perdido` nem `descartado` como degrau", () => {
    const degraus = funilEmDegraus([
      linha({ estagio: "perdido", oportunidades: 9 }),
      linha({ estagio: "descartado", oportunidades: 9 }),
    ]);
    expect(degraus.map((d) => d.estagio)).not.toContain("perdido");
    expect(degraus.map((d) => d.estagio)).not.toContain("descartado");
  });
});

describe("porCanal", () => {
  it("separa os canais e soma dentro de cada um", () => {
    const mapa = porCanal([
      linha({ canal: "pago", estagio: "r1", oportunidades: 2 }),
      linha({ canal: "pago", estagio: "r1", oportunidades: 1 }),
      linha({ canal: "indicacao", estagio: "r1", oportunidades: 4 }),
    ]);
    expect(mapa.get("pago")?.r1).toBe(3);
    expect(mapa.get("indicacao")?.r1).toBe(4);
  });

  it("`sem_atribuicao` fica separado, nunca somado a um canal real", () => {
    const mapa = porCanal([
      linha({ canal: "sem_atribuicao", estagio: "prospeccao", oportunidades: 7 }),
      linha({ canal: "outbound", estagio: "prospeccao", oportunidades: 1 }),
    ]);
    expect(mapa.get("sem_atribuicao")?.prospeccao).toBe(7);
    expect(mapa.get("outbound")?.prospeccao).toBe(1);
  });

  it("cada canal recebe seu próprio objeto — um não escreve no outro", () => {
    const mapa = porCanal([
      linha({ canal: "pago", estagio: "r1", oportunidades: 1 }),
      linha({ canal: "inbound", estagio: "r2", oportunidades: 1 }),
    ]);
    expect(mapa.get("pago")?.r2).toBe(0);
    expect(mapa.get("inbound")?.r1).toBe(0);
  });
});

describe("taxaDeConversaoDoCanal — o denominador vem do banco, não de uma soma", () => {
  it("fechados sobre as oportunidades DISTINTAS do canal", () => {
    expect(taxaDeConversaoDoCanal(1, 10)).toBe(0.1);
  });

  it("canal sem oportunidade devolve null, nunca 0", () => {
    expect(taxaDeConversaoDoCanal(0, 0)).toBeNull();
  });

  it("o canal que converte mais aparece com a taxa maior", () => {
    const a = taxaDeConversaoDoCanal(10, 10);
    const b = taxaDeConversaoDoCanal(5, 10);
    expect(a).toBe(1);
    expect(b).toBe(0.5);
    expect(a!).toBeGreaterThan(b!);

    const somaDosDegrausA = 60;
    const somaDosDegrausB = 15;
    expect(10 / somaDosDegrausA).toBeLessThan(5 / somaDosDegrausB);
  });
});

describe("oportunidadesPorCanal", () => {
  it("pega o total que o banco mandou, sem somar linha", () => {
    const mapa = oportunidadesPorCanal([
      linha({ canal: "pago", estagio: "prospeccao", oportunidades: 1, oportunidadesNoCanal: 7 }),
      linha({ canal: "pago", estagio: "abordagem", oportunidades: 1, oportunidadesNoCanal: 7 }),
    ]);
    expect(mapa.get("pago")).toBe(7);
  });

  it("canal ausente não tem entrada", () => {
    expect(oportunidadesPorCanal([]).get("pago")).toBeUndefined();
  });
});

describe("somarBaldesDisjuntos", () => {
  it("soma o que o banco já agregou em baldes que não se sobrepõem", () => {
    expect(somarBaldesDisjuntos([{ oportunidades: 3 }, { oportunidades: 4 }])).toBe(7);
  });

  it("lista vazia é zero", () => {
    expect(somarBaldesDisjuntos([])).toBe(0);
  });
});

describe("totalDaSemana", () => {
  it("soma as pessoas da semana pedida, e só dela", () => {
    const total = totalDaSemana(
      [
        semana({ responsavel: "Vinicius", toques: 12, r1Marcadas: 2, r1DistintasNaSemana: 3 }),
        semana({ responsavel: "Murilo", toques: 8, r1Marcadas: 1, r1DistintasNaSemana: 3 }),
        semana({
          responsavel: "Fernando",
          semana: "2026-08-10",
          toques: 99,
          r1Marcadas: 9,
          r1DistintasNaSemana: 9,
        }),
      ],
      "2026-08-17",
    );
    expect(total).toEqual({ toques: 20, r1Marcadas: 3, pessoas: 2 });
  });

  it("🔴 DASH-4: a mesma oportunidade a R1 por duas pessoas na semana conta UMA", () => {
    const total = totalDaSemana(
      [
        semana({ responsavel: "Olívia", r1Marcadas: 1, r1DistintasNaSemana: 1 }),
        semana({ responsavel: "Marina", r1Marcadas: 1, r1DistintasNaSemana: 1 }),
      ],
      "2026-08-17",
    );
    expect(total.r1Marcadas).toBe(1);
    expect(total.pessoas).toBe(2);
  });

  it("semana sem ninguém é zero de verdade, não erro", () => {
    expect(totalDaSemana([], "2026-08-17")).toEqual({ toques: 0, r1Marcadas: 0, pessoas: 0 });
  });

  it("responsável sem nome ainda soma — toque sem dono não some do total", () => {
    const total = totalDaSemana(
      [semana({ responsavel: "sem responsavel", responsavelId: null, toques: 5 })],
      "2026-08-17",
    );
    expect(total.toques).toBe(5);
    expect(total.pessoas).toBe(1);
  });
});

describe("referenciaDoFunil", () => {
  it("com gente no topo, a referência É o topo", () => {
    const degraus = funilEmDegraus([
      linha({ estagio: "prospeccao", oportunidades: 50 }),
      linha({ estagio: "abordagem", oportunidades: 20 }),
    ]);
    expect(referenciaDoFunil(degraus)).toEqual({ valor: 50, ehOMaior: false });
  });

  it("🔴 topo ZERO com degrau adiante não zera a barra — passa a valer o maior", () => {
    const degraus = funilEmDegraus([
      linha({ estagio: "abordagem", oportunidades: 40 }),
      linha({ estagio: "r1", oportunidades: 10 }),
    ]);
    expect(degraus[0].estagio).toBe("prospeccao");
    expect(degraus[0].oportunidades).toBe(0);

    expect(referenciaDoFunil(degraus)).toEqual({ valor: 40, ehOMaior: true });
  });

  it("funil inteiro em zero devolve zero, e NÃO diz que trocou de régua", () => {
    expect(referenciaDoFunil(funilEmDegraus([]))).toEqual({ valor: 0, ehOMaior: false });
  });

  it("lista de degraus vazia não estoura", () => {
    expect(referenciaDoFunil([])).toEqual({ valor: 0, ehOMaior: false });
  });
});
