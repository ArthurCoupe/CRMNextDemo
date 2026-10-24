import { describe, expect, it } from "vitest";

import {
  atingiuOAlerta,
  custoMensalDaParticipacao,
  custoMensalTotal,
  excedeOTeto,
  geraCustoAgora,
  mensagemDeTetoExcedido,
  padroesExcedemOTeto,
  podeAplicarPadraoDaBu,
  problemaNoLimiarDeAlerta,
  problemaNoPercentualDoPadrao,
  problemasDasParticipacoes,
  recusaDoTetoDoPadrao,
  somaDaProducaoPadrao,
  somaDasParticipacoes,
  TETO_DE_PARTICIPACAO,
  type BaseDeCusto,
  type PadraoParaSoma,
  type Participacao,
} from "./shares";

const participacao = (tipo: Participacao["tipo"], percentual: number): Participacao => ({
  perfilId: "00000000-0000-4000-8000-000000000001",
  nomeExterno: null,
  tipo,
  percentual,
});

const MRR_2000: BaseDeCusto = {
  tipo: "mrr",
  valorMensal: 2000,
  valorTotal: null,
  mesesDeCobranca: null,
  comissionavel: true,
  status: "active",
  cobrancaAtiva: true,
};

const TCV_30000_EM_10: BaseDeCusto = {
  tipo: "tcv",
  valorMensal: null,
  valorTotal: 30000,
  mesesDeCobranca: 10,
  comissionavel: true,
  status: "active",
  cobrancaAtiva: true,
};

describe("custoMensalDaParticipacao — o cenário de referência da fase", () => {
  it("MRR R$ 2.000 com produção de 15% custa R$ 300,00/mês", () => {
    expect(custoMensalDaParticipacao(MRR_2000, 15)).toBe(300);
  });

  it("TCV usa billing_months, NUNCA duration_months (§4.3)", () => {
    expect(custoMensalDaParticipacao(TCV_30000_EM_10, 15)).toBe(450);
  });

  it("centavos não escorregam por ponto flutuante", () => {
    const combo: BaseDeCusto = { ...MRR_2000, valorMensal: 3193 };
    expect(custoMensalDaParticipacao(combo, 15)).toBe(478.95);
  });

  it("arredonda ao centavo, e não trunca", () => {
    const base: BaseDeCusto = { ...TCV_30000_EM_10, valorTotal: 1000, mesesDeCobranca: 3 };
    expect(custoMensalDaParticipacao(base, 10)).toBe(33.33);
  });
});

describe("custoMensalDaParticipacao — paridade com private.v_share_cost (FIN-10)", () => {
  it("TCV 10.000,01 em 2 meses, 50% → 2.500,00 (o cenário do bug)", () => {
    const base: BaseDeCusto = { ...TCV_30000_EM_10, valorTotal: 10000.01, mesesDeCobranca: 2 };
    expect(custoMensalDaParticipacao(base, 50)).toBe(2500);
  });

  it("MRR 3.193,00, 15% → 478,95", () => {
    expect(custoMensalDaParticipacao({ ...MRR_2000, valorMensal: 3193 }, 15)).toBe(478.95);
  });

  it("TCV 1.000,01 em 3 meses, 33% → 110,00 (dízima no meio da conta)", () => {
    const base: BaseDeCusto = { ...TCV_30000_EM_10, valorTotal: 1000.01, mesesDeCobranca: 3 };
    expect(custoMensalDaParticipacao(base, 33)).toBe(110);
  });

  it("MRR 1.450,00, 12,29% → 178,21 (meio centavo exato: a view arredonda para cima)", () => {
    expect(custoMensalDaParticipacao({ ...MRR_2000, valorMensal: 1450 }, 12.29)).toBe(178.21);
  });

  it("TCV 10.000,12 em 3 meses, 37,5% → 1.250,02 (dízima antes do percentual: a ordem importa)", () => {
    const base: BaseDeCusto = { ...TCV_30000_EM_10, valorTotal: 10000.12, mesesDeCobranca: 3 };
    expect(custoMensalDaParticipacao(base, 37.5)).toBe(1250.02);
  });
});

