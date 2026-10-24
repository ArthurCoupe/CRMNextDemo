import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  despesaCorreEm,
  despesaEncerradaEm,
  fimParaGravar,
  indiceDoMes,
  interpretarValorEmReais,
  mesEAno,
  mesesDesde,
  montarArvore,
  parcelasParaGravar,
  parcelasPagasAte,
  parcelasRestantes,
  proximaQueda,
  recorrenciaParaGravar,
  ultimaParcelaEm,
  type DespesaEfetiva,
  type MesDeQueda,
  type RecorrenciaDeDespesa,
} from "./expenses";

const PRIMEIRO_MES = 2024 * 12 + 0;
const MESES_DE_INICIO = 36;
const MESES_DE_REFERENCIA = 36;

const COMBOS: readonly { rec: RecorrenciaDeDespesa; inst: number | null }[] = [
  { rec: "mensal", inst: null },
  { rec: "pontual", inst: null },
  ...Array.from({ length: 12 }, (_, i) => ({ rec: "parcelado" as const, inst: i + 1 })),
];

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

function md5(texto: string): string {
  return createHash("md5").update(texto, "utf8").digest("hex");
}

function varrerGrade(
  visitar: (inicio: string, ref: string, rec: RecorrenciaDeDespesa, inst: number | null) => void,
) {
  for (let s = 0; s < MESES_DE_INICIO; s += 1) {
    for (let r = 0; r < MESES_DE_REFERENCIA; r += 1) {
      const ref = dataDoIndice(PRIMEIRO_MES + r, false);
      for (const ultimoDia of [false, true]) {
        const inicio = dataDoIndice(PRIMEIRO_MES + s, ultimoDia);
        for (const combo of COMBOS) {
          visitar(inicio, ref, combo.rec, combo.inst);
        }
      }
    }
  }
}

describe("paridade com o Postgres, por varredura da grade inteira", () => {
  it("a grade tem 36.288 casos, todos distintos, e cobre o dia 31", () => {
    const vistos = new Set<string>();
    const inicios = new Set<string>();
    varrerGrade((inicio, ref, rec, inst) => {
      vistos.add(`${inicio}|${ref}|${rec}|${inst}`);
      inicios.add(inicio);
    });
    expect(vistos.size).toBe(36_288);
    expect(inicios.size).toBe(72);
    expect([...inicios].some((d) => d.endsWith("-31"))).toBe(true);
    expect([...inicios].some((d) => d.endsWith("-29"))).toBe(true);
  });

  it("fn_despesa_corre_em", () => {
    const bits: string[] = [];
    varrerGrade((inicio, ref, rec, inst) => {
      bits.push(
        despesaCorreEm({ recorrencia: rec, inicio, fim: null, parcelasTotal: inst }, ref) === true
          ? "1"
          : "0",
      );
    });
    expect(bits.filter((b) => b === "1")).toHaveLength(6_448);
    expect(md5(bits.join(""))).toBe("04df60f58abca3e8ea76624b329396e6");
  });

  it("fn_despesa_encerrada_em", () => {
    const bits: string[] = [];
    varrerGrade((inicio, ref, rec, inst) => {
      bits.push(
        despesaEncerradaEm({ recorrencia: rec, inicio, fim: null, parcelasTotal: inst }, ref) ===
          true
          ? "1"
          : "0",
      );
    });
    expect(md5(bits.join(""))).toBe("d4fb0a8c10268d57a88eb24d60a8260e");
  });

  it("🔴 encerrada ⇒ não corre, sobre a grade inteira", () => {
    let violacoes = 0;
    let aindaNaoComecaram = 0;
    varrerGrade((inicio, ref, rec, inst) => {
      const base = { recorrencia: rec, inicio, fim: null, parcelasTotal: inst };
      const corre = despesaCorreEm(base, ref);
      const encerrada = despesaEncerradaEm(base, ref);
      if (encerrada === true && corre === true) violacoes += 1;
      if (corre === false && encerrada === false) aindaNaoComecaram += 1;
    });
    expect(violacoes).toBe(0);
    expect(aindaNaoComecaram).toBeGreaterThan(0);
  });

  it("fn_parcelas_pagas_ate", () => {
    const valores: string[] = [];
    varrerGrade((inicio, ref, _rec, inst) => {
      valores.push(String(parcelasPagasAte(inicio, inst, ref) ?? "x"));
    });
    expect(md5(valores.join(","))).toBe("102e4de1efbb02fdeae7251343ee37a4");
  });

  it("fn_ultima_parcela_em", () => {
    const valores: string[] = [];
    varrerGrade((inicio, _ref, _rec, inst) => {
      valores.push(ultimaParcelaEm(inicio, inst) ?? "x");
    });
    expect(md5(valores.join(","))).toBe("62afbca5aa63c92ab4c7b79b2a704e6d");
  });

  it("a divergência com o SQL para `parcelado` sem número de parcelas é DECLARADA", () => {
    const base = {
      recorrencia: "parcelado" as const,
      inicio: "2026-08-01",
      fim: null,
      parcelasTotal: null,
    };
    expect(despesaCorreEm(base, "2026-08-01")).toBeNull();
    expect(despesaEncerradaEm(base, "2026-08-01")).toBeNull();
  });
});

