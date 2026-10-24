import { describe, expect, it } from "vitest";

import {
  calcularTier,
  congelarResposta,
  interpretarCatalogo,
  montarCatalogoParaGravar,
  problemaNoCatalogo,
  somarPontos,
  type CatalogoDeQualificacao,
  type ObjetoJson,
  type PerguntaDoCatalogo,
  type RespostaCongelada,
} from "./qualification";

const CATALOGO_REAL: CatalogoDeQualificacao = {
  version: 1,
  questions: [
    {
      key: "investimento",
      label: "Q1 · Orçamento",
      prompt: "Existe orçamento reservado para este projeto?",
      options: [
        { label: "Sem orçamento previsto", points: 0, ko: true },
        { label: "Até R$ 2.000/mês", points: 1 },
        { label: "R$ 2.000 a 5.000/mês", points: 2 },
        { label: "Acima de R$ 5.000/mês", points: 2 },
      ],
    },
    {
      key: "decisor",
      label: "Q2 · Decisão",
      prompt: "Você decide sozinho?",
      options: [
        { label: "Não sabe quem aprova", points: 0, ko: true },
        { label: "Diretoria ou comitê", points: 1 },
        { label: "Aprova junto com um sócio", points: 1 },
        { label: "Aprova sozinho", points: 2 },
      ],
    },
    {
      key: "dor",
      label: "Q3 · Necessidade",
      prompt: "O que tira o seu sono?",
      options: [
        { label: "Nenhum problema claro", points: 0, ko: true },
        { label: "Reconhece quando aponto", points: 1 },
        { label: "Captação de clientes", points: 2 },
        { label: "Processo interno", points: 2 },
        { label: "Visibilidade da marca", points: 2 },
      ],
    },
    {
      key: "prazo",
      label: "Q4 · Prazo",
      prompt: "Existe prazo ou meta?",
      options: [
        { label: "Sem prazo definido", points: 0 },
        { label: "Mais de 90 dias", points: 1 },
        { label: "60 a 90 dias", points: 1 },
        { label: "30 a 60 dias", points: 2 },
        { label: "Menos de 30 dias", points: 2 },
      ],
    },
  ],
};

function resposta(over: Partial<RespostaCongelada> = {}): RespostaCongelada {
  return { questionKey: "q", optionIndex: 1, points: 2, isKo: false, ...over };
}

describe("calcularTier — espelho de opportunity_tier()", () => {
  it("sem resposta nenhuma devolve null, não C", () => {
    expect(calcularTier([])).toBeNull();
  });

  it("soma ≥ 6 é A", () => {
    expect(calcularTier([resposta(), resposta(), resposta()])).toBe("A");
    expect(calcularTier([resposta(), resposta(), resposta(), resposta()])).toBe("A");
  });

  it("soma ≥ 4 é B", () => {
    expect(calcularTier([resposta(), resposta()])).toBe("B");
    expect(calcularTier([resposta(), resposta(), resposta({ points: 1 })])).toBe("B");
  });

  it("soma < 4 é C", () => {
    expect(calcularTier([resposta({ points: 1 })])).toBe("C");
    expect(calcularTier([resposta({ points: 0 })])).toBe("C");
  });

  it("KO derruba para C mesmo com a soma dando A", () => {
    const respostas = [
      resposta({ points: 2 }),
      resposta({ points: 2 }),
      resposta({ points: 2 }),
      resposta({ points: 0, isKo: true }),
    ];
    expect(somarPontos(respostas)).toBe(6);
    expect(calcularTier(respostas)).toBe("C");
  });

  it("qualificação parcial pontua como o banco: soma do que foi respondido", () => {
    expect(calcularTier([resposta({ points: 2 })])).toBe("C");
    expect(calcularTier([resposta(), resposta()])).toBe("B");
    expect(calcularTier([resposta(), resposta(), resposta()])).toBe("A");
  });

  it("as 400 combinações completas respeitam as invariantes de opportunity_tier()", () => {
    const [q1, q2, q3, q4] = CATALOGO_REAL.questions;
    let combinacoes = 0;

    for (let a = 0; a < q1!.options.length; a++)
      for (let b = 0; b < q2!.options.length; b++)
        for (let c = 0; c < q3!.options.length; c++)
          for (let d = 0; d < q4!.options.length; d++) {
            combinacoes++;
            const respostas = [
              congelarResposta(q1!, a),
              congelarResposta(q2!, b),
              congelarResposta(q3!, c),
              congelarResposta(q4!, d),
            ];
            const tier = calcularTier(respostas);
            const soma = somarPontos(respostas);
            const temKo = respostas.some((r) => r.isKo);

            if (temKo) {
              expect(tier).toBe("C");
            } else if (soma >= 6) {
              expect(tier).toBe("A");
            } else if (soma >= 4) {
              expect(tier).toBe("B");
            } else {
              expect(tier).toBe("C");
            }
          }

    expect(combinacoes).toBe(4 * 4 * 5 * 5);
  });
});

