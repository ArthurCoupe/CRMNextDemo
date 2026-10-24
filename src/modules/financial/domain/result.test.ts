import { describe, expect, it } from "vitest";

import {
  breakEvenEmClientes,
  conferirResultado,
  margemPct,
  progressoDaMeta,
  progressoParaBarra,
  ratearPorCaixa,
  rateioFecha,
  situacaoDoMes,
  TOLERANCIA_DA_MARGEM_PP,
  TOLERANCIA_DO_RATEIO,
  type ResultadoDaBu,
} from "./result";
import type { UnidadeDeNegocio } from "./expenses";

const CAIXA = new Map<UnidadeDeNegocio, number>([
  ["demanda", 6000],
  ["sistemas", 4000],
]);
const COMPARTILHADO = 4500;

const REFERENCIA: readonly ResultadoDaBu[] = [
  {
    bu: "demanda",
    receitaBruta: 6000,
    imposto: 0,
    taxas: 0,
    receitaLiquida: 6000,
    custoGastos: 1800,
    custoFolha: 0,
    custoParticipacao: 0,
    custoDireto: 1800,
    custoRateado: 2700,
    resultado: 1500,
    margemPct: 25,
    proporcaoPct: 60,
  },
  {
    bu: "sistemas",
    receitaBruta: 4000,
    imposto: 0,
    taxas: 0,
    receitaLiquida: 4000,
    custoGastos: 600,
    custoFolha: 0,
    custoParticipacao: 0,
    custoDireto: 600,
    custoRateado: 1800,
    resultado: 1600,
    margemPct: 40,
    proporcaoPct: 40,
  },
];

describe("cenário de referência do brief §5.4", () => {
  it("🔴 o rateio dá 2.700 e 1.800", () => {
    const rateado = ratearPorCaixa(COMPARTILHADO, CAIXA);
    expect(rateado.get("demanda")).toBe(2700);
    expect(rateado.get("sistemas")).toBe(1800);
  });

  it("🔴 o resultado dá 1.500 e 1.600, e o consolidado 3.100", () => {
    const rateado = ratearPorCaixa(COMPARTILHADO, CAIXA);
    const demanda = 6000 - 1800 - (rateado.get("demanda") ?? 0);
    const sistemas = 4000 - 600 - (rateado.get("sistemas") ?? 0);
    expect(demanda).toBe(1500);
    expect(sistemas).toBe(1600);
    expect(demanda + sistemas).toBe(3100);
  });

  it("🔴 a margem dá 25,0% e 40,0%, e a consolidada 31,0%", () => {
    expect(margemPct(1500, 6000)).toBe(25);
    expect(margemPct(1600, 4000)).toBe(40);
    expect(margemPct(3100, 10000)).toBe(31);
  });

  it("🔴 as parcelas do rateio somam o compartilhado inteiro", () => {
    expect(rateioFecha(REFERENCIA, COMPARTILHADO)).toBe(true);
  });

  it("🔴 e o banco concorda: nenhuma divergência no cenário do brief", () => {
    expect(conferirResultado(REFERENCIA, COMPARTILHADO)).toEqual([]);
  });
});

describe("conferirResultado", () => {
  it("🔴 acusa rateio errado vindo do banco", () => {
    const adulterada = REFERENCIA.map((l) =>
      l.bu === "demanda" ? { ...l, custoRateado: 2250 } : l,
    );
    const divergencias = conferirResultado(adulterada, COMPARTILHADO);
    expect(divergencias.map((d) => d.grandeza)).toContain("rateio");
    expect(divergencias.find((d) => d.grandeza === "rateio")?.recalculado).toBe(2700);
  });

  it("🔴 acusa resultado que não fecha com as próprias parcelas", () => {
    const adulterada = REFERENCIA.map((l) => (l.bu === "sistemas" ? { ...l, resultado: 9999 } : l));
    const divergencias = conferirResultado(adulterada, COMPARTILHADO);
    expect(divergencias.some((d) => d.grandeza === "resultado" && d.bu === "sistemas")).toBe(true);
  });

  it("🔴 acusa margem que não corresponde ao resultado exibido", () => {
    const adulterada = REFERENCIA.map((l) => (l.bu === "demanda" ? { ...l, margemPct: 90 } : l));
    const divergencias = conferirResultado(adulterada, COMPARTILHADO);
    expect(divergencias.some((d) => d.grandeza === "margem" && d.doBanco === 90)).toBe(true);
  });

  it("o rateio NÃO fecha quando falta parcela, e a função diz", () => {
    const faltando = REFERENCIA.map((l) => (l.bu === "sistemas" ? { ...l, custoRateado: 0 } : l));
    expect(rateioFecha(faltando, COMPARTILHADO)).toBe(false);
  });
});