describe("interpretarValorEmReais", () => {
  it("🔴 ponto como separador DECIMAL não é mais engolido", () => {
    expect(interpretarValorEmReais("1500.00")).toBe(1500);
    expect(interpretarValorEmReais("670.50")).toBe(670.5);
    expect(interpretarValorEmReais("670.5")).toBe(670.5);
    expect(interpretarValorEmReais("0.5")).toBe(0.5);
  });

  it("formato pt-BR continua certo", () => {
    expect(interpretarValorEmReais("1500,00")).toBe(1500);
    expect(interpretarValorEmReais("1.500,00")).toBe(1500);
    expect(interpretarValorEmReais("1.234.567,89")).toBe(1234567.89);
    expect(interpretarValorEmReais("521,00")).toBe(521);
    expect(interpretarValorEmReais("3.000,50")).toBe(3000.5);
  });

  it("formato en-US com milhar também", () => {
    expect(interpretarValorEmReais("1,500.00")).toBe(1500);
    expect(interpretarValorEmReais("1,234,567.89")).toBe(1234567.89);
  });

  it("separador sozinho com 3 dígitos é MILHAR — 1.500 é mil e quinhentos", () => {
    expect(interpretarValorEmReais("1.500")).toBe(1500);
    expect(interpretarValorEmReais("1,500")).toBe(1500);
    expect(interpretarValorEmReais("1.500.000")).toBe(1500000);
    expect(interpretarValorEmReais("999.999.999")).toBe(999999999);
  });

  it("🔴 milhar exige agrupamento VÁLIDO, não só 3 dígitos", () => {
    expect(interpretarValorEmReais("0,750")).toBeNull();
    expect(interpretarValorEmReais("0.750")).toBeNull();
    expect(interpretarValorEmReais("1234.567")).toBeNull();
    expect(interpretarValorEmReais("1.500,000")).toBeNull();
  });

  it("🔴 dois separadores decimais é recusa, não R$ 12,30", () => {
    expect(interpretarValorEmReais("1,2,3")).toBeNull();
    expect(interpretarValorEmReais("1.2.3")).toBeNull();
    expect(interpretarValorEmReais("1,,2")).toBeNull();
    expect(interpretarValorEmReais("1.2,3")).toBeNull();
    expect(interpretarValorEmReais("1.234,56")).toBe(1234.56);
    expect(interpretarValorEmReais("1,23")).toBe(1.23);
  });

  it("🔴 o agrupador não pode ser o próprio separador decimal", () => {
    expect(interpretarValorEmReais("1.234.56")).toBeNull();
    expect(interpretarValorEmReais("1,234,56")).toBeNull();
    expect(interpretarValorEmReais("1.234.567,89")).toBe(1234567.89);
    expect(interpretarValorEmReais("1,234,567.89")).toBe(1234567.89);
  });

  it("separador na ponta é recusa dos dois lados", () => {
    expect(interpretarValorEmReais(",5")).toBeNull();
    expect(interpretarValorEmReais("5,")).toBeNull();
    expect(interpretarValorEmReais(".5")).toBeNull();
    expect(interpretarValorEmReais("0,5")).toBe(0.5);
    expect(interpretarValorEmReais("5,0")).toBe(5);
  });

  it("campo vazio devolve null, não 0 — a lição da F12", () => {
    expect(interpretarValorEmReais("")).toBeNull();
    expect(interpretarValorEmReais("   ")).toBeNull();
  });

  it("zero digitado é decisão e passa", () => {
    expect(interpretarValorEmReais("0")).toBe(0);
    expect(interpretarValorEmReais("0,00")).toBe(0);
  });

  it("recusa o que não é dinheiro em vez de adivinhar", () => {
    expect(interpretarValorEmReais("-10")).toBeNull();
    expect(interpretarValorEmReais("mil reais")).toBeNull();
    expect(interpretarValorEmReais("R$ 670,50")).toBeNull();
    expect(interpretarValorEmReais("1500,")).toBeNull();
    expect(interpretarValorEmReais("1.5000")).toBeNull();
    expect(interpretarValorEmReais(",50")).toBeNull();
    expect(interpretarValorEmReais("1 500")).toBeNull();
  });

  it("não perde centavo em valor grande", () => {
    expect(interpretarValorEmReais("9.999.999,99")).toBe(9999999.99);
    expect(interpretarValorEmReais("0,01")).toBe(0.01);
  });
});