describe("custoMensalDaParticipacao — zero e 'não dá para saber' são coisas diferentes", () => {
  it("contrato não comissionável custa ZERO, não desconhecido", () => {
    expect(custoMensalDaParticipacao({ ...MRR_2000, comissionavel: false }, 15)).toBe(0);
  });

  it("descarta cancelled e cobrança suspensa: o predicado de LISTAGEM (FIN-1)", () => {
    expect(custoMensalDaParticipacao({ ...MRR_2000, status: "cancelled" }, 15)).toBe(0);
    expect(custoMensalDaParticipacao({ ...MRR_2000, cobrancaAtiva: false }, 15)).toBe(0);

    expect(custoMensalDaParticipacao({ ...MRR_2000, status: "finished" }, 15)).toBe(300);
  });

  it("geraCustoAgora nomeia a condição em vez de escondê-la num if", () => {
    expect(geraCustoAgora(MRR_2000)).toBe(true);
    expect(geraCustoAgora({ ...MRR_2000, status: "cancelled" })).toBe(false);
    expect(geraCustoAgora({ ...MRR_2000, cobrancaAtiva: false })).toBe(false);
    expect(geraCustoAgora({ ...MRR_2000, comissionavel: false })).toBe(false);
  });

  it("TCV sem billing_months é NULO — a view resolve isso com nullif", () => {
    expect(custoMensalDaParticipacao({ ...TCV_30000_EM_10, mesesDeCobranca: null }, 15)).toBeNull();
    expect(custoMensalDaParticipacao({ ...TCV_30000_EM_10, mesesDeCobranca: 0 }, 15)).toBeNull();
  });

  it("MRR sem valor mensal é NULO, não zero", () => {
    expect(custoMensalDaParticipacao({ ...MRR_2000, valorMensal: null }, 15)).toBeNull();
  });

  it("o total propaga o nulo em vez de somar como se a parcela fosse zero", () => {
    const base: BaseDeCusto = { ...TCV_30000_EM_10, mesesDeCobranca: null };
    expect(custoMensalTotal(base, [participacao("producao", 15)])).toBeNull();
  });
});

describe("somaDasParticipacoes e o teto — C1: global, nunca por tipo", () => {
  it("soma os TRÊS tipos, que é o que o addendum D1 errava", () => {
    const tres = [
      participacao("venda", 40),
      participacao("producao", 40),
      participacao("indicacao", 30),
    ];
    expect(somaDasParticipacoes(tres)).toBe(110);
    expect(excedeOTeto(tres)).toBe(true);
  });

  it("exatamente 100% passa — o teto é o limite, não a barreira", () => {
    const cheio = [participacao("venda", 60), participacao("producao", 40)];
    expect(somaDasParticipacoes(cheio)).toBe(TETO_DE_PARTICIPACAO);
    expect(excedeOTeto(cheio)).toBe(false);
  });

  it("contrato sem participação nenhuma soma zero", () => {
    expect(somaDasParticipacoes([])).toBe(0);
    expect(excedeOTeto([])).toBe(false);
  });

  it("a mensagem substitui o 23514 cru, que fala em id de contrato", () => {
    const msg = mensagemDeTetoExcedido([participacao("venda", 60), participacao("producao", 60)]);
    expect(msg).toContain("120%");
    expect(msg).toContain("venda, produção e indicação");
    expect(msg).not.toContain("23514");
  });
});

describe("CONTR-7 — soma em centésimos inteiros, nunca ponto flutuante ingênuo", () => {
  it("🔴 15 + 53,02 + 31,98 fecha em 100% exato: nem estoura, nem some sem alertar", () => {
    const tres = [
      participacao("producao", 15),
      participacao("venda", 53.02),
      participacao("indicacao", 31.98),
    ];
    expect(somaDasParticipacoes(tres)).toBe(100);
    expect(excedeOTeto(tres)).toBe(false);
    expect(atingiuOAlerta(tres, 60)).toBe(true);
  });

  it("varredura das 8.501 combinações de 2 casas que fecham 100% com o padrão de 15%: nenhuma estoura", () => {
    let combinacoes = 0;
    for (let centavos = 0; centavos <= 8500; centavos += 1) {
      const a = centavos / 100;
      const b = (8500 - centavos) / 100;
      const tres = [
        participacao("producao", 15),
        participacao("venda", a),
        participacao("indicacao", b),
      ];
      expect(excedeOTeto(tres)).toBe(false);
      expect(somaDasParticipacoes(tres)).toBe(100);
      combinacoes += 1;
    }
    expect(combinacoes).toBe(8501);
  });
});