describe("congelarResposta", () => {
  it("copia pontos e KO do catálogo — o congelamento do §5.9", () => {
    const q1 = CATALOGO_REAL.questions[0]!;
    expect(congelarResposta(q1, 0)).toEqual({
      questionKey: "investimento",
      optionIndex: 0,
      points: 0,
      isKo: true,
    });
    expect(congelarResposta(q1, 2)).toEqual({
      questionKey: "investimento",
      optionIndex: 2,
      points: 2,
      isKo: false,
    });
  });

  it("recusa índice fora do catálogo — UUID errado não cai em default", () => {
    const q4 = CATALOGO_REAL.questions[3]!;
    expect(() => congelarResposta(q4, 5)).toThrow(/não existe/);
    expect(() => congelarResposta(q4, -1)).toThrow(/não existe/);
  });
});

describe("interpretarCatalogo", () => {
  it("aceita o shape real do banco", () => {
    const catalogo = interpretarCatalogo(JSON.parse(JSON.stringify(CATALOGO_REAL)));
    expect(catalogo.version).toBe(1);
    expect(catalogo.questions).toHaveLength(4);
    expect(catalogo.questions[0]!.options[0]!.ko).toBe(true);
    expect(catalogo.questions[3]!.options[0]!.ko).toBe(false);
  });

  it("falha ALTO com catálogo quebrado — nunca tela vazia em silêncio", () => {
    expect(() => interpretarCatalogo(null)).toThrow(/formato inválido/);
    expect(() => interpretarCatalogo({})).toThrow(/version ou questions/);
    expect(() => interpretarCatalogo({ version: 1, questions: [{ key: "x" }] })).toThrow(
      /incompleta/,
    );
    expect(() =>
      interpretarCatalogo({
        version: 1,
        questions: [{ key: "x", label: "X", prompt: "?", options: [{ label: "só label" }] }],
      }),
    ).toThrow(/label\/points/);
  });
});

const BRUTO: ObjetoJson = {
  version: 1,
  tiers: { A: 6, B: 4 },
  questions: [
    {
      key: "investimento",
      label: "Q1 · Orçamento",
      prompt: "Existe orçamento reservado para este projeto?",
      dica: "x",
      options: [
        { points: 0, label: "Sem orçamento previsto", ko: true, dica: "sem verba" },
        { points: 1, label: "Até R$ 2.000/mês", ko: false },
      ],
    },
    {
      key: "decisor",
      label: "Q2 · Decisão",
      prompt: "Você decide sozinho?",
      options: [{ points: 2, label: "Aprova sozinho" }],
    },
  ],
};

const PERGUNTAS = interpretarCatalogo(BRUTO).questions;

function perguntasGravadas(valor: ObjetoJson): ObjetoJson[] {
  const lista = valor.questions;
  if (!Array.isArray(lista)) throw new Error("questions gravado não é uma lista");
  return lista.map((q) => {
    if (typeof q !== "object" || q === null || Array.isArray(q)) {
      throw new Error("pergunta gravada não é um objeto");
    }
    return q;
  });
}

const pergunta = (over: Partial<PerguntaDoCatalogo> = {}): PerguntaDoCatalogo => ({
  key: "nova",
  label: "Q5 · Urgência",
  prompt: "Para quando precisa?",
  options: [
    { label: "Este mês", points: 2 },
    { label: "Sem pressa", points: 0 },
  ],
  ...over,
});