describe("o domínio decide o payload, não o rascunho", () => {
  it("parcelasParaGravar: só parcelado grava o número", () => {
    expect(parcelasParaGravar("parcelado", 8)).toBe(8);
    expect(parcelasParaGravar("mensal", 8)).toBeNull();
    expect(parcelasParaGravar("pontual", 8)).toBeNull();
  });

  it("🔴 fimParaGravar: só mensal grava a data de fim", () => {
    expect(fimParaGravar("mensal", "2026-10-31")).toBe("2026-10-31");
    expect(fimParaGravar("parcelado", "2026-10-31")).toBeNull();
    expect(fimParaGravar("pontual", "2026-10-31")).toBeNull();
    expect(fimParaGravar("mensal", null)).toBeNull();
  });

  it("🔴 recorrenciaParaGravar: agrupador é sempre mensal", () => {
    expect(recorrenciaParaGravar(true, "parcelado")).toBe("mensal");
    expect(recorrenciaParaGravar(true, "pontual")).toBe("mensal");
    expect(recorrenciaParaGravar(true, "mensal")).toBe("mensal");
    expect(recorrenciaParaGravar(false, "parcelado")).toBe("parcelado");
    expect(recorrenciaParaGravar(false, "pontual")).toBe("pontual");
  });

  it("os três compõem: agrupador não leva parcela nem fim", () => {
    const rec = recorrenciaParaGravar(true, "parcelado");
    expect(parcelasParaGravar(rec, 8)).toBeNull();
    expect(fimParaGravar(rec, "2026-12-31")).toBe("2026-12-31");
  });
});