describe("problemasDasParticipacoes — espelha a validação da RPC", () => {
  const externo = (nome: string | null, pct: number): Participacao => ({
    perfilId: null,
    nomeExterno: nome,
    tipo: "indicacao",
    percentual: pct,
  });

  it("linha em branco acusa os DOIS problemas, não só o primeiro", () => {
    const problemas = problemasDasParticipacoes([externo(null, 0)]);
    expect(problemas).toHaveLength(2);
    expect(problemas.map((p) => p.indice)).toEqual([0, 0]);
  });

  it("percentual zero é problema — o campo renderiza vazio nesse caso (CONTR-6)", () => {
    expect(problemasDasParticipacoes([participacao("venda", 0)])[0].mensagem).toBe(
      "Informe um percentual, ou remova a linha pela lixeira.",
    );
  });

  it("uma linha sozinha acima de 100% é recusada antes do banco", () => {
    expect(problemasDasParticipacoes([participacao("venda", 101)])[0].mensagem).toContain("100%");
  });

  it("mesma pessoa e mesmo tipo duas vezes: o banco recusaria pelo unique", () => {
    const problemas = problemasDasParticipacoes([
      participacao("venda", 10),
      participacao("venda", 20),
    ]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0].indice).toBe(1);
    expect(problemas[0].mensagem).toContain("Some os percentuais");
  });

  it("mesma pessoa em tipos DIFERENTES é legítimo", () => {
    expect(
      problemasDasParticipacoes([participacao("venda", 10), participacao("producao", 20)]),
    ).toEqual([]);
  });

  it("🔴 dois externos com nomes DIFERENTES não podem ser acusados", () => {
    expect(problemasDasParticipacoes([externo("Ana", 5), externo("Bruno", 5)])).toEqual([]);
  });

  it("nome externo só com espaços conta como ausente", () => {
    expect(problemasDasParticipacoes([externo("   ", 10)])[0].mensagem).toContain("Escolha quem");
  });

  it("lista válida não produz problema nenhum", () => {
    expect(problemasDasParticipacoes([participacao("producao", 15), externo("Ana", 5)])).toEqual(
      [],
    );
  });
});

describe("podeAplicarPadraoDaBu — 'não sei' nunca é 'não há'", () => {
  it("🔴 consulta PENDENTE não autoriza aplicar — foi o defeito crítico da F10", () => {
    expect(
      podeAplicarPadraoDaBu({
        padroesResolvidos: false,
        linhaDeNegocio: "sistemas",
        jaAplicadoPara: null,
      }),
    ).toBe(false);
  });

  it("consulta resolvida autoriza, e o resultado vazio é resposta legítima", () => {
    expect(
      podeAplicarPadraoDaBu({
        padroesResolvidos: true,
        linhaDeNegocio: "demanda",
        jaAplicadoPara: null,
      }),
    ).toBe(true);
  });

  it("não reaplica na mesma BU — senão o padrão voltaria a cada render", () => {
    expect(
      podeAplicarPadraoDaBu({
        padroesResolvidos: true,
        linhaDeNegocio: "sistemas",
        jaAplicadoPara: "sistemas",
      }),
    ).toBe(false);
  });

  it("trocar de BU reaplica — inclusive vindo de uma BU que tinha padrão", () => {
    expect(
      podeAplicarPadraoDaBu({
        padroesResolvidos: true,
        linhaDeNegocio: "sistemas",
        jaAplicadoPara: "demanda",
      }),
    ).toBe(true);
  });

  it("pendente continua bloqueando mesmo depois de já ter aplicado outra BU", () => {
    expect(
      podeAplicarPadraoDaBu({
        padroesResolvidos: false,
        linhaDeNegocio: "sistemas",
        jaAplicadoPara: "demanda",
      }),
    ).toBe(false);
  });
});

describe("atingiuOAlerta — o limiar vem de app_settings, não daqui", () => {
  it("alerta a partir do limiar, inclusive", () => {
    const seis = [participacao("venda", 60)];
    expect(atingiuOAlerta(seis, 60)).toBe(true);
    expect(atingiuOAlerta([participacao("venda", 59)], 60)).toBe(false);
  });

  it("acima do teto NÃO é alerta — é erro, e a tela já recusa", () => {
    expect(atingiuOAlerta([participacao("venda", 110)], 60)).toBe(false);
  });

  it("sem limiar configurado não inventa um", () => {
    expect(atingiuOAlerta([participacao("venda", 90)], null)).toBe(false);
  });
});