describe("problemaNoCatalogo", () => {
  it("o catálogo real passa", () => {
    expect(problemaNoCatalogo(CATALOGO_REAL.questions)).toBeNull();
  });

  it("🔴 catálogo sem pergunta nenhuma não grava", () => {
    expect(problemaNoCatalogo([])).toBe("O catálogo precisa de pelo menos uma pergunta.");
  });

  it("🔴 título ou texto em branco não grava", () => {
    expect(problemaNoCatalogo([pergunta({ label: "  " })])).toBe(
      "Pergunta 1: o título não pode ficar em branco.",
    );
    expect(problemaNoCatalogo([pergunta({ prompt: "" })])).toBe(
      "Pergunta 1: o texto não pode ficar em branco.",
    );
  });

  it("🔴 pergunta sem opção não grava", () => {
    expect(problemaNoCatalogo([pergunta({ options: [] })])).toBe(
      "Pergunta 1: precisa de pelo menos uma opção.",
    );
  });

  it.each([3, -1, 1.5, Number.NaN])("🔴 pontos %s não gravam", (pontos) => {
    expect(problemaNoCatalogo([pergunta({ options: [{ label: "Sim", points: pontos }] })])).toBe(
      "Pergunta 1, opção 1: os pontos vão de 0 a 2, sem fração.",
    );
  });

  it("🔴 opção sem texto e opção repetida não gravam", () => {
    expect(problemaNoCatalogo([pergunta({ options: [{ label: " ", points: 1 }] })])).toBe(
      "Pergunta 1, opção 1: o texto não pode ficar em branco.",
    );
    expect(
      problemaNoCatalogo([
        pergunta({
          options: [
            { label: "Sim", points: 1 },
            { label: "Sim ", points: 2 },
          ],
        }),
      ]),
    ).toBe('Pergunta 1: duas opções com o texto "Sim".');
  });

  it("🔴 duas perguntas com a mesma chave não gravam", () => {
    expect(problemaNoCatalogo([pergunta(), pergunta({ label: "Outra" })])).toBe(
      "Pergunta 2: chave repetida ou vazia. Recarregue a página e refaça.",
    );
  });

  it("a mensagem diz a posição da pergunta", () => {
    expect(problemaNoCatalogo([...PERGUNTAS, pergunta({ label: "" })])).toBe(
      "Pergunta 3: o título não pode ficar em branco.",
    );
  });
});

describe("montarCatalogoParaGravar", () => {
  it("🔴 preserva tiers e o que o front não lê, e sobe a versão", () => {
    const valor = montarCatalogoParaGravar({ ...BRUTO, extra: "fica" }, PERGUNTAS);

    expect(valor.tiers).toEqual({ A: 6, B: 4 });
    expect(valor.extra).toBe("fica");
    expect(valor.version).toBe(2);
  });

  it("🔴 pergunta que já existia muda só título e texto: as opções cruas ficam como estavam", () => {
    const renomeadas = PERGUNTAS.map((p) =>
      p.key === "investimento"
        ? { ...p, label: "  Q1 · Quanto investe  ", prompt: "Quanto investe por mês?" }
        : p,
    );

    expect(montarCatalogoParaGravar(BRUTO, renomeadas).questions).toEqual([
      {
        key: "investimento",
        label: "Q1 · Quanto investe",
        prompt: "Quanto investe por mês?",
        dica: "x",
        options: [
          { points: 0, label: "Sem orçamento previsto", ko: true, dica: "sem verba" },
          { points: 1, label: "Até R$ 2.000/mês", ko: false },
        ],
      },
      {
        key: "decisor",
        label: "Q2 · Decisão",
        prompt: "Você decide sozinho?",
        options: [{ points: 2, label: "Aprova sozinho" }],
      },
    ]);
  });

  it("a ordem gravada é a da lista, e a pergunta removida sai", () => {
    const valor = montarCatalogoParaGravar(BRUTO, [PERGUNTAS[1]]);

    expect(perguntasGravadas(valor).map((q) => q.key)).toEqual(["decisor"]);
  });

  it("pergunta nova grava as opções, com ko só quando é KO", () => {
    const nova = pergunta({
      key: "k-nova",
      options: [
        { label: "Este mês", points: 2, ko: false },
        { label: "Nunca", points: 0, ko: true },
      ],
    });

    const valor = montarCatalogoParaGravar(BRUTO, [...PERGUNTAS, nova]);

    expect(perguntasGravadas(valor)[2]).toEqual({
      key: "k-nova",
      label: "Q5 · Urgência",
      prompt: "Para quando precisa?",
      options: [
        { points: 2, label: "Este mês" },
        { points: 0, label: "Nunca", ko: true },
      ],
    });
  });

  it("objeto sem version nem questions: versão 1 e a pergunta nova gravada", () => {
    expect(montarCatalogoParaGravar({}, [pergunta()])).toEqual({
      version: 1,
      questions: [
        {
          key: "nova",
          label: "Q5 · Urgência",
          prompt: "Para quando precisa?",
          options: [
            { points: 2, label: "Este mês" },
            { points: 0, label: "Sem pressa" },
          ],
        },
      ],
    });
  });

  it("o que se grava, a leitura entende", () => {
    expect(() =>
      interpretarCatalogo(montarCatalogoParaGravar(BRUTO, [...PERGUNTAS, pergunta()])),
    ).not.toThrow();
  });
});