describe("mês civil, sem passar por Date", () => {
  it("lê ano e mês da string ISO", () => {
    expect(indiceDoMes("2026-08-01")).toBe(2026 * 12 + 7);
    expect(mesEAno("2027-03-01")).toBe("03/2027");
  });

  it("devolve null para texto que não é data", () => {
    expect(indiceDoMes("")).toBeNull();
    expect(indiceDoMes("agosto")).toBeNull();
    expect(indiceDoMes("2026-13-01")).toBeNull();
    expect(mesEAno("2026/08/01")).toBeNull();
  });

  it("o dia 1º de agosto é AGOSTO — o bug que `new Date` causaria em São Paulo", () => {
    expect(mesEAno("2026-08-01")).toBe("08/2026");
  });

  it("conta meses civis, não dias por 30", () => {
    expect(mesesDesde("2026-01-31", "2026-02-01")).toBe(1);
    expect(mesesDesde("2026-08-01", "2026-08-31")).toBe(0);
    expect(mesesDesde("2026-08-01", "2026-07-01")).toBe(-1);
  });
});

describe("vigência por recorrência", () => {
  const emAgosto = "2026-08-01";

  it("mensal corre indefinidamente a partir do início", () => {
    const base = {
      recorrencia: "mensal" as const,
      inicio: "2026-01-01",
      fim: null,
      parcelasTotal: null,
    };
    expect(despesaCorreEm(base, emAgosto)).toBe(true);
    expect(despesaCorreEm(base, "2030-12-01")).toBe(true);
    expect(despesaEncerradaEm(base, "2030-12-01")).toBe(false);
  });

  it("mensal para no mês do fim declarado, inclusive", () => {
    const base = {
      recorrencia: "mensal" as const,
      inicio: "2026-01-01",
      fim: "2026-08-20",
      parcelasTotal: null,
    };
    expect(despesaCorreEm(base, emAgosto)).toBe(true);
    expect(despesaCorreEm(base, "2026-09-01")).toBe(false);
    expect(despesaEncerradaEm(base, "2026-09-01")).toBe(true);
  });

  it("🔴 pontual corre SÓ no mês do início", () => {
    const base = {
      recorrencia: "pontual" as const,
      inicio: emAgosto,
      fim: null,
      parcelasTotal: null,
    };
    expect(despesaCorreEm(base, emAgosto)).toBe(true);
    expect(despesaCorreEm(base, "2026-09-01")).toBe(false);
    expect(despesaCorreEm(base, "2026-07-01")).toBe(false);
  });

  it("parcelado corre exatamente installments_total meses", () => {
    const base = {
      recorrencia: "parcelado" as const,
      inicio: emAgosto,
      fim: null,
      parcelasTotal: 8,
    };
    expect(despesaCorreEm(base, emAgosto)).toBe(true);
    expect(despesaCorreEm(base, "2027-03-01")).toBe(true);
    expect(despesaCorreEm(base, "2027-04-01")).toBe(false);
    expect(despesaEncerradaEm(base, "2027-04-01")).toBe(true);
  });

  it("🔴 o que ainda não começou NÃO está encerrado — o defeito crítico do job", () => {
    const base = {
      recorrencia: "parcelado" as const,
      inicio: "2026-09-01",
      fim: null,
      parcelasTotal: 6,
    };
    expect(despesaCorreEm(base, emAgosto)).toBe(false);
    expect(despesaEncerradaEm(base, emAgosto)).toBe(false);
  });

  it("devolve null quando não dá para decidir — e null não é false", () => {
    expect(
      despesaCorreEm(
        { recorrencia: "parcelado", inicio: "2026-08-01", fim: null, parcelasTotal: null },
        "2026-08-01",
      ),
    ).toBeNull();
    expect(
      despesaCorreEm(
        { recorrencia: "mensal", inicio: "sei lá", fim: null, parcelasTotal: null },
        "2026-08-01",
      ),
    ).toBeNull();
  });
});