describe("padroesExcedemOTeto: a produção padrão que todo contrato novo da BU herda", () => {
  const ANA = "00000000-0000-4000-8000-000000000001";
  const BIA = "00000000-0000-4000-8000-000000000002";
  const CAIO = "00000000-0000-4000-8000-000000000003";
  const DUDA = "00000000-0000-4000-8000-000000000004";

  const padrao = (over: Partial<PadraoParaSoma> = {}): PadraoParaSoma => ({
    id: "p1",
    linhaDeNegocio: "sistemas",
    perfilId: ANA,
    tipo: "producao",
    percentual: 15,
    ...over,
  });

  it("15% sozinho cabe", () => {
    expect(padroesExcedemOTeto([], padrao())).toBe(false);
  });

  it("🔴 15% + 90% de produção na mesma BU estoura", () => {
    expect(
      padroesExcedemOTeto([padrao()], padrao({ id: "p2", perfilId: BIA, percentual: 90 })),
    ).toBe(true);
  });

  it("exatamente 100% cabe, sem resíduo de ponto flutuante (CONTR-7)", () => {
    const outros = [
      padrao({ id: "p3", perfilId: BIA, percentual: 53.02 }),
      padrao({ id: "p4", perfilId: CAIO, percentual: 31.98 }),
    ];
    expect(padroesExcedemOTeto(outros, padrao({ id: "p2", percentual: 15 }))).toBe(false);
  });

  it("a própria linha sai da soma: 15% editado para 20% ao lado de 80% dá 100%, não 115%", () => {
    const lista = [padrao({ percentual: 15 }), padrao({ id: "p2", perfilId: BIA, percentual: 80 })];
    expect(padroesExcedemOTeto(lista, padrao({ percentual: 20 }))).toBe(false);
    expect(padroesExcedemOTeto(lista, padrao({ percentual: 21 }))).toBe(true);
  });

  it("outra linha de negócio não entra na soma", () => {
    const lista = [padrao({ linhaDeNegocio: "demanda", perfilId: BIA, percentual: 90 })];
    expect(padroesExcedemOTeto(lista, padrao({ id: "p2", percentual: 15 }))).toBe(false);
  });

  it("venda e indicação não entram: o gatilho só aplica produção", () => {
    expect(
      padroesExcedemOTeto(
        [padrao({ tipo: "venda", perfilId: BIA, percentual: 90 })],
        padrao({ id: "p2" }),
      ),
    ).toBe(false);
    expect(
      padroesExcedemOTeto(
        [padrao()],
        padrao({ id: "p2", perfilId: BIA, tipo: "indicacao", percentual: 90 }),
      ),
    ).toBe(false);
  });

  it("padrão novo (id nulo) soma com todos os da BU", () => {
    expect(
      padroesExcedemOTeto([padrao()], padrao({ id: null, perfilId: BIA, percentual: 90 })),
    ).toBe(true);
  });

  it("somaDaProducaoPadrao devolve a soma que a mensagem mostra", () => {
    expect(
      somaDaProducaoPadrao([padrao()], padrao({ id: "p2", perfilId: BIA, percentual: 90 })),
    ).toBe(105);
  });

  describe("a mesma pessoa não conta duas vezes (a unique nunca deixaria as duas existirem)", () => {
    const ativas = [
      padrao({ id: "p1", perfilId: ANA, percentual: 60 }),
      padrao({ id: "p2", perfilId: BIA, percentual: 30 }),
    ];

    it("🔴 adicionar Ana (id nulo) que já está ativa: 60 sai, 50 entra, soma 80, não excede", () => {
      const candidato = padrao({ id: null, perfilId: ANA, percentual: 50 });

      expect(padroesExcedemOTeto(ativas, candidato)).toBe(false);
      expect(somaDaProducaoPadrao(ativas, candidato)).toBe(80);
    });

    it("o positivo ao lado: adicionar Caio (pessoa nova) 20% sobre 60 + 30 excede, 110", () => {
      const candidato = padrao({ id: null, perfilId: CAIO, percentual: 20 });

      expect(padroesExcedemOTeto(ativas, candidato)).toBe(true);
      expect(somaDaProducaoPadrao(ativas, candidato)).toBe(110);
    });

    it("🔴 trocar a pessoa da linha p2 (Bia 30) para Ana, que já tem 60: a Ana antiga sai da soma", () => {
      const candidato = padrao({ id: "p2", perfilId: ANA, percentual: 50 });

      expect(somaDaProducaoPadrao(ativas, candidato)).toBe(50);
      expect(padroesExcedemOTeto(ativas, candidato)).toBe(false);
    });

    it("o controle ao lado: trocar a Bia (30) para a Duda, ainda fora da BU, soma 60 + 50 e excede", () => {
      const candidato = padrao({ id: "p2", perfilId: DUDA, percentual: 50 });

      expect(somaDaProducaoPadrao(ativas, candidato)).toBe(110);
      expect(padroesExcedemOTeto(ativas, candidato)).toBe(true);
    });
  });
});