const MES_DO_BUG: readonly ResultadoDaBu[] = [
  {
    bu: "demanda",
    receitaBruta: 1024,
    imposto: 0,
    taxas: 0,
    receitaLiquida: 1024,
    custoGastos: 3315.2,
    custoFolha: 0,
    custoParticipacao: 0,
    custoDireto: 3315.2,
    custoRateado: 0,
    resultado: -2291.2,
    margemPct: -223.8,
    proporcaoPct: 100,
  },
];

describe("conferirResultado — FIN-9, tolerância de ponto flutuante", () => {
  it("🔴 −223,8 do banco contra −223,7 recalculado NÃO é divergência", () => {
    expect(margemPct(-2291.2, 1024)).toBe(-223.7);
    expect(conferirResultado(MES_DO_BUG, 0)).toEqual([]);
  });

  it("as constantes são as da régua: 0,1 p.p. na margem e R$ 0,01 no rateio", () => {
    expect(TOLERANCIA_DA_MARGEM_PP).toBe(0.1);
    expect(TOLERANCIA_DO_RATEIO).toBe(0.01);
  });

  it("0,2 p.p. de diferença na margem continua acusada", () => {
    const adulterada = MES_DO_BUG.map((l) => ({ ...l, margemPct: -223.9 }));
    const divergencias = conferirResultado(adulterada, 0);
    expect(divergencias.map((d) => d.grandeza)).toEqual(["margem"]);
  });

  it("margem nula de um lado só continua acusada — a tolerância não engole o null", () => {
    const adulterada = MES_DO_BUG.map((l) => ({ ...l, margemPct: null }));
    expect(conferirResultado(adulterada, 0).map((d) => d.grandeza)).toEqual(["margem"]);
  });

  it("um centavo de rateio passa; dois centavos acusam", () => {
    const umCentavo = REFERENCIA.map((l) =>
      l.bu === "demanda" ? { ...l, custoRateado: 2699.99 } : l,
    );
    expect(conferirResultado(umCentavo, COMPARTILHADO).map((d) => d.grandeza)).toEqual([]);

    const doisCentavos = REFERENCIA.map((l) =>
      l.bu === "demanda" ? { ...l, custoRateado: 2700.02 } : l,
    );
    expect(conferirResultado(doisCentavos, COMPARTILHADO).map((d) => d.grandeza)).toEqual([
      "rateio",
    ]);
  });
});

describe("rateioFecha — FIN-7", () => {
  it("🔴 sem caixa em frente nenhuma, fecha — mesma regra de fn_result_by_unit `when ct.total = 0 then 0`", () => {
    const semCaixa: readonly ResultadoDaBu[] = REFERENCIA.map((l) => ({
      ...l,
      receitaBruta: 0,
      custoRateado: 0,
    }));
    expect(rateioFecha(semCaixa, 7170)).toBe(true);
  });

  it("caixa positivo e rateio zerado continua ACUSANDO — a regra é só para caixa total zero", () => {
    const comCaixaMasZerado = REFERENCIA.map((l) =>
      l.bu === "sistemas" ? { ...l, custoRateado: 0 } : l,
    );
    expect(rateioFecha(comCaixaMasZerado, COMPARTILHADO)).toBe(false);
  });
});