describe("contagem de parcelas", () => {
  it("no mês do início uma parcela já correu", () => {
    expect(parcelasPagasAte("2026-08-01", 8, "2026-08-01")).toBe(1);
    expect(parcelasRestantes("2026-08-01", 8, "2026-08-01")).toBe(7);
  });

  it("não passa do total nem fica negativa", () => {
    expect(parcelasPagasAte("2026-08-01", 8, "2030-01-01")).toBe(8);
    expect(parcelasPagasAte("2026-08-01", 8, "2020-01-01")).toBe(0);
    expect(parcelasRestantes("2026-08-01", 8, "2030-01-01")).toBe(0);
  });

  it("8× começando em 08/2026 termina em 03/2027", () => {
    expect(ultimaParcelaEm("2026-08-01", 8)).toBe("2027-03-01");
  });

  it("o dia do início não muda o mês do fim", () => {
    expect(ultimaParcelaEm("2026-01-31", 2)).toBe("2026-02-01");
    expect(ultimaParcelaEm("2026-01-01", 2)).toBe("2026-02-01");
  });

  it("vira o ano corretamente", () => {
    expect(ultimaParcelaEm("2026-12-01", 3)).toBe("2027-02-01");
  });

  it("null quando não é parcelado", () => {
    expect(ultimaParcelaEm("2026-08-01", null)).toBeNull();
    expect(parcelasRestantes("2026-08-01", null, "2026-08-01")).toBeNull();
  });
});

function despesa(
  parcial: Partial<DespesaEfetiva> & Pick<DespesaEfetiva, "id" | "descricao" | "valor">,
): DespesaEfetiva {
  return {
    categoria: "estrutural",
    bu: "compartilhado",
    recorrencia: "mensal",
    fornecedor: null,
    meioDePagamento: null,
    agrupadorId: null,
    agrupador: null,
    totalDoAgrupador: null,
    parcelasTotal: null,
    parcelasPagas: null,
    parcelasRestantes: null,
    ultimaParcelaEm: null,
    inicio: "2026-01-01",
    fim: null,
    mesReferencia: "2026-08-01",
    ...parcial,
  };
}

describe("montarArvore", () => {
  it("separa agrupados de soltas, um nível só", () => {
    const arvore = montarArvore([
      despesa({ id: "aluguel", descricao: "Aluguel", valor: 3000 }),
      despesa({
        id: "ia",
        descricao: "IA",
        valor: 670,
        agrupadorId: "cartao",
        agrupador: "Cartão",
        totalDoAgrupador: 1191,
      }),
    ]);
    expect(arvore.agrupadores).toHaveLength(1);
    expect(arvore.agrupadores[0].filhos.map((f) => f.id)).toEqual(["ia"]);
    expect(arvore.soltas.map((s) => s.id)).toEqual(["aluguel"]);
  });

  it("🔴 o subtotal vem da view e NÃO é a soma dos filhos visíveis", () => {
    const arvore = montarArvore([
      despesa({
        id: "ia",
        descricao: "IA",
        valor: 670,
        bu: "demanda",
        agrupadorId: "cartao",
        agrupador: "Cartão",
        totalDoAgrupador: 1191,
      }),
    ]);
    expect(arvore.agrupadores[0].total).toBe(1191);
    expect(arvore.agrupadores[0].filhos).toHaveLength(1);
    expect(arvore.agrupadores[0].filhos[0].valor).toBe(670);
  });

  it("dois agrupadores distintos não se misturam", () => {
    const arvore = montarArvore([
      despesa({
        id: "a1",
        descricao: "IA",
        valor: 670,
        agrupadorId: "cartao",
        agrupador: "Cartão",
        totalDoAgrupador: 670,
      }),
      despesa({
        id: "b1",
        descricao: "Nuvem",
        valor: 900,
        agrupadorId: "cartao2",
        agrupador: "Cartão 2",
        totalDoAgrupador: 900,
      }),
      despesa({
        id: "a2",
        descricao: "Design",
        valor: 300,
        agrupadorId: "cartao",
        agrupador: "Cartão",
        totalDoAgrupador: 670,
      }),
    ]);
    expect(arvore.agrupadores).toHaveLength(2);
    expect(arvore.agrupadores.map((a) => a.id)).toEqual(["cartao2", "cartao"]);
    expect(arvore.agrupadores.find((a) => a.id === "cartao")?.filhos.map((f) => f.id)).toEqual([
      "a1",
      "a2",
    ]);
    expect(arvore.agrupadores.find((a) => a.id === "cartao2")?.filhos.map((f) => f.id)).toEqual([
      "b1",
    ]);
  });

  it("agrupador sem total vai para o fim, em vez de virar zero e parecer barato", () => {
    const arvore = montarArvore([
      despesa({
        id: "x",
        descricao: "sem total",
        valor: 10,
        agrupadorId: "outro",
        agrupador: "Cartão Secundário",
        totalDoAgrupador: null,
      }),
      despesa({
        id: "y",
        descricao: "com total",
        valor: 10,
        agrupadorId: "cartao",
        agrupador: "Cartão",
        totalDoAgrupador: 1,
      }),
    ]);
    expect(arvore.agrupadores.map((a) => a.id)).toEqual(["cartao", "outro"]);
  });

  it("lista sem agrupador nenhum devolve árvore vazia de agrupadores", () => {
    const arvore = montarArvore([despesa({ id: "a", descricao: "Aluguel", valor: 3000 })]);
    expect(arvore.agrupadores).toEqual([]);
    expect(arvore.soltas).toHaveLength(1);
  });
});