describe("problemaNoPercentualDoPadrao: a regra de `share_pct numeric(5,2)` com a frase da tela", () => {
  const FRASE = "O percentual precisa ser maior que 0 e no máximo 100, com até duas casas.";

  it.each([0, -1, 100.5, 1.005, Number.NaN, Number.POSITIVE_INFINITY])(
    "🔴 %s é recusado com a frase",
    (percentual) => {
      expect(problemaNoPercentualDoPadrao(percentual)).toBe(FRASE);
    },
  );

  it.each([100, 0.01, 53.02, 15, 99.99])("%s passa", (percentual) => {
    expect(problemaNoPercentualDoPadrao(percentual)).toBeNull();
  });
});

describe("problemaNoLimiarDeAlerta: o aviso de participação, com a frase da tela e do repositório", () => {
  const FRASE = "O aviso precisa ser maior que 0 e no máximo 100%.";

  it.each([0, -1, 100.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "🔴 %s é recusado com a frase",
    (percentual) => {
      expect(problemaNoLimiarDeAlerta(percentual)).toBe(FRASE);
    },
  );

  it.each([100, 0.01, 60, 70.5, 33.333])("%s passa", (percentual) => {
    expect(problemaNoLimiarDeAlerta(percentual)).toBeNull();
  });
});

describe("recusaDoTetoDoPadrao: a frase que a tela e o repositório mostram", () => {
  const ANA = "00000000-0000-4000-8000-000000000001";
  const BIA = "00000000-0000-4000-8000-000000000002";

  const padrao = (over: Partial<PadraoParaSoma> = {}): PadraoParaSoma => ({
    id: "p1",
    linhaDeNegocio: "sistemas",
    perfilId: ANA,
    tipo: "producao",
    percentual: 15,
    ...over,
  });

  it("🔴 acima do teto devolve a frase, com a soma em pt-BR e a linha de negócio por extenso", () => {
    expect(
      recusaDoTetoDoPadrao([padrao()], padrao({ id: "p2", perfilId: BIA, percentual: 90.5 })),
    ).toBe(
      "A produção padrão de Sistemas somaria 105,5%. Acima de 100%, todo contrato novo dessa linha seria recusado.",
    );
  });

  it("o rótulo vem da linha do candidato", () => {
    expect(
      recusaDoTetoDoPadrao(
        [padrao({ linhaDeNegocio: "demanda" })],
        padrao({ id: "p2", linhaDeNegocio: "demanda", perfilId: BIA, percentual: 90 }),
      ),
    ).toMatch(/^A produção padrão de Demanda somaria 105%\./);
  });

  it("o positivo ao lado: cabendo, e exatamente 100%, devolve null", () => {
    expect(
      recusaDoTetoDoPadrao([padrao()], padrao({ id: "p2", perfilId: BIA, percentual: 85 })),
    ).toBeNull();
    expect(recusaDoTetoDoPadrao([], padrao({ percentual: 100 }))).toBeNull();
  });

  it("tipo que não é produção nunca é recusado pela soma", () => {
    expect(
      recusaDoTetoDoPadrao(
        [padrao()],
        padrao({ id: "p2", perfilId: BIA, tipo: "venda", percentual: 99 }),
      ),
    ).toBeNull();
  });
});