describe("ratearPorCaixa", () => {
  it("🔴 sem caixa em frente nenhuma, o rateio é ZERO — não é meio a meio", () => {
    const semCaixa = new Map<UnidadeDeNegocio, number>([
      ["demanda", 0],
      ["sistemas", 0],
    ]);
    const rateado = ratearPorCaixa(4500, semCaixa);
    expect(rateado.get("demanda")).toBe(0);
    expect(rateado.get("sistemas")).toBe(0);
  });

  it("uma frente sozinha leva o compartilhado inteiro", () => {
    const so = new Map<UnidadeDeNegocio, number>([
      ["demanda", 5000],
      ["sistemas", 0],
    ]);
    const rateado = ratearPorCaixa(4500, so);
    expect(rateado.get("demanda")).toBe(4500);
    expect(rateado.get("sistemas")).toBe(0);
  });

  it("dízima arredonda em duas casas, como o Postgres", () => {
    const caixa = new Map<UnidadeDeNegocio, number>([
      ["demanda", 1000],
      ["sistemas", 2000],
    ]);
    const rateado = ratearPorCaixa(3000, caixa);
    expect(rateado.get("demanda")).toBe(1000);
    expect(rateado.get("sistemas")).toBe(2000);

    const caixaTorta = new Map<UnidadeDeNegocio, number>([
      ["demanda", 1000],
      ["sistemas", 2000],
    ]);
    const tortos = ratearPorCaixa(1000, caixaTorta);
    expect(tortos.get("demanda")).toBe(333.33);
    expect(tortos.get("sistemas")).toBe(666.67);
  });
});

describe("margemPct", () => {
  it("🔴 null quando não há receita líquida — 0% afirmaria que empatou", () => {
    expect(margemPct(-500, 0)).toBeNull();
    expect(margemPct(0, 0)).toBeNull();
  });

  it("margem negativa é margem, e uma casa decimal", () => {
    expect(margemPct(-15872.5, 940)).toBe(-1688.6);
  });
});

describe("breakEvenEmClientes", () => {
  it("🔴 arredonda para CIMA — 3,2 clientes não fecha a conta com três", () => {
    expect(breakEvenEmClientes(16000, 5000)).toBe(4);
    expect(breakEvenEmClientes(15000, 5000)).toBe(3);
  });

  it("null sem ticket médio — sem ele a resposta seria infinita", () => {
    expect(breakEvenEmClientes(16000, 0)).toBeNull();
  });

  it("custo fixo zerado não precisa de cliente nenhum", () => {
    expect(breakEvenEmClientes(0, 5000)).toBe(0);
  });
});

describe("progressoDaMeta", () => {
  it("proporção simples, e null sem meta", () => {
    expect(progressoDaMeta(8000, 16000)).toBe(0.5);
    expect(progressoDaMeta(8000, 0)).toBeNull();
  });
});

describe("progressoParaBarra", () => {
  it("calcula percentual e quanto falta", () => {
    expect(progressoParaBarra(12000, 16000)).toEqual({ percentual: 75, falta: 4000 });
  });

  it("meta batida trava em 100 e falta zero", () => {
    expect(progressoParaBarra(20000, 16000)).toEqual({ percentual: 100, falta: 0 });
  });

  it("🔴 meta NAO definida devolve null, nunca 0%", () => {
    expect(progressoParaBarra(12000, null)).toBeNull();
  });

  it("🔴 meta ZERO devolve null — divisao por zero nao vira Infinity na tela", () => {
    expect(progressoParaBarra(12000, 0)).toBeNull();
  });

  it("atual zero com meta definida e 0%, e isso e verdade", () => {
    expect(progressoParaBarra(0, 16000)).toEqual({ percentual: 0, falta: 16000 });
  });

  it("🔴 atual NEGATIVO trava em 0%, nao vira width negativo", () => {
    expect(progressoParaBarra(-5000, 16000)).toEqual({ percentual: 0, falta: 21000 });
  });
});

describe("situacaoDoMes", () => {
  it("🔴 o mês corrente é PARCIAL, e o futuro também", () => {
    expect(situacaoDoMes("2026-08-01", "2026-08-01", false)).toBe("parcial");
    expect(situacaoDoMes("2026-09-01", "2026-08-01", false)).toBe("parcial");
  });

  it("🔴 mês passado COM snapshot é congelado; SEM snapshot é reconstruído", () => {
    expect(situacaoDoMes("2026-07-01", "2026-08-01", true)).toBe("congelado");
    expect(situacaoDoMes("2026-07-01", "2026-08-01", false)).toBe("reconstruido");
  });

  it("congelado e reconstruído não são a mesma coisa com nome diferente", () => {
    expect(situacaoDoMes("2026-03-01", "2026-08-01", true)).not.toBe(
      situacaoDoMes("2026-03-01", "2026-08-01", false),
    );
  });
});
