import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  agruparPorBu,
  avisoDePercentualSugerido,
  explicacaoDeParticipacaoSemLinha,
  fatiaVariavel,
  pessoaNaFolhaEm,
  ROTULO_DO_VINCULO,
  situacaoNaFolhaEm,
  type CustoDeFolhaPorBu,
  type PessoaNaEquipe,
} from "./payroll";
import { indiceDoMes, primeiroDiaDoMes } from "./mes-civil";

const PRIMEIRO_MES = 2024 * 12 + 0;
const MESES = 36;
const VARIANTES_DE_FIM: readonly (number | null)[] = [null, 0, 6, 12];

function ultimoDiaDoMes(ano: number, mes: number): number {
  if (mes === 2) {
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
    return bissexto ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

function dataDoIndice(indice: number, ultimoDia: boolean): string {
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  const dia = ultimoDia ? ultimoDiaDoMes(ano, mes) : 1;
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function somaMeses(data: string, meses: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const alvo = ano * 12 + (mes - 1) + meses;
  const anoAlvo = Math.floor(alvo / 12);
  const mesAlvo = (alvo % 12) + 1;
  const diaAlvo = Math.min(dia, ultimoDiaDoMes(anoAlvo, mesAlvo));
  return `${String(anoAlvo).padStart(4, "0")}-${String(mesAlvo).padStart(2, "0")}-${String(diaAlvo).padStart(2, "0")}`;
}

function md5(texto: string): string {
  return createHash("md5").update(texto, "utf8").digest("hex");
}

function varrerGrade(visitar: (inicio: string, fim: string | null, ref: string) => void) {
  for (let s = 0; s < MESES; s += 1) {
    for (let r = 0; r < MESES; r += 1) {
      const ref = dataDoIndice(PRIMEIRO_MES + r, false);
      for (const ultimoDia of [false, true]) {
        const inicio = dataDoIndice(PRIMEIRO_MES + s, ultimoDia);
        for (const variante of VARIANTES_DE_FIM) {
          visitar(inicio, variante === null ? null : somaMeses(inicio, variante), ref);
        }
      }
    }
  }
}

describe("paridade com fn_pessoa_na_folha_em, por varredura", () => {
  it("a grade tem 10.368 casos distintos e cobre o último dia do mês", () => {
    const vistos = new Set<string>();
    const inicios = new Set<string>();
    varrerGrade((inicio, fim, ref) => {
      vistos.add(`${inicio}|${fim}|${ref}`);
      inicios.add(inicio);
    });
    expect(vistos.size).toBe(10_368);
    expect(inicios.size).toBe(72);
    expect([...inicios].some((d) => d.endsWith("-31"))).toBe(true);
    expect([...inicios].some((d) => d.endsWith("-29"))).toBe(true);
  });

  it("bate com o Postgres nos 10.368", () => {
    const bits: string[] = [];
    varrerGrade((inicio, fim, ref) => {
      bits.push(pessoaNaFolhaEm(inicio, fim, ref) === true ? "1" : "0");
    });
    expect(bits.filter((b) => b === "1")).toHaveLength(2_646);
    expect(md5(bits.join(""))).toBe("fa510d30ffb3f4d9194fea2a39deb8c3");
  });
});

describe("pessoaNaFolhaEm", () => {
  it("sem fim, conta de sempre a partir do início", () => {
    expect(pessoaNaFolhaEm("2026-01-01", null, "2026-08-01")).toBe(true);
    expect(pessoaNaFolhaEm("2026-01-01", null, "2099-12-01")).toBe(true);
  });

  it("não conta antes de começar", () => {
    expect(pessoaNaFolhaEm("2026-09-01", null, "2026-08-01")).toBe(false);
  });

  it("🔴 quem sai no meio do mês CONTA nele", () => {
    expect(pessoaNaFolhaEm("2026-01-01", "2026-08-20", "2026-08-01")).toBe(true);
    expect(pessoaNaFolhaEm("2026-01-01", "2026-08-20", "2026-09-01")).toBe(false);
  });

  it("entrar e sair no mesmo mês conta naquele mês", () => {
    expect(pessoaNaFolhaEm("2026-08-10", "2026-08-25", "2026-08-01")).toBe(true);
    expect(pessoaNaFolhaEm("2026-08-10", "2026-08-25", "2026-07-01")).toBe(false);
    expect(pessoaNaFolhaEm("2026-08-10", "2026-08-25", "2026-09-01")).toBe(false);
  });

  it("o dia do mês não muda a resposta — a conta é de mês civil", () => {
    expect(pessoaNaFolhaEm("2026-08-31", null, "2026-08-01")).toBe(true);
    expect(pessoaNaFolhaEm("2026-08-01", null, "2026-08-01")).toBe(true);
  });

  it("devolve null quando não dá para decidir — e null não é false", () => {
    expect(pessoaNaFolhaEm("sei lá", null, "2026-08-01")).toBeNull();
    expect(pessoaNaFolhaEm("2026-01-01", "qualquer coisa", "2026-08-01")).toBeNull();
  });
});

describe("situacaoNaFolhaEm", () => {
  it("distingue as duas causas de não contar", () => {
    expect(pessoaNaFolhaEm("2026-09-01", null, "2026-08-01")).toBe(false);
    expect(situacaoNaFolhaEm("2026-09-01", null, "2026-08-01")).toBe("ainda-nao");

    expect(pessoaNaFolhaEm("2026-01-01", "2026-07-20", "2026-08-01")).toBe(false);
    expect(situacaoNaFolhaEm("2026-01-01", "2026-07-20", "2026-08-01")).toBe("terminou");
  });

  it("quem começa NESTE mês já conta — o mês do início não é 'ainda não'", () => {
    expect(situacaoNaFolhaEm("2026-08-20", null, "2026-08-01")).toBe("conta");
  });

  it("quem sai no meio do mês CONTA nele, como na vigência", () => {
    expect(situacaoNaFolhaEm("2026-01-01", "2026-08-20", "2026-08-01")).toBe("conta");
    expect(situacaoNaFolhaEm("2026-01-01", "2026-08-20", "2026-09-01")).toBe("terminou");
  });

  it("null quando não dá para decidir — e null não é 'terminou'", () => {
    expect(situacaoNaFolhaEm("sei lá", null, "2026-08-01")).toBeNull();
    expect(situacaoNaFolhaEm("2026-01-01", "qualquer coisa", "2026-08-01")).toBeNull();
  });

  it("🔴 a partição FECHA sobre a grade inteira, e 'conta' é exatamente a vigência", () => {
    let conta = 0;
    let aindaNao = 0;
    let terminou = 0;
    let divergencias = 0;

    varrerGrade((inicio, fim, ref) => {
      const situacao = situacaoNaFolhaEm(inicio, fim, ref);
      if (situacao === "conta") conta += 1;
      if (situacao === "ainda-nao") aindaNao += 1;
      if (situacao === "terminou") terminou += 1;
      if ((situacao === "conta") !== (pessoaNaFolhaEm(inicio, fim, ref) === true)) {
        divergencias += 1;
      }
    });

    expect(divergencias).toBe(0);
    expect(conta).toBe(2_646);
    expect(conta + aindaNao + terminou).toBe(10_368);
    expect(aindaNao).toBeGreaterThan(0);
    expect(terminou).toBeGreaterThan(0);
  });
});

describe("explicacaoDeParticipacaoSemLinha", () => {
  it("explica a linha órfã e cala na normal", () => {
    const orfa = pessoa({ id: null, pessoa: "Bruno", semLinhaDeFolha: true, custoFixo: 0 });
    expect(explicacaoDeParticipacaoSemLinha(orfa)).toContain("sem linha de folha");
    expect(explicacaoDeParticipacaoSemLinha(pessoa({ id: "a", pessoa: "Ana" }))).toBeNull();
  });
});

function pessoa(
  parcial: Partial<PessoaNaEquipe> & Pick<PessoaNaEquipe, "id" | "pessoa">,
): PessoaNaEquipe {
  const custoFixo = parcial.custoFixo ?? 1000;
  const custoVariavel = parcial.custoVariavel ?? 0;
  return {
    chave: parcial.id ?? "sem-linha",
    profileId: null,
    cargo: null,
    vinculo: "clt",
    bu: "demanda",
    custoMensal: custoFixo,
    beneficios: 0,
    custoFixo,
    custoVariavel,
    contratosComParticipacao: 0,
    custoTotal: custoFixo + custoVariavel,
    inicio: "2026-01-01",
    fim: null,
    ativa: true,
    semLinhaDeFolha: false,
    ...parcial,
  };
}

describe("agruparPorBu", () => {
  const custos: readonly CustoDeFolhaPorBu[] = [
    { bu: "demanda", custoFixo: 4200, pessoas: 2, mesReferencia: "2026-08-01" },
    { bu: "sistemas", custoFixo: 0, pessoas: 0, mesReferencia: "2026-08-01" },
    { bu: "compartilhado", custoFixo: 900, pessoas: 1, mesReferencia: "2026-08-01" },
  ];

  it("as três BUs aparecem sempre, mesmo vazias", () => {
    const grupos = agruparPorBu([], custos);
    expect(grupos.map((g) => g.bu)).toEqual(["demanda", "sistemas", "compartilhado"]);
    expect(grupos.every((g) => g.pessoas.length === 0)).toBe(true);
  });

  it("separa por BU sem perder ninguém", () => {
    const grupos = agruparPorBu(
      [
        pessoa({ id: "a", pessoa: "Ana", bu: "demanda" }),
        pessoa({ id: "b", pessoa: "Bruno", bu: "sistemas" }),
        pessoa({ id: "c", pessoa: "Carla", bu: "demanda" }),
      ],
      custos,
    );
    expect(grupos[0].pessoas.map((p) => p.id)).toEqual(["a", "c"]);
    expect(grupos[1].pessoas.map((p) => p.id)).toEqual(["b"]);
    expect(grupos[2].pessoas).toEqual([]);
  });

  it("🔴 o custo do grupo vem da RPC, NÃO da soma das pessoas visíveis", () => {
    const grupos = agruparPorBu(
      [
        pessoa({ id: "a", pessoa: "Ana", bu: "demanda", custoFixo: 1000 }),
        pessoa({ id: "c", pessoa: "Carla", bu: "demanda", custoFixo: 2000 }),
      ],
      custos,
    );
    expect(grupos[0].custoFixo).toBe(4200);
    expect(grupos[0].pessoasNoCusto).toBe(2);
    expect(grupos[0].pessoas).toHaveLength(2);
  });

  it("custo null quando a consulta não trouxe a BU — e null não é zero", () => {
    const grupos = agruparPorBu([], []);
    expect(grupos.every((g) => g.custoFixo === null)).toBe(true);
    expect(grupos.every((g) => g.pessoasNoCusto === null)).toBe(true);
  });
});

describe("fatiaVariavel", () => {
  it("proporção entre valores que o Postgres já entregou", () => {
    expect(
      fatiaVariavel(pessoa({ id: "x", pessoa: "X", custoFixo: 300, custoVariavel: 450 })),
    ).toBe(0.6);
    expect(fatiaVariavel(pessoa({ id: "y", pessoa: "Y", custoFixo: 1000, custoVariavel: 0 }))).toBe(
      0,
    );
  });

  it("🔴 null quando o total é zero — NaN numa barra afirmaria 'tudo fixo'", () => {
    expect(
      fatiaVariavel(pessoa({ id: "z", pessoa: "Z", custoFixo: 0, custoVariavel: 0 })),
    ).toBeNull();
  });
});

describe("avisoDePercentualSugerido", () => {
  it("🔴 comissionado recebe o aviso de que o percentual não é retroativo", () => {
    const aviso = avisoDePercentualSugerido("comissionado");
    expect(aviso).toContain("contratos novos");
    expect(aviso).toContain("preservam o percentual da assinatura");
  });

  it("os outros vínculos não recebem aviso nenhum", () => {
    for (const v of ["clt", "pj", "estagio", "freela", "socio"] as const) {
      expect(avisoDePercentualSugerido(v)).toBeNull();
    }
  });
});

describe("rótulos", () => {
  it("os seis vínculos têm nome de tela", () => {
    expect(Object.keys(ROTULO_DO_VINCULO)).toHaveLength(6);
    expect(ROTULO_DO_VINCULO.comissionado).toBe("Comissionado");
  });
});

describe("mes-civil continua respondendo pelos dois módulos", () => {
  it("é o mesmo primitivo que a F13 usa", () => {
    expect(indiceDoMes("2026-08-01")).toBe(2026 * 12 + 7);
    expect(primeiroDiaDoMes(2026 * 12 + 7)).toBe("2026-08-01");
  });
});