describe("proximaQueda", () => {
  const mes = (parcial: Partial<MesDeQueda> & Pick<MesDeQueda, "mesFim">): MesDeQueda => ({
    valorQueSai: 100,
    despesas: 1,
    custoNoMesDoFim: 1000,
    custoDepois: 900,
    ...parcial,
  });

  it("escolhe o término mais próximo e confirma a queda", () => {
    const q = proximaQueda([
      mes({ mesFim: "2027-03-01", valorQueSai: 521, custoNoMesDoFim: 4191, custoDepois: 3670 }),
      mes({ mesFim: "2027-09-01" }),
    ]);
    expect(q?.ultimoMes).toBe("2027-03-01");
    expect(q?.valorQueSai).toBe(521);
    expect(q?.custoDepois).toBe(3670);
    expect(q?.caiuDeFato).toBe(true);
  });

  it("🔴 quando o mês seguinte custa MAIS, caiuDeFato é false", () => {
    const q = proximaQueda([
      mes({ mesFim: "2027-02-01", valorQueSai: 800, custoNoMesDoFim: 1470, custoDepois: 4670 }),
    ]);
    expect(q?.caiuDeFato).toBe(false);
    expect(q?.custoNoMesDoFim).toBe(1470);
    expect(q?.custoDepois).toBe(4670);
  });

  it("🔴 fora da janela de 12 meses, caiuDeFato é null — não false", () => {
    const q = proximaQueda([
      mes({ mesFim: "2029-07-01", valorQueSai: 300, custoNoMesDoFim: null, custoDepois: null }),
    ]);
    expect(q?.valorQueSai).toBe(300);
    expect(q?.caiuDeFato).toBeNull();
  });

  it("não soma nada: o valor vem como a view entregou", () => {
    const q = proximaQueda([mes({ mesFim: "2027-03-01", valorQueSai: 621.55 })]);
    expect(q?.valorQueSai).toBe(621.55);
  });

  it("🔴 custo IGUAL não é queda — a fronteira que um `<=` atravessaria", () => {
    const q = proximaQueda([
      mes({ mesFim: "2027-02-01", valorQueSai: 500, custoNoMesDoFim: 3000, custoDepois: 3000 }),
    ]);
    expect(q?.caiuDeFato).toBe(false);
  });

  it("sem parcelamento em aberto não há card", () => {
    expect(proximaQueda([])).toBeNull();
  });

  it("ignora mês com data inválida em vez de escolhê-lo", () => {
    const q = proximaQueda([mes({ mesFim: "sei lá" }), mes({ mesFim: "2027-05-01" })]);
    expect(q?.ultimoMes).toBe("2027-05-01");
  });
});
